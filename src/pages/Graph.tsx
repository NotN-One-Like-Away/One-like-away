import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { startBotLoop, stopBotLoop } from '../lib/botRunner';
import type { User } from '../types';

interface GraphNode {
  id: string;
  name: string;
  is_bot: boolean;
  avatar_config: User['avatar_config'];
  topics: string[];
  cluster?: string;
  clusterColor?: string;
  clusterJoinTime?: number; // Timestamp when node joined its current cluster
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  [key: string]: unknown;
}

interface GraphLink {
  source: string;
  target: string;
  strength: number;
  isTopicLink?: boolean;
  [key: string]: unknown;
}

interface ClusterInfo {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  radius: number;
  memberCount: number;
}

// Distinct colors for each cluster/topic
const CLUSTER_COLORS: Record<string, string> = {
  fitness: '#22c55e',
  workout: '#22c55e',
  gains: '#22c55e',
  gym: '#22c55e',
  tech: '#3b82f6',
  ai: '#3b82f6',
  coding: '#3b82f6',
  programming: '#3b82f6',
  crypto: '#f59e0b',
  bitcoin: '#f59e0b',
  blockchain: '#f59e0b',
  defi: '#f59e0b',
  politics: '#ef4444',
  progressive: '#ef4444',
  conservative: '#ef4444',
  climate: '#10b981',
  environment: '#10b981',
  gaming: '#8b5cf6',
  esports: '#8b5cf6',
  food: '#f97316',
  cooking: '#f97316',
  wellness: '#ec4899',
  meditation: '#ec4899',
  conspiracy: '#6b7280',
  truth: '#6b7280',
};

const DEFAULT_CLUSTER_COLOR = '#6366f1';

// Normalize related topics to a single canonical cluster name
const TOPIC_TO_CLUSTER: Record<string, string> = {
  fitness: 'fitness', workout: 'fitness', gains: 'fitness', gym: 'fitness',
  motivation: 'fitness', mealprep: 'fitness', health: 'fitness',
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
  games: 'gaming', streamer: 'gaming', pc: 'gaming',
  food: 'food', cooking: 'food', recipe: 'food',
  foodie: 'food', chef: 'food', italian: 'food', baking: 'food', recipes: 'food',
  wellness: 'wellness', meditation: 'wellness', mindfulness: 'wellness',
  peace: 'wellness', selfcare: 'wellness', zen: 'wellness',
  conspiracy: 'conspiracy', truth: 'conspiracy', wakeup: 'conspiracy',
  question: 'conspiracy', research: 'conspiracy', aware: 'conspiracy',
};

// Canonical cluster colors (one per cluster)
const CANONICAL_CLUSTER_COLORS: Record<string, string> = {
  fitness: '#22c55e',
  tech: '#3b82f6',
  crypto: '#f59e0b',
  politics: '#ef4444',
  climate: '#10b981',
  gaming: '#8b5cf6',
  food: '#f97316',
  wellness: '#ec4899',
  conspiracy: '#6b7280',
};

const OUTLINE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
];

export function Graph() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const graphRef = useRef<ForceGraphMethods>(null);
  const colorIndexRef = useRef<Map<string, number>>(new Map());
  const clusterUpdateInterval = useRef<number | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const clustersRef = useRef<ClusterInfo[]>([]);
  const forcesConfigured = useRef(false);
  const fetchTimeout = useRef<number | null>(null);
  const lastClearTime = useRef(0);
  const drawnAuras = useRef(new Set<string>());
  const prevClusterMap = useRef(new Map<string, string>());

  const getOutlineColor = useCallback((userId: string, isBot: boolean) => {
    if (isBot) return '#6366f1';
    if (!colorIndexRef.current.has(userId)) {
      colorIndexRef.current.set(userId, colorIndexRef.current.size % OUTLINE_COLORS.length);
    }
    return OUTLINE_COLORS[colorIndexRef.current.get(userId)!];
  }, []);

  const normalizeToCluster = (topic: string): string => {
    return TOPIC_TO_CLUSTER[topic.toLowerCase()] || topic.toLowerCase();
  };

  const getClusterColor = (cluster: string): string => {
    return CANONICAL_CLUSTER_COLORS[cluster] || CLUSTER_COLORS[cluster.toLowerCase()] || DEFAULT_CLUSTER_COLOR;
  };

  const fetchGraphData = useCallback(async () => {
    // Get all active users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name, avatar_config, is_bot, expires_at')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    if (usersError || !users) {
      console.error('Failed to fetch users:', usersError);
      return;
    }

    // Get all likes with topic info
    const { data: likes, error: likesError } = await supabase
      .from('likes')
      .select('user_id, post_id, posts(user_id, topic_tags)');

    if (likesError) {
      console.error('Failed to fetch likes:', likesError);
      return;
    }

    // Build user topic profiles
    const userTopics = new Map<string, Map<string, number>>();

    console.log(`[Graph Data] Processing ${likes?.length || 0} likes`);

    likes?.forEach((like) => {
      const post = like.posts as unknown as { user_id: string; topic_tags: string[] } | null;
      if (!post?.topic_tags) return;

      const existing = userTopics.get(like.user_id) || new Map<string, number>();
      post.topic_tags.forEach((tag) => {
        existing.set(tag, (existing.get(tag) || 0) + 1);
      });
      userTopics.set(like.user_id, existing);
    });

    console.log(`[Graph Data] Users with topic profiles: ${userTopics.size}`);

    // Find dominant cluster for each user (normalize topics to clusters first)
    const userDominantTopic = new Map<string, string>();
    userTopics.forEach((topics, userId) => {
      // Aggregate topic counts into cluster counts
      const clusterCounts = new Map<string, number>();
      topics.forEach((count, topic) => {
        const cluster = normalizeToCluster(topic);
        clusterCounts.set(cluster, (clusterCounts.get(cluster) || 0) + count);
      });

      let maxCluster = '';
      let maxCount = 0;
      clusterCounts.forEach((count, cluster) => {
        if (count > maxCount) {
          maxCount = count;
          maxCluster = cluster;
        }
      });
      if (maxCluster) {
        userDominantTopic.set(userId, maxCluster);
      }
    });

    // Build nodes - preserve existing positions from the ref (not stale state)
    const currentNodes = nodesRef.current;
    const currentNodeMap = new Map(currentNodes.map(n => [n.id, n]));
    const now = Date.now();

    const graphNodes: GraphNode[] = users.map((user) => {
      const topics = userTopics.get(user.id);
      const topicList = topics ? Array.from(topics.keys()) : [];
      const dominantTopic = userDominantTopic.get(user.id);
      const existing = currentNodeMap.get(user.id);

      // Track when cluster changes for visual effect
      const clusterChanged = existing?.cluster !== dominantTopic;
      const clusterJoinTime = clusterChanged ? now : (existing?.clusterJoinTime || now);

      return {
        id: user.id,
        name: user.display_name,
        is_bot: user.is_bot,
        avatar_config: user.avatar_config,
        topics: topicList,
        cluster: dominantTopic,
        clusterColor: dominantTopic ? getClusterColor(dominantTopic) : undefined,
        clusterJoinTime,
        // Preserve simulation state from ref so positions are never lost
        ...(existing ? { x: existing.x, y: existing.y, vx: existing.vx, vy: existing.vy } : {}),
      };
    });

    // Build links - both direct interactions AND topic similarity
    const linkMap = new Map<string, { strength: number; isTopicLink: boolean }>();

    // Direct interaction links (from likes)
    likes?.forEach((like) => {
      const post = like.posts as unknown as { user_id: string; topic_tags: string[] } | null;
      if (!post) return;
      const postAuthorId = post.user_id;
      if (like.user_id === postAuthorId) return;

      const key = [like.user_id, postAuthorId].sort().join('-');
      const existing = linkMap.get(key) || { strength: 0, isTopicLink: false };
      linkMap.set(key, { strength: existing.strength + 2, isTopicLink: false });
    });

    // Topic similarity links - connect users who share topics
    const userIds = Array.from(userTopics.keys());
    for (let i = 0; i < userIds.length; i++) {
      for (let j = i + 1; j < userIds.length; j++) {
        const user1Topics = userTopics.get(userIds[i])!;
        const user2Topics = userTopics.get(userIds[j])!;

        // Calculate topic overlap
        let sharedWeight = 0;
        user1Topics.forEach((count1, topic) => {
          const count2 = user2Topics.get(topic) || 0;
          if (count2 > 0) {
            sharedWeight += Math.min(count1, count2);
          }
        });

        if (sharedWeight > 0) {
          const key = [userIds[i], userIds[j]].sort().join('-');
          const existing = linkMap.get(key) || { strength: 0, isTopicLink: true };
          linkMap.set(key, {
            strength: existing.strength + sharedWeight,
            isTopicLink: existing.isTopicLink && sharedWeight > 0
          });
        }
      }
    }

    // Create a set of valid node IDs for validation
    const validNodeIds = new Set(graphNodes.map(n => n.id));

    const graphLinks: GraphLink[] = Array.from(linkMap.entries())
      .map(([key, data]) => {
        const [source, target] = key.split('-');
        return { source, target, strength: data.strength, isTopicLink: data.isTopicLink };
      })
      .filter(link => validNodeIds.has(link.source) && validNodeIds.has(link.target));

    nodesRef.current = graphNodes;
    setNodes(graphNodes);
    setLinks(graphLinks);

    // Debug: log cluster assignments
    const nodesWithClusters = graphNodes.filter(n => n.cluster);
    const clusterCounts = new Map<string, number>();
    nodesWithClusters.forEach(n => {
      clusterCounts.set(n.cluster!, (clusterCounts.get(n.cluster!) || 0) + 1);
    });
    console.log(`[Graph Data] Total nodes: ${graphNodes.length}, with clusters: ${nodesWithClusters.length}`);
    console.log(`[Graph Data] Cluster breakdown:`, Object.fromEntries(clusterCounts));

    // Track cluster changes for logging
    const newClusterMap = new Map<string, string>();
    graphNodes.forEach(n => {
      if (n.cluster) newClusterMap.set(n.id, n.cluster);
      const prev = prevClusterMap.current.get(n.id);
      if (n.cluster && n.cluster !== prev) {
        console.log(`Node ${n.name} joined cluster: ${n.cluster}`);
      }
    });
    prevClusterMap.current = newClusterMap;

    // ALWAYS reheat on data update - keeps the simulation alive and moving
    // This makes echo chamber formation visually dramatic
    if (graphRef.current) {
      graphRef.current.d3ReheatSimulation();
    }
  }, []);

  // Update cluster positions periodically (reads from nodesRef for latest sim positions)
  const updateClusterPositions = useCallback(() => {
    const currentNodes = nodesRef.current;
    if (currentNodes.length === 0) return;

    const clusterPositions = new Map<string, {
      x: number; y: number; count: number; color: string;
      members: { x: number; y: number }[];
    }>();

    currentNodes.forEach((node) => {
      if (!node.cluster || node.x === undefined || node.y === undefined) return;

      const existing = clusterPositions.get(node.cluster) || {
        x: 0, y: 0, count: 0,
        color: getClusterColor(node.cluster),
        members: [],
      };

      existing.x += node.x;
      existing.y += node.y;
      existing.count += 1;
      existing.members.push({ x: node.x, y: node.y });
      clusterPositions.set(node.cluster, existing);
    });

    const clusterInfos: ClusterInfo[] = Array.from(clusterPositions.entries())
      .filter(([, data]) => data.count >= 2)
      .map(([name, data]) => {
        const cx = data.x / data.count;
        const cy = data.y / data.count;

        // Compute radius as max distance from centroid to any member + padding
        let maxDist = 0;
        data.members.forEach(({ x, y }) => {
          const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
          if (dist > maxDist) maxDist = dist;
        });

        return {
          id: name,
          name: `#${name}`,
          color: data.color,
          x: cx,
          y: cy,
          radius: maxDist + 35,
          memberCount: data.count,
        };
      });

    clustersRef.current = clusterInfos;
    // Only trigger React re-render when the count changes (avoids
    // unnecessary re-renders every 500 ms that can compound flicker).
    setClusters(prev => prev.length === clusterInfos.length ? prev : clusterInfos);
  }, []);

  // Keep ref in sync so fetchGraphData always has latest positions
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Configure forces once when graph first has data
  useEffect(() => {
    if (!graphRef.current || nodes.length === 0 || forcesConfigured.current) return;

    const fg = graphRef.current;
    forcesConfigured.current = true;

    // Weak repulsion so clusters can form tightly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const charge = fg.d3Force('charge') as any;
    if (charge?.strength) {
      charge.strength(-30); // Weaker repulsion = tighter clusters
      charge.distanceMax(150);
      charge.distanceMin(10);
    }

    // Link distance - allows some spread within clusters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = fg.d3Force('link') as any;
    if (link?.distance) link.distance(50);

    // Stronger center force to keep graph stable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const center = fg.d3Force('center') as any;
    if (center?.strength) center.strength(1);

    // Collision force: prevent nodes from overlapping
    // Node radii are 13 (bot) / 17 (human) — add padding so they stay close but never overlap
    const collideForceFn = () => {
      let forceNodes: GraphNode[] = [];
      const force = () => {
        for (let i = 0; i < forceNodes.length; i++) {
          for (let j = i + 1; j < forceNodes.length; j++) {
            const a = forceNodes[i];
            const b = forceNodes[j];
            if (a.x === undefined || a.y === undefined || b.x === undefined || b.y === undefined) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const rA = (a.is_bot ? 13 : 17) + 4;
            const rB = (b.is_bot ? 13 : 17) + 4;
            const minDist = rA + rB;
            if (dist < minDist) {
              const overlap = (minDist - dist) / dist * 0.5;
              const mx = dx * overlap;
              const my = dy * overlap;
              a.vx! -= mx;
              a.vy! -= my;
              b.vx! += mx;
              b.vy! += my;
            }
          }
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (force as any).initialize = (n: GraphNode[]) => { forceNodes = n; };
      return force;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fg.d3Force('collide', collideForceFn() as any);

    // Custom clustering force: pull same-cluster nodes toward each other STRONGLY
    const clusterForceFn = () => {
      let forceNodes: GraphNode[] = [];
      let lastLog = 0;
      const force = (alpha: number) => {
        const centroids = new Map<string, { x: number; y: number; count: number }>();
        forceNodes.forEach(node => {
          if (!node.cluster || node.x === undefined || node.y === undefined) return;
          const c = centroids.get(node.cluster) || { x: 0, y: 0, count: 0 };
          c.x += node.x;
          c.y += node.y;
          c.count += 1;
          centroids.set(node.cluster, c);
        });

        // Debug log every 2 seconds
        const now = Date.now();
        if (now - lastLog > 2000) {
          lastLog = now;
          const nodesWithCluster = forceNodes.filter(n => n.cluster).length;
          console.log(`[Cluster Force] alpha=${alpha.toFixed(3)}, nodes with cluster: ${nodesWithCluster}/${forceNodes.length}, clusters: ${Array.from(centroids.keys()).join(', ')}`);
        }

        forceNodes.forEach(node => {
          if (!node.cluster) return;
          const c = centroids.get(node.cluster);
          if (!c || c.count < 2) return;
          const cx = c.x / c.count;
          const cy = c.y / c.count;

          // Distance to cluster center
          const dx = cx - node.x!;
          const dy = cy - node.y!;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // STRONG pull toward cluster - minimum alpha of 0.1 keeps it always active
          // Strength increases with distance (nodes far from cluster get pulled harder)
          const effectiveAlpha = Math.max(alpha, 0.1);
          const pullStrength = effectiveAlpha * 0.8 * Math.min(dist / 100, 1.5);

          node.vx! += dx * pullStrength;
          node.vy! += dy * pullStrength;
        });
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (force as any).initialize = (n: GraphNode[]) => { forceNodes = n; };
      return force;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fg.d3Force('cluster', clusterForceFn() as any);

    fg.d3ReheatSimulation();
  }, [nodes]);

  useEffect(() => {
    fetchGraphData();
    startBotLoop();

    // Debounce real-time updates - faster for user changes (deletions), slower for likes
    const debouncedFetch = (fast = false) => {
      if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
      fetchTimeout.current = window.setTimeout(fetchGraphData, fast ? 300 : 800);
    };

    const channel = supabase
      .channel('graph-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => debouncedFetch(true)) // Fast update for user changes (drifter expiration)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => debouncedFetch(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => debouncedFetch(false))
      .subscribe();

    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);

    // Update cluster positions every 500ms
    clusterUpdateInterval.current = window.setInterval(updateClusterPositions, 500);

    return () => {
      stopBotLoop();
      supabase.removeChannel(channel);
      window.removeEventListener('resize', handleResize);
      if (fetchTimeout.current) clearTimeout(fetchTimeout.current);
      if (clusterUpdateInterval.current) {
        clearInterval(clusterUpdateInterval.current);
      }
    };
  }, [fetchGraphData, updateClusterPositions]);

  const drawNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    // ── Draw cluster auras (once per cluster per frame) ──
    // Detect new frame: within a single frame all nodeCanvasObject calls
    // happen in < 1 ms; between frames the gap is ~16 ms at 60 fps.
    const now = performance.now();
    if (now - lastClearTime.current > 5) {
      lastClearTime.current = now;
      drawnAuras.current.clear();
    }

    if (node.cluster && !drawnAuras.current.has(node.cluster)) {
      drawnAuras.current.add(node.cluster);
      const cluster = clustersRef.current.find(c => c.id === node.cluster);
      if (cluster) {
        const { x, y, radius, color, name, memberCount } = cluster;

        // Outer glow gradient
        const gradient = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius);
        gradient.addColorStop(0, `${color}25`);
        gradient.addColorStop(0.5, `${color}15`);
        gradient.addColorStop(1, `${color}00`);

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Dashed border ring
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = `${color}60`;
        ctx.lineWidth = 1.5 / globalScale;
        ctx.setLineDash([6 / globalScale, 4 / globalScale]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Echo chamber label at top of aura
        const fontSize = Math.max(16 / globalScale, 4);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(name, x, y - radius - 6 / globalScale);

        // Member count below the aura
        const smallFont = Math.max(11 / globalScale, 3);
        ctx.font = `${smallFont}px sans-serif`;
        ctx.fillStyle = `${color}bb`;
        ctx.textBaseline = 'top';
        ctx.fillText(`${memberCount} people`, x, y + radius + 6 / globalScale);
      }
    }

    // ── Draw the node itself ──
    const size = node.is_bot ? 10 : 14;
    const outlineColor = node.clusterColor || getOutlineColor(node.id, node.is_bot);

    // Pulsing glow effect for nodes that recently joined a cluster (within 5 seconds)
    const timeSinceJoin = node.clusterJoinTime ? (Date.now() - node.clusterJoinTime) : Infinity;
    if (node.cluster && timeSinceJoin < 5000) {
      const pulsePhase = (timeSinceJoin / 300) % (2 * Math.PI);
      const pulseSize = size + 8 + Math.sin(pulsePhase) * 4;
      const pulseOpacity = Math.max(0, 1 - timeSinceJoin / 5000);

      ctx.beginPath();
      ctx.arc(node.x!, node.y!, pulseSize, 0, 2 * Math.PI);
      ctx.fillStyle = `${outlineColor}${Math.floor(pulseOpacity * 100).toString(16).padStart(2, '0')}`;
      ctx.fill();
    }

    // Outline
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, size + 3, 0, 2 * Math.PI);
    ctx.fillStyle = outlineColor;
    ctx.fill();

    // Avatar background (skin)
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
    ctx.fillStyle = node.avatar_config?.skin_color ?? '#888';
    ctx.fill();

    // Hair
    ctx.fillStyle = node.avatar_config?.hair_color ?? '#333';
    ctx.beginPath();
    ctx.arc(node.x!, node.y! - size * 0.3, size * 0.6, Math.PI, 0);
    ctx.fill();

    // Name label for larger nodes
    if (!node.is_bot && size >= 12) {
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(node.name.slice(0, 10), node.x!, node.y! + size + 12);
    }
  }, [getOutlineColor]);

  const appUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/`
    : 'http://localhost:5173/';

  const graphData = useMemo(() => ({ nodes, links }), [nodes, links]);

  return (
    <div className="w-screen h-screen bg-[var(--bg-primary)] overflow-hidden relative">
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#0a0a0a"
        nodeRelSize={10}
        nodeCanvasObject={drawNode}
        nodePointerAreaPaint={(node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, 20, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkColor={(link) => {
          const l = link as GraphLink;
          return l.isTopicLink ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.4)';
        }}
        linkWidth={(link) => Math.min((link as GraphLink).strength * 0.5, 4)}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        cooldownTime={Infinity}
      />

      {/* Title */}
      <div className="absolute top-6 left-6">
        <h1 className="text-3xl font-bold mb-2">Echo Chamber</h1>
        <p className="text-[var(--text-secondary)]">
          Watch opinions cluster in real-time
        </p>
      </div>

      {/* Stats */}
      <div className="absolute top-6 right-6 text-right">
        <div className="text-2xl font-bold">{nodes.length}</div>
        <div className="text-[var(--text-secondary)]">participants</div>
        <div className="text-xl font-bold mt-2">{clusters.length}</div>
        <div className="text-[var(--text-secondary)]">echo chambers</div>
      </div>

      {/* QR Code */}
      <div className="absolute bottom-6 right-6 bg-white p-4 rounded-2xl">
        <QRCodeSVG value={appUrl} size={140} />
        <p className="text-black text-center mt-2 font-medium text-sm">
          Scan to join
        </p>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 bg-[var(--bg-secondary)]/80 backdrop-blur-sm p-4 rounded-xl">
        <p className="text-sm font-semibold mb-2">Topics</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(CANONICAL_CLUSTER_COLORS).map(([topic, color]) => (
              <div key={topic} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="capitalize">{topic}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
