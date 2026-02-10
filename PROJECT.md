# Echo Chamber - Social Media Simulation

A hackathon project demonstrating how echo chambers form on social media through algorithmic recommendations and user behavior.

## Concept

Visitors scan a QR code to join a simulated social media platform. They create an avatar, browse a feed of posts, and like content. As they interact, they get pulled into "echo chambers" - groups of users who share similar interests. A big screen displays a real-time graph showing these echo chambers forming.

## Key Components

### 1. Mobile Feed (`/feed`)
- Users see posts from bots and other users
- Posts have topic tags (e.g., `#crypto`, `#fitness`, `#politics`)
- Users can like posts and create their own
- **Recommendation algorithm**: The more you like a topic, the more you see it, and the less you see other topics
- 3-minute session timer per user

### 2. Graph Visualization (`/graph`)
- Password-protected big screen display
- Shows all users as nodes
- **Echo chambers form visually**: Users who like similar topics get pulled together
- Links between nodes = shared topic interests (more shared = stronger attraction)
- Cluster auras show echo chamber groups with labels

### 3. Bot System
Two types of bots keep the platform alive:

**Opinionated Bots** (permanent):
- 10 personas: FitLife_Mike, TechNerd_Sarah, CryptoKing99, etc.
- Each has fixed topic preferences
- Post regularly from templates
- Like posts matching their topics

**Drifter Bots** (temporary):
- Spawn with random seed preference toward one topic cluster
- Live for 3 minutes then expire
- Demonstrate how neutral users get pulled into echo chambers
- Appear on graph, drift toward a cluster, then disappear

## How Echo Chambers Form

### Feed Algorithm
1. Track which topics user has liked
2. Calculate affinity score for each post based on topic overlap
3. Filter out low-affinity posts (non-matching content fades away)
4. Sort by affinity, then recency
5. Effect intensifies with more likes - users get trapped faster

### Graph Physics (Real-time Topic Assignment)
**Data flow**: Likes → Post tags → Cluster assignment → Visual pull + color

1. User likes a post → Realtime subscription fires
2. Post's `topic_tags` are fetched and normalized to canonical clusters
3. User's **likes-only topic profile** is updated (separate from posts they create)
4. User is assigned to their **dominant cluster** (whichever topic they've liked most)
5. Node adopts that cluster's **color** and is pulled toward its **fixed hotspot position**
6. **Cluster gravity force**: Pulls nodes toward their assigned hotspot (9 hotspots in circle layout)
7. **Charge force**: Short-range repulsion to prevent node overlap
8. **No pairwise forces**: Nodes don't pull each other—only anchored to cluster hotspots
9. Echo chambers form as users visually segregate by their like behavior

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL + Realtime)
- **Graph**: react-force-graph-2d (D3.js force simulation)
- **State**: Zustand
- **Hosting**: Vercel

## Database Schema

```sql
users (id, display_name, avatar_config, is_bot, expires_at, created_at)
posts (id, user_id, content, topic_tags[], created_at)
likes (id, user_id, post_id, created_at)
comments (id, user_id, post_id, content, created_at)
```

## Key Files

- `src/pages/Feed.tsx` - Mobile feed with recommendation algorithm
- `src/pages/Graph.tsx` - Big screen visualization
- `src/lib/botRunner.ts` - Bot automation (posting, liking, drifters)
- `src/stores/userStore.ts` - Session management
- `src/components/AvatarBuilder.tsx` - Character creation
- `src/components/Post.tsx` - Post card with like button

## Topic Clusters

Topics normalize to canonical clusters for grouping:
- **fitness**: workout, gains, gym, motivation
- **tech**: ai, coding, programming, innovation
- **crypto**: bitcoin, blockchain, defi, hodl
- **politics**: progressive, conservative, justice, values
- **climate**: environment, sustainability, green
- **gaming**: esports, games, streaming
- **food**: cooking, recipe, foodie
- **wellness**: meditation, mindfulness, peace
- **conspiracy**: truth, wakeup, research

## Environment Variables

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_GRAPH_PASSWORD=password_for_graph_page
```

## The Demo Flow

1. Display graph on big screen (password protected)
2. Visitors scan QR code on their phones
3. They create an avatar and enter the feed
4. Bots are already posting and interacting
5. Visitors like posts that interest them
6. On the graph, visitors appear as nodes
7. As they like more, they get pulled toward similar users
8. Echo chambers become visually obvious
9. After 3 minutes, visitor expires (node disappears)
10. Drifter bots continuously spawn, drift into chambers, and expire

## What Makes It Work

The key insight: **attraction is based on actual behavior, not artificial assignment**.

- You like crypto posts → you build a crypto topic profile
- Someone else likes crypto posts → they have a similar profile
- Similarity creates a link → physics pulls you together
- More shared interests → stronger pull
- Groups form naturally around shared topics
- That's an echo chamber.
