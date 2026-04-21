const router = require('express').Router();

router.use((req, res, next) => { req.io = req.app.get('io'); next(); });
const auth   = require('../middleware/auth');
const User   = require('../models/User');

// Recherche par username
router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    const users = await User.find({ _id: { $ne: req.userId } })
      .select('username avatar avatarImage usernameHash');
    const filtered = users
      .filter(u => u.username?.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 10);
    res.json(filtered.map(u => ({
      _id: u._id,
      username: u.username,
      avatar: u.avatar,
      avatarImage: u.avatarImage
    })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Mon profil
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('-passwordHash -secretAnswerHash -usernameHash');
    if (!user) return res.status(404).json({ error: 'Introuvable' });
    res.json(user);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Mettre à jour mon profil
router.put('/me', auth, async (req, res) => {
  try {
    const { username, avatar, avatarImage, bio } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Introuvable' });

    // ── Changement de username ──────────────────────────────
    if (username && username.toLowerCase() !== user.username?.toLowerCase()) {
      // Validation format
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: 'Username : lettres, chiffres et _ uniquement' });
      }
      if (username.length < 3 || username.length > 24) {
        return res.status(400).json({ error: 'Username : 3 à 24 caractères' });
      }
      // Vérifier unicité
      const newHash = User.hashUsername(username);
      const exists  = await User.findOne({ usernameHash: newHash });
      if (exists && exists._id.toString() !== req.userId) {
        return res.status(409).json({ error: 'Ce username est déjà pris' });
      }
      user.usernameHash = newHash;
      user.username     = username.toLowerCase();
    }

    // ── Avatar emoji ────────────────────────────────────────
    if (avatar !== undefined) user.avatar = avatar;

    // ── Avatar image custom ─────────────────────────────────
    if (avatarImage !== undefined) {
      // Limiter la taille (max ~500KB en base64)
      if (avatarImage.length > 700000) {
        return res.status(400).json({ error: 'Image trop lourde (max 500KB)' });
      }
      user.avatarImage = avatarImage;
      if (avatarImage) user.avatar = 'custom'; // marquer comme custom
    }

    // ── Bio ─────────────────────────────────────────────────
    if (bio !== undefined) {
      if (bio.length > 200) return res.status(400).json({ error: 'Bio max 200 caractères' });
      user.bio = bio;
    }

    await user.save();

    const updated = {
      _id:         user._id.toString(),
      username:    user.username,
      avatar:      user.avatar,
      avatarImage: user.avatarImage || '',
      bio:         user.bio || '',
    };

    // ✅ Broadcast à tous les clients connectés
    req.io?.emit('user_updated', updated);

    res.json(updated);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Profil public d'un utilisateur (pour future étape 3)
router.get('/:id/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username avatar avatarImage bio');
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
