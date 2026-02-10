import { useState } from 'react';
import type { Post as PostType } from '../types';
import { Avatar } from './Avatar';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/userStore';

interface PostProps {
  post: PostType;
  onLikeChange?: () => void;
}

export function Post({ post, onLikeChange }: PostProps) {
  const [isLiked, setIsLiked] = useState(post.is_liked ?? false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [isLoading, setIsLoading] = useState(false);
  const { user, isExpired } = useUserStore();

  const timeAgo = getTimeAgo(new Date(post.created_at));

  async function handleLike() {
    if (!user || isExpired || isLoading) return;

    setIsLoading(true);

    if (isLiked) {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', post.id);

      if (!error) {
        setIsLiked(false);
        setLikesCount((c) => c - 1);
      }
    } else {
      const { error } = await supabase
        .from('likes')
        .insert({ user_id: user.id, post_id: post.id });

      if (!error) {
        setIsLiked(true);
        setLikesCount((c) => c + 1);
      }
    }

    setIsLoading(false);
    onLikeChange?.();
  }

  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 border border-[var(--border)]">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {post.user?.avatar_config ? (
            <Avatar config={post.user.avatar_config} size={44} />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[var(--bg-tertiary)]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold truncate">
              {post.user?.display_name ?? 'Unknown'}
            </span>
            {post.user?.is_bot && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)]">
                bot
              </span>
            )}
            <span className="text-[var(--text-secondary)] text-sm">
              {timeAgo}
            </span>
          </div>

          <p className="text-[var(--text-primary)] whitespace-pre-wrap break-words mb-3">
            {post.content}
          </p>

          {post.topic_tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {post.topic_tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-6 text-[var(--text-secondary)]">
            <button
              onClick={handleLike}
              disabled={!user || isExpired || isLoading}
              className={`flex items-center gap-2 transition-colors ${
                isLiked ? 'text-[var(--danger)]' : 'hover:text-[var(--danger)]'
              } ${(!user || isExpired) && 'opacity-50 cursor-not-allowed'}`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill={isLiked ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span className="text-sm">{likesCount}</span>
            </button>

            <div className="flex items-center gap-2">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-sm">{post.comments_count}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
