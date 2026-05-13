import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketCtx = createContext(null);

// Dev  : VITE_BACKEND_URL=http://localhost:5000
// Prod : VITE_BACKEND_URL non défini → fallback URL Render
const BACKEND = import.meta.env.VITE_BACKEND_URL
  || (import.meta.env.DEV ? 'http://localhost:5000' : 'https://shadowtalk-kvvv.onrender.com');

export function SocketProvider({ children }) {
  const { token, updateUser } = useAuth();
  const socketRef    = useRef(null);
  const updateUserRef = useRef(updateUser);
  const myUserIdRef  = useRef(null);

  const [socket,        setSocket]       = useState(null);
  const [connected,     setConnected]    = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [usersCache,      setUsersCache]      = useState({});
  const [contactRequests, setContactRequests] = useState([]);

  useEffect(() => { updateUserRef.current = updateUser; }, [updateUser]);

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      return;
    }

    // Extraire userId du JWT pour user_updated
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      myUserIdRef.current = payload.userId;
    } catch {}

    console.log('🔌 Connexion socket vers:', BACKEND);

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

    s.on('connect', () => {
      console.log('✅ Socket connecté — transport:', s.io.engine.transport.name);
      setConnected(true);
      setSocket(s);
    });

    s.on('disconnect', reason => {
      console.warn('⚠️ Socket déconnecté:', reason);
      setConnected(false);
    });

    s.on('connect_error', err => {
      console.error('❌ Socket erreur:', err.message, '→ Backend:', BACKEND);
      setConnected(false);
    });

    s.on('reconnect', () => {
      console.log('🔄 Socket reconnecté');
      setConnected(true);
      setSocket(s);
      s.emit('client_reconnected');
    });

    // Notification in-app + browser
    s.on('notification', n => {
      setNotifications(prev => [{ ...n, id: Date.now() }, ...prev.slice(0, 49)]);
      if ('vibrate' in navigator) navigator.vibrate([150, 80, 150]);
      if (Notification.permission === 'granted') {
        try {
          new Notification(`💬 ${n.from}`, {
            body: 'Nouveau message',
            icon: '/icon-192.png',
            badge: '/badge-72.png',
          });
        } catch {}
      }
    });

    // ✅ Demande de contact reçue
    s.on('contact_request', req => {
      setContactRequests(prev =>
        prev.find(r => r.user._id === req.user._id) ? prev : [req, ...prev]
      );
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    });

    // ✅ Contact supprimé par l'autre
    s.on('contact_removed', ({ userId }) => {
      // Sera géré par ContactsPage via cet event
    });

    // ✅ Demande acceptée
    s.on('contact_accepted', ({ user }) => {
      setContactRequests(prev => prev.filter(r => r.user._id !== user._id));
    });

    // Avatar/username changé
    s.on('user_updated', updated => {
      setUsersCache(prev => ({ ...prev, [updated._id]: updated }));
      if (updated._id === myUserIdRef.current) {
        updateUserRef.current?.(updated);
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
    return cached ? { ...u, ...cached } : u;
  }, [usersCache]);

  function setUserInCache(userData) {
    if (!userData?._id) return;
    setUsersCache(prev => ({ ...prev, [userData._id.toString()]: userData }));
  }

  return (
    <SocketCtx.Provider value={{
      socket,
      connected,
      notifications,
      clearNotif,
      clearAllNotifs,
      usersCache,
      resolveUser,
      setUserInCache,
      contactRequests,
      setContactRequests
    }}>
      {children}
    </SocketCtx.Provider>
  );
}

export const useSocket = () => useContext(SocketCtx);
