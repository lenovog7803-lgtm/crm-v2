import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, setToken, getToken, pingServer } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pingServer(); // wake Render immediately
    const t = getToken();
    if (t) {
      const saved = localStorage.getItem('crm_user');
      setUser(saved ? { token: t, user: JSON.parse(saved) } : { token: t });
    }
    setLoading(false);
  }, []);

  const signIn = async (username, password) => {
    const data = await apiLogin(username, password);
    setToken(data.token);
    if (data.user) localStorage.setItem('crm_user', JSON.stringify(data.user));
    setUser({ token: data.token, ...data });
  };

  const signOut = () => {
    setToken('');
    localStorage.removeItem('crm_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
