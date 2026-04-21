const mongoose = require('mongoose');

// Stocke les subscriptions Web Push par user
const pushSubSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscription: {
    endpoint: { type: String, required: true },
    keys: {
      p256dh: String,
      auth:   String
    }
  },
  userAgent: String,
  createdAt: { type: Date, default: Date.now }
});

// Index unique par endpoint (évite les doublons)
pushSubSchema.index({ 'subscription.endpoint': 1 }, { unique: true });

module.exports = mongoose.model('PushSubscription', pushSubSchema);
