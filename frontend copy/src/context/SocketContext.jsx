import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketCtx = createContext(null);
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export function SocketProvider({ children }) {
  const { token }  = useAuth();
  const socketRef  = useRef(null);
  const [connected,     setConnected]     = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!token) { socketRef.current?.disconnect(); return; }

    const s = io(BACKEND, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });
    socketRef.current = s;

    s.on('connect',    () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    s.on('notification', n => {
      setNotifications(prev => [{ ...n, id: Date.now() }, ...prev.slice(0, 49)]);

      // ✅ Vibration à la réception d'un message
      if ('vibrate' in navigator) {
        navigator.vibrate([150, 80, 150]);
      }

      // Notification browser si appli ouverte
      if (Notification.permission === 'granted') {
        new Notification(`💬 ${n.from}`, {
          body: 'Nouveau message',
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          silent: false,
          vibrate: [200, 100, 200]
        });
      }
    });

    return () => s.disconnect();
  }, [token]);

  function clearNotif(id)  { setNotifications(prev => prev.filter(n => n.id !== id)); }
  function clearAllNotifs() { setNotifications([]); }

  return (
    <SocketCtx.Provider value={{ socket: socketRef.current, connected, notifications, clearNotif, clearAllNotifs }}>
      {children}
    </SocketCtx.Provider>
  );
}

export const useSocket = () => useContext(SocketCtx);
