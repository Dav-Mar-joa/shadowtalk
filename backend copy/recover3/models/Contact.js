const mongoose = require('mongoose');
const s = new mongoose.Schema({
  owner:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  addedAt: { type: Date, default: Date.now }
});
s.index({ owner: 1, contact: 1 }, { unique: true });
module.exports = mongoose.model('Contact', s);
