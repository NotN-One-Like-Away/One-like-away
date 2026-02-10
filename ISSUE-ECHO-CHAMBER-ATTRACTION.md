# Issue: Users Not Being Pulled Into Echo Chambers

## The Problem

**Observed behavior:**
- User creates account
- User likes ONLY conspiracy posts
- Feed correctly shows only conspiracy posts (recommendation algorithm works)
- On the Graph, user is being REPELLED from the conspiracy echo chamber instead of attracted

**Expected behavior:**
- User likes conspiracy posts → user builds conspiracy topic profile
- Other users (bots) also have conspiracy topic profiles
- User should be PULLED TOWARD the conspiracy cluster on the graph
- The more conspiracy posts they like, the stronger the pull

## How It Should Work

```
User likes conspiracy post
        ↓
User's topic profile: { conspiracy: 1 }
        ↓
Bot "TruthSeeker42" also has: { conspiracy: 5 }
        ↓
Similarity = shared topics = conspiracy
        ↓
Link created between User and TruthSeeker42
        ↓
Link force PULLS them together
        ↓
User visibly moves toward conspiracy cluster
        ↓
THAT'S THE ECHO CHAMBER
```

## The Core Mechanic

**Attraction = Topic Similarity**

For every pair of users:
1. Get User A's liked topics: `{ conspiracy: 3, truth: 2 }`
2. Get User B's liked topics: `{ conspiracy: 5, wakeup: 1 }`
3. Calculate overlap: `min(3, 5) = 3` for conspiracy
4. Similarity score = 3
5. Create link with strength = 3
6. Link force pulls A and B together with strength proportional to 3

**More shared likes = stronger pull = tighter cluster = echo chamber**

## What's Going Wrong

The graph has multiple forces competing:
1. **Charge force**: Repels ALL nodes from each other (keeps graph spread out)
2. **Link force**: Pulls connected nodes together
3. **Cluster force**: Pulls same-cluster nodes together

If the charge force is too strong, or the attraction forces are too weak, nodes get pushed apart even when they should be attracted.

## The Fix

The attraction forces need to OVERPOWER the repulsion for nodes with high similarity:

```javascript
// For nodes in the same cluster (same dominant topic):
// - Pull strength should be STRONG (overpower charge repulsion)
// - The more shared likes, the stronger the pull

// Current issue: charge force = -50, cluster pull = 0.3 * alpha
// The charge is constant, the cluster pull decays with alpha

// Fix: Make cluster pull CONSTANT and STRONG regardless of alpha
const pullStrength = 0.5; // Not multiplied by alpha
```

## Visual Expectation

```
Before liking:
  [User]                    [Conspiracy Cluster]
    o                            ooo
                                 ooo

After liking conspiracy posts:
  [User] ----strong link---> [Conspiracy Cluster]
    o =========================> ooo
                                 ooo
    (User gets pulled into cluster)

Result:
                             [Conspiracy Cluster]
                                 ooo
                                 o←User now inside
                                 ooo
```

## Key Insight

The echo chamber effect should be:
1. **Immediate**: Like a conspiracy post → start moving toward conspiracy users
2. **Cumulative**: More likes → faster/stronger movement
3. **Visible**: You can SEE the user drifting into the cluster
4. **Permanent**: Once in a cluster, charge repulsion shouldn't push you out

The feed algorithm is working (user only sees conspiracy).
The graph needs to match: user should be IN the conspiracy cluster visually.
