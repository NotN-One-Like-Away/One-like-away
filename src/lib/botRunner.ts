import { supabase } from './supabase';

const BOT_PERSONAS: Record<string, { topics: string[]; templates: string[]; hashtags: string[] }> = {
  'FitLife_Mike': {
    topics: ['workout', 'gains', 'protein', 'gym'],
    templates: [
      "Just crushed leg day! Nothing like the burn of a good squat session. #fitness #gains",
      "Reminder: You don't need motivation, you need discipline. Get up and move! #workout #motivation",
      "Hot take: Rest days are just as important as training days. Your muscles grow when you rest! #fitness",
      "5AM workout crew, where you at? Early bird gets the gains! #gym #grindset",
      "Meal prep Sunday is the secret to a successful fitness week. No excuses! #mealprep #fitness"
    ],
    hashtags: ['fitness', 'workout', 'gains', 'motivation', 'gym']
  },
  'TechNerd_Sarah': {
    topics: ['AI', 'coding', 'tech', 'programming'],
    templates: [
      "Just spent 3 hours debugging only to find a missing semicolon. Classic. #coding #devlife",
      "The new AI models are getting scary good. Are we ready for this? #ai #tech",
      "Hot take: Tabs > Spaces. Fight me in the comments. #coding #developers",
      "Finally automated that tedious task. This is why I love programming! #automation #tech",
      "Reading through legacy code is like archaeology but with more crying. #programming #coding"
    ],
    hashtags: ['tech', 'ai', 'coding', 'programming', 'innovation']
  },
  'ProgressiveVoice': {
    topics: ['justice', 'equality', 'healthcare', 'climate'],
    templates: [
      "Healthcare is a human right, not a privilege. When will we learn? #healthcare #progressive",
      "The climate crisis won't wait for us to get comfortable. Action needed NOW. #climate #action",
      "Imagine a world where everyone has equal opportunities. Let's build it. #equality #justice",
      "Workers deserve living wages. This shouldn't be controversial. #workers #progressive",
      "Education should lift people up, not burden them with debt. #education #reform"
    ],
    hashtags: ['progressive', 'justice', 'equality', 'change', 'politics']
  },
  'TraditionFirst': {
    topics: ['values', 'freedom', 'family', 'tradition'],
    templates: [
      "Strong families build strong communities. Never forget our roots. #family #values",
      "Personal responsibility is the foundation of a free society. #freedom #conservative",
      "Some things are worth preserving. Tradition gives us wisdom. #tradition #values",
      "Small government, big opportunity. Let people thrive! #freedom #liberty",
      "Faith, family, and hard work. The values that built this nation. #conservative #values"
    ],
    hashtags: ['conservative', 'values', 'freedom', 'tradition', 'politics']
  },
  'CryptoKing99': {
    topics: ['bitcoin', 'crypto', 'defi', 'blockchain'],
    templates: [
      "WAGMI! This dip is a buying opportunity. Diamond hands only! #crypto #hodl",
      "Banks are obsolete. DeFi is the future and they know it. #defi #crypto",
      "Not your keys, not your coins. Stay safe out there! #bitcoin #crypto",
      "The next bull run will be legendary. Are you positioned? #crypto #bitcoin",
      "Blockchain technology will revolutionize everything. We're still early! #blockchain #tech"
    ],
    hashtags: ['crypto', 'bitcoin', 'defi', 'blockchain', 'hodl']
  },
  'ZenMaster_Luna': {
    topics: ['meditation', 'mindfulness', 'peace', 'wellness'],
    templates: [
      "Started my day with 20 minutes of silence. The mind is clearer than ever. #meditation #peace",
      "Your breath is your anchor. When lost, return to it. #mindfulness #wellness",
      "Peace is not the absence of chaos, but the presence of calm within it. #zen #meditation",
      "Gratitude practice: What are three things you're thankful for today? #wellness #mindfulness",
      "The present moment is all we truly have. Embrace it fully. #mindfulness #peace"
    ],
    hashtags: ['wellness', 'meditation', 'mindfulness', 'peace', 'selfcare']
  },
  'xX_Gamer_Xx': {
    topics: ['gaming', 'esports', 'streaming', 'games'],
    templates: [
      "Just hit a new personal best! The grind never stops. #gaming #esports",
      "That new game update is actually fire. Who's playing tonight? #gaming #games",
      "Streaming later, come hang! Gonna be a wild session. #streaming #gaming",
      "Hot take: Single player games > multiplayer. Quality over chaos. #gaming #unpopular",
      "My setup is finally complete. RGB everything, no regrets. #gaming #battlestation"
    ],
    hashtags: ['gaming', 'esports', 'streamer', 'games', 'pc']
  },
  'ChefAntonio': {
    topics: ['cooking', 'food', 'recipes', 'italian'],
    templates: [
      "The secret to perfect pasta? Salt your water like the Mediterranean! #cooking #italian",
      "Made fresh bread today. The smell alone is worth the effort. #baking #food",
      "Unpopular opinion: Simple ingredients, prepared well, beat complexity every time. #cooking #chef",
      "Sunday sauce simmering all day. This is what life is about. #food #italian",
      "Good olive oil is not optional, it's essential. Invest in quality! #cooking #foodie"
    ],
    hashtags: ['food', 'cooking', 'recipe', 'foodie', 'chef']
  },
  'EcoWarrior_Greta': {
    topics: ['climate', 'environment', 'sustainability', 'green'],
    templates: [
      "Every plastic bottle takes 450 years to decompose. Choose reusable. #environment #sustainability",
      "The science is clear. Climate action cannot wait. #climate #action",
      "Small changes matter. What's one eco-friendly swap you've made? #green #sustainability",
      "Renewable energy is now cheaper than fossil fuels. The transition is inevitable. #climate #green",
      "Our planet doesn't need saving. Our habits do. #environment #change"
    ],
    hashtags: ['climate', 'environment', 'sustainability', 'green', 'action']
  },
  'TruthSeeker42': {
    topics: ['truth', 'research', 'questions', 'skeptic'],
    templates: [
      "Why doesn't anyone talk about this? Do your own research. #truth #wakeup",
      "The mainstream narrative doesn't add up. Connect the dots. #question #research",
      "They want you distracted. Stay vigilant, stay informed. #truth #aware",
      "Coincidences don't exist at this level. Think about it. #conspiracy #wakeup",
      "Question everything you're told. The truth is out there. #truth #research"
    ],
    hashtags: ['truth', 'wakeup', 'question', 'conspiracy', 'research']
  }
};

export async function runBot(): Promise<boolean> {
  try {
    // Get a random bot
    const { data: bots, error: botsError } = await supabase
      .from('users')
      .select('id, display_name')
      .eq('is_bot', true);

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

    // Extract hashtags
    const hashtagMatches = content.match(/#\w+/g) || [];
    const topicTags = hashtagMatches.map(tag => tag.slice(1).toLowerCase());

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

    // Randomly like a post
    if (Math.random() > 0.4) {
      const { data: posts } = await supabase
        .from('posts')
        .select('id, topic_tags')
        .neq('user_id', bot.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (posts?.length) {
        // Prefer posts with similar topics
        const relevant = posts.filter(p =>
          p.topic_tags?.some((tag: string) => persona.hashtags.includes(tag))
        );
        const target = relevant.length ? relevant : posts;
        const postToLike = target[Math.floor(Math.random() * target.length)];

        await supabase
          .from('likes')
          .upsert({ user_id: bot.id, post_id: postToLike.id });
      }
    }

    return true;
  } catch (err) {
    console.error('Bot runner error:', err);
    return false;
  }
}

// Start bot loop - posts every 15-30 seconds
let botInterval: number | null = null;

export function startBotLoop() {
  if (botInterval) return;

  const scheduleNext = () => {
    const delay = 15000 + Math.random() * 15000; // 15-30 seconds
    botInterval = window.setTimeout(async () => {
      await runBot();
      scheduleNext();
    }, delay);
  };

  // Run immediately, then schedule
  runBot().then(scheduleNext);
  console.log('Bot loop started');
}

export function stopBotLoop() {
  if (botInterval) {
    clearTimeout(botInterval);
    botInterval = null;
    console.log('Bot loop stopped');
  }
}
