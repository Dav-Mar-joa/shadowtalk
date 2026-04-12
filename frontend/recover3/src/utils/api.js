import CryptoJS from 'crypto-js';

const BASE = import.meta.env.VITE_API_URL || '/api';
const ENC_KEY = import.meta.env.VITE_ENC_KEY || 'shadowtalk_default_32chars_key!!';

// ─── HTTP helpers ────────────────────────────────────────────
function headers() {
  const token = localStorage.getItem('st_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function api(path, options = {}) {
  const res = await fetch(BASE + path, { headers: headers(), ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const get  = (p)       => api(p);
export const post = (p, body) => api(p, { method: 'POST', body: JSON.stringify(body) });

// ─── AES-256 encryption ─────────────────────────────────────
export function encrypt(text) {
  return CryptoJS.AES.encrypt(text, ENC_KEY).toString();
}

export function decrypt(cipher) {
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, ENC_KEY);
    return bytes.toString(CryptoJS.enc.Utf8) || '🔒';
  } catch {
    return '🔒';
  }
}

// ─── Awake ping (Render cold-start prevention) ───────────────
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
export function startAwakePing() {
  const ping = () => fetch(BACKEND + '/ping').catch(() => {});
  ping();
  setInterval(ping, 13 * 60 * 1000); // toutes les 13 min
}

// ─── Helpers ─────────────────────────────────────────────────
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
