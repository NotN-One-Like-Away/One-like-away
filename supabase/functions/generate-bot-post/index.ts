import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Bot personas with their topics and posting styles
const BOT_PERSONAS: Record<string, { topics: string[]; style: string; hashtags: string[] }> = {
  'FitLife_Mike': {
    topics: ['workout routines', 'protein intake', 'gym motivation', 'fitness goals', 'muscle gains'],
    style: 'enthusiastic, uses fitness slang, motivational',
    hashtags: ['fitness', 'workout', 'gains', 'motivation', 'gym']
  },
  'TechNerd_Sarah': {
    topics: ['AI developments', 'coding tips', 'new gadgets', 'software updates', 'tech industry news'],
    style: 'nerdy, informative, occasionally sarcastic about tech',
    hashtags: ['tech', 'ai', 'coding', 'programming', 'innovation']
  },
  'ProgressiveVoice': {
    topics: ['social justice', 'healthcare reform', 'climate policy', 'workers rights', 'equality'],
    style: 'passionate, empathetic, calls for action',
    hashtags: ['progressive', 'justice', 'equality', 'change', 'politics']
  },
  'TraditionFirst': {
    topics: ['family values', 'economic freedom', 'national security', 'traditional culture', 'small government'],
    style: 'principled, patriotic, values-focused',
    hashtags: ['conservative', 'values', 'freedom', 'tradition', 'politics']
  },
  'CryptoKing99': {
    topics: ['bitcoin price', 'altcoins', 'DeFi projects', 'NFTs', 'blockchain technology'],
    style: 'hype-driven, uses crypto slang like WAGMI/HODL, optimistic about markets',
    hashtags: ['crypto', 'bitcoin', 'defi', 'blockchain', 'hodl']
  },
  'ZenMaster_Luna': {
    topics: ['meditation practices', 'mindfulness', 'yoga', 'mental health', 'spiritual growth'],
    style: 'calm, wise, uses peaceful imagery',
    hashtags: ['wellness', 'meditation', 'mindfulness', 'peace', 'selfcare']
  },
  'xX_Gamer_Xx': {
    topics: ['new game releases', 'esports', 'gaming setups', 'streaming tips', 'game reviews'],
    style: 'casual, uses gaming slang, competitive',
    hashtags: ['gaming', 'esports', 'streamer', 'games', 'pc']
  },
  'ChefAntonio': {
    topics: ['recipes', 'cooking techniques', 'restaurant reviews', 'food culture', 'ingredients'],
    style: 'passionate about food, uses Italian phrases, descriptive about flavors',
    hashtags: ['food', 'cooking', 'recipe', 'foodie', 'chef']
  },
  'EcoWarrior_Greta': {
    topics: ['climate change', 'renewable energy', 'sustainability', 'environmental policy', 'conservation'],
    style: 'urgent, fact-driven, calls for environmental action',
    hashtags: ['climate', 'environment', 'sustainability', 'green', 'action']
  },
  'TruthSeeker42': {
    topics: ['government secrets', 'mainstream media criticism', 'alternative theories', 'hidden truths', 'skepticism'],
    style: 'suspicious, asks provocative questions, tells people to "wake up"',
    hashtags: ['truth', 'wakeup', 'question', 'conspiracy', 'research']
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const groqApiKey = Deno.env.get('GROQ_API_KEY')

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get a random bot
    const { data: bots, error: botsError } = await supabase
      .from('users')
      .select('id, display_name')
      .eq('is_bot', true)

    if (botsError || !bots?.length) {
      throw new Error('No bots found')
    }

    const bot = bots[Math.floor(Math.random() * bots.length)]
    const persona = BOT_PERSONAS[bot.display_name]

    if (!persona) {
      throw new Error(`No persona found for ${bot.display_name}`)
    }

    // Get recent posts to make responses more contextual
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('content, topic_tags')
      .order('created_at', { ascending: false })
      .limit(5)

    const recentContext = recentPosts?.map(p => p.content).join('\n') || ''

    // Generate post content using Groq
    let postContent: string
    let topicTags: string[]

    if (groqApiKey) {
      const topic = persona.topics[Math.floor(Math.random() * persona.topics.length)]
      const prompt = `You are ${bot.display_name}, a social media user. Your style: ${persona.style}.

Write a short social media post (1-3 sentences, max 280 chars) about: ${topic}

Recent posts on the platform for context:
${recentContext}

Guidelines:
- Be opinionated and engaging
- Stay in character
- Include 1-2 relevant hashtags from: ${persona.hashtags.join(', ')}
- Don't use emojis excessively
- Make it feel authentic, not AI-generated

Post:`

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
          temperature: 0.9,
        }),
      })

      const data = await response.json()
      postContent = data.choices?.[0]?.message?.content?.trim() || ''

      // Extract hashtags from content
      const hashtagMatches = postContent.match(/#\w+/g) || []
      topicTags = hashtagMatches.map((tag: string) => tag.slice(1).toLowerCase())
    } else {
      // Fallback: use pre-written posts if no Groq key
      const fallbackPosts = [
        `Just thinking about ${persona.topics[0]} today. What are your thoughts? #${persona.hashtags[0]}`,
        `Hot take: ${persona.topics[1]} is underrated. #${persona.hashtags[1]} #${persona.hashtags[2]}`,
        `Anyone else passionate about ${persona.topics[2]}? Let's discuss! #${persona.hashtags[0]}`,
      ]
      postContent = fallbackPosts[Math.floor(Math.random() * fallbackPosts.length)]
      topicTags = persona.hashtags.slice(0, 2)
    }

    // Insert the post
    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({
        user_id: bot.id,
        content: postContent,
        topic_tags: topicTags,
      })
      .select()
      .single()

    if (postError) {
      throw postError
    }

    // Randomly like some recent posts (creates connections)
    if (Math.random() > 0.5) {
      const { data: postsToLike } = await supabase
        .from('posts')
        .select('id, topic_tags')
        .neq('user_id', bot.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (postsToLike?.length) {
        // Prefer posts with similar topics
        const relevantPosts = postsToLike.filter(p =>
          p.topic_tags?.some((tag: string) => persona.hashtags.includes(tag))
        )
        const targetPosts = relevantPosts.length ? relevantPosts : postsToLike
        const postToLike = targetPosts[Math.floor(Math.random() * targetPosts.length)]

        await supabase
          .from('likes')
          .upsert({ user_id: bot.id, post_id: postToLike.id })
      }
    }

    return new Response(
      JSON.stringify({ success: true, post }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
