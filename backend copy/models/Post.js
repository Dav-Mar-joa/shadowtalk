const mongoose      = require('mongoose');
const encryptPlugin = require('../utils/encryptPlugin');

const commentSchema = new mongoose.Schema({
  author:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:   { type: String, required: true, maxlength: 500 },
  reactions: { type: Map, of: [String], default: {} }
}, { timestamps: true });

commentSchema.plugin(encryptPlugin, { fields: ['content'] });

const s = new mongoose.Schema({
  author:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:    { type: String, default: '', maxlength: 1000 },
  url:        { type: String, default: '' },
  urlType:    { type: String, enum: ['youtube','web','event','other'], default: 'other' },
  urlPreview: { title: String, description: String, thumbnail: String },
  likes:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reactions:  { type: Map, of: [String], default: {} },
  comments:   [commentSchema]
}, { timestamps: true });

s.plugin(encryptPlugin, { fields: ['content', 'url'] });

module.exports = mongoose.model('Post', s);
