const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

const CANONICAL_TOPICS = [
  'fitness', 'tech', 'crypto', 'politics', 'climate',
  'gaming', 'food', 'wellness', 'conspiracy',
];

const SYSTEM_PROMPT = `You are a social media post rewriter. Given a user's raw text, rewrite it as an engaging social media post (under 280 characters) and assign 1-3 topic hashtags from this list ONLY: ${CANONICAL_TOPICS.map(t => '#' + t).join(', ')}.

Rules:
- Keep the original meaning and tone
- Make it punchy and social-media-friendly
- Include the hashtags naturally in the post text
- Return JSON with "content" (the full post text including hashtags) and "topics" (array of canonical topic names without #)

Example input: "I love going to the gym"
Example output: {"content": "Nothing beats that post-workout high! The grind never stops #fitness", "topics": ["fitness"]}`;

interface GroqResult {
  content: string;
  topics: string[];
}

async function extractHashtagsFallback(text: string): Promise<string[]> {
  const { normalizeToCanonical } = await import('./botRunner');
  const matches = text.match(/#\w+/g);
  if (!matches) return [];
  const tags = [...new Set(matches.map(tag => tag.slice(1).toLowerCase()))];
  return tags
    .map(tag => normalizeToCanonical(tag))
    .filter(tag => CANONICAL_TOPICS.includes(tag));
}

export async function rewriteWithGroq(userText: string): Promise<GroqResult> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    console.warn('VITE_GROQ_API_KEY not set, using raw text');
    return { content: userText, topics: await extractHashtagsFallback(userText) };
  }

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userText },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 256,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) throw new Error('Empty Groq response');

    const parsed = JSON.parse(raw);
    const content = typeof parsed.content === 'string' ? parsed.content : userText;

    // Validate topics against canonical list
    const { normalizeToCanonical } = await import('./botRunner');
    const topics: string[] = (Array.isArray(parsed.topics) ? parsed.topics : [])
      .map((t: string) => normalizeToCanonical(String(t).toLowerCase().replace(/^#/, '')))
      .filter((t: string) => CANONICAL_TOPICS.includes(t));

    // Deduplicate
    const uniqueTopics = [...new Set(topics)];

    // If Groq returned no valid topics, try regex extraction from the rewritten content
    if (uniqueTopics.length === 0) {
      const fallbackTopics = await extractHashtagsFallback(content);
      return { content, topics: fallbackTopics };
    }

    return { content, topics: uniqueTopics };
  } catch (err) {
    console.error('Groq rewrite failed, using raw text:', err);
    return { content: userText, topics: await extractHashtagsFallback(userText) };
  }
}
