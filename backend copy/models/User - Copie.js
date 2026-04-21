const mongoose      = require('mongoose');
const encryptPlugin = require('../utils/encryptPlugin');
const crypto        = require('crypto');

const s = new mongoose.Schema({
  // Index de recherche : hash SHA-256 du username lowercase
  usernameHash:     { type: String, required: true, unique: true },
  // Username chiffré AES pour affichage
  username:         { type: String, required: true },
  passwordHash:     { type: String, required: true },
  secretQuestion:   { type: String, required: true },
  secretAnswerHash: { type: String, required: true },
  // Avatar : emoji id (ex: 'ghost') ou 'custom' si image uploadée
  avatar:           { type: String, default: 'ghost' },
  // Image avatar custom en base64 (si avatar === 'custom')
  avatarImage:      { type: String, default: '' },
  // Profil public
  bio:              { type: String, default: '', maxlength: 200 },
}, { timestamps: true });

// Chiffre les champs sensibles en DB
s.plugin(encryptPlugin, { fields: ['username', 'secretQuestion', 'avatar', 'bio'] });

// Helper statique : hash du username pour la recherche
s.statics.hashUsername = function(username) {
  return crypto.createHash('sha256').update(username.toLowerCase().trim()).digest('hex');
};

module.exports = mongoose.model('User', s);
