import { useState, useEffect, useCallback } from 'react';
import { get, post } from '../utils/api';

export function usePushNotifications(navigate) {
  const [permission,  setPermission]  = useState(Notification.permission);
  const [subscribed,  setSubscribed]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [swReg,       setSwReg]       = useState(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => { setSwReg(reg); return reg.pushManager.getSubscription(); })
      .then(sub => { if (sub) setSubscribed(true); })
      .catch(err => console.error('SW registration failed:', err));

    const handler = event => {
      if (event.data?.type === 'NAVIGATE' && navigate) navigate(event.data.url);
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [navigate]);

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  // ✅ Demande TOUTES les permissions en une fois
  const subscribe = useCallback(async () => {
    if (!swReg) { setError('Service Worker non chargé'); return; }
    setLoading(true); setError('');

    try {
      // 1. Permission notifications
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError('Active les notifications dans les paramètres du navigateur');
        setLoading(false); return;
      }

      // 2. Permission microphone (demande proactive)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop()); // stop immédiatement, juste pour la permission
      } catch { /* micro refusé — pas bloquant */ }

      // 3. Vibration test (API)
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);

      // 4. Clé VAPID
      const { key } = await get('/push/vapid-public-key');
      if (!key) { setError('Clé VAPID manquante'); setLoading(false); return; }

      // 5. Subscription push
      const subscription = await swReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
      });

      // 6. Enregistrement backend
      await post('/push/subscribe', { subscription });
      setSubscribed(true);
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [swReg]);

  const unsubscribe = useCallback(async () => {
    if (!swReg) return;
    setLoading(true);
    try {
      const sub = await swReg.pushManager.getSubscription();
      if (sub) { await post('/push/unsubscribe', { endpoint: sub.endpoint }); await sub.unsubscribe(); }
      setSubscribed(false);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [swReg]);

  const supported = 'serviceWorker' in navigator && 'PushManager' in window;
  return { permission, subscribed, loading, error, supported, subscribe, unsubscribe };
}
