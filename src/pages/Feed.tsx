import { useEffect, useState, useCallback } from 'react';
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
  const { user, isExpired } = useUserStore();

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
      .limit(50);

    if (error) {
      console.error('Failed to fetch posts:', error);
      return;
    }

    // Get user's likes to mark which posts they've liked
    let likedPostIds: string[] = [];
    if (user) {
      const { data: likes } = await supabase
        .from('likes')
        .select('post_id')
        .eq('user_id', user.id);
      likedPostIds = likes?.map((l) => l.post_id) ?? [];
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
      is_liked: likedPostIds.includes(post.id),
    }));

    setPosts(formattedPosts);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPosts();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        () => fetchPosts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  if (isExpired) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-6">⏰</div>
        <h1 className="text-2xl font-bold mb-3">Session Expired</h1>
        <p className="text-[var(--text-secondary)] mb-6 max-w-sm">
          Your time in the echo chamber has ended. Check out the big screen to see where you ended up!
        </p>
        <button
          onClick={() => window.location.reload()}
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
          <h1 className="text-xl font-bold">Echo Chamber</h1>
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
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            <p>No posts yet. Be the first!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Post key={post.id} post={post} onLikeChange={fetchPosts} />
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
