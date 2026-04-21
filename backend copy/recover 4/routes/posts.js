const router = require('express').Router();
const auth   = require('../middleware/auth');
const Post   = require('../models/Post');

router.use((req, res, next) => { req.io = req.app.get('io'); next(); });

const VALID_REACTIONS = ['❤️','😂','👍','😮','😢','🔥'];

router.get('/', auth, async (req, res) => {
  try {
    const page  = parseInt(req.query.page) || 1;
    const posts = await Post.find()
      .populate('author', 'username avatar')
      .populate('comments.author', 'username avatar')
      .sort({ createdAt: -1 }).skip((page-1)*20).limit(20);
    res.json(posts);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { content, url, urlType, urlPreview } = req.body;
    if (!content && !url) return res.status(400).json({ error: 'Contenu ou URL requis' });
    let p = await Post.create({ author: req.userId, content, url, urlType, urlPreview });
    p = await p.populate('author', 'username avatar');
    req.io?.emit('new_post', p);
    res.status(201).json(p);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const p = await Post.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Post introuvable' });
    if (p.author.toString() !== req.userId) return res.status(403).json({ error: 'Pas ton post' });
    await p.deleteOne();
    req.io?.emit('post_deleted', { postId: req.params.id });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ✅ Réaction sur un post (toggle)
router.post('/:id/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!VALID_REACTIONS.includes(emoji)) return res.status(400).json({ error: 'Réaction invalide' });
    const p = await Post.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Post introuvable' });

    if (!p.reactions) p.reactions = new Map();
    const users = p.reactions.get(emoji) || [];
    const idx   = users.indexOf(req.userId);
    if (idx > -1) users.splice(idx, 1); else users.push(req.userId);
    if (users.length === 0) p.reactions.delete(emoji); else p.reactions.set(emoji, users);
    p.markModified('reactions');
    await p.save();

    const reactObj = Object.fromEntries(p.reactions);
    req.io?.emit('post_reacted', { postId: p._id, reactions: reactObj });
    res.json({ reactions: reactObj });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Like (raccourci ❤️ — garde la compat)
router.post('/:id/like', auth, async (req, res) => {
  try {
    const p = await Post.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Post introuvable' });
    const idx = p.likes.findIndex(l => l.toString() === req.userId);
    if (idx > -1) p.likes.splice(idx, 1); else p.likes.push(req.userId);
    await p.save();
    req.io?.emit('post_liked', { postId: p._id, likes: p.likes.length, liked: idx === -1, userId: req.userId });
    res.json({ likes: p.likes.length, liked: idx === -1 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/comment', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Commentaire vide' });
    const p = await Post.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Introuvable' });
    p.comments.push({ author: req.userId, content });
    await p.save();
    const updated = await Post.findById(req.params.id)
      .populate('author', 'username avatar')
      .populate('comments.author', 'username avatar');
    req.io?.emit('post_commented', updated);
    res.json(updated);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ✅ Réaction sur un commentaire (toggle)
router.post('/:id/comment/:commentId/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!VALID_REACTIONS.includes(emoji)) return res.status(400).json({ error: 'Réaction invalide' });
    const p = await Post.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Post introuvable' });
    const comment = p.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });

    if (!comment.reactions) comment.reactions = new Map();
    const users = comment.reactions.get(emoji) || [];
    const idx   = users.indexOf(req.userId);
    if (idx > -1) users.splice(idx, 1); else users.push(req.userId);
    if (users.length === 0) comment.reactions.delete(emoji); else comment.reactions.set(emoji, users);
    p.markModified('comments');
    await p.save();

    const updated = await Post.findById(req.params.id)
      .populate('author', 'username avatar')
      .populate('comments.author', 'username avatar');
    req.io?.emit('post_commented', updated);
    res.json(updated);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id/comment/:commentId', auth, async (req, res) => {
  try {
    const p = await Post.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Post introuvable' });
    const comment = p.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });
    if (comment.author.toString() !== req.userId) return res.status(403).json({ error: 'Pas ton commentaire' });
    comment.deleteOne();
    await p.save();
    const updated = await Post.findById(req.params.id)
      .populate('author', 'username avatar')
      .populate('comments.author', 'username avatar');
    req.io?.emit('post_commented', updated);
    res.json(updated);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
