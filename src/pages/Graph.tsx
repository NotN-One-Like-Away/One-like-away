import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { startBotLoop, stopBotLoop } from '../lib/botRunner';
import type { AvatarConfig } from '../types';

// ─── Helpers ────────────────────────────────────────────────

const clamp = (v: number, max = 5) => Math.max(-max, Math.min(max, v));

interface GraphNode {
  id: string;
  name: string;
  is_bot: boolean;
  avatar_config: AvatarConfig | null;
  cluster?: string;
  clusterColor?: string;
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
  [key: string]: unknown;
}

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

const TOPIC_TO_CLUSTER: Record<string, string> = {
  workout: 'fitness', gym: 'fitness', gains: 'fitness', motivation: 'fitness',
  ai: 'tech', coding: 'tech', programming: 'tech', innovation: 'tech',
  bitcoin: 'crypto', blockchain: 'crypto', defi: 'crypto', hodl: 'crypto',
  progressive: 'politics', conservative: 'politics', justice: 'politics', values: 'politics',
  environment: 'climate', sustainability: 'climate', green: 'climate',
  esports: 'gaming', games: 'gaming', streaming: 'gaming',
  recipe: 'food', cooking: 'food', foodie: 'food',
  meditation: 'wellness', mindfulness: 'wellness', peace: 'wellness',
  truth: 'conspiracy', wakeup: 'conspiracy', research: 'conspiracy',
};

const normalize = (t: string): string => {
  const lower = t.toLowerCase().replace(/^#/, '');
  return TOPIC_TO_CLUSTER[lower] || lower;
};

/** Cosine similarity on two topic-weight maps */
const similarity = (a: Map<string, number>, b: Map<string, number>): number => {
  let dot = 0, magA = 0, magB = 0;
  a.forEach((v, k) => { magA += v * v; if (b.has(k)) dot += v * b.get(k)!; });
  b.forEach(v => { magB += v * v; });
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
};

// ─── SVG path data for canvas avatar drawing ────────────────

const FACE_PATHS: Record<string, string> = {
  round:  'M50,10 C75,10 90,30 90,50 C90,75 75,90 50,90 C25,90 10,75 10,50 C10,30 25,10 50,10',
  square: 'M15,15 L85,15 L85,85 L15,85 Z',
  oval:   'M50,5 C80,5 90,35 90,50 C90,70 80,95 50,95 C20,95 10,70 10,50 C10,35 20,5 50,5',
  heart:  'M50,85 C20,60 10,40 25,25 C35,15 50,20 50,35 C50,20 65,15 75,25 C90,40 80,60 50,85',
};

const HAIR_PATHS: Record<string, string> = {
  short:    'M25,35 Q25,15 50,15 Q75,15 75,35 Q75,25 50,25 Q25,25 25,35',
  long:     'M20,35 Q20,10 50,10 Q80,10 80,35 L85,70 Q85,80 75,75 L75,40 Q75,30 50,30 Q25,30 25,40 L25,75 Q15,80 15,70 Z',
  curly:    'M20,40 Q15,20 35,15 Q30,10 50,10 Q70,10 65,15 Q85,20 80,40 Q90,35 85,50 Q80,35 75,40 Q85,30 70,25 Q80,20 50,20 Q20,20 30,25 Q15,30 25,40 Q20,35 10,50 Q15,35 20,40',
  bald:     '',
  mohawk:   'M45,5 L55,5 L55,35 Q50,30 45,35 Z',
  ponytail: 'M25,35 Q25,15 50,15 Q75,15 75,35 Q75,25 50,25 Q25,25 25,35 M70,25 Q85,30 80,55 Q75,65 70,60 Q75,50 70,35',
};

const EYE_SHAPES: Record<string, { rx: number; ry: number }> = {
  round:  { rx: 5, ry: 5 },
  almond: { rx: 6, ry: 4 },
  wide:   { rx: 7, ry: 5 },
  narrow: { rx: 5, ry: 3 },
};

const MOUTH_PATHS: Record<string, string> = {
  smile:   'M35,65 Q50,75 65,65',
  neutral: 'M35,65 L65,65',
  grin:    'M30,62 Q50,80 70,62 Q50,70 30,62',
  small:   'M42,65 Q50,70 58,65',
};

// Pre-render avatar SVGs to offscreen images for perf
const avatarCache = new Map<string, HTMLImageElement>();

function getAvatarImage(nodeId: string, config: AvatarConfig | null, size: number): HTMLImageElement | null {
  if (!config) return null;
  const key = `${nodeId}-${size}`;
  if (avatarCache.has(key)) return avatarCache.get(key)!;

  const face = FACE_PATHS[config.face_shape] || FACE_PATHS.round;
  const hair = HAIR_PATHS[config.hair_style] || '';
  const eye = EYE_SHAPES[config.eye_style] || EYE_SHAPES.round;
  const mouth = MOUTH_PATHS[config.mouth_style] || MOUTH_PATHS.smile;

  // Build glasses/hat/earring accessory SVG
  let accessorySvg = '';
  if (config.accessory === 'glasses') {
    accessorySvg = `<g stroke="#333" stroke-width="2" fill="none">
      <circle cx="35" cy="48" r="10"/><circle cx="65" cy="48" r="10"/>
      <line x1="45" y1="48" x2="55" y2="48"/>
      <line x1="25" y1="48" x2="20" y2="45"/>
      <line x1="75" y1="48" x2="80" y2="45"/>
    </g>`;
  } else if (config.accessory === 'sunglasses') {
    accessorySvg = `<g>
      <rect x="25" y="42" width="20" height="14" rx="2" fill="#1a1a1a"/>
      <rect x="55" y="42" width="20" height="14" rx="2" fill="#1a1a1a"/>
      <line x1="45" y1="48" x2="55" y2="48" stroke="#333" stroke-width="2"/>
    </g>`;
  } else if (config.accessory === 'earring') {
    accessorySvg = `<circle cx="15" cy="55" r="4" fill="#ffd700"/>`;
  } else if (config.accessory === 'hat') {
    accessorySvg = `<g>
      <ellipse cx="50" cy="18" rx="35" ry="8" fill="#333"/>
      <rect x="30" y="5" width="40" height="15" rx="5" fill="#333"/>
    </g>`;
  }

  const hairBehind = config.hair_style === 'long'
    ? `<path d="${HAIR_PATHS.long}" fill="${config.hair_color}"/>` : '';
  const hairFront = config.hair_style !== 'long' && hair
    ? `<path d="${hair}" fill="${config.hair_color}"/>` : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#2a2a2a" rx="50"/>
    ${hairBehind}
    <path d="${face}" fill="${config.skin_color}"/>
    ${hairFront}
    <ellipse cx="35" cy="48" rx="${eye.rx}" ry="${eye.ry}" fill="white"/>
    <ellipse cx="65" cy="48" rx="${eye.rx}" ry="${eye.ry}" fill="white"/>
    <circle cx="35" cy="48" r="3" fill="${config.eye_color}"/>
    <circle cx="65" cy="48" r="3" fill="${config.eye_color}"/>
    <circle cx="36" cy="47" r="1" fill="white"/>
    <circle cx="66" cy="47" r="1" fill="white"/>
    <path d="${mouth}" stroke="#c0846d" stroke-width="2" fill="${config.mouth_style === 'grin' ? '#fff' : 'none'}" stroke-linecap="round"/>
    ${accessorySvg}
  </svg>`;

  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  avatarCache.set(key, img);
  return img;
}

// ─── Component ──────────────────────────────────────────────

export function Graph() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const graphRef = useRef<ForceGraphMethods>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const topicsRef = useRef<Map<string, Map<string, number>>>(new Map()); // userId → {cluster → weight}
  const forcesConfigured = useRef(false);
  const drawnAuras = useRef<Set<string>>(new Set());
  const lastAuraClear = useRef(0);

  // ─── Cluster info for aura drawing ──────────────────────

  interface ClusterInfo { id: string; name: string; color: string; x: number; y: number; radius: number; count: number; }
  const clustersRef = useRef<ClusterInfo[]>([]);

  const updateClusterPositions = useCallback(() => {
    const current = nodesRef.current;
    const groups = new Map<string, GraphNode[]>();
    current.forEach(n => {
      if (!n.cluster || n.cluster === 'neutral') return;
      if (!groups.has(n.cluster)) groups.set(n.cluster, []);
      groups.get(n.cluster)!.push(n);
    });

    const infos: ClusterInfo[] = [];
    groups.forEach((members, cluster) => {
      if (members.length === 0) return;
      let cx = 0, cy = 0;
      members.forEach(m => { cx += m.x || 0; cy += m.y || 0; });
      cx /= members.length;
      cy /= members.length;
      let maxDist = 0;
      members.forEach(m => {
        const d = Math.sqrt((m.x! - cx) ** 2 + (m.y! - cy) ** 2);
        if (d > maxDist) maxDist = d;
      });
      infos.push({
        id: cluster,
        name: `#${cluster}`,
        color: CANONICAL_CLUSTER_COLORS[cluster] || '#6b7280',
        x: cx, y: cy,
        radius: Math.max(50, maxDist + 60),
        count: members.length,
      });
    });
    clustersRef.current = infos;
  }, []);

  // ─── Fetch graph data ─────────────────────────────────────

  const fetchGraphData = useCallback(async () => {
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, avatar_config, is_bot, expires_at')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    const { data: likes } = await supabase
      .from('likes')
      .select('user_id, posts(topic_tags)');

    if (!users) return;

    // Build topic profiles (cluster-normalized)
    const profiles = new Map<string, Map<string, number>>();
    likes?.forEach(l => {
      const tags = (l.posts as unknown as { topic_tags: string[] } | null)?.topic_tags;
      if (!tags) return;
      if (!profiles.has(l.user_id)) profiles.set(l.user_id, new Map());
      const m = profiles.get(l.user_id)!;
      tags.forEach(t => {
        const k = normalize(t);
        m.set(k, (m.get(k) || 0) + 1);
      });
    });
    topicsRef.current = profiles;

    // Build nodes, preserving sim state
    const prevMap = new Map(nodesRef.current.map(n => [n.id, n]));
    const graphNodes: GraphNode[] = users.map(u => {
      const old = prevMap.get(u.id);
      const profile = profiles.get(u.id);

      // Determine dominant cluster
      let maxCluster = 'neutral', maxCount = 0;
      if (profile) {
        profile.forEach((count, cluster) => {
          if (count > maxCount) { maxCount = count; maxCluster = cluster; }
        });
      }

      return {
        id: u.id,
        name: u.display_name,
        is_bot: u.is_bot,
        avatar_config: u.avatar_config,
        cluster: maxCluster,
        clusterColor: CANONICAL_CLUSTER_COLORS[maxCluster] || '#6b7280',
        x: old?.x ?? (Math.random() - 0.5) * 800,
        y: old?.y ?? (Math.random() - 0.5) * 800,
        vx: clamp(old?.vx || 0),
        vy: clamp(old?.vy || 0),
      };
    });

    // Build interaction links from shared likes
    const graphLinks: GraphLink[] = [];
    for (let i = 0; i < graphNodes.length; i++) {
      const aTopics = profiles.get(graphNodes[i].id);
      if (!aTopics) continue;
      for (let j = i + 1; j < graphNodes.length; j++) {
        const bTopics = profiles.get(graphNodes[j].id);
        if (!bTopics) continue;
        const sim = similarity(aTopics, bTopics);
        if (sim > 0.1) {
          graphLinks.push({ source: graphNodes[i].id, target: graphNodes[j].id, strength: sim });
        }
      }
    }

    // Identity-preserving update
    const prev = nodesRef.current;
    const sameIds = prev.length === graphNodes.length &&
      prev.every((n, i) => n.id === graphNodes[i].id);

    if (!sameIds) {
      nodesRef.current = graphNodes;
      setNodes(graphNodes);
    } else {
      graphNodes.forEach((n, i) => Object.assign(prev[i], n));
      setNodes([...prev]);
    }
    setLinks(graphLinks);

    updateClusterPositions();
    graphRef.current?.d3ReheatSimulation();
  }, [updateClusterPositions]);

  // Keep ref in sync
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // ─── Configure forces ─────────────────────────────────────

  useEffect(() => {
    if (!graphRef.current || nodes.length === 0 || forcesConfigured.current) return;
    const fg = graphRef.current;
    forcesConfigured.current = true;

    // Charge: repulsion between all nodes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const charge = fg.d3Force('charge') as any;
    if (charge?.strength) {
      charge.strength(-80);
      charge.distanceMax(400);
      charge.distanceMin(10);
    }

    // Link: similarity-weighted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = fg.d3Force('link') as any;
    if (link?.distance) link.distance(80);
    if (link?.strength) {
      link.strength((l: GraphLink) => Math.min(1.5, l.strength * 1.2));
    }

    // Center: gentle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const center = fg.d3Force('center') as any;
    if (center?.strength) center.strength(0.05);

    // LIVE SIMILARITY FORCE — reads topicsRef for real-time cluster attraction
    const similarityForce = () => {
      let forceNodes: GraphNode[] = [];
      const force = (alpha: number) => {
        const topics = topicsRef.current;
        if (topics.size === 0) return;

        for (let i = 0; i < forceNodes.length; i++) {
          const a = forceNodes[i];
          if (a.x == null || a.y == null || !isFinite(a.x) || !isFinite(a.y)) continue;
          const aTopics = topics.get(a.id);
          if (!aTopics || aTopics.size === 0) continue;

          for (let j = i + 1; j < forceNodes.length; j++) {
            const b = forceNodes[j];
            if (b.x == null || b.y == null || !isFinite(b.x) || !isFinite(b.y)) continue;
            const bTopics = topics.get(b.id);
            if (!bTopics || bTopics.size === 0) continue;

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 5 || dist > 500) continue; // zero-distance guard + cutoff

            const sim = similarity(aTopics, bTopics);
            if (sim <= 0) continue;

            // Spring toward target distance, scaled by similarity
            const targetDist = 40;
            const diff = dist - targetDist;
            const strength = sim * 0.4;
            const f = diff * strength * alpha;

            const nx = dx / dist;
            const ny = dy / dist;
            a.vx = (a.vx || 0) + nx * f;
            a.vy = (a.vy || 0) + ny * f;
            b.vx = (b.vx || 0) - nx * f;
            b.vy = (b.vy || 0) - ny * f;
          }
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (force as any).initialize = (n: GraphNode[]) => { forceNodes = n; };
      return force;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fg.d3Force('similarity', similarityForce() as any);

    // Collision
    const collisionForce = () => {
      let forceNodes: GraphNode[] = [];
      const force = (alpha: number) => {
        for (let i = 0; i < forceNodes.length; i++) {
          const a = forceNodes[i];
          if (a.x == null || a.y == null || !isFinite(a.x) || !isFinite(a.y)) continue;
          for (let j = i + 1; j < forceNodes.length; j++) {
            const b = forceNodes[j];
            if (b.x == null || b.y == null || !isFinite(b.x) || !isFinite(b.y)) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist > 80) continue;
            const rA = (a.is_bot ? 12 : 16) + 4;
            const rB = (b.is_bot ? 12 : 16) + 4;
            const minDist = rA + rB;
            if (dist < minDist) {
              const overlap = ((minDist - dist) / dist) * 0.8 * alpha;
              a.vx = (a.vx || 0) - dx * overlap;
              a.vy = (a.vy || 0) - dy * overlap;
              b.vx = (b.vx || 0) + dx * overlap;
              b.vy = (b.vy || 0) + dy * overlap;
            }
          }
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (force as any).initialize = (n: GraphNode[]) => { forceNodes = n; };
      return force;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fg.d3Force('collide', collisionForce() as any);

    fg.d3ReheatSimulation();
  }, [nodes]);

  // ─── Lifecycle: fetch, bots, realtime ─────────────────────

  useEffect(() => {
    fetchGraphData();
    startBotLoop();

    // Real-time: incremental topic update on new likes
    const channel = supabase
      .channel('graph-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, async (payload) => {
        // Fetch the post's topic tags for this like
        const like = payload.new as { user_id: string; post_id: string };
        const { data: post } = await supabase
          .from('posts')
          .select('topic_tags')
          .eq('id', like.post_id)
          .single();

        if (post?.topic_tags) {
          // Incrementally update the live topic map
          if (!topicsRef.current.has(like.user_id)) {
            topicsRef.current.set(like.user_id, new Map());
          }
          const m = topicsRef.current.get(like.user_id)!;
          post.topic_tags.forEach((t: string) => {
            const k = normalize(t);
            m.set(k, (m.get(k) || 0) + 1);
          });

          // Update node's cluster assignment live
          const node = nodesRef.current.find(n => n.id === like.user_id);
          if (node) {
            let maxCluster = 'neutral', maxCount = 0;
            m.forEach((count, cluster) => {
              if (count > maxCount) { maxCount = count; maxCluster = cluster; }
            });
            node.cluster = maxCluster;
            node.clusterColor = CANONICAL_CLUSTER_COLORS[maxCluster] || '#6b7280';
          }

          // Reheat to make forces respond
          graphRef.current?.d3ReheatSimulation();
          updateClusterPositions();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        // Full refetch on user add/remove (topology change)
        fetchGraphData();
      })
      .subscribe();

    // Periodic full refresh for link/cluster recalculation
    const poll = setInterval(fetchGraphData, 8000);

    // Cluster position update timer
    const clusterPoll = setInterval(updateClusterPositions, 500);

    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);

    return () => {
      stopBotLoop();
      supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(clusterPoll);
      window.removeEventListener('resize', handleResize);
    };
  }, [fetchGraphData, updateClusterPositions]);

  // ─── Canvas drawing: avatars + auras ──────────────────────

  const drawNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const nx = node.x, ny = node.y;
    if (nx == null || ny == null || !isFinite(nx) || !isFinite(ny)) return;

    try {
      // ── Aura (once per cluster per frame) ──
      const now = performance.now();
      if (now - lastAuraClear.current > 5) { lastAuraClear.current = now; drawnAuras.current.clear(); }

      if (node.cluster && node.cluster !== 'neutral' && !drawnAuras.current.has(node.cluster)) {
        drawnAuras.current.add(node.cluster);
        const c = clustersRef.current.find(ci => ci.id === node.cluster);
        if (c && isFinite(c.x) && isFinite(c.y) && c.radius > 0) {
          const r = c.radius + 40;
          const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
          grad.addColorStop(0, `${c.color}20`);
          grad.addColorStop(0.7, `${c.color}0a`);
          grad.addColorStop(1, `${c.color}00`);
          ctx.beginPath();
          ctx.arc(c.x, c.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(c.x, c.y, r, 0, 2 * Math.PI);
          ctx.strokeStyle = `${c.color}30`;
          ctx.lineWidth = 1 / globalScale;
          ctx.setLineDash([6 / globalScale, 6 / globalScale]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Label
          const fontSize = Math.max(14 / globalScale, 4);
          ctx.font = `600 ${fontSize}px sans-serif`;
          ctx.fillStyle = `${c.color}90`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(c.name, c.x, c.y - r * 0.6);

          const smallFont = Math.max(10 / globalScale, 3);
          ctx.font = `${smallFont}px sans-serif`;
          ctx.fillStyle = `${c.color}60`;
          ctx.textBaseline = 'top';
          ctx.fillText(`${c.count} people`, c.x, c.y - r * 0.6 + fontSize + 2 / globalScale);
        }
      }

      // ── Node: avatar image ──
      const size = node.is_bot ? 24 : 32;
      const outlineColor = node.clusterColor || '#6b7280';

      // Outline ring
      ctx.beginPath();
      ctx.arc(nx, ny, size / 2 + 3, 0, 2 * Math.PI);
      ctx.fillStyle = outlineColor;
      ctx.fill();

      // Clip to circle for avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(nx, ny, size / 2, 0, 2 * Math.PI);
      ctx.clip();

      const img = getAvatarImage(node.id, node.avatar_config, size * 4); // render at 4x for sharpness
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, nx - size / 2, ny - size / 2, size, size);
      } else {
        // Fallback circle while image loads
        ctx.fillStyle = node.avatar_config?.skin_color ?? '#888';
        ctx.fillRect(nx - size / 2, ny - size / 2, size, size);
      }
      ctx.restore();

      // Name label
      const labelSize = Math.max(8 / globalScale, 3);
      ctx.font = `500 ${labelSize}px sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(node.name, nx, ny + size / 2 + 4);
    } catch {
      // Silently handle drawing errors
    }
  }, []);

  // ─── Render ───────────────────────────────────────────────

  const appUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '';
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
          if (node.x == null || node.y == null) return;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 20, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkColor={() => 'rgba(99, 102, 241, 0.15)'}
        linkWidth={(link) => Math.min((link as GraphLink).strength * 3, 4)}
        d3AlphaDecay={0.008}
        d3VelocityDecay={0.15}
        cooldownTime={Infinity}
      />

      {/* Title */}
      <div className="absolute top-6 left-6">
        <h1 className="text-3xl font-bold mb-2">Echo Chamber</h1>
        <p className="text-[var(--text-secondary)]">Watch opinions cluster in real-time</p>
      </div>

      {/* QR Code */}
      <div className="absolute bottom-6 right-6 bg-white/95 p-4 rounded-2xl shadow-xl backdrop-blur-md flex flex-col items-center">
        <QRCodeSVG value={appUrl} size={140} level="M" />
        <p className="text-black text-center mt-2 font-medium text-sm">Scan to join</p>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 bg-white/10 backdrop-blur-md rounded-xl p-4">
        <p className="text-white/70 text-xs mb-2 font-medium">ECHO CHAMBERS</p>
        <div className="grid grid-cols-3 gap-x-4 gap-y-1">
          {Object.entries(CANONICAL_CLUSTER_COLORS).map(([topic, color]) => (
            <div key={topic} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-white/80 text-xs">{topic}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
