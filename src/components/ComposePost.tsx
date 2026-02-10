import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/userStore';

interface ComposePostProps {
  onClose: () => void;
  onPostCreated: () => void;
}

export function ComposePost({ onClose, onPostCreated }: ComposePostProps) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useUserStore();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !content.trim() || isLoading) return;

    setIsLoading(true);
    setError('');

    try {
      // For MVP: just post the content directly
      // TODO: Call LLM to expand the content
      const expandedContent = content.trim();

      // Extract hashtags as topic tags
      const topicTags = extractHashtags(expandedContent);

      const { error: insertError } = await supabase.from('posts').insert({
        user_id: user.id,
        content: expandedContent,
        topic_tags: topicTags,
      });

      if (insertError) throw insertError;

      onPostCreated();
      onClose();
    } catch (err) {
      setError('Failed to create post. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">New Post</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-full transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind? Keep it short, AI will expand it..."
            maxLength={280}
            rows={4}
            autoFocus
            className="w-full p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)] focus:border-[var(--accent)] outline-none resize-none"
          />

          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-[var(--text-secondary)]">
              {content.length}/280
            </span>

            {error && (
              <span className="text-sm text-[var(--danger)]">{error}</span>
            )}
          </div>

          <button
            type="submit"
            disabled={!content.trim() || isLoading}
            className={`w-full mt-4 py-3 rounded-xl font-semibold transition-colors ${
              content.trim() && !isLoading
                ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
                : 'bg-[var(--border)] cursor-not-allowed'
            }`}
          >
            {isLoading ? 'Posting...' : 'Post'}
          </button>
        </form>
      </div>
    </div>
  );
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#\w+/g);
  if (!matches) return [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}
