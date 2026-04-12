import { useState, useEffect, useCallback } from 'react';
import { get, post } from '../utils/api';

/**
 * Hook pour gérer les notifications push Web
 * - Demande la permission
 * - Enregistre le service worker
 * - S'abonne au serveur push
 * - Gère la navigation depuis une notif (appli fermée → rouverte)
 */
export function usePushNotifications(navigate) {
  const [permission,  setPermission]  = useState(Notification.permission);
  const [subscribed,  setSubscribed]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [swReg,       setSwReg]       = useState(null);

  // Enregistrer le Service Worker au démarrage
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        setSwReg(reg);
        // Vérifie si déjà abonné
        return reg.pushManager.getSubscription();
      })
      .then(sub => {
        if (sub) setSubscribed(true);
      })
      .catch(err => console.error('SW registration failed:', err));

    // Écoute les messages du SW (navigation depuis notif)
    const handler = event => {
      if (event.data?.type === 'NAVIGATE' && navigate) {
        navigate(event.data.url);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [navigate]);

  // Convertit la clé VAPID base64 en Uint8Array
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  // Demander la permission + s'abonner
  const subscribe = useCallback(async () => {
    if (!swReg) { setError('Service Worker non chargé'); return; }
    setLoading(true); setError('');

    try {
      // 1. Demander permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError('Permission refusée — active les notifications dans les paramètres de ton navigateur');
        return;
      }

      // 2. Récupérer la clé VAPID publique
      const { key } = await get('/push/vapid-public-key');
      if (!key) { setError('Clé VAPID manquante côté serveur'); return; }

      // 3. Créer la subscription navigateur
      const subscription = await swReg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(key)
      });

      // 4. Envoyer au backend
      await post('/push/subscribe', { subscription });
      setSubscribed(true);
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [swReg]);

  // Se désabonner
  const unsubscribe = useCallback(async () => {
    if (!swReg) return;
    setLoading(true);
    try {
      const sub = await swReg.pushManager.getSubscription();
      if (sub) {
        await post('/push/unsubscribe', { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [swReg]);

  const supported = 'serviceWorker' in navigator && 'PushManager' in window;

  return { permission, subscribed, loading, error, supported, subscribe, unsubscribe };
}
