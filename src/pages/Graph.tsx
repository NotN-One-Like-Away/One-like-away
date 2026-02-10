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
  cluster?: string;
  x?: number;
  y?: number;
  [key: string]: unknown;
}

interface GraphLink {
  source: string;
  target: string;
  strength: number;
  [key: string]: unknown;
}

interface ClusterInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  memberCount: number;
}

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

  const getOutlineColor = useCallback((userId: string, isBot: boolean) => {
    if (isBot) return '#6366f1'; // Bots get accent color

    if (!colorIndexRef.current.has(userId)) {
      colorIndexRef.current.set(userId, colorIndexRef.current.size % OUTLINE_COLORS.length);
    }
    return OUTLINE_COLORS[colorIndexRef.current.get(userId)!];
  }, []);

  const fetchGraphData = useCallback(async () => {
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, display_name, avatar_config, is_bot, expires_at')
      .or(`is_bot.eq.true,expires_at.gt.${new Date().toISOString()}`);

    if (usersError) {
      console.error('Failed to fetch users:', usersError);
      return;
    }

    // Get all likes to build connections
    const { data: likes, error: likesError } = await supabase
      .from('likes')
      .select('user_id, post_id, posts(user_id, topic_tags)');

    if (likesError) {
      console.error('Failed to fetch likes:', likesError);
      return;
    }

    // Build nodes
    const graphNodes: GraphNode[] = users.map((user) => ({
      id: user.id,
      name: user.display_name,
      is_bot: user.is_bot,
      avatar_config: user.avatar_config,
    }));

    // Build links based on interactions (who liked whose posts)
    const linkMap = new Map<string, number>();
    likes?.forEach((like) => {
      const post = like.posts as unknown as { user_id: string; topic_tags: string[] } | null;
      if (!post) return;
      const postAuthorId = post.user_id;
      if (like.user_id === postAuthorId) return; // Skip self-likes

      const key = [like.user_id, postAuthorId].sort().join('-');
      linkMap.set(key, (linkMap.get(key) ?? 0) + 1);
    });

    const graphLinks: GraphLink[] = Array.from(linkMap.entries()).map(([key, strength]) => {
      const [source, target] = key.split('-');
      return { source, target, strength };
    });

    // Simple clustering based on topic tags
    const userTopics = new Map<string, Set<string>>();
    likes?.forEach((like) => {
      const post = like.posts as unknown as { user_id: string; topic_tags: string[] } | null;
      if (!post) return;
      const topics = post.topic_tags ?? [];
      const existing = userTopics.get(like.user_id) ?? new Set();
      topics.forEach((t) => existing.add(t));
      userTopics.set(like.user_id, existing);
    });

    // Assign clusters based on most common topic
    const topicCounts = new Map<string, number>();
    userTopics.forEach((topics) => {
      topics.forEach((topic) => {
        topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
      });
    });

    // Find dominant topic for each user
    graphNodes.forEach((node) => {
      const topics = userTopics.get(node.id);
      if (topics && topics.size > 0) {
        let maxTopic = '';
        let maxCount = 0;
        topics.forEach((topic) => {
          const count = topicCounts.get(topic) ?? 0;
          if (count > maxCount) {
            maxCount = count;
            maxTopic = topic;
          }
        });
        node.cluster = maxTopic;
      }
    });

    setNodes(graphNodes);
    setLinks(graphLinks);

    // Calculate cluster positions after graph settles
    setTimeout(() => {
      if (!graphRef.current) return;

      const clusterPositions = new Map<string, { x: number; y: number; count: number }>();

      graphNodes.forEach((node) => {
        if (!node.cluster || !node.x || !node.y) return;

        const existing = clusterPositions.get(node.cluster) ?? { x: 0, y: 0, count: 0 };
        clusterPositions.set(node.cluster, {
          x: existing.x + node.x,
          y: existing.y + node.y,
          count: existing.count + 1,
        });
      });

      const clusterInfos: ClusterInfo[] = Array.from(clusterPositions.entries())
        .filter(([, data]) => data.count >= 2) // Only show clusters with 2+ members
        .map(([name, data]) => ({
          id: name,
          name: `#${name}`,
          x: data.x / data.count,
          y: data.y / data.count,
          memberCount: data.count,
        }));

      setClusters(clusterInfos);
    }, 2000);
  }, []);

  useEffect(() => {
    fetchGraphData();

    // Start bot activity when graph is displayed
    startBotLoop();

    // Subscribe to realtime updates
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

    return () => {
      stopBotLoop();
      supabase.removeChannel(channel);
      window.removeEventListener('resize', handleResize);
    };
  }, [fetchGraphData]);

  const drawNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D) => {
    const size = node.is_bot ? 8 : 12;
    const outlineColor = getOutlineColor(node.id, node.is_bot);

    // Draw outline
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, size + 3, 0, 2 * Math.PI);
    ctx.fillStyle = outlineColor;
    ctx.fill();

    // Draw avatar background
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
    ctx.fillStyle = node.avatar_config?.skin_color ?? '#888';
    ctx.fill();

    // Draw simple face representation
    ctx.fillStyle = node.avatar_config?.hair_color ?? '#333';
    ctx.beginPath();
    ctx.arc(node.x!, node.y! - size * 0.3, size * 0.6, Math.PI, 0);
    ctx.fill();
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
          ctx.arc(node.x!, node.y!, 15, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkColor={() => 'rgba(99, 102, 241, 0.3)'}
        linkWidth={(link: GraphLink) => Math.min(link.strength, 5)}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        cooldownTime={3000}
        onEngineStop={() => {
          // Recalculate clusters when graph settles
          const clusterPositions = new Map<string, { x: number; y: number; count: number }>();

          nodes.forEach((node) => {
            if (!node.cluster || !node.x || !node.y) return;

            const existing = clusterPositions.get(node.cluster) ?? { x: 0, y: 0, count: 0 };
            clusterPositions.set(node.cluster, {
              x: existing.x + node.x,
              y: existing.y + node.y,
              count: existing.count + 1,
            });
          });

          const clusterInfos: ClusterInfo[] = Array.from(clusterPositions.entries())
            .filter(([, data]) => data.count >= 2)
            .map(([name, data]) => ({
              id: name,
              name: `#${name}`,
              x: data.x / data.count,
              y: data.y / data.count,
              memberCount: data.count,
            }));

          setClusters(clusterInfos);
        }}
      />

      {/* Cluster labels */}
      {clusters.map((cluster) => (
        <div
          key={cluster.id}
          className="absolute pointer-events-none"
          style={{
            left: cluster.x + dimensions.width / 2,
            top: cluster.y + dimensions.height / 2,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="bg-[var(--bg-secondary)]/80 backdrop-blur-sm px-3 py-1 rounded-full border border-[var(--accent)]/30">
            <span className="text-[var(--accent)] font-semibold">{cluster.name}</span>
            <span className="text-[var(--text-secondary)] text-sm ml-2">({cluster.memberCount})</span>
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
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 rounded-full bg-[#6366f1]" />
          <span className="text-sm">Bot</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1">
            {OUTLINE_COLORS.slice(0, 4).map((color) => (
              <div
                key={color}
                className="w-3 h-3 rounded-full border-2"
                style={{ borderColor: color, backgroundColor: '#f5d0c5' }}
              />
            ))}
          </div>
          <span className="text-sm">Visitors</span>
        </div>
      </div>
    </div>
  );
}
