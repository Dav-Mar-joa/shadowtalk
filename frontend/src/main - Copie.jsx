import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// ✅ Enregistrement du Service Worker — OBLIGATOIRE pour les push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('✅ SW enregistré:', reg.scope);
        // Écouter les messages du SW (navigation depuis notif)
        navigator.serviceWorker.addEventListener('message', event => {
          if (event.data?.type === 'NAVIGATE') {
            window.location.href = event.data.url;
          }
        });
      })
      .catch(err => console.error('❌ SW échec:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>
);
