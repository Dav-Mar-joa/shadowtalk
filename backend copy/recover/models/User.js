const mongoose = require('mongoose');
const s = new mongoose.Schema({
  username:        { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 24, match: /^[a-zA-Z0-9_]+$/ },
  passwordHash:    { type: String, required: true },
  secretQuestion:  { type: String, required: true },
  secretAnswerHash:{ type: String, required: true },
  avatar:          { type: String, default: 'ghost' }
}, { timestamps: true });
module.exports = mongoose.model('User', s);
