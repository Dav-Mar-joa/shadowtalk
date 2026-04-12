const mongoose = require('mongoose');
const commentSchema = new mongoose.Schema({
  author:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 500 }
}, { timestamps: true });

const s = new mongoose.Schema({
  author:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, default: '', maxlength: 1000 },
  url:     { type: String, default: '' },
  urlType: { type: String, enum: ['youtube','web','event','other'], default: 'other' },
  urlPreview: { title: String, description: String, thumbnail: String },
  likes:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments:[commentSchema]
}, { timestamps: true });
module.exports = mongoose.model('Post', s);
