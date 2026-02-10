# Attraction System Integration Guide

## What's Implemented

The bot behavior system now **materializes attraction scores** based on:
- **Likes** (+1.0 per like to topic, +0.6 to author)
- **Exposure** (+0.1 per impression - weak but cumulative)  
- **Bot posts** (+2.0 to their ideological topics - gravity wells)

This data is persisted to the `attraction` table in real-time.

## What This Enables

### Current State (before):
- Cluster assignment based on like counts only
- No weight for mere exposure
- Static once assigned

### New State (after attraction integration):
- **Continuous drift** - users pulled toward topics they're exposed to, not just what they like
- **Ideological gravity** - opinionated bots become fixed masses that warp the space
- **Emergent clustering** - sub-communities form around shared micro-interests
- **Measurable polarization** - attraction scores quantify echo chamber strength

## Next Steps: Wire Attraction → Graph Physics

### Option A: ForceGraph2D forces (quick)

In `Graph.tsx`, add a new D3 force:

```ts
const attractionForce = () => {
  let forceNodes: GraphNode[] = [];
  
  const force = async () => {
    // Fetch top attractions from Supabase
    const { data: attractions } = await supabase.rpc('get_top_attractions', { p_limit: 200 });
    
    forceNodes.forEach(node => {
      // Find attractions where this node is the source
      const userAttractions = attractions?.filter(a => a.source_id === node.id) || [];
      
      userAttractions.forEach(attr => {
        if (attr.target_id.startsWith('topic:')) {
          // Pull toward topic hotspot
          const topic = attr.target_id.slice(6);
          const hotspot = CLUSTER_HOTSPOTS[topic];
          if (hotspot) {
            const dx = hotspot.x - node.x;
            const dy = hotspot.y - node.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const strength = attr.weight * 0.05; // scale by attraction score
            
            node.vx = (node.vx || 0) + (dx/dist) * strength;
            node.vy = (node.vy || 0) + (dy/dist) * strength;
          }
        } else if (attr.target_id.startsWith('user:')) {
          // Pull toward another user
          const targetUserId = attr.target_id.slice(5);
          const targetNode = forceNodes.find(n => n.id === targetUserId);
          if (targetNode && targetNode.x && targetNode.y) {
            const dx = targetNode.x - node.x;
            const dy = targetNode.y - node.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const strength = attr.weight * 0.03;
            
            node.vx = (node.vx || 0) + (dx/dist) * strength;
            node.vy = (node.vy || 0) + (dy/dist) * strength;
          }
        }
      });
    });
  };
  
  (force as any).initialize = (n: GraphNode[]) => { forceNodes = n; };
  return force;
};

fg.d3Force('attraction', attractionForce() as any);
```

### Option B: Replace cluster assignment (architectural)

Instead of using `likeTopicsRef` for cluster assignment, use attraction scores:

```ts
// In fetchGraphData:
const { data: attractions } = await supabase.rpc('get_top_attractions');

const graphNodes = users.map(u => {
  // Find user's top topic attraction
  const userAttractions = attractions
    ?.filter(a => a.source_id === u.id && a.target_id.startsWith('topic:'))
    .sort((a, b) => b.weight - a.weight) || [];
  
  const topTopic = userAttractions[0]?.target_id.slice(6);
  const cluster = CANONICAL_CLUSTER_COLORS[topTopic] ? topTopic : 'neutral';
  
  return {
    id: u.id,
    cluster,
    clusterColor: CANONICAL_CLUSTER_COLORS[cluster] || '#6b7280',
    // ... rest
  };
});
```

### Option C: Realtime subscription (most powerful)

Subscribe to attraction table changes:

```ts
const attractionChannel = supabase
  .channel('attraction-live')
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'attraction' 
  }, (payload) => {
    // Recalculate cluster/force on every attraction update
    updateNodeAttraction(payload.new);
  })
  .subscribe();
```

## Running the Migration

1. Open Supabase Dashboard → SQL Editor
2. Run `supabase/attraction-setup.sql`
3. Verify tables created: `attraction` table + RPC functions

## Metrics You Can Now Track

```sql
-- Top polarized users (high total attraction)
SELECT source_id, SUM(weight) as total_attraction
FROM attraction
GROUP BY source_id
ORDER BY total_attraction DESC;

-- Topic centrality (which topics have most pull)
SELECT target_id, COUNT(*) as user_count, AVG(weight) as avg_weight
FROM attraction
WHERE target_id LIKE 'topic:%'
GROUP BY target_id
ORDER BY avg_weight DESC;

-- Echo chamber modularity
SELECT 
  SUBSTRING(target_id FROM 7) as cluster,
  COUNT(DISTINCT source_id) as members,
  AVG(weight) as cohesion
FROM attraction
WHERE target_id LIKE 'topic:%'
GROUP BY cluster;
```

## Why This Architecture Is Correct

| Layer | Responsibility |
|-------|---------------|
| `botRunner.ts` | **Behavior** - likes, exposure, posts |
| `attraction` table | **Causality** - materialized influence graph |
| `Graph.tsx` | **Consequence** - visual manifestation |

This separation means:
- ✅ Replay events for different visualizations
- ✅ Time-travel debugging (attraction over time)
- ✅ Swap physics engines without changing behavior
- ✅ Measure polarization quantitatively, not just visually

## The Philosophical Payoff

Before: "Users like things → they cluster"
After: "**Users see things → they drift → they like → they're trapped**"

The second model is uncomfortable because it's true.
