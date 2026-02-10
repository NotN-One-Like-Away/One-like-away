import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { startBotLoop, stopBotLoop } from '../lib/botRunner';
import type { User } from '../types';

const clamp = (v: number, max = 5) => Math.max(-max, Math.min(max, v));

interface GraphNode {
  id: string;
  name: string;
  is_bot: boolean;
  avatar_config: User['avatar_config'];
  topics: Record<string, number>;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  cluster?: string;
  clusterColor?: string;
}

interface GraphLink {
  source: string;
  target: string;
  strength: number;
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
  workout: 'fitness', gym: 'fitness', gains: 'fitness',
  ai: 'tech', coding: 'tech', programming: 'tech',
  bitcoin: 'crypto', blockchain: 'crypto', defi: 'crypto',
  progressive: 'politics', conservative: 'politics',
  environment: 'climate', sustainability: 'climate',
  esports: 'gaming', streaming: 'gaming',
  recipe: 'food', cooking: 'food',
  meditation: 'wellness', mindfulness: 'wellness',
  truth: 'conspiracy', wakeup: 'conspiracy',
};

const normalize = (t: string) => TOPIC_TO_CLUSTER[t] || t;

const cosineSimilarity = (a: Record<string, number>, b: Record<string, number>) => {
  let dot = 0, magA = 0, magB = 0;
  for (const k in a) {
    magA += a[k] ** 2;
    if (b[k]) dot += a[k] * b[k];
  }
  for (const k in b) magB += b[k] ** 2;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
};

export function Graph() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const graphRef = useRef<ForceGraphMethods>(null);
  const nodesRef = useRef<GraphNode[]>([]);

  const fetchGraphData = useCallback(async () => {
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name, avatar_config, is_bot, expires_at')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    const { data: likes } = await supabase
      .from('likes')
      .select('user_id, posts(topic_tags)');

    if (!users) return;

    const profiles = new Map<string, Record<string, number>>();

    likes?.forEach(l => {
      const tags = l.posts?.topic_tags;
      if (!tags) return;
      const profile = profiles.get(l.user_id) || {};
      tags.forEach(t => {
        const k = normalize(t.toLowerCase());
        profile[k] = (profile[k] || 0) + 1;
      });
      profiles.set(l.user_id, profile);
    });

    const prev = nodesRef.current;
    const prevMap = new Map(prev.map(n => [n.id, n]));

    const graphNodes: GraphNode[] = users.map(u => {
      const old = prevMap.get(u.id);
      return {
        id: u.id,
        name: u.display_name,
        is_bot: u.is_bot,
        avatar_config: u.avatar_config,
        topics: profiles.get(u.id) || {},
        x: old?.x ?? (Math.random() - 0.5) * 800,
        y: old?.y ?? (Math.random() - 0.5) * 800,
        vx: clamp(old?.vx || 0),
        vy: clamp(old?.vy || 0),
      };
    });

    const graphLinks: GraphLink[] = [];
    for (let i = 0; i < graphNodes.length; i++) {
      for (let j = i + 1; j < graphNodes.length; j++) {
        const a = graphNodes[i];
        const b = graphNodes[j];
        const sim = cosineSimilarity(a.topics, b.topics);
        if (sim > 0.2) {
          graphLinks.push({ source: a.id, target: b.id, strength: sim });
        }
      }
    }

    // Label clusters AFTER structure exists
    graphNodes.forEach(n => {
      let max = 0, topic = '';
      for (const t in n.topics) {
        if (n.topics[t] > max) {
          max = n.topics[t];
          topic = t;
        }
      }
      n.cluster = topic || 'neutral';
      n.clusterColor = CANONICAL_CLUSTER_COLORS[topic] || '#6b7280';
    });

    nodesRef.current = graphNodes;
    setNodes(graphNodes);
    setLinks(graphLinks);

    graphRef.current?.d3ReheatSimulation();
  }, []);

  useEffect(() => {
    fetchGraphData();
    startBotLoop();

    const channel = supabase
      .channel('graph')
      .on('postgres_changes', { event: '*', schema: 'public' }, fetchGraphData)
      .subscribe();

    return () => {
      stopBotLoop();
      supabase.removeChannel(channel);
    };
  }, [fetchGraphData]);

  const graphData = useMemo(() => ({ nodes, links }), [nodes, links]);

  return (
    <div className="w-screen h-screen bg-black">
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        nodeColor={n => (n as GraphNode).clusterColor || '#888'}
        linkWidth={l => (l as GraphLink).strength * 3}
        linkColor="rgba(255,255,255,0.2)"
        d3VelocityDecay={0.2}
      />
      <div className="absolute bottom-6 right-6 bg-white p-4 rounded-xl">
        <QRCodeSVG value={window.location.origin} size={140} />
      </div>
    </div>
  );
}
