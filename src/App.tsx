import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useUserStore } from './stores/userStore';
import { AvatarBuilder } from './components/AvatarBuilder';
import { PasswordGate } from './components/PasswordGate';
import { Feed } from './pages/Feed';
import { Graph } from './pages/Graph';
import type { AvatarConfig } from './types';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/feed" element={<ProtectedFeed />} />
        <Route path="/graph" element={<PasswordGate><Graph /></PasswordGate>} />
      </Routes>
    </BrowserRouter>
  );
}

function Home() {
  const { user, isExpired, createSession } = useUserStore();
  const navigate = useNavigate();

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

  return <AvatarBuilder onComplete={handleAvatarComplete} />;
}

function ProtectedFeed() {
  const { user } = useUserStore();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <Feed />;
}

export default App;
