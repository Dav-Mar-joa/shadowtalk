import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketCtx = createContext(null);
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export function SocketProvider({ children }) {
  const { token, user, updateUser } = useAuth();
  const socketRef = useRef(null);
  const [connected,     setConnected]     = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [usersCache,    setUsersCache]    = useState({});

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const s = io(BACKEND, {
      auth: { token },
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });

    socketRef.current = s;

    s.on('connect',       () => setConnected(true));
    s.on('disconnect',    () => setConnected(false));
    s.on('connect_error', () => setConnected(false));
    s.on('reconnect',     () => { setConnected(true); s.emit('reconnected'); });

    s.on('notification', n => {
      setNotifications(prev => [{ ...n, id: Date.now() }, ...prev.slice(0, 49)]);
      if ('vibrate' in navigator) navigator.vibrate([150, 80, 150]);
      if (Notification.permission === 'granted') {
        try {
          new Notification(`💬 ${n.from}`, {
            body: 'Nouveau message',
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            silent: false,
          });
        } catch {}
      }
    });

    // ✅ Un user a mis à jour son profil (username, avatar, avatarImage)
    s.on('user_updated', updated => {
      // 1. Mettre à jour le cache global — pour TOUS les users
      setUsersCache(prev => ({ ...prev, [updated._id]: updated }));

      // 2. Si c'est MOI → mettre à jour AuthContext aussi
      //    Comparer avec user._id du moment (via ref pour éviter closure stale)
      if (user?._id && updated._id === user._id.toString()) {
        updateUser?.(updated);
      }
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [token]); // ⚠️ user et updateUser intentionnellement hors des deps
                // pour éviter de recréer le socket à chaque re-render du user

  // Ref pour accéder au user courant sans recréer le socket
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  function clearNotif(id)   { setNotifications(prev => prev.filter(n => n.id !== id)); }
  function clearAllNotifs() { setNotifications([]); }

  // Résout les infos à jour d'un user depuis le cache
  const resolveUser = useCallback((u) => {
    if (!u) return u;
    const id = (u._id || u)?.toString();
    if (!id) return u;
    const cached = usersCache[id];
    if (!cached) return u;
    return { ...u, ...cached };
  }, [usersCache]);

  // Forcer la mise à jour du cache pour un user (utilisé par ProfilePage)
  function setUserInCache(userData) {
    if (!userData?._id) return;
    setUsersCache(prev => ({ ...prev, [userData._id.toString()]: userData }));
  }

  return (
    <SocketCtx.Provider value={{
      socket: socketRef.current,
      connected,
      notifications,
      clearNotif,
      clearAllNotifs,
      usersCache,
      resolveUser,
      setUserInCache
    }}>
      {children}
    </SocketCtx.Provider>
  );
}

export const useSocket = () => useContext(SocketCtx);
