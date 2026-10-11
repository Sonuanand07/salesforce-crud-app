import { useEffect, useState } from 'react';
import useAuth from './hooks/useAuth.js';
import LoginScreen from './components/LoginScreen.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
  const { loading, user, logout, expire } = useAuth();
  // OAuth errors come back as ?error=... ; read once, then clean the URL.
  const [oauthError] = useState(() => new URLSearchParams(window.location.search).get('error'));

  useEffect(() => {
    if (oauthError) window.history.replaceState({}, '', window.location.pathname);
  }, [oauthError]);

  if (loading) return <p className="state boot" role="status">Loading…</p>;
  if (!user) return <LoginScreen error={oauthError} />;
  return <Dashboard user={user} onLogout={logout} onExpire={expire} />;
}
