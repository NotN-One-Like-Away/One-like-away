import { useEffect, useState, useCallback, useRef } from 'react';
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

  const getOutlineColor = useCallback((userId: string, isBot: boolean) => {
    if (isBot) return '#6366f1';
    if (!colorIndexRef.current.has(userId)) {
      colorIndexRef.current.set(userId, colorIndexRef.current.size % OUTLINE_COLORS.length);
    }
    return OUTLINE_COLORS[colorIndexRef.current.get(userId)!];
  }, []);

  const getClusterColor = (topic: string): string => {
    return CLUSTER_COLORS[topic.toLowerCase()] || DEFAULT_CLUSTER_COLOR;
  };

  const fetchGraphData = useCallback(async () => {
    // Get all active users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name, avatar_config, is_bot, expires_at')
      .or(`is_bot.eq.true,expires_at.gt.${new Date().toISOString()}`);

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

    likes?.forEach((like) => {
      const post = like.posts as unknown as { user_id: string; topic_tags: string[] } | null;
      if (!post?.topic_tags) return;

      const existing = userTopics.get(like.user_id) || new Map<string, number>();
      post.topic_tags.forEach((tag) => {
        existing.set(tag, (existing.get(tag) || 0) + 1);
      });
      userTopics.set(like.user_id, existing);
    });

    // Find dominant topic for each user
    const userDominantTopic = new Map<string, string>();
    userTopics.forEach((topics, userId) => {
      let maxTopic = '';
      let maxCount = 0;
      topics.forEach((count, topic) => {
        if (count > maxCount) {
          maxCount = count;
          maxTopic = topic;
        }
      });
      if (maxTopic) {
        userDominantTopic.set(userId, maxTopic);
      }
    });

    // Build nodes
    const graphNodes: GraphNode[] = users.map((user) => {
      const topics = userTopics.get(user.id);
      const topicList = topics ? Array.from(topics.keys()) : [];
      const dominantTopic = userDominantTopic.get(user.id);

      return {
        id: user.id,
        name: user.display_name,
        is_bot: user.is_bot,
        avatar_config: user.avatar_config,
        topics: topicList,
        cluster: dominantTopic,
        clusterColor: dominantTopic ? getClusterColor(dominantTopic) : undefined,
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

    const graphLinks: GraphLink[] = Array.from(linkMap.entries()).map(([key, data]) => {
      const [source, target] = key.split('-');
      return { source, target, strength: data.strength, isTopicLink: data.isTopicLink };
    });

    setNodes(graphNodes);
    setLinks(graphLinks);
  }, []);

  // Update cluster positions periodically
  const updateClusterPositions = useCallback(() => {
    if (nodes.length === 0) return;

    const clusterPositions = new Map<string, { x: number; y: number; count: number; color: string }>();

    nodes.forEach((node) => {
      if (!node.cluster || node.x === undefined || node.y === undefined) return;

      const existing = clusterPositions.get(node.cluster) || {
        x: 0, y: 0, count: 0,
        color: getClusterColor(node.cluster)
      };

      clusterPositions.set(node.cluster, {
        x: existing.x + node.x,
        y: existing.y + node.y,
        count: existing.count + 1,
        color: existing.color,
      });
    });

    const clusterInfos: ClusterInfo[] = Array.from(clusterPositions.entries())
      .filter(([, data]) => data.count >= 2)
      .map(([name, data]) => ({
        id: name,
        name: `#${name}`,
        color: data.color,
        x: data.x / data.count,
        y: data.y / data.count,
        memberCount: data.count,
      }));

    setClusters(clusterInfos);
  }, [nodes]);

  useEffect(() => {
    fetchGraphData();
    startBotLoop();

    const channel = supabase
      .channel('graph-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchGraphData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, fetchGraphData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, fetchGraphData)
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
      if (clusterUpdateInterval.current) {
        clearInterval(clusterUpdateInterval.current);
      }
    };
  }, [fetchGraphData, updateClusterPositions]);

  const drawNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D) => {
    const size = node.is_bot ? 10 : 14;
    const outlineColor = node.clusterColor || getOutlineColor(node.id, node.is_bot);

    // Glow effect for clustered nodes
    if (node.cluster) {
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, size + 8, 0, 2 * Math.PI);
      ctx.fillStyle = `${outlineColor}33`;
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

  return (
    <div className="w-screen h-screen bg-[var(--bg-primary)] overflow-hidden relative">
      <ForceGraph2D
        ref={graphRef}
        graphData={{ nodes, links }}
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
        d3AlphaDecay={0.01}
        d3VelocityDecay={0.2}
        cooldownTime={5000}
      />

      {/* Cluster labels */}
      {clusters.map((cluster) => (
        <div
          key={cluster.id}
          className="absolute pointer-events-none transition-all duration-300"
          style={{
            left: cluster.x + dimensions.width / 2,
            top: cluster.y + dimensions.height / 2,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="px-4 py-2 rounded-full backdrop-blur-sm border-2"
            style={{
              backgroundColor: `${cluster.color}22`,
              borderColor: cluster.color,
            }}
          >
            <span className="font-bold text-lg" style={{ color: cluster.color }}>
              {cluster.name}
            </span>
            <span className="text-[var(--text-secondary)] ml-2">
              ({cluster.memberCount})
            </span>
          </div>
        </div>
      ))}

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
          {Object.entries(CLUSTER_COLORS)
            .filter((_, i, arr) => i === arr.findIndex(([, c]) => c === arr[i][1]))
            .slice(0, 8)
            .map(([topic, color]) => (
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
