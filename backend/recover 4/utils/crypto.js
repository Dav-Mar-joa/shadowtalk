/**
 * Chiffrement AES-256-CBC pour les champs stockés en MongoDB
 * Tout ce qui entre en DB passe par encrypt()
 * Tout ce qui sort passe par decrypt()
 */
const crypto = require('crypto');

const KEY = Buffer.from(
  (process.env.ENCRYPTION_KEY || 'shadowtalk_default_32chars_key!!').padEnd(32).slice(0, 32)
);
const ALGO = 'aes-256-cbc';
const IV_LEN = 16;
const PREFIX = 'enc:'; // préfixe pour détecter si déjà chiffré

function encrypt(text) {
  if (!text) return text;
  if (typeof text !== 'string') text = String(text);
  if (text.startsWith(PREFIX)) return text; // déjà chiffré
  const iv  = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return PREFIX + iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text) return text;
  if (typeof text !== 'string') return text;
  if (!text.startsWith(PREFIX)) return text; // pas chiffré, retourne tel quel
  try {
    const raw = text.slice(PREFIX.length);
    const [ivHex, encHex] = raw.split(':');
    const iv        = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encHex, 'hex');
    const decipher  = crypto.createDecipheriv(ALGO, KEY, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    return text; // si déchiffrement échoue, retourne brut
  }
}

module.exports = { encrypt, decrypt };
