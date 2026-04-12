const router      = require('express').Router();
const auth        = require('../middleware/auth');
const PushSub     = require('../models/PushSubscription');

// Retourne la clé publique VAPID (le frontend en a besoin pour s'abonner)
router.get('/vapid-public-key', (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || '' });
});

// Enregistrer ou mettre à jour une subscription
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ error: 'Subscription invalide' });

    await PushSub.findOneAndUpdate(
      { 'subscription.endpoint': subscription.endpoint },
      {
        user: req.userId,
        subscription,
        userAgent: req.headers['user-agent']
      },
      { upsert: true, new: true }
    );

    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Supprimer une subscription (désinscription)
router.post('/unsubscribe', auth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSub.deleteOne({ 'subscription.endpoint': endpoint, user: req.userId });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
