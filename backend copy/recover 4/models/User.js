const mongoose      = require('mongoose');
const encryptPlugin = require('../utils/encryptPlugin');
const crypto        = require('crypto');

const s = new mongoose.Schema({
  // Index de recherche : hash SHA-256 du username lowercase (non réversible, non lisible)
  usernameHash:     { type: String, required: true, unique: true },
  // Username chiffré AES pour affichage
  username:         { type: String, required: true },
  passwordHash:     { type: String, required: true },
  secretQuestion:   { type: String, required: true },
  secretAnswerHash: { type: String, required: true },
  avatar:           { type: String, default: 'ghost' }
}, { timestamps: true });

// Chiffre les champs sensibles en DB
s.plugin(encryptPlugin, { fields: ['username', 'secretQuestion', 'avatar'] });

// Helper statique : hash du username pour la recherche
s.statics.hashUsername = function(username) {
  return crypto.createHash('sha256').update(username.toLowerCase().trim()).digest('hex');
};

module.exports = mongoose.model('User', s);
