import { useEffect, useState, useCallback, useRef } from 'react';
import { Post } from '../components/Post';
import { Timer } from '../components/Timer';
import { ComposePost } from '../components/ComposePost';
import { Avatar } from '../components/Avatar';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/userStore';
import type { Post as PostType } from '../types';

export function Feed() {
  const [posts, setPosts] = useState<PostType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [likedTopics, setLikedTopics] = useState<Map<string, number>>(new Map());
  const { user, isExpired, clearSession } = useUserStore();
  const likedPostIdsRef = useRef<Set<string>>(new Set());

  // Calculate affinity score for a post based on liked topics
  // This is the core echo chamber mechanism - users get trapped fast
  const calculateAffinity = useCallback((post: PostType): number => {
    if (likedTopics.size === 0) return 1; // No preferences yet, show everything

    let score = 0;
    const tags = post.topic_tags || [];

    // Check if ANY tag matches user's interests
    let hasMatchingTag = false;
    for (const tag of tags) {
      const topicWeight = likedTopics.get(tag) || 0;
      if (topicWeight > 0) hasMatchingTag = true;
      score += topicWeight;
    }

    // Normalize score
    const maxPossibleScore = Math.max(...likedTopics.values(), 1) * Math.max(tags.length, 1);
    const normalizedScore = maxPossibleScore > 0 ? score / maxPossibleScore : 0;

    // AGGRESSIVE echo chamber effect - kicks in after just 2 likes
    const totalLikes = Array.from(likedTopics.values()).reduce((a, b) => a + b, 0);
    const echoStrength = Math.min(totalLikes / 3, 1); // Max effect after 3 total likes

    // Non-matching content gets heavily suppressed
    if (!hasMatchingTag) {
      // Visibility drops rapidly: 100% -> 40% -> 15% -> 5% as echo grows
      const baseVisibility = Math.max(0.05, 0.4 * (1 - echoStrength));
      return baseVisibility;
    }

    // Matching content gets boosted
    const boost = 0.5 + (normalizedScore * 0.5); // 0.5 to 1.0
    return Math.min(1, boost + (echoStrength * 0.2)); // Extra boost as echo strengthens
  }, [likedTopics]);

  // Sort and filter posts based on affinity
  // The more you like, the more aggressively we filter your feed
  const getRecommendedPosts = useCallback((allPosts: PostType[]): PostType[] => {
    if (likedTopics.size === 0) {
      // No likes yet - show chronologically
      return allPosts;
    }

    const totalLikes = Array.from(likedTopics.values()).reduce((a, b) => a + b, 0);
    const echoStrength = Math.min(totalLikes / 3, 1);

    // Score each post
    const scoredPosts = allPosts.map(post => ({
      post,
      affinity: calculateAffinity(post),
      isRecent: Date.now() - new Date(post.created_at).getTime() < 30000, // Last 30 seconds
    }));

    // Filter: as echo grows, threshold for inclusion rises
    // At max echo, only posts with >0.6 affinity make it through
    const affinityThreshold = 0.1 + (echoStrength * 0.5);

    const filtered = scoredPosts.filter(({ affinity, isRecent }) => {
      // Very recent posts get a pass (but still sorted down if low affinity)
      if (isRecent) return true;
      // Hard cutoff based on echo strength
      if (affinity < affinityThreshold) return false;
      // Probabilistic for edge cases
      return Math.random() < (affinity * 1.5);
    });

    // Sort: affinity is king, recency is secondary
    filtered.sort((a, b) => {
      // Strong affinity difference = sort by affinity
      const affinityDiff = b.affinity - a.affinity;
      if (Math.abs(affinityDiff) > 0.15) return affinityDiff;

      // Similar affinity = sort by time
      return new Date(b.post.created_at).getTime() - new Date(a.post.created_at).getTime();
    });

    return filtered.map(({ post }) => post);
  }, [likedTopics, calculateAffinity]);

  // Fetch user's liked topics
  const fetchLikedTopics = useCallback(async () => {
    if (!user) return;

    const { data: likes } = await supabase
      .from('likes')
      .select('post_id, posts(topic_tags)')
      .eq('user_id', user.id);

    if (!likes) return;

    const topicCounts = new Map<string, number>();
    const likedIds = new Set<string>();

    likes.forEach((like) => {
      likedIds.add(like.post_id);
      const post = like.posts as unknown as { topic_tags: string[] } | null;
      if (post?.topic_tags) {
        post.topic_tags.forEach((tag) => {
          topicCounts.set(tag, (topicCounts.get(tag) || 0) + 1);
        });
      }
    });

    likedPostIdsRef.current = likedIds;
    setLikedTopics(topicCounts);
  }, [user]);

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users(id, display_name, avatar_config, is_bot),
        likes_count:likes(count),
        comments_count:comments(count)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Failed to fetch posts:', error);
      return;
    }

    const formattedPosts: PostType[] = data.map((post) => ({
      id: post.id,
      user_id: post.user_id,
      content: post.content,
      topic_tags: post.topic_tags ?? [],
      created_at: post.created_at,
      user: post.user,
      likes_count: post.likes_count?.[0]?.count ?? 0,
      comments_count: post.comments_count?.[0]?.count ?? 0,
      is_liked: likedPostIdsRef.current.has(post.id),
    }));

    setPosts(formattedPosts);
    setIsLoading(false);
  }, []);

  // Handle like changes - update topics and refetch
  const handleLikeChange = useCallback(async () => {
    await fetchLikedTopics();
    await fetchPosts();
  }, [fetchLikedTopics, fetchPosts]);

  // Add a single new post to the feed (for realtime)
  const addNewPost = useCallback(async (postId: string) => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        user:users(id, display_name, avatar_config, is_bot),
        likes_count:likes(count),
        comments_count:comments(count)
      `)
      .eq('id', postId)
      .single();

    if (error || !data) return;

    const newPost: PostType = {
      id: data.id,
      user_id: data.user_id,
      content: data.content,
      topic_tags: data.topic_tags ?? [],
      created_at: data.created_at,
      user: data.user,
      likes_count: data.likes_count?.[0]?.count ?? 0,
      comments_count: data.comments_count?.[0]?.count ?? 0,
      is_liked: likedPostIdsRef.current.has(data.id),
    };

    // Add to top of feed with animation
    setPosts((prev) => [newPost, ...prev.filter(p => p.id !== postId)]);
  }, []);

  useEffect(() => {
    fetchLikedTopics();
    fetchPosts();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('feed-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          // New post - add it immediately
          addNewPost(payload.new.id);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'likes' },
        () => {
          // Likes changed - refresh counts
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts, fetchLikedTopics, addNewPost]);

  // Get recommended posts based on user's interests
  const recommendedPosts = getRecommendedPosts(posts);

  if (isExpired) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-6">⏰</div>
        <h1 className="text-2xl font-bold mb-3">Session Expired</h1>
        <p className="text-[var(--text-secondary)] mb-6 max-w-sm">
          Your time in the echo chamber has ended. Check out the big screen to see where you ended up!
        </p>
        <button
          onClick={() => {
            clearSession();
            window.location.href = '/';
          }}
          className="px-6 py-3 bg-[var(--accent)] rounded-xl font-semibold hover:bg-[var(--accent-hover)] transition-colors"
        >
          Start New Session
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 safe-top">
      <Timer />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[var(--bg-primary)]/80 backdrop-blur-lg border-b border-[var(--border)]">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <div>
            <h1 className="text-xl font-bold">Echo Chamber</h1>
            {likedTopics.size > 0 && (
              <p className="text-xs text-[var(--text-secondary)]">
                Personalized for you
              </p>
            )}
          </div>
          {user && (
            <Avatar config={user.avatar_config} size={36} />
          )}
        </div>
      </header>

      {/* Posts */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="bg-[var(--bg-secondary)] rounded-2xl p-4 animate-pulse"
              >
                <div className="flex gap-3">
                  <div className="w-11 h-11 rounded-full bg-[var(--bg-tertiary)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/3" />
                    <div className="h-4 bg-[var(--bg-tertiary)] rounded w-full" />
                    <div className="h-4 bg-[var(--bg-tertiary)] rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : recommendedPosts.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            <p>No posts yet. Be the first!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recommendedPosts.map((post) => (
              <Post key={post.id} post={post} onLikeChange={handleLikeChange} />
            ))}
          </div>
        )}
      </main>

      {/* Compose button */}
      {user && !isExpired && (
        <button
          onClick={() => setShowCompose(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-full flex items-center justify-center shadow-lg transition-colors safe-bottom"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {/* Compose modal */}
      {showCompose && (
        <ComposePost
          onClose={() => setShowCompose(false)}
          onPostCreated={fetchPosts}
        />
      )}
    </div>
  );
}
