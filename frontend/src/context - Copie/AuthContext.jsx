import { createContext, useContext, useState, useEffect } from 'react';
import { get, post, startAwakePing } from '../utils/api';

const AuthCtx = createContext(null);

// ── Subscription push complète ─────────────────────────────
async function setupPushNotifications() {
  try {
    // 1. Vérifier support
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!('Notification' in window)) return;

    // 2. Attendre que le SW soit prêt (il est enregistré dans main.jsx)
    let reg = window.__swRegistration;
    if (!reg) {
      reg = await navigator.serviceWorker.ready;
    }
    if (!reg) return;

    // 3. Vérifier si déjà subscribed
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      // Déjà subscribed → juste re-envoyer au backend (en cas de refresh)
      await post('/push/subscribe', { subscription: existing });
      return;
    }

    // 4. Demander permission si pas encore accordée
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
    }
    if (perm !== 'granted') return;

    // 5. Récupérer clé VAPID
    const { key } = await get('/push/vapid-public-key');
    if (!key) return;

    // 6. Créer la subscription
    const padding  = '='.repeat((4 - key.length % 4) % 4);
    const base64   = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData  = window.atob(base64);
    const appKey   = Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appKey
    });

    // 7. Enregistrer au backend
    await post('/push/subscribe', { subscription });
    console.log('✅ Push notifications activées');

    // 8. Vibration de confirmation
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);

  } catch (err) {
    // Silencieux — les push sont optionnelles
    console.warn('Push setup:', err.message);
  }
}

// ── Permission micro ───────────────────────────────────────
async function requestMicPermission() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
  } catch { /* refusé — pas bloquant */ }
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
          // ✅ Setup push + micro automatiquement au démarrage
          setupPushNotifications();
          requestMicPermission();
        })
        .catch(() => {
          localStorage.removeItem('st_token');
          setToken(null);
        })
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
    // ✅ Setup push après login aussi
    setupPushNotifications();
    requestMicPermission();
  }

  function logout() {
    localStorage.removeItem('st_token');
    setToken(null);
    setUser(null);
  }

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
