import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { get } from '../utils/api';

/**
 * Retourne un Set des userIds en ligne
 * Se met à jour en temps réel via socket
 */
export function useOnlineStatus() {
  const { socket } = useSocket();
  const [onlineSet, setOnlineSet] = useState(new Set());

  // Charger l'état initial depuis l'API
  useEffect(() => {
    get('/users/online').then(ids => setOnlineSet(new Set(ids))).catch(() => {});
  }, []);

  // Écouter les events socket
  useEffect(() => {
    if (!socket) return;
    socket.on('user_online',  uid => setOnlineSet(prev => new Set([...prev, uid])));
    socket.on('user_offline', uid => setOnlineSet(prev => { const s = new Set(prev); s.delete(uid); return s; }));
    return () => { socket.off('user_online'); socket.off('user_offline'); };
  }, [socket]);

  function isOnline(userId) {
    return onlineSet.has(userId?.toString());
  }

  return { onlineSet, isOnline };
}
