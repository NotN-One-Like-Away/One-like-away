import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useUserStore } from './stores/userStore';
import { AvatarBuilder } from './components/AvatarBuilder';
import { PasswordGate } from './components/PasswordGate';
import { Feed } from './pages/Feed';
import { Graph } from './pages/Graph';
import type { AvatarConfig } from './types';

const INTRO_POPUP_SEEN_KEY = 'one-like-away-intro-seen';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CreateAvatarPage />} />
        <Route path="/create-avatar" element={<CreateAvatarPage />} />
        <Route path="/feed" element={<ProtectedFeed />} />
        <Route path="/graph" element={<PasswordGate><Graph /></PasswordGate>} />
      </Routes>
    </BrowserRouter>
  );
}

function CreateAvatarPage() {
  const { user, isExpired, createSession } = useUserStore();
  const navigate = useNavigate();
  const [showIntroPopup, setShowIntroPopup] = useState(false);

  useEffect(() => {
    const hasSeenIntro = localStorage.getItem(INTRO_POPUP_SEEN_KEY) === 'true';
    if (!hasSeenIntro) {
      setShowIntroPopup(true);
      localStorage.setItem(INTRO_POPUP_SEEN_KEY, 'true');
    }
  }, []);

  // If user has valid session, redirect to feed
  if (user && !isExpired) {
    return <Navigate to="/feed" replace />;
  }

  async function handleAvatarComplete(config: AvatarConfig, name: string) {
    const newUser = await createSession(config, name);
    if (newUser) {
      navigate('/feed');
    }
  }

  return (
    <>
      <AvatarBuilder onComplete={handleAvatarComplete} />

      {showIntroPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6 md:p-8">
            <p className="mb-3 text-sm uppercase tracking-[0.2em] text-[var(--text-secondary)]">
              One Like Away
            </p>
            <h1 className="mb-4 text-2xl font-bold md:text-3xl">Waarom deze app?</h1>

            <p className="mb-3 leading-relaxed text-[var(--text-secondary)]">
              Iedereen gebruikt social media, maar bijna niemand ziet hoe snel je in een echo chamber terechtkomt.
              Door likes, posts en algoritmes krijg je steeds meer van hetzelfde te zien.
            </p>
            <p className="mb-6 leading-relaxed text-[var(--text-secondary)]">
              Deze app laat zien dat je online wereld klein kan worden zonder dat je het doorhebt.
              Niet alles wat je ziet is de volledige waarheid. Er is altijd meer buiten jouw bubbel.
            </p>

            <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-tertiary)] p-4">
              <h2 className="mb-3 text-lg font-semibold">Hoe gebruik je de app?</h2>
              <ol className="space-y-2 text-[var(--text-secondary)]">
                <li>1. Maak een anonieme gebruiker aan (emoji + naam).</li>
                <li>2. Like posts of maak zelf een post om je feed te sturen.</li>
              </ol>
            </div>

            <button
              onClick={() => setShowIntroPopup(false)}
              className="rounded-xl bg-[var(--accent)] px-6 py-3 font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
            >
              Start
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ProtectedFeed() {
  const { user } = useUserStore();

  if (!user) {
    return <Navigate to="/create-avatar" replace />;
  }

  return <Feed />;
}

export default App;
