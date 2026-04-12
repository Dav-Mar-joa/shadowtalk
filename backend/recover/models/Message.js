const mongoose = require('mongoose');
const s = new mongoose.Schema({
  chat:             { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  sender:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  encryptedContent: { type: String, required: true },
  tempId:           String,
  readBy:           [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });
module.exports = mongoose.model('Message', s);
