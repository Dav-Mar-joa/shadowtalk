const mongoose      = require('mongoose');
const encryptPlugin = require('../utils/encryptPlugin');

const s = new mongoose.Schema({
  chat:             { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  sender:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  encryptedContent: { type: String, default: '' },
  // Type : text | image | audio | file
  type:             { type: String, enum: ['text','image','audio','file'], default: 'text' },
  // Pour images/audio : base64 chiffré ou URL
  mediaData:        { type: String, default: '' },
  fileName:         { type: String, default: '' },
  tempId:           String,
  // Statut "vu" : liste des userId qui ont lu
  readBy:           [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Réactions emoji : { emoji: [userId, ...] }
  reactions:        { type: Map, of: [String], default: {} },
  // Message supprimé (soft delete)
  deleted:          { type: Boolean, default: false }
}, { timestamps: true });

s.plugin(encryptPlugin, { fields: ['encryptedContent', 'mediaData', 'fileName'] });

module.exports = mongoose.model('Message', s);
