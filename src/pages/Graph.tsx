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
  lockedCluster?: string; // For cluster inertia/hysteresis
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

// Fixed hotspot positions for each cluster — arranged in a circle so they never overlap.
// Positions are computed once relative to screen center; the radius is large enough
// that clusters stay visually separated.
const CLUSTER_NAMES = Object.keys(CANONICAL_CLUSTER_COLORS);
const HOTSPOT_RADIUS = 350; // distance from center to each hotspot
const CLUSTER_HOTSPOTS: Record<string, { x: number; y: number }> = {};
CLUSTER_NAMES.forEach((name, i) => {
  const angle = (2 * Math.PI * i) / CLUSTER_NAMES.length - Math.PI / 2; // start at top
  CLUSTER_HOTSPOTS[name] = {
    x: Math.cos(angle) * HOTSPOT_RADIUS,
    y: Math.sin(angle) * HOTSPOT_RADIUS,
  };
});

/**
 * Determine dominant cluster with hysteresis to prevent oscillation.
 * Requires a clear leader (dominanceRatio × second place) to assign identity.
 * Returns 'neutral' for ties or weak signals.
 */
function getDominantCluster(
  profile: Map<string, number> | undefined,
  dominanceRatio = 1.8 // Reduced from 2.5 for faster chamber lock-in
): string {
  if (!profile || profile.size === 0) return 'neutral';

  const entries = Array.from(profile.entries())
    .filter(([k]) => CANONICAL_CLUSTER_COLORS[k])
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return 'neutral';
  if (entries.length === 1) return entries[0][0];

  const [top, second] = entries;

  // Require clear dominance to avoid flip-flopping
  if (top[1] >= second[1] * dominanceRatio) {
    return top[0];
  }

  return 'neutral';
}

/** Cosine similarity on two topic-weight maps */
const similarity = (a: Map<string, number>, b: Map<string, number>): number => {
  let dot = 0, magA = 0, magB = 0;
  a.forEach((v, k) => { magA += v * v; if (b.has(k)) dot += v * b.get(k)!; });
  b.forEach(v => { magB += v * v; });
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? dot / denom : 0;
};

// ─── SVG path data for canvas avatar drawing ────────────────

// Eye dimensions per style (matches Avatar.tsx)
const EYE_DIMS: Record<string, { rx: number; ry: number; ir: number; pr: number; hl: number }> = {
  round:  { rx: 5.5, ry: 6,   ir: 4,   pr: 2,   hl: 1.2 },
  almond: { rx: 7,   ry: 4.5, ir: 3.5, pr: 1.8, hl: 1.0 },
  wide:   { rx: 7,   ry: 7,   ir: 5,   pr: 2.2, hl: 1.3 },
  narrow: { rx: 6,   ry: 3,   ir: 2.5, pr: 1.5, hl: 0.8 },
};

// Pre-render avatar SVGs to offscreen images for perf
const avatarCache = new Map<string, HTMLImageElement>();

function getAvatarImage(nodeId: string, config: AvatarConfig | null, size: number): HTMLImageElement | null {
  if (!config) return null;
  const key = `${nodeId}-${size}`;
  if (avatarCache.has(key)) return avatarCache.get(key)!;

  const ed = EYE_DIMS[config.eye_style] || EYE_DIMS.round;

  // Face shape SVG
  const faceMap: Record<string, string> = {
    round:  `<circle cx="50" cy="52" r="32" fill="${config.skin_color}"/>`,
    oval:   `<ellipse cx="50" cy="52" rx="27" ry="35" fill="${config.skin_color}"/>`,
    square: `<rect x="19" y="20" width="62" height="64" rx="14" fill="${config.skin_color}"/>`,
    heart:  `<path d="M50,86 C32,84 18,66 18,48 C18,28 30,18 50,18 C70,18 82,28 82,48 C82,66 68,84 50,86" fill="${config.skin_color}"/>`,
  };
  const faceSvg = faceMap[config.face_shape] || faceMap.round;

  // Hair back layer
  let hairBack = '';
  if (config.hair_style === 'long') {
    hairBack = `<path d="M16,48 C16,14 35,4 50,4 C65,4 84,14 84,48 L86,82 C84,86 80,78 78,72 L78,48 C78,32 66,24 50,24 C34,24 22,32 22,48 L22,72 C20,78 16,86 14,82 Z" fill="${config.hair_color}"/>`;
  } else if (config.hair_style === 'curly') {
    hairBack = `<circle cx="18" cy="46" r="12" fill="${config.hair_color}"/><circle cx="82" cy="46" r="12" fill="${config.hair_color}"/>`;
  }

  // Hair front layer
  const hairFrontMap: Record<string, string> = {
    short: `<path d="M20,48 C20,22 35,10 50,10 C65,10 80,22 80,48 C78,40 65,34 50,34 C35,34 22,40 20,48" fill="${config.hair_color}"/>`,
    long:  `<path d="M20,48 C20,22 35,10 50,10 C65,10 80,22 80,48 C78,40 65,34 50,34 C35,34 22,40 20,48" fill="${config.hair_color}"/>`,
    curly: `<g fill="${config.hair_color}"><circle cx="28" cy="24" r="14"/><circle cx="50" cy="16" r="16"/><circle cx="72" cy="24" r="14"/><circle cx="20" cy="38" r="11"/><circle cx="80" cy="38" r="11"/><circle cx="40" cy="14" r="11"/><circle cx="60" cy="14" r="11"/></g>`,
    bald:  '',
    mohawk: `<path d="M42,32 C42,10 46,2 50,2 C54,2 58,10 58,32 C56,28 44,28 42,32" fill="${config.hair_color}"/>`,
    ponytail: `<path d="M20,48 C20,22 35,10 50,10 C65,10 80,22 80,48 C78,40 65,34 50,34 C35,34 22,40 20,48" fill="${config.hair_color}"/><path d="M76,36 C90,40 92,58 82,68 C78,62 82,46 76,40 Z" fill="${config.hair_color}"/><circle cx="78" cy="38" r="3" fill="#ff6b8a"/>`,
  };
  const hairFront = hairFrontMap[config.hair_style] || '';

  // Mouth
  const mouthMap: Record<string, string> = {
    smile:   `<path d="M40,64 Q50,72 60,64" stroke="#d4827a" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    neutral: `<path d="M40,66 L60,66" stroke="#d4827a" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    grin:    `<path d="M36,63 Q50,76 64,63" stroke="#d4827a" stroke-width="2" fill="white" stroke-linecap="round"/><line x1="38" y1="64.5" x2="62" y2="64.5" stroke="#d4827a" stroke-width="0.8"/>`,
    small:   `<path d="M44,65 Q50,69 56,65" stroke="#d4827a" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  };
  const mouthSvg = mouthMap[config.mouth_style] || mouthMap.smile;

  // Accessories
  let accessorySvg = '';
  if (config.accessory === 'glasses') {
    accessorySvg = `<g stroke="#555" stroke-width="2" fill="none"><circle cx="38" cy="47" r="10"/><circle cx="62" cy="47" r="10"/><line x1="48" y1="47" x2="52" y2="47"/><line x1="28" y1="47" x2="20" y2="44"/><line x1="72" y1="47" x2="80" y2="44"/></g>`;
  } else if (config.accessory === 'sunglasses') {
    accessorySvg = `<g><rect x="26" y="41" width="20" height="13" rx="3" fill="#1a1a1a" opacity="0.85"/><rect x="54" y="41" width="20" height="13" rx="3" fill="#1a1a1a" opacity="0.85"/><line x1="46" y1="47" x2="54" y2="47" stroke="#444" stroke-width="2"/><line x1="26" y1="47" x2="18" y2="44" stroke="#444" stroke-width="2"/><line x1="74" y1="47" x2="82" y2="44" stroke="#444" stroke-width="2"/></g>`;
  } else if (config.accessory === 'earring') {
    accessorySvg = `<circle cx="16" cy="58" r="3.5" fill="#ffd700"/>`;
  } else if (config.accessory === 'hat') {
    accessorySvg = `<g><ellipse cx="50" cy="20" rx="38" ry="8" fill="#444"/><rect x="28" y="4" width="44" height="18" rx="8" fill="#444"/></g>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="50" fill="#2d3748"/>
    ${hairBack}
    <circle cx="18" cy="52" r="5" fill="${config.skin_color}"/>
    <circle cx="82" cy="52" r="5" fill="${config.skin_color}"/>
    ${faceSvg}
    <ellipse cx="30" cy="59" rx="6" ry="3" fill="#ff8888" opacity="0.2"/>
    <ellipse cx="70" cy="59" rx="6" ry="3" fill="#ff8888" opacity="0.2"/>
    <ellipse cx="50" cy="57" rx="2.5" ry="1.8" fill="#000" opacity="0.06"/>
    <ellipse cx="38" cy="47" rx="${ed.rx}" ry="${ed.ry}" fill="white"/>
    <circle cx="38" cy="47.5" r="${ed.ir}" fill="${config.eye_color}"/>
    <circle cx="38" cy="47.5" r="${ed.pr}" fill="#1a1a1a"/>
    <circle cx="39.5" cy="46" r="${ed.hl}" fill="white"/>
    <ellipse cx="62" cy="47" rx="${ed.rx}" ry="${ed.ry}" fill="white"/>
    <circle cx="62" cy="47.5" r="${ed.ir}" fill="${config.eye_color}"/>
    <circle cx="62" cy="47.5" r="${ed.pr}" fill="#1a1a1a"/>
    <circle cx="63.5" cy="46" r="${ed.hl}" fill="white"/>
    <path d="M30,39 Q38,35 44,39" stroke="${config.hair_color}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M56,39 Q62,35 70,39" stroke="${config.hair_color}" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${mouthSvg}
    ${hairFront}
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
  const likeTopicsRef = useRef<Map<string, Map<string, number>>>(new Map()); // userId → likes-only {cluster → weight}
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

    // Always emit an entry for every cluster that has a hotspot,
    // even if no members yet — so auras always appear at the anchor.
    CLUSTER_NAMES.forEach(cluster => {
      const hotspot = CLUSTER_HOTSPOTS[cluster];
      const members = groups.get(cluster) || [];

      // Aura center = the fixed hotspot (always stable)
      const cx = hotspot.x;
      const cy = hotspot.y;

      // Radius based on member spread around the hotspot
      let maxDist = 0;
      members.forEach(m => {
        const d = Math.sqrt(((m.x || 0) - cx) ** 2 + ((m.y || 0) - cy) ** 2);
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

    const { data: attractions } = await supabase
      .from('attractions')
      .select('source_id, target_id, weight');

    if (!users) return;

    // Build topic profiles from attractions table (single source of truth)
    const profiles = new Map<string, Map<string, number>>();
    const likeProfiles = new Map<string, Map<string, number>>();

    attractions?.forEach(a => {
      if (!profiles.has(a.source_id)) profiles.set(a.source_id, new Map());
      const userProfile = profiles.get(a.source_id)!;
      
      // Extract topic from target_id (format: "topic:{canonical}")
      if (a.target_id.startsWith('topic:')) {
        const topic = a.target_id.slice(6);
        userProfile.set(topic, a.weight);
        
        // For cluster assignment, track in likes profile too
        if (!likeProfiles.has(a.source_id)) likeProfiles.set(a.source_id, new Map());
        likeProfiles.get(a.source_id)!.set(topic, a.weight);
      }
    });

    topicsRef.current = profiles;
    likeTopicsRef.current = likeProfiles;

    // Build nodes, preserving sim state
    const prevMap = new Map(nodesRef.current.map(n => [n.id, n]));
    const graphNodes: GraphNode[] = users.map(u => {
      const old = prevMap.get(u.id);

      // MANDATORY: use LIKES-ONLY profile for cluster identity
      // No fallback to exposure/profiles - if no likes, stay neutral
      // This prevents bots/exposure from creating false identity
      const clusterProfile = likeProfiles.get(u.id);

      // Use dominant cluster detection with hysteresis
      const newCluster = getDominantCluster(clusterProfile);
      const prevCluster = old?.lockedCluster || 'neutral';
      
      // Cluster inertia: only change if new cluster is strong and different
      let finalCluster: string;
      let lockedCluster: string;
      
      if (newCluster !== 'neutral' && newCluster !== prevCluster) {
        // Entering or switching chamber - accept if dominant
        lockedCluster = newCluster;
        finalCluster = newCluster;
      } else if (newCluster === 'neutral' && prevCluster !== 'neutral') {
        // Don't immediately lose chamber identity on weak signal
        lockedCluster = prevCluster;
        finalCluster = prevCluster;
      } else {
        // Stable state
        lockedCluster = prevCluster;
        finalCluster = prevCluster;
      }

      return {
        id: u.id,
        name: u.display_name,
        is_bot: u.is_bot,
        avatar_config: u.avatar_config,
        cluster: finalCluster,
        clusterColor: CANONICAL_CLUSTER_COLORS[finalCluster] || '#6b7280',
        lockedCluster: lockedCluster,
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

    // Charge: light repulsion — just enough to prevent total overlap
    // Similarity force handles the real clustering logic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const charge = fg.d3Force('charge') as any;
    if (charge?.strength) {
      charge.strength(-15);      // light repulsion — prevents overlap only
      charge.distanceMax(80);    // short range so it doesn't create a repulsion moat around clusters
      charge.distanceMin(10);
    }

    // Remove link force — nodes no longer pull each other,
    // they only get pulled toward their cluster hotspot.
    fg.d3Force('link', null);

    // Remove center force — hotspots already anchor nodes;
    // centering fights the circular layout and drags nodes inward.
    fg.d3Force('center', null);

    // Remove similarity force — all clustering is via hotspot gravity.
    fg.d3Force('similarity', null);

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

    // CLUSTER GRAVITY — pulls nodes toward their cluster's FIXED HOTSPOT.
    // Hotspots are arranged in a circle so clusters never overlap.
    // This creates stable "basins" that keep users inside echo chambers.
    const clusterGravityForce = () => {
      let forceNodes: GraphNode[] = [];

      const force = () => {
        for (const n of forceNodes) {
          if (!n.cluster || n.cluster === 'neutral') continue;
          if (n.x == null || n.y == null || !isFinite(n.x) || !isFinite(n.y)) continue;

          const hotspot = CLUSTER_HOTSPOTS[n.cluster];
          if (!hotspot) continue;

          const dx = hotspot.x - n.x;
          const dy = hotspot.y - n.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 5) continue;

          // Pull strength: stronger when far away (helps initial placement),
          // constant minimum so nodes stay trapped inside the basin.
          const basePull = n.is_bot ? 0.25 : 0.35;
          // Ramp up pull for nodes far from their hotspot (> 150px)
          const distFactor = dist > 150 ? 1 + (dist - 150) * 0.005 : 1;
          const strength = basePull * distFactor;

          const nx = dx / dist;
          const ny = dy / dist;

          n.vx = (n.vx || 0) + nx * strength;
          n.vy = (n.vy || 0) + ny * strength;
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (force as any).initialize = (n: GraphNode[]) => { forceNodes = n; };
      return force;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fg.d3Force('clusterGravity', clusterGravityForce() as any);

    fg.d3ReheatSimulation();
  }, [nodes]);

  // ─── Lifecycle: fetch, bots, realtime ─────────────────────

  useEffect(() => {
    fetchGraphData();
    startBotLoop();

    // Real-time updates: watch for data changes
    const channel = supabase
      .channel('graph-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        // Full refetch on user add/remove (topology change)
        fetchGraphData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attractions' }, async (payload) => {
        // Real-time attraction updates - update data structures only, defer UI updates to polling interval
        const attraction = payload.new as { source_id: string; target_id: string; weight: number };
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          // Update botRunner's attraction graph in real-time
          const { getAllAttractions } = await import('../lib/botRunner');
          const attractionGraph = getAllAttractions();
          
          if (!attractionGraph.has(attraction.source_id)) {
            attractionGraph.set(attraction.source_id, new Map());
          }
          attractionGraph.get(attraction.source_id)!.set(attraction.target_id, attraction.weight);
          
          // Update local topic profiles if it's a topic attraction
          if (attraction.target_id.startsWith('topic:')) {
            const topic = attraction.target_id.slice(6);
            
            if (!topicsRef.current.has(attraction.source_id)) {
              topicsRef.current.set(attraction.source_id, new Map());
            }
            topicsRef.current.get(attraction.source_id)!.set(topic, attraction.weight);
            
            if (!likeTopicsRef.current.has(attraction.source_id)) {
              likeTopicsRef.current.set(attraction.source_id, new Map());
            }
            likeTopicsRef.current.get(attraction.source_id)!.set(topic, attraction.weight);
            
            // Update node's cluster (in nodesRef only, no UI update)
            const node = nodesRef.current.find(n => n.id === attraction.source_id);
            if (node) {
              const lm = likeTopicsRef.current.get(attraction.source_id)!;
              
              // Use dominant cluster detection with hysteresis
              const newCluster = getDominantCluster(lm);
              const prevCluster = node.lockedCluster || 'neutral';
              
              // Cluster inertia: only update if strong signal
              if (newCluster !== 'neutral' && newCluster !== prevCluster) {
                node.lockedCluster = newCluster;
                node.cluster = newCluster;
                node.clusterColor = CANONICAL_CLUSTER_COLORS[newCluster] || '#6b7280';
                console.log(`🔄 ${node.name}: ${topic}=${attraction.weight.toFixed(1)} → cluster: ${prevCluster} → ${newCluster}`);
              } else if (newCluster === 'neutral' && prevCluster !== 'neutral') {
                // Keep previous cluster on weak signal
                node.cluster = prevCluster;
                node.clusterColor = CANONICAL_CLUSTER_COLORS[prevCluster] || '#6b7280';
              }
              
              // Let the 3s UI sync interval handle renders
            }
          }
        }
      })
      .subscribe();

    // Periodic full refresh - reduced from 8s to 15s
    const poll = setInterval(fetchGraphData, 15000);

    // Cluster position update - reduced from 500ms to 2s
    const clusterPoll = setInterval(updateClusterPositions, 2000);

    // Periodic UI sync to reflect real-time cluster changes without full refetch
    // This batches UI updates from real-time attraction changes every 3 seconds
    const uiSyncPoll = setInterval(() => {
      setNodes([...nodesRef.current]);
      graphRef.current?.d3ReheatSimulation();
    }, 3000);

    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);

    return () => {
      stopBotLoop();
      supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(clusterPoll);
      clearInterval(uiSyncPoll);
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
        linkColor={(link) => {
          const s = (link as GraphLink).strength;
          const opacity = Math.min(0.5, s * 0.6);
          // Color links by the cluster of the source node (falls back to indigo)
          const src = (link as any).source;
          const srcNode = typeof src === 'object' ? src as GraphNode : null;
          const clusterColor = srcNode?.clusterColor || '#6366f1';
          // Parse hex to rgb for opacity
          const r = parseInt(clusterColor.slice(1, 3), 16);
          const g = parseInt(clusterColor.slice(3, 5), 16);
          const b = parseInt(clusterColor.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }}
        linkWidth={(link) => Math.min((link as GraphLink).strength * 2.5, 3)}
        d3AlphaDecay={0.005}
        d3VelocityDecay={0.25}
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
