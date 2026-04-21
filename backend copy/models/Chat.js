const mongoose      = require('mongoose');
const encryptPlugin = require('../utils/encryptPlugin');

const s = new mongoose.Schema({
  name:        { type: String, default: '' },
  isGroup:     { type: Boolean, default: false },
  members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }
}, { timestamps: true });

// Chiffre le nom du groupe
s.plugin(encryptPlugin, { fields: ['name'] });

module.exports = mongoose.model('Chat', s);
