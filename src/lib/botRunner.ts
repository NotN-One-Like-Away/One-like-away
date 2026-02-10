import { supabase } from './supabase';

// Map any topic to its canonical cluster
const normalizeToCanonical = (topic: string): string => {
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

// ── Drifter bot names & avatars (neutral, short-lived) ─────────────────────
const DRIFTER_NAMES = [
  'Wanderer_01', 'Curious_Cat', 'JustBrowsing', 'NewHere_99',
  'Passerby', 'RandomUser42', 'LurkMode', 'OpenMind',
  'NoSides', 'JustVibes', 'ScrollerX', 'NeutralNick',
  'FenceRider', 'Observer_7', 'BlankSlate',
];

const DRIFTER_AVATAR_CONFIGS = [
  { face_shape: 'round', skin_color: '#e8beac', hair_style: 'short', hair_color: '#555555', eye_style: 'round', eye_color: '#808080', mouth_style: 'neutral', accessory: 'none' },
  { face_shape: 'oval', skin_color: '#d4a373', hair_style: 'curly', hair_color: '#333333', eye_style: 'almond', eye_color: '#4a3728', mouth_style: 'smile', accessory: 'none' },
  { face_shape: 'square', skin_color: '#f5d0c5', hair_style: 'long', hair_color: '#8b4513', eye_style: 'wide', eye_color: '#1e90ff', mouth_style: 'small', accessory: 'glasses' },
  { face_shape: 'heart', skin_color: '#c68642', hair_style: 'ponytail', hair_color: '#2c1810', eye_style: 'narrow', eye_color: '#228b22', mouth_style: 'grin', accessory: 'none' },
  { face_shape: 'round', skin_color: '#8d5524', hair_style: 'mohawk', hair_color: '#222222', eye_style: 'round', eye_color: '#4a3728', mouth_style: 'neutral', accessory: 'hat' },
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
 * Build a topic affinity profile for a bot.
 * Opinionated bots: heavy seed weights so they almost never stray.
 * Drifter bots: no seed, purely learned from likes (starts blank).
 */
async function getBotTopicProfile(
  botId: string,
  persona: { hashtags: string[] } | null,
  isOpinionated: boolean
): Promise<Map<string, number>> {
  const topicCounts = new Map<string, number>();

  // Opinionated bots get very high seed weights so they stay in their lane
  // Demo: use canonical topics only
  if (isOpinionated && persona) {
    persona.hashtags.forEach(tag => {
      const canonical = normalizeToCanonical(tag);
      topicCounts.set(canonical, 15); // Increased from 10 for stronger echo chambers
    });
  }

  // Layer on exposure memory (drifters only) — repeated viewing builds preference
  // Demo: normalize to canonical
  if (!isOpinionated) {
    const exposure = drifterExposure.get(botId);
    if (exposure) {
      exposure.forEach((impressions, tag) => {
        const canonical = normalizeToCanonical(tag);
        // Each impression is worth 2 weight (increased from 1 for faster clustering)
        topicCounts.set(canonical, (topicCounts.get(canonical) || 0) + impressions * 2);
      });
    }
  }

  // Layer on learned preferences from past likes
  // Demo: normalize to canonical
  const { data: likes } = await supabase
    .from('likes')
    .select('post_id, posts(topic_tags)')
    .eq('user_id', botId);

  if (likes) {
    likes.forEach(like => {
      const post = like.posts as unknown as { topic_tags: string[] } | null;
      if (post?.topic_tags) {
        post.topic_tags.forEach(tag => {
          const canonical = normalizeToCanonical(tag);
          // Likes are worth more than impressions — active engagement reinforces
          const w = isOpinionated ? 2 : 5; // Increased for demo
          topicCounts.set(canonical, (topicCounts.get(canonical) || 0) + w);
        });
      }
    });
  }

  return topicCounts;
}

/**
 * Same aggressive affinity/recommendation algorithm as the user Feed.
 * Scores posts by how well their tags match the bot's topic profile,
 * then sorts so the bot sees (and likes) echo-chamber-aligned content.
 * This pulls drifters into echo chambers FAST.
 */
function getRecommendedPosts(
  posts: { id: string; topic_tags: string[]; user_id: string }[],
  topicProfile: Map<string, number>,
  botId: string
): { id: string; topic_tags: string[]; affinity: number }[] {
  // Filter out own posts
  const candidates = posts.filter(p => p.user_id !== botId);

  if (topicProfile.size === 0) {
    // No preferences yet - return all with equal affinity
    return candidates.map(p => ({ ...p, affinity: 1 }));
  }

  const maxWeight = Math.max(...topicProfile.values(), 1);
  const totalExposure = Array.from(topicProfile.values()).reduce((a, b) => a + b, 0);
  // Echo kicks in aggressively after just 3 total exposure points (reduced from 5 for demo)
  const echoStrength = Math.min(totalExposure / 3, 1);

  const scored = candidates.map(post => {
    const tags = post.topic_tags || [];
    let score = 0;
    let hasMatchingTag = false;

    for (const tag of tags) {
      // Demo: normalize to canonical before matching
      const canonical = normalizeToCanonical(tag);
      const weight = topicProfile.get(canonical) || 0;
      if (weight > 0) hasMatchingTag = true;
      score += weight;
    }

    // Normalize
    const maxPossible = maxWeight * Math.max(tags.length, 1);
    const normalized = maxPossible > 0 ? score / maxPossible : 0;

    // Non-matching content gets heavily suppressed
    if (!hasMatchingTag) {
      const baseVisibility = Math.max(0.1, 0.5 * (1 - echoStrength));
      return { id: post.id, topic_tags: post.topic_tags, affinity: baseVisibility };
    }

    // Matching content gets boosted
    const boost = 0.6 + (normalized * 0.4);
    const affinity = Math.min(1, boost + (echoStrength * 0.15));

    return { id: post.id, topic_tags: post.topic_tags, affinity };
  });

  // Sort by affinity descending - matching content floats to top
  scored.sort((a, b) => b.affinity - a.affinity);

  return scored;
}

// ── Drifter bot management ─────────────────────────────────────────────────
const activeDrifters = new Set<string>(); // track drifter IDs for liking loop

// In-memory exposure memory: tracks which topics a drifter has been *shown*
// by the recommendation algorithm. This simulates the real echo-chamber
// mechanism — you don't need to like something for it to shape your worldview;
// mere repeated exposure builds familiarity and preference.
const drifterExposure = new Map<string, Map<string, number>>();

async function spawnDrifters(): Promise<void> {
  const now = new Date().toISOString();

  // Query the DB for currently alive drifters to get the real count
  const { data: liveDrifters } = await supabase
    .from('users')
    .select('id')
    .eq('is_bot', true)
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
  const count = Math.min(3 + Math.floor(Math.random() * 3), maxToSpawn); // Demo: spawn 3-5 at once

  for (let i = 0; i < count; i++) {
    const name = DRIFTER_NAMES[Math.floor(Math.random() * DRIFTER_NAMES.length)] +
      '_' + Math.floor(Math.random() * 1000);
    const avatar = DRIFTER_AVATAR_CONFIGS[Math.floor(Math.random() * DRIFTER_AVATAR_CONFIGS.length)];
    const expiresAt = new Date(Date.now() + DRIFTER_LIFESPAN_MS).toISOString();

    const { data, error } = await supabase
      .from('users')
      .insert({
        display_name: name,
        avatar_config: avatar,
        is_bot: true,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (!error && data) {
      activeDrifters.add(data.id);

      // Give this drifter a random seed preference toward one echo chamber
      // Demo: canonical topics only, stronger seed for faster clustering
      const seedCluster = DRIFTER_SEED_CLUSTERS[Math.floor(Math.random() * DRIFTER_SEED_CLUSTERS.length)];
      const seedExposure = new Map<string, number>();
      seedCluster.forEach(tag => {
        // Strong initial seed (12-18 points, increased from 8-12) so they drift toward this cluster fast
        seedExposure.set(tag, 12 + Math.floor(Math.random() * 7));
      });
      drifterExposure.set(data.id, seedExposure);

      console.log(`Drifter "${name}" spawned, seeded toward: ${seedCluster[0]}`);
    }
  }
}

/**
 * Make a drifter bot like a post. Drifters start with no opinions —
 * they build preferences from what the algorithm shows them (exposure)
 * and what they choose to like (engagement). This two-layer feedback
 * loop pulls them into echo chambers organically:
 *   see topic → familiarity grows → algo shows more → like it → preference locks in
 */
async function runDrifterLike(drifterId: string): Promise<void> {
  const topicProfile = await getBotTopicProfile(drifterId, null, false);

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

  const recommended = getRecommendedPosts(recentPosts, topicProfile, drifterId)
    .filter(p => !alreadyLiked.has(p.id));

  if (recommended.length === 0) return;

  // ── Record exposure: the top posts the algo "showed" this drifter ──
  // Even without liking, seeing the same topics repeatedly builds familiarity
  // Demo: normalize all tags to canonical for faster echo chamber formation
  const exposure = drifterExposure.get(drifterId) || new Map<string, number>();
  const feedSlice = recommended.slice(0, 10); // top 10 = their "feed"
  for (const post of feedSlice) {
    if (post.topic_tags) {
      for (const tag of post.topic_tags) {
        const canonical = normalizeToCanonical(tag);
        exposure.set(canonical, (exposure.get(canonical) || 0) + 1);
      }
    }
  }
  drifterExposure.set(drifterId, exposure);

  // ── Pick a post to like (weighted random by affinity) ──
  const totalAffinity = recommended.reduce((sum, p) => sum + p.affinity, 0);
  let rand = Math.random() * totalAffinity;
  let chosen = recommended[0];

  for (const post of recommended) {
    rand -= post.affinity;
    if (rand <= 0) {
      chosen = post;
      break;
    }
  }

  const { error } = await supabase
    .from('likes')
    .upsert({ user_id: drifterId, post_id: chosen.id });

  if (!error) {
    const topTags = Array.from(exposure.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t, c]) => `${t}(${c})`);
    console.log(
      `Drifter liked post (affinity: ${chosen.affinity.toFixed(2)}, ` +
      `tags: ${chosen.topic_tags?.join(', ')}, ` +
      `top exposure: ${topTags.join(', ')})`
    );
  }
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

    const bot = bots[Math.floor(Math.random() * bots.length)];
    const persona = BOT_PERSONAS[bot.display_name];

    if (!persona) {
      console.error(`No persona for ${bot.display_name}`);
      return false;
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

    console.log(`Bot ${bot.display_name} posted: ${content.slice(0, 50)}...`);

    // Opinionated bots ALWAYS try to like (strongly biased toward their topics)
    const topicProfile = await getBotTopicProfile(bot.id, persona, true);

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

      // Only consider posts that share at least one topic
      const recommended = getRecommendedPosts(recentPosts, topicProfile, bot.id)
        .filter(p => !alreadyLiked.has(p.id))
        .filter(p => p.affinity > 0.3); // Demo: less picky (was 0.6), more echo chambering

      if (recommended.length > 0) {
        // Strongly prefer the highest-affinity posts
        const top3 = recommended.slice(0, 3);
        const chosen = top3[Math.floor(Math.random() * top3.length)];

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

  // Delete all expired drifters from DB (cascade removes likes/posts)
  const { data: deleted, error } = await supabase
    .from('users')
    .delete()
    .eq('is_bot', true)
    .not('expires_at', 'is', null)
    .lt('expires_at', now)
    .select('id, display_name');

  if (!error && deleted && deleted.length > 0) {
    deleted.forEach(d => {
      activeDrifters.delete(d.id);
      drifterExposure.delete(d.id);
      console.log(`Cleaned up expired drifter: ${d.display_name}`);
    });
  }
}

// ── Main loops ─────────────────────────────────────────────────────────────
let botInterval: number | null = null;
let drifterSpawnInterval: number | null = null;
let drifterLikeInterval: number | null = null;
let cleanupInterval: number | null = null;

export function startBotLoop() {
  if (botInterval) return;

  // Opinionated bot posting loop (8-15s - demo: very active)
  const scheduleNext = () => {
    const delay = 8000 + Math.random() * 7000;
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

    // Each drifter has 90% chance to engage (demo: highly active)
    for (const drifterId of drifterIds) {
      if (Math.random() < 0.9) {
        await runDrifterLike(drifterId);
      }
    }
  }, 1500);
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
  activeDrifters.clear();
  drifterExposure.clear();
  console.log('Bot loop stopped');
}
