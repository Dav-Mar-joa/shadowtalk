import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketCtx = createContext(null);
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export function SocketProvider({ children }) {
  const { token, user, updateUser } = useAuth();
  const socketRef = useRef(null);

  // ✅ socket exposé via state pour forcer le re-render quand il change
  const [socket,        setSocket]       = useState(null);
  const [connected,     setConnected]    = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [usersCache,    setUsersCache]   = useState({});

  // Ref pour accéder au user courant sans recréer le socket
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      return;
    }

    const s = io(BACKEND, {
      auth: { token },
      // ✅ polling d'abord (fonctionne toujours sur Render),
      // puis upgrade automatique vers WebSocket
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });

    socketRef.current = s;

    s.on('connect', () => {
      console.log('🔌 Socket connecté, transport:', s.io.engine.transport.name);
      setConnected(true);
      // ✅ Exposer le socket via state pour que les composants le reçoivent
      setSocket(s);
    });

    s.on('disconnect', reason => {
      console.log('🔌 Socket déconnecté:', reason);
      setConnected(false);
    });

    s.on('connect_error', err => {
      console.error('🔌 Erreur connexion:', err.message);
      setConnected(false);
    });

    // ✅ Après reconnexion — remettre à jour le state socket
    s.on('reconnect', attempt => {
      console.log('🔌 Reconnecté après', attempt, 'tentatives');
      setConnected(true);
      setSocket(s);
      // Signaler aux pages qu'elles doivent re-joindre leurs rooms
      s.emit('client_reconnected');
    });

    // Notifications in-app
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

    // Mise à jour profil d'un user
    s.on('user_updated', updated => {
      setUsersCache(prev => ({ ...prev, [updated._id]: updated }));
      // Mettre à jour AuthContext seulement si c'est moi
      if (userRef.current?._id && updated._id === userRef.current._id.toString()) {
        updateUser?.(updated);
      }
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [token]);

  function clearNotif(id)   { setNotifications(prev => prev.filter(n => n.id !== id)); }
  function clearAllNotifs() { setNotifications([]); }

  const resolveUser = useCallback((u) => {
    if (!u) return u;
    const id = (u._id || u)?.toString();
    if (!id) return u;
    const cached = usersCache[id];
    if (!cached) return u;
    return { ...u, ...cached };
  }, [usersCache]);

  function setUserInCache(userData) {
    if (!userData?._id) return;
    setUsersCache(prev => ({ ...prev, [userData._id.toString()]: userData }));
  }

  return (
    <SocketCtx.Provider value={{
      socket,           // ✅ state, pas ref → re-render garanti
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
