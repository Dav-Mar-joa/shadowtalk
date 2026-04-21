const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const SECRET  = process.env.JWT_SECRET || 'devsecret';

router.post('/register', async (req, res) => {
  try {
    const { username, password, secretQuestion, secretAnswer, avatar } = req.body;
    if (!username || !password || !secretQuestion || !secretAnswer)
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Mot de passe trop court (6 min)' });

    const usernameHash = User.hashUsername(username);
    if (await User.findOne({ usernameHash }))
      return res.status(409).json({ error: 'Username déjà pris' });

    const passwordHash     = await bcrypt.hash(password, 12);
    const secretAnswerHash = await bcrypt.hash(secretAnswer.toLowerCase().trim(), 12);

    const user = await User.create({
      usernameHash,
      username: username.toLowerCase(),
      passwordHash,
      secretQuestion,
      secretAnswerHash,
      avatar: avatar || 'ghost'
    });

    const token = jwt.sign({ userId: user._id }, SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user: { _id: user._id, username: user.username, avatar: user.avatar } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const usernameHash = User.hashUsername(username);
    const user = await User.findOne({ usernameHash });
    if (!user || !await bcrypt.compare(password, user.passwordHash))
      return res.status(401).json({ error: 'Username ou mot de passe incorrect' });
    const token = jwt.sign({ userId: user._id }, SECRET, { expiresIn: '30d' });
    res.json({ token, user: { _id: user._id, username: user.username, avatar: user.avatar } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/recover/:username', async (req, res) => {
  try {
    const usernameHash = User.hashUsername(req.params.username);
    const user = await User.findOne({ usernameHash });
    if (!user) return res.status(404).json({ error: 'Username introuvable' });
    res.json({ secretQuestion: user.secretQuestion });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/recover', async (req, res) => {
  try {
    const { username, secretAnswer, newPassword } = req.body;
    const usernameHash = User.hashUsername(username);
    const user = await User.findOne({ usernameHash });
    if (!user) return res.status(404).json({ error: 'Username introuvable' });
    if (!await bcrypt.compare(secretAnswer.toLowerCase().trim(), user.secretAnswerHash))
      return res.status(401).json({ error: 'Réponse incorrecte' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Mot de passe trop court' });
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    const token = jwt.sign({ userId: user._id }, SECRET, { expiresIn: '30d' });
    res.json({ token, user: { _id: user._id, username: user.username, avatar: user.avatar } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
