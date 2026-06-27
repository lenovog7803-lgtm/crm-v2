import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, setToken, getToken, pingServer } from './api';

const AuthContext = createContext(null);

const USER_PROFILES = {
  egor_dir:   { name: 'Егор',   role: 'director' },
  polina_dir: { name: 'Полина', role: 'director' },
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pingServer(); // wake Render immediately
    const t = getToken();
    if (t) {
      const saved = localStorage.getItem('crm_user');
      const savedUsername = localStorage.getItem('crm_username');
      const profile = (savedUsername && USER_PROFILES[savedUsername]) || (saved ? JSON.parse(saved) : null);
      setUser(profile ? { token: t, user: profile } : { token: t });
    }
    setLoading(false);
  }, []);

  const signIn = async (username, password) => {
    const data = await apiLogin(username, password);
    setToken(data.token);
    const profile = USER_PROFILES[username] || data.user || { name: username, role: 'manager' };
    localStorage.setItem('crm_user', JSON.stringify(profile));
    localStorage.setItem('crm_username', username);
    setUser({ token: data.token, user: profile });
  };

  const signOut = () => {
    setToken('');
    localStorage.removeItem('crm_user');
    localStorage.removeItem('crm_username');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
