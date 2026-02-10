import { useState, useEffect } from 'react';

interface PasswordGateProps {
  children: React.ReactNode;
}

const STORAGE_KEY = 'graph-authenticated';

export function PasswordGate({ children }: PasswordGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const correctPassword = import.meta.env.VITE_GRAPH_PASSWORD;

  useEffect(() => {
    // Check if already authenticated this session
    const authenticated = sessionStorage.getItem(STORAGE_KEY);
    if (authenticated === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password === correctPassword) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      setIsAuthenticated(true);
    } else {
      setError('Incorrect password');
      setPassword('');
    }
  }

  // If no password is configured, allow access (dev mode)
  if (!correctPassword) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="animate-pulse text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4">
      <div className="w-full max-w-sm">
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 border border-[var(--border)]">
          <h1 className="text-2xl font-bold text-center mb-2">Graph View</h1>
          <p className="text-[var(--text-secondary)] text-center text-sm mb-6">
            Enter password to access
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full p-4 rounded-xl bg-[var(--bg-tertiary)] border-2 border-[var(--border)] focus:border-[var(--accent)] outline-none text-center text-lg mb-4"
            />

            {error && (
              <p className="text-[var(--danger)] text-center text-sm mb-4">{error}</p>
            )}

            <button
              type="submit"
              disabled={!password}
              className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                password
                  ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
                  : 'bg-[var(--border)] cursor-not-allowed'
              }`}
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
