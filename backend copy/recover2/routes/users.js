const router = require('express').Router();
const auth   = require('../middleware/auth');
const User   = require('../models/User');

// Recherche par username — déchiffre et compare
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    // Charge tous les users (hors soi-même) et filtre après déchiffrement
    // En prod avec beaucoup d'users : paginer ou utiliser un index de recherche dédié
    const users = await User.find({ _id: { $ne: req.userId } }).select('username avatar usernameHash');
    const filtered = users
      .filter(u => u.username?.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 10);
    res.json(filtered.map(u => ({ _id: u._id, username: u.username, avatar: u.avatar })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Profil courant
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash -secretAnswerHash -usernameHash');
    if (!user) return res.status(404).json({ error: 'Introuvable' });
    res.json(user);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Liste online
router.get('/online', (req, res) => {
  const online = req.app.get('online') || new Map();
  res.json([...online.keys()]);
});

module.exports = router;
