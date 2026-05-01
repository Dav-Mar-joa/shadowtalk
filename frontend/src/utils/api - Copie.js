import CryptoJS from 'crypto-js';

// En prod: VITE_API_URL = https://shadowtalk-backend.onrender.com/api
// En dev:  VITE_API_URL = /api  (proxied par vite vers localhost:5000)
const BASE    = import.meta.env.VITE_API_URL || '/api';
const ENC_KEY = import.meta.env.VITE_ENC_KEY || 'ShadowTalk_MyS3cur3K3y_2024!!XYZ';

// ─── HTTP helpers ───────────────────────────────────────────
function headers() {
  const token = localStorage.getItem('st_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export async function api(path, options = {}) {
  const res  = await fetch(BASE + path, { headers: headers(), ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const get  = (p)       => api(p);
export const post = (p, body) => api(p, { method: 'POST', body: JSON.stringify(body) });

// ─── AES-256 chiffrement ────────────────────────────────────
export function encrypt(text) {
  if (!text) return text;
  return CryptoJS.AES.encrypt(String(text), ENC_KEY).toString();
}

export function decrypt(cipher) {
  if (!cipher) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, ENC_KEY);
    return bytes.toString(CryptoJS.enc.Utf8) || '🔒';
  } catch {
    return '🔒';
  }
}

// ─── Awake ping Render ──────────────────────────────────────
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
export function startAwakePing() {
  const ping = () => fetch(BACKEND + '/ping').catch(() => {});
  ping();
  setInterval(ping, 13 * 60 * 1000);
}

// ─── Helpers ────────────────────────────────────────────────
export function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'maintenant';
  if (diff < 3600)  return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day:'numeric', month:'short' });
}

export function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
}

export function detectUrlType(url) {
  if (!url) return 'other';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return 'web';
}

export function getYoutubeId(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match ? match[1] : null;
}

// Helper pour les appels directs (DELETE etc.) avec la bonne URL de base
export const apiDirect = (path, opts={}) => fetch(BASE + path, {
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + localStorage.getItem('st_token')
  },
  ...opts
}).then(r => r.json());
