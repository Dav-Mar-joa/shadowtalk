import { createContext, useContext, useState, useEffect } from 'react';
import { get, startAwakePing } from '../utils/api';

const AuthCtx = createContext(null);

// ✅ Demande les permissions dès que l'user est connecté
async function requestPermissions() {
  // 1. Notifications push
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  // 2. Microphone — demande silencieuse (juste pour que le navigateur mémorise)
  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // On coupe immédiatement — on voulait juste la permission
      stream.getTracks().forEach(t => t.stop());
    } catch {
      // Refusé ou pas de micro — pas bloquant
    }
  }

  // 3. Vibration test (Android)
  if ('vibrate' in navigator) navigator.vibrate([50]);
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => localStorage.getItem('st_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      get('/users/me')
        .then(u => {
          setUser(u);
          startAwakePing();
          // ✅ Demande les permissions dès que l'user est authentifié
          requestPermissions();
        })
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
    // ✅ Aussi demander après le login
    requestPermissions();
  }

  function logout() {
    localStorage.removeItem('st_token');
    setToken(null);
    setUser(null);
  }

  // Mettre à jour les infos user en local (après modif profil)
  function updateUser(updates) {
    setUser(prev => ({ ...prev, ...updates }));
  }

  return (
    <AuthCtx.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
