const router = require('express').Router();
const auth   = require('../middleware/auth');
const User   = require('../models/User');

router.get('/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    const users = await User.find({ username: { $regex: q.toLowerCase(), $options:'i' }, _id: { $ne: req.userId } })
      .select('username avatar').limit(10);
    res.json(users);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash -secretAnswerHash');
    if (!user) return res.status(404).json({ error: 'Introuvable' });
    res.json(user);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
