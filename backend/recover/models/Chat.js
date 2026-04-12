const mongoose = require('mongoose');
const s = new mongoose.Schema({
  name:      { type: String, default: '' },
  isGroup:   { type: Boolean, default: false },
  members:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastMessage:{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }
}, { timestamps: true });
module.exports = mongoose.model('Chat', s);
