import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, setToken, getToken, pingServer, setUnauthorizedHandler } from './api';

const AuthContext = createContext(null);

const USER_PROFILES = {
  egor_dir:   { id: '553e8660-5728-439c-8532-7bb1b2d4ae67', name: 'Егор',   role: 'director', fleet_access: true },
  polina_dir: { id: 'b743c39b-509b-4487-8514-6cbe766d65b7', name: 'Полина', role: 'director', fleet_access: true },
}

function decodeTokenPayload(t) {
  try {
    const part = (t || '').split('.')[1]
    if (!part) return null
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pingServer(); // wake Render immediately (async, doesn't block UI)
    const t = getToken();
    if (t) {
      const saved = localStorage.getItem('crm_user');
      const savedUsername = localStorage.getItem('crm_username');
      const tokenPayload = decodeTokenPayload(t);
      const parsedSaved = saved ? JSON.parse(saved) : null;
      const profile = {
        ...(parsedSaved || {}),
        ...(savedUsername && USER_PROFILES[savedUsername] ? USER_PROFILES[savedUsername] : {}),
      };
      const userId = profile.id || tokenPayload?.sub || tokenPayload?.user_id || '553e8660-5728-439c-8532-7bb1b2d4ae67';
      profile.id = userId;
      setUser({ token: t, user: profile, username: savedUsername });
    }
    setLoading(false);
  }, []);

  // Re-read token from localStorage (needed if another tab set it)
  useEffect(() => {
    const stored = localStorage.getItem('crm_token');
    if (stored && stored !== getToken()) {
      setToken(stored);
    }
  }, []);

  const signIn = async (username, password) => {
    const data = await apiLogin(username, password);
    setToken(data.token);
    const tokenPayload = decodeTokenPayload(data.token);
    const userId = data.user?.id || tokenPayload?.sub || tokenPayload?.user_id || USER_PROFILES[username]?.id || '553e8660-5728-439c-8532-7bb1b2d4ae67';
    const profile = {
      ...(data.user || {}),
      ...(USER_PROFILES[username] || {}),
      id: userId,
      name: USER_PROFILES[username]?.name || data.user?.name || username,
      role: USER_PROFILES[username]?.role || data.user?.role || 'manager'
    };
    localStorage.setItem('crm_user', JSON.stringify(profile));
    localStorage.setItem('crm_username', username);
    setUser({ token: data.token, user: profile, username });
  };

  const signOut = () => {
    setToken('');
    localStorage.removeItem('crm_user');
    localStorage.removeItem('crm_username');
    setUser(null);
  };

  // Any expired/rejected token anywhere in the app funnels through here —
  // registered once so req() in api.js (outside React) can force a sign-out.
  useEffect(() => {
    setUnauthorizedHandler(signOut);
  }, []);

  return (
    <AuthContext.Provider value={{ user, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
