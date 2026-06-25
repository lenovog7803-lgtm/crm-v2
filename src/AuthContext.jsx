import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, setToken, getToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getToken();
    if (t) {
      setUser({ token: t });
    }
    setLoading(false);
  }, []);

  const signIn = async (username, password) => {
    const data = await apiLogin(username, password);
    setToken(data.token);
    setUser({ token: data.token, ...data });
  };

  const signOut = () => {
    setToken('');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
