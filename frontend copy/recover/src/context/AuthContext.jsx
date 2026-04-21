import { createContext, useContext, useState, useEffect } from 'react';
import { get, startAwakePing } from '../utils/api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => localStorage.getItem('st_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      get('/users/me')
        .then(u => { setUser(u); startAwakePing(); })
        .catch(() => { localStorage.removeItem('st_token'); setToken(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  function login(data) {
    localStorage.setItem('st_token', data.token);
    setToken(data.token);
    setUser(data.user);
    startAwakePing();
  }

  function logout() {
    localStorage.removeItem('st_token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
