import { supabase } from './supabase';

// ── Attraction scoring: materialize implicit behavioral patterns ──────────
// In-memory attraction graph: source_id → target_id → weight
// This tracks behavioral drift without needing database setup (hackathon-friendly)
const attractionGraph = new Map<string, Map<string, number>>();

// Pending database writes (batched for performance)
let pendingWrites = new Map<string, { source_id: string; target_id: string; weight: number }>();
let flushTimeout: number | null = null;

/**
 * Check if a user ID is a demo user (not in database)
 */
function isDemoUser(userId: string): boolean {
  return userId.startsWith('demo-');
}

/**
 * Flush pending attraction updates to database in a single batch
 * Filters out demo users to avoid foreign key constraint violations
 */
async function flushAttractionUpdates(): Promise<void> {
  if (pendingWrites.size === 0) return;
  
  // Filter out demo users - they exist only in local state until promoted
  const batch = Array.from(pendingWrites.values())
    .filter(update => !isDemoUser(update.source_id))
    .map(update => ({
      ...update,
      updated_at: new Date().toISOString(),
    }));
  
  pendingWrites.clear();
  
  if (batch.length === 0) return; // All updates were for demo users
  
  // Single batch upsert for all pending updates
  const { error } = await supabase.from('attractions').upsert(batch);
  if (error) {
    console.error('Failed to flush attractions:', error);
  }
}

/**
 * Schedule a flush if not already scheduled
 */
function scheduleFlush(): void {
  if (flushTimeout) return;
  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    flushAttractionUpdates();
  }, 2000); // Batch writes every 2 seconds
}

/**
 * Update attraction between a source (user/bot) and target (topic/user).
 * This drives live graph reconfiguration based on behavior, not just topology.
 * 
 * Attraction accumulates from:
 * - Likes (strong: +1.0 per like)
 * - Exposure (weak: +0.02 per impression, saturating)
 * - Posts (gravity wells: +2.0 for opinionated bots)
 * 
 * Now batches writes to database for performance.
 */
async function updateAttraction(
  sourceId: string,
  targetId: string,
  delta: number
): Promise<void> {
  // Update in-memory graph immediately (works for both demo and real users)
  if (!attractionGraph.has(sourceId)) {
    attractionGraph.set(sourceId, new Map());
  }
  const targets = attractionGraph.get(sourceId)!;
  const newWeight = (targets.get(targetId) || 0) + delta;
  targets.set(targetId, newWeight);

  // Queue database write only for real users (not demo users)
  if (!isDemoUser(sourceId)) {
    const key = `${sourceId}:${targetId}`;
    pendingWrites.set(key, {
      source_id: sourceId,
      target_id: targetId,
      weight: newWeight,
    });
    
    scheduleFlush();
  }
}

/**
 * Decay attractions over time to prevent unbounded growth.
 * This keeps the echo chamber effect dynamic and allows for preference shifts.
 * Demo users are tracked in-memory but not persisted to database.
 */
function decayAttraction(agentId: string, factor = 0.98): void {
  const profile = attractionGraph.get(agentId);
  if (!profile) return;

  const isDemo = isDemoUser(agentId);

  for (const [targetId, weight] of profile) {
    const decayed = weight * factor;
    if (decayed < 0.05) {
      profile.delete(targetId);
      if (!isDemo) {
        // Queue deletion in database (only for real users)
        pendingWrites.delete(`${agentId}:${targetId}`);
      }
    } else {
      profile.set(targetId, decayed);
      if (!isDemo) {
        // Queue update in database (only for real users)
        const key = `${agentId}:${targetId}`;
        pendingWrites.set(key, {
          source_id: agentId,
          target_id: targetId,
          weight: decayed,
        });
      }
    }
  }
  
  if (!isDemo) {
    scheduleFlush();
  }
}

/**
 * Get attraction scores for any agent (for graph/feed integration)
 */
export function getUserAttractions(userId: string): Map<string, number> {
  return attractionGraph.get(userId) || new Map();
}

/**
 * Transfer attractions from demo user to real user when promoted.
 * Call this after promoting a demo user to persist their history.
 */
export async function transferDemoAttractions(demoUserId: string, realUserId: string): Promise<void> {
  const demoAttractions = attractionGraph.get(demoUserId);
  if (!demoAttractions || demoAttractions.size === 0) return;

  // Copy to new user ID in memory
  attractionGraph.set(realUserId, new Map(demoAttractions));
  
  // Persist to database (batch upsert)
  const batch = Array.from(demoAttractions.entries()).map(([targetId, weight]) => ({
    source_id: realUserId,
    target_id: targetId,
    weight: weight,
    updated_at: new Date().toISOString(),
  }));

  if (batch.length > 0) {
    const { error } = await supabase.from('attractions').upsert(batch);
    if (error) {
      console.error('Failed to transfer demo attractions:', error);
    } else {
      console.log(`✓ Transferred ${batch.length} attractions from demo → ${realUserId}`);
    }
  }

  // Clean up old demo user
  attractionGraph.delete(demoUserId);
}

/**
 * Get all attraction data (for debugging/metrics)
 */
export function getAllAttractions(): Map<string, Map<string, number>> {
  return attractionGraph;
}

/**
 * Initialize attraction graph from database.
 * This ensures users/bots retain their attraction history across sessions.
 */
export async function initializeAttractionGraph(): Promise<void> {
  console.log('Initializing attraction graph from database...');
  
  // Clear existing (for hot reload)
  attractionGraph.clear();

  // 1. Load ALL attraction data from database (primary source of truth)
  const { data: attractions } = await supabase
    .from('attractions')
    .select('source_id, target_id, weight');

  if (attractions && attractions.length > 0) {
    attractions.forEach(a => {
      if (!attractionGraph.has(a.source_id)) {
        attractionGraph.set(a.source_id, new Map());
      }
      attractionGraph.get(a.source_id)!.set(a.target_id, a.weight);
    });
    console.log(`Loaded ${attractions.length} attraction records from database`);
  } else {
    console.log('No existing attractions - will seed from historical data');
    
    // FALLBACK: If database is empty, seed from likes (one-time migration)
    const { data: likes } = await supabase
      .from('likes')
      .select('user_id, posts(topic_tags)');

    if (likes) {
      const updates: Promise<void>[] = [];
      likes.forEach(like => {
        const tags = (like.posts as unknown as { topic_tags: string[] } | null)?.topic_tags;
        if (!tags) return;
        
        tags.forEach(tag => {
          const canonical = normalizeToCanonical(tag.replace(/^#/, ''));
          updates.push(updateAttraction(like.user_id, `topic:${canonical}`, 1.0));
        });
      });
      await Promise.all(updates);
      console.log(`Seeded ${updates.length} attractions from historical likes`);
    }
  }

  // 2. Ensure opinionated bots always have their ideological anchors
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, is_bot')
    .eq('is_bot', true)
    .is('expires_at', null);

  if (users) {
    const botUpdates: Promise<void>[] = [];
    users.forEach(bot => {
      const persona = BOT_PERSONAS[bot.display_name];
      if (persona) {
        // Check if bot already has attraction data
        const existing = attractionGraph.get(bot.id);
        const needsSeed = !existing || existing.size === 0;
        
        if (needsSeed) {
          // Opinionated bots = gravity wells
          persona.hashtags.forEach(tag => {
            botUpdates.push(updateAttraction(bot.id, `topic:${tag}`, 3.0));
          });
        }
      }
    });
    if (botUpdates.length > 0) {
      await Promise.all(botUpdates);
      console.log(`Seeded ${botUpdates.length} bot attractions`);
    }
  }

  // 3. Track existing drifters
  const now = new Date().toISOString();
  const { data: drifters } = await supabase
    .from('users')
    .select('id')
    .not('expires_at', 'is', null)
    .gt('expires_at', now);

  drifters?.forEach(d => activeDrifters.add(d.id));

  const attractionCount = Array.from(attractionGraph.values())
    .reduce((sum, targets) => sum + targets.size, 0);
  console.log(`Initialized ${attractionGraph.size} agents with ${attractionCount} attraction edges`);
}

// Map any topic to its canonical cluster
export const normalizeToCanonical = (topic: string): string => {
  const map: Record<string, string> = {
    fitness: 'fitness', workout: 'fitness', gains: 'fitness', gym: 'fitness',
    motivation: 'fitness', mealprep: 'fitness', health: 'fitness', protein: 'fitness',
    tech: 'tech', ai: 'tech', coding: 'tech', programming: 'tech',
    innovation: 'tech', automation: 'tech', developers: 'tech', devlife: 'tech',
    crypto: 'crypto', bitcoin: 'crypto', blockchain: 'crypto', defi: 'crypto',
    hodl: 'crypto', investing: 'crypto',
    politics: 'politics', progressive: 'politics', conservative: 'politics',
    justice: 'politics', equality: 'politics', healthcare: 'politics',
    change: 'politics', reform: 'politics', workers: 'politics',
    values: 'politics', freedom: 'politics', family: 'politics',
    tradition: 'politics', liberty: 'politics',
    climate: 'climate', environment: 'climate', sustainability: 'climate',
    green: 'climate', action: 'climate', activism: 'climate',
    gaming: 'gaming', esports: 'gaming', streaming: 'gaming',
    games: 'gaming', streamer: 'gaming', pc: 'gaming', battlestation: 'gaming',
    food: 'food', cooking: 'food', recipe: 'food',
    foodie: 'food', chef: 'food', italian: 'food', baking: 'food', recipes: 'food',
    wellness: 'wellness', meditation: 'wellness', mindfulness: 'wellness',
    peace: 'wellness', selfcare: 'wellness', zen: 'wellness',
    conspiracy: 'conspiracy', truth: 'conspiracy', wakeup: 'conspiracy',
    question: 'conspiracy', research: 'conspiracy', aware: 'conspiracy', skeptic: 'conspiracy',
  };
  return map[topic.toLowerCase()] || topic.toLowerCase();
};

/**
 * Internal: Get topic profile for ANY agent (bot, drifter, user).
 * This is the ONLY source of truth for "what this agent is attracted to".
 * Everything downstream (feed, graph, clustering) reads from this.
 */
function getAgentTopicProfile(agentId: string): Map<string, number> {
  return attractionGraph.get(agentId) || new Map();
}

// ── Opinionated bot personas (permanent, strongly biased) ──────────────────
const BOT_PERSONAS: Record<string, { topics: string[]; templates: string[]; hashtags: string[]; opinionated: true }> = {
  'FitLife_Mike': {
    opinionated: true,
    topics: ['fitness'], // Demo: canonical only
    templates: [
      "Just crushed leg day! Nothing like the burn of a good squat session. #fitness #gains",
      "Reminder: You don't need motivation, you need discipline. Get up and move! #workout #motivation",
      "Hot take: Rest days are just as important as training days. Your muscles grow when you rest! #fitness",
      "5AM workout crew, where you at? Early bird gets the gains! #gym #grindset",
      "Meal prep Sunday is the secret to a successful fitness week. No excuses! #mealprep #fitness"
    ],
    hashtags: ['fitness'] // Demo: canonical only
  },
  'TechNerd_Sarah': {
    opinionated: true,
    topics: ['tech'], // Demo: canonical only
    templates: [
      "Just spent 3 hours debugging only to find a missing semicolon. Classic. #coding #devlife",
      "The new AI models are getting scary good. Are we ready for this? #ai #tech",
      "Hot take: Tabs > Spaces. Fight me in the comments. #coding #developers",
      "Finally automated that tedious task. This is why I love programming! #automation #tech",
      "Reading through legacy code is like archaeology but with more crying. #programming #coding"
    ],
    hashtags: ['tech'] // Demo: canonical only
  },
  'ProgressiveVoice': {
    opinionated: true,
    topics: ['politics'], // Demo: canonical only
    templates: [
      "Healthcare is a human right, not a privilege. When will we learn? #healthcare #progressive",
      "The climate crisis won't wait for us to get comfortable. Action needed NOW. #climate #action",
      "Imagine a world where everyone has equal opportunities. Let's build it. #equality #justice",
      "Workers deserve living wages. This shouldn't be controversial. #workers #progressive",
      "Education should lift people up, not burden them with debt. #education #reform"
    ],
    hashtags: ['politics'] // Demo: canonical only
  },
  'TraditionFirst': {
    opinionated: true,
    topics: ['politics'], // Demo: canonical only
    templates: [
      "Strong families build strong communities. Never forget our roots. #family #values",
      "Personal responsibility is the foundation of a free society. #freedom #conservative",
      "Some things are worth preserving. Tradition gives us wisdom. #tradition #values",
      "Small government, big opportunity. Let people thrive! #freedom #liberty",
      "Faith, family, and hard work. The values that built this nation. #conservative #values"
    ],
    hashtags: ['politics'] // Demo: canonical only
  },
  'CryptoKing99': {
    opinionated: true,
    topics: ['crypto'], // Demo: canonical only
    templates: [
      "WAGMI! This dip is a buying opportunity. Diamond hands only! #crypto #hodl",
      "Banks are obsolete. DeFi is the future and they know it. #defi #crypto",
      "Not your keys, not your coins. Stay safe out there! #bitcoin #crypto",
      "The next bull run will be legendary. Are you positioned? #crypto #bitcoin",
      "Blockchain technology will revolutionize everything. We're still early! #blockchain #tech"
    ],
    hashtags: ['crypto'] // Demo: canonical only
  },
  'ZenMaster_Luna': {
    opinionated: true,
    topics: ['wellness'], // Demo: canonical only
    templates: [
      "Started my day with 20 minutes of silence. The mind is clearer than ever. #meditation #peace",
      "Your breath is your anchor. When lost, return to it. #mindfulness #wellness",
      "Peace is not the absence of chaos, but the presence of calm within it. #zen #meditation",
      "Gratitude practice: What are three things you're thankful for today? #wellness #mindfulness",
      "The present moment is all we truly have. Embrace it fully. #mindfulness #peace"
    ],
    hashtags: ['wellness'] // Demo: canonical only
  },
  'xX_Gamer_Xx': {
    opinionated: true,
    topics: ['gaming'], // Demo: canonical only
    templates: [
      "Just hit a new personal best! The grind never stops. #gaming #esports",
      "That new game update is actually fire. Who's playing tonight? #gaming #games",
      "Streaming later, come hang! Gonna be a wild session. #streaming #gaming",
      "Hot take: Single player games > multiplayer. Quality over chaos. #gaming #unpopular",
      "My setup is finally complete. RGB everything, no regrets. #gaming #battlestation"
    ],
    hashtags: ['gaming'] // Demo: canonical only
  },
  'ChefAntonio': {
    opinionated: true,
    topics: ['food'], // Demo: canonical only
    templates: [
      "The secret to perfect pasta? Salt your water like the Mediterranean! #cooking #italian",
      "Made fresh bread today. The smell alone is worth the effort. #baking #food",
      "Unpopular opinion: Simple ingredients, prepared well, beat complexity every time. #cooking #chef",
      "Sunday sauce simmering all day. This is what life is about. #food #italian",
      "Good olive oil is not optional, it's essential. Invest in quality! #cooking #foodie"
    ],
    hashtags: ['food'] // Demo: canonical only
  },
  'EcoWarrior_Greta': {
    opinionated: true,
    topics: ['climate'], // Demo: canonical only
    templates: [
      "Every plastic bottle takes 450 years to decompose. Choose reusable. #environment #sustainability",
      "The science is clear. Climate action cannot wait. #climate #action",
      "Small changes matter. What's one eco-friendly swap you've made? #green #sustainability",
      "Renewable energy is now cheaper than fossil fuels. The transition is inevitable. #climate #green",
      "Our planet doesn't need saving. Our habits do. #environment #change"
    ],
    hashtags: ['climate'] // Demo: canonical only
  },
  'TruthSeeker42': {
    opinionated: true,
    topics: ['conspiracy'], // Demo: canonical only
    templates: [
      "Why doesn't anyone talk about this? Do your own research. #truth #wakeup",
      "The mainstream narrative doesn't add up. Connect the dots. #question #research",
      "They want you distracted. Stay vigilant, stay informed. #truth #aware",
      "Coincidences don't exist at this level. Think about it. #conspiracy #wakeup",
      "Question everything you're told. The truth is out there. #truth #research"
    ],
    hashtags: ['conspiracy'] // Demo: canonical only
  }
};

// ── Drifter bot names & avatars (look like real users) ─────────────────────
const DRIFTER_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey',
  'Riley', 'Quinn', 'Avery', 'Parker', 'Drew',
  'Sam', 'Jamie', 'Reese', 'Skyler', 'Dakota',
  'Charlie', 'Frankie', 'Emery', 'Sage', 'Rowan',
  'Kai', 'Hayden', 'Finley', 'Nico', 'Ezra',
  'Mika', 'Jules', 'Ariel', 'Robin', 'Eden',
  'Noa', 'Luca', 'Jude', 'River', 'Wren',
  'Felix', 'Leo', 'Milo', 'Iris', 'Luna',
  'Zara', 'Noor', 'Yuki', 'Soren', 'Asha',
];

const DRIFTER_AVATAR_CONFIGS = [
  { face_shape: 'round', skin_color: '#e8beac', hair_style: 'short', hair_color: '#4a3728', eye_style: 'round', eye_color: '#4a3728', mouth_style: 'smile', accessory: 'none' },
  { face_shape: 'oval', skin_color: '#d4a373', hair_style: 'curly', hair_color: '#1a1a1a', eye_style: 'almond', eye_color: '#4a3728', mouth_style: 'smile', accessory: 'none' },
  { face_shape: 'square', skin_color: '#f5d0c5', hair_style: 'long', hair_color: '#8b4513', eye_style: 'wide', eye_color: '#1e90ff', mouth_style: 'grin', accessory: 'glasses' },
  { face_shape: 'heart', skin_color: '#c68642', hair_style: 'ponytail', hair_color: '#2c1810', eye_style: 'almond', eye_color: '#228b22', mouth_style: 'smile', accessory: 'none' },
  { face_shape: 'round', skin_color: '#8d5524', hair_style: 'short', hair_color: '#222222', eye_style: 'round', eye_color: '#4a3728', mouth_style: 'grin', accessory: 'none' },
  { face_shape: 'oval', skin_color: '#f5d0c5', hair_style: 'curly', hair_color: '#b8860b', eye_style: 'wide', eye_color: '#1e90ff', mouth_style: 'smile', accessory: 'sunglasses' },
  { face_shape: 'round', skin_color: '#e8beac', hair_style: 'long', hair_color: '#222222', eye_style: 'almond', eye_color: '#4a3728', mouth_style: 'small', accessory: 'earring' },
  { face_shape: 'heart', skin_color: '#d4a373', hair_style: 'mohawk', hair_color: '#8b0000', eye_style: 'narrow', eye_color: '#228b22', mouth_style: 'grin', accessory: 'none' },
  { face_shape: 'square', skin_color: '#c68642', hair_style: 'short', hair_color: '#333333', eye_style: 'round', eye_color: '#4a3728', mouth_style: 'smile', accessory: 'hat' },
  { face_shape: 'oval', skin_color: '#8d5524', hair_style: 'ponytail', hair_color: '#1a1a1a', eye_style: 'wide', eye_color: '#1e90ff', mouth_style: 'smile', accessory: 'none' },
];

const DRIFTER_LIFESPAN_MS = 2 * 60 * 1000; // 2 minutes (demo: faster turnover)
const DRIFTER_SPAWN_INTERVAL_MS = 30 * 1000; // 30 seconds (demo: rapid spawning)
const MAX_DRIFTERS = 8; // Increased from 6 for more activity

// Topic clusters for drifter seeding (DEMO: canonical topics only)
// Each drifter gets seeded toward one of the 9 echo chambers
const DRIFTER_SEED_CLUSTERS = [
  ['fitness'],
  ['tech'],
  ['crypto'],
  ['politics'],
  ['climate'],
  ['gaming'],
  ['food'],
  ['wellness'],
  ['conspiracy'],
];

/**
 * Feed recommendation: scores posts by attraction overlap.
 * This is the ONLY algorithm — works for ALL agents.
 */
function getRecommendedPosts(
  posts: { id: string; topic_tags: string[]; user_id: string }[],
  agentId: string
): { id: string; topic_tags: string[]; affinity: number }[] {
  const candidates = posts.filter(p => p.user_id !== agentId);
  const attraction = getAgentTopicProfile(agentId);

  if (attraction.size === 0) {
    // No preferences yet - equal affinity
    return candidates.map(p => ({ ...p, affinity: 1 }));
  }

  const maxAttraction = Math.max(...Array.from(attraction.values()).filter(v => v > 0), 1);
  const totalAttraction = Array.from(attraction.values()).reduce((a, b) => a + b, 0);
  // Echo strength ramps up quickly
  const echoStrength = Math.min(totalAttraction / 3, 1);

  const scored = candidates.map(post => {
    const tags = post.topic_tags || [];
    let score = 0;
    let hasMatchingTag = false;

    for (const tag of tags) {
      const canonical = normalizeToCanonical(tag);
      const attractionWeight = attraction.get(`topic:${canonical}`) || 0;
      if (attractionWeight > 0) hasMatchingTag = true;
      score += attractionWeight;
    }

    // Non-matching content gets suppressed
    if (!hasMatchingTag) {
      const baseVisibility = Math.max(0.1, 0.5 * (1 - echoStrength));
      return { id: post.id, topic_tags: post.topic_tags, affinity: baseVisibility };
    }

    // Normalize and boost matching content
    const maxPossible = maxAttraction * Math.max(tags.length, 1);
    const normalized = maxPossible > 0 ? score / maxPossible : 0;
    const boost = 0.6 + (normalized * 0.4);
    const affinity = Math.min(1, boost + (echoStrength * 0.15));

    return { id: post.id, topic_tags: post.topic_tags, affinity };
  });

  scored.sort((a, b) => b.affinity - a.affinity);
  return scored;
}

// ── Drifter bot management ─────────────────────────────────────────────────
const activeDrifters = new Set<string>(); // track drifter IDs for liking loop

// No more drifterExposure — attraction IS the memory

async function spawnDrifters(): Promise<void> {
  const now = new Date().toISOString();

  // Query the DB for currently alive drifters (identified by having expires_at)
  const { data: liveDrifters } = await supabase
    .from('users')
    .select('id')
    .not('expires_at', 'is', null)
    .gt('expires_at', now);

  const liveCount = liveDrifters?.length ?? 0;

  // Sync activeDrifters set with DB reality
  activeDrifters.clear();
  liveDrifters?.forEach(d => activeDrifters.add(d.id));

  if (liveCount >= MAX_DRIFTERS) {
    console.log(`Drifter cap reached (${liveCount}/${MAX_DRIFTERS}), skipping spawn`);
    return;
  }

  const maxToSpawn = MAX_DRIFTERS - liveCount;
  const count = Math.min(3, maxToSpawn); // Fixed count of 3 for deterministic behavior

  for (let i = 0; i < count; i++) {
    const name = DRIFTER_NAMES[Math.floor(Math.random() * DRIFTER_NAMES.length)] +
      '_' + Math.floor(Math.random() * 100);
    const avatar = DRIFTER_AVATAR_CONFIGS[Math.floor(Math.random() * DRIFTER_AVATAR_CONFIGS.length)];
    const expiresAt = new Date(Date.now() + DRIFTER_LIFESPAN_MS).toISOString();

    const { data, error } = await supabase
      .from('users')
      .insert({
        display_name: name,
        avatar_config: avatar,
        is_bot: false, // Drifters look like real users
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (!error && data) {
      activeDrifters.add(data.id);

      // Seed drifter with initial attraction toward one cluster
      // Light initial preference - let their likes build the real identity
      const seedCluster = DRIFTER_SEED_CLUSTERS[Math.floor(Math.random() * DRIFTER_SEED_CLUSTERS.length)];
      await Promise.all(seedCluster.map(tag => 
        updateAttraction(data.id, `topic:${tag}`, 2.0) // Reduced from 12-19 to 2.0
      ));

      // Immediately like 2-4 posts matching their seed cluster
      const seedTopic = seedCluster[0];
      const { data: seedPosts } = await supabase
        .from('posts')
        .select('id, topic_tags')
        .contains('topic_tags', [seedTopic])
        .order('created_at', { ascending: false })
        .limit(10);

      if (seedPosts?.length) {
        const shuffled = seedPosts.sort(() => Math.random() - 0.5);
        const toLike = shuffled.slice(0, 2 + Math.floor(Math.random() * 3));
        for (const post of toLike) {
          await supabase
            .from('likes')
            .upsert({ user_id: data.id, post_id: post.id });
        }
        console.log(`"${name}" joined, interested in #${seedTopic} (liked ${toLike.length} posts)`);
      } else {
        console.log(`"${name}" joined, interested in #${seedTopic} (no posts to like yet)`);
      }
    }
  }
}

/**
 * Drifter engages with content. Uses unified attraction-based feed.
 */
async function runDrifterLike(drifterId: string): Promise<void> {
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('id, topic_tags, user_id')
    .neq('user_id', drifterId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!recentPosts?.length) return;

  const { data: existingLikes } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', drifterId);

  const alreadyLiked = new Set((existingLikes || []).map(l => l.post_id));

  const recommended = getRecommendedPosts(recentPosts, drifterId)
    .filter(p => !alreadyLiked.has(p.id));

  if (recommended.length === 0) return;

  // ── Pick a post to like (DETERMINISTIC: always pick highest affinity) ──
  // No exposure tracking, no randomness - outcomes based EXCLUSIVELY on likes
  const chosen = recommended[0]; // Already sorted by affinity in getRecommendedPosts

  const { error } = await supabase
    .from('likes')
    .upsert({ user_id: drifterId, post_id: chosen.id });

  if (!error) {
    // ── Step 3: Likes = ONLY signal (no exposure, no social gravity) ──
    const likeUpdates: Promise<void>[] = [];
    for (const tag of chosen.topic_tags || []) {
      const canonical = normalizeToCanonical(tag.replace(/^#/, ''));
      likeUpdates.push(updateAttraction(drifterId, `topic:${canonical}`, 1.0));
    }
    // NO user-to-user attraction - outcomes based EXCLUSIVELY on topic likes
    await Promise.all(likeUpdates);

    const attraction = getAgentTopicProfile(drifterId);
    const topTopics = Array.from(attraction.entries())
      .filter(([id]) => id.startsWith('topic:'))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, w]) => `${id.slice(6)}(${w.toFixed(1)})`);
    console.log(
      `Drifter liked (affinity: ${chosen.affinity.toFixed(2)}, ` +
      `tags: ${chosen.topic_tags?.join(', ')}, ` +
      `attraction: ${topTopics.join(', ')})`
    );
  }
}

/**
 * Select a bot DETERMINISTICALLY based on aggregate user interests.
 * No randomness - always pick the bot whose topics most align with user likes.
 */
function selectWeightedBot(bots: { id: string; display_name: string }[]): { id: string; display_name: string } {
  // Calculate aggregate topic interests from all active users
  const aggregateInterests = new Map<string, number>();
  
  for (const [userId, userAttractions] of attractionGraph) {
    // Skip bots themselves and demo users
    if (isDemoUser(userId)) continue;
    
    for (const [targetId, weight] of userAttractions) {
      if (targetId.startsWith('topic:')) {
        const topic = targetId.slice(6);
        aggregateInterests.set(topic, (aggregateInterests.get(topic) || 0) + weight);
      }
    }
  }

  // If no user interests yet, cycle through bots round-robin
  if (aggregateInterests.size === 0) {
    // Use timestamp to get deterministic but varied selection
    return bots[Date.now() % bots.length];
  }

  // Calculate bot weights based on topic alignment
  const botWeights = bots.map(bot => {
    const persona = BOT_PERSONAS[bot.display_name];
    if (!persona) return { bot, weight: 0 };

    // Bot weight = sum of user interest in bot's topics
    let weight = 0;
    for (const topic of persona.topics) {
      weight += aggregateInterests.get(topic) || 0;
    }

    return { bot, weight };
  });

  // DETERMINISTIC selection: always pick bot with highest weight
  botWeights.sort((a, b) => b.weight - a.weight);
  return botWeights[0].bot;
}

// ── Opinionated bot run (post + like) ──────────────────────────────────────
export async function runBot(): Promise<boolean> {
  try {
    // Get a random opinionated (permanent) bot
    const { data: bots, error: botsError } = await supabase
      .from('users')
      .select('id, display_name')
      .eq('is_bot', true)
      .is('expires_at', null);

    if (botsError || !bots?.length) {
      console.error('No bots found:', botsError);
      return false;
    }

    // Weight bot selection by aggregate user interests (make bots responsive to the community)
    const bot = selectWeightedBot(bots);
    const persona = BOT_PERSONAS[bot.display_name];

    if (!persona) {
      console.error(`No persona for ${bot.display_name}`);
      return false;
    }

    // Seed opinionated bot attraction ONCE (not every cycle)
    // Check if already seeded to prevent infinite gravity wells
    const botProfile = attractionGraph.get(bot.id);
    const needsSeeding = !botProfile || persona.hashtags.some(tag => !botProfile.has(`topic:${tag}`));
    
    if (needsSeeding) {
      // Moderate initial values - let likes build the identity organically
      await Promise.all(persona.hashtags.map(tag => 
        updateAttraction(bot.id, `topic:${tag}`, 5.0)
      ));
    }

    // Pick a random template
    const content = persona.templates[Math.floor(Math.random() * persona.templates.length)];

    // Extract hashtags and normalize to canonical topics for demo
    const hashtagMatches = content.match(/#\w+/g) || [];
    const topicTags = hashtagMatches
      .map(tag => tag.slice(1).toLowerCase())
      .map(tag => normalizeToCanonical(tag));

    // Insert post
    const { error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: bot.id,
        content,
        topic_tags: topicTags,
      });

    if (postError) {
      console.error('Failed to create post:', postError);
      return false;
    }

    // ── Step 5: Opinionated bots reinforce through posts ──
    // Moderate reinforcement - primary signal comes from likes
    await Promise.all(topicTags.map(tag => 
      updateAttraction(bot.id, `topic:${tag}`, 1.0)
    ));

    console.log(`Bot ${bot.display_name} posted: ${content.slice(0, 50)}...`);

    // Opinionated bots like content aligned with their ideology
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('id, topic_tags, user_id')
      .neq('user_id', bot.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (recentPosts?.length) {
      const { data: existingLikes } = await supabase
        .from('likes')
        .select('post_id')
        .eq('user_id', bot.id);

      const alreadyLiked = new Set((existingLikes || []).map(l => l.post_id));

      const recommended = getRecommendedPosts(recentPosts, bot.id)
        .filter(p => !alreadyLiked.has(p.id))
        .filter(p => p.affinity > 0.3); // Demo: less picky (was 0.6), more echo chambering

      if (recommended.length > 0) {
        // DETERMINISTIC: always pick the highest-affinity post
        const chosen = recommended[0];

        const { error: likeError } = await supabase
          .from('likes')
          .upsert({ user_id: bot.id, post_id: chosen.id });

        if (!likeError) {
          console.log(
            `Bot ${bot.display_name} liked post (affinity: ${chosen.affinity.toFixed(2)}, ` +
            `tags: ${chosen.topic_tags?.join(', ')})`
          );
        }
      }
    }

    return true;
  } catch (err) {
    console.error('Bot runner error:', err);
    return false;
  }
}

// ── Cleanup expired drifters from the database ────────────────────────────
async function cleanupExpiredDrifters(): Promise<void> {
  const now = new Date().toISOString();

  const { data: deleted, error } = await supabase
    .from('users')
    .delete()
    .not('expires_at', 'is', null)
    .lt('expires_at', now)
    .select('id, display_name');

  if (!error && deleted && deleted.length > 0) {
    deleted.forEach(d => {
      activeDrifters.delete(d.id);
      // Clean up attraction state
      attractionGraph.delete(d.id);
      console.log(`Cleaned up expired drifter: ${d.display_name}`);
    });
  }
}

// ── Main loops ─────────────────────────────────────────────────────────────
let botInterval: number | null = null;
let drifterSpawnInterval: number | null = null;
let drifterLikeInterval: number | null = null;
let cleanupInterval: number | null = null;
let decayInterval: number | null = null;

export function startBotLoop() {
  if (botInterval) return;

  // Initialize attraction graph from database FIRST
  initializeAttractionGraph().then(() => {
    console.log('Attraction graph ready');
  });

  if (botInterval) return;

  // Opinionated bot posting loop (fixed 10s interval for deterministic behavior)
  const scheduleNext = () => {
    const delay = 10000; // Fixed interval
    botInterval = window.setTimeout(async () => {
      await runBot();
      scheduleNext();
    }, delay);
  };

  runBot().then(scheduleNext);
  console.log('Bot loop started');

  // Cleanup expired drifters immediately and every 10 seconds
  cleanupExpiredDrifters();
  cleanupInterval = window.setInterval(cleanupExpiredDrifters, 10000);

  // Spawn a batch of drifters immediately, then every 30s (demo: rapid)
  spawnDrifters();
  drifterSpawnInterval = window.setInterval(spawnDrifters, DRIFTER_SPAWN_INTERVAL_MS);

  // Drifter like loop — every 1.5s (demo: very active)
  // ALL drifters consider liking to build database fast for echo chamber detection
  drifterLikeInterval = window.setInterval(async () => {
    const drifterIds = Array.from(activeDrifters);
    if (drifterIds.length === 0) return;

    // Deterministic engagement: cycle through drifters
    const cycleIndex = Math.floor(Date.now() / 1500) % Math.max(drifterIds.length, 1);
    const drifterId = drifterIds[cycleIndex];
    if (drifterId) {
      await runDrifterLike(drifterId);
      // Decay drifter attractions slightly after each action to prevent unbounded growth
      decayAttraction(drifterId, 0.99);
    }
  }, 1500);

  // Global decay for all agents every 30s to prevent attraction explosion
  // Lighter decay to preserve like-based preferences longer
  decayInterval = window.setInterval(() => {
    for (const [agentId] of attractionGraph) {
      const isDrifter = activeDrifters.has(agentId);
      // Drifters decay normally, others decay very lightly to preserve like history
      const decayFactor = isDrifter ? 0.98 : 0.995;
      decayAttraction(agentId, decayFactor);
    }
  }, 30000);
}

export function stopBotLoop() {
  if (botInterval) {
    clearTimeout(botInterval);
    botInterval = null;
  }
  if (drifterSpawnInterval) {
    clearInterval(drifterSpawnInterval);
    drifterSpawnInterval = null;
  }
  if (drifterLikeInterval) {
    clearInterval(drifterLikeInterval);
    drifterLikeInterval = null;
  }
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  if (decayInterval) {
    clearInterval(decayInterval);
    decayInterval = null;
  }
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  
  // Flush any pending attraction updates before stopping
  flushAttractionUpdates();
  
  activeDrifters.clear();
  attractionGraph.clear();
  console.log('Bot loop stopped');
}
