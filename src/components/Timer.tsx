import { useEffect } from 'react';
import { useUserStore } from '../stores/userStore';

export function Timer() {
  const { user, timeRemaining, updateTimeRemaining, isExpired } = useUserStore();

  useEffect(() => {
    if (!user || isExpired) return;

    const expiresAt = user.expires_at ? new Date(user.expires_at).getTime() : null;
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      updateTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [user, isExpired, updateTimeRemaining]);

  if (!user || isExpired) return null;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isLow = timeRemaining <= 30;

  return (
    <div
      className={`fixed top-4 right-4 px-4 py-2 rounded-full font-mono text-lg z-50 transition-colors ${
        isLow
          ? 'bg-[var(--danger)]/20 text-[var(--danger)] animate-pulse'
          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
      }`}
    >
      {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  );
}
