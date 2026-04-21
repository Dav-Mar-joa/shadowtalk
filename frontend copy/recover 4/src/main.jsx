import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// ── Enregistrement du Service Worker ────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('✅ SW enregistré:', reg.scope);

        // Vérifier les mises à jour du SW
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('🔄 Nouvelle version disponible');
            }
          });
        });
      })
      .catch(err => console.error('❌ SW échec:', err));

    // Écouter les messages du SW (navigation depuis notif)
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'NAVIGATE') {
        window.location.href = event.data.url;
      }
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
