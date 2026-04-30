const router = require('express').Router();
const auth   = require('../middleware/auth');
const Post    = require('../models/Post');
const Contact = require('../models/Contact');

router.use((req, res, next) => { req.io = req.app.get('io'); next(); });

const VALID_REACTIONS = ['❤️','😂','👍','😮','😢','🔥'];

/**
 * Logique "une réaction par user" :
 * - Si l'user réagit avec le MÊME emoji → toggle off
 * - Si l'user réagit avec un AUTRE emoji → retire l'ancien, ajoute le nouveau
 * - Résultat : max 1 emoji par utilisateur sur un item
 */
function applyReaction(reactionsMap, userId, newEmoji) {
  if (!reactionsMap) reactionsMap = new Map();

  // Trouver l'emoji actuel de cet utilisateur (s'il en a un)
  let currentEmoji = null;
  for (const [emoji, users] of reactionsMap.entries()) {
    if (users.includes(userId)) {
      currentEmoji = emoji;
      break;
    }
  }

  // Retirer l'utilisateur de son emoji actuel
  if (currentEmoji) {
    const users = reactionsMap.get(currentEmoji).filter(u => u !== userId);
    if (users.length === 0) reactionsMap.delete(currentEmoji);
    else reactionsMap.set(currentEmoji, users);
  }

  // Si même emoji → juste le retrait (toggle off) → terminé
  if (currentEmoji === newEmoji) return reactionsMap;

  // Sinon ajouter l'utilisateur sur le nouvel emoji
  const users = reactionsMap.get(newEmoji) || [];
  users.push(userId);
  reactionsMap.set(newEmoji, users);

  return reactionsMap;
}

// Fil d'actu
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;

    // ✅ Récupérer uniquement les posts de mes contacts + les miens
    const myContacts = await Contact.find({ owner: req.userId }).select('contact');
    const contactIds = myContacts.map(c => c.contact);
    // Inclure mon propre userId pour voir mes propres posts
    const authorIds  = [...contactIds, req.userId];

    const posts = await Post.find({ author: { $in: authorIds } })
      .populate('author', 'username avatar avatarImage')
      .populate('comments.author', 'username avatar avatarImage')
      .sort({ createdAt: -1 }).skip((page-1)*20).limit(20);

    res.json(posts);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Créer un post
router.post('/', auth, async (req, res) => {
  try {
    const { content, url, urlType, urlPreview } = req.body;
    if (!content && !url) return res.status(400).json({ error: 'Contenu ou URL requis' });
    let p = await Post.create({ author: req.userId, content, url, urlType, urlPreview });
    p = await p.populate('author', 'username avatar avatarImage');
    req.io?.emit('new_post', p);
    res.status(201).json(p);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Supprimer un post
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

// ✅ Réaction sur un post — une seule réaction par utilisateur
router.post('/:id/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!VALID_REACTIONS.includes(emoji)) return res.status(400).json({ error: 'Réaction invalide' });
    const p = await Post.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Post introuvable' });

    p.reactions = applyReaction(p.reactions || new Map(), req.userId, emoji);
    p.markModified('reactions');
    await p.save();

    const reactObj = Object.fromEntries(p.reactions);
    req.io?.emit('post_reacted', { postId: p._id, reactions: reactObj });
    res.json({ reactions: reactObj });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Commenter
router.post('/:id/comment', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Commentaire vide' });
    const p = await Post.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Introuvable' });
    p.comments.push({ author: req.userId, content });
    await p.save();
    const updated = await Post.findById(req.params.id)
      .populate('author', 'username avatar avatarImage')
      .populate('comments.author', 'username avatar avatarImage');
    req.io?.emit('post_commented', updated);
    res.json(updated);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ✅ Réaction sur un commentaire — une seule réaction par utilisateur
router.post('/:id/comment/:commentId/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!VALID_REACTIONS.includes(emoji)) return res.status(400).json({ error: 'Réaction invalide' });
    const p = await Post.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Post introuvable' });
    const comment = p.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Commentaire introuvable' });

    comment.reactions = applyReaction(comment.reactions || new Map(), req.userId, emoji);
    p.markModified('comments');
    await p.save();

    const updated = await Post.findById(req.params.id)
      .populate('author', 'username avatar avatarImage')
      .populate('comments.author', 'username avatar avatarImage');
    req.io?.emit('post_commented', updated);
    res.json(updated);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Supprimer un commentaire
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
      .populate('author', 'username avatar avatarImage')
      .populate('comments.author', 'username avatar avatarImage');
    req.io?.emit('post_commented', updated);
    res.json(updated);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
