const router  = require('express').Router();
const auth    = require('../middleware/auth');
const Message = require('../models/Message');
const Chat    = require('../models/Chat');

router.use((req, res, next) => { req.io = req.app.get('io'); next(); });

/**
 * Une seule réaction par utilisateur :
 * - Même emoji → toggle off
 * - Autre emoji → remplace l'ancien
 */
function applyReaction(reactionsMap, userId, newEmoji) {
  if (!reactionsMap) reactionsMap = new Map();

  let currentEmoji = null;
  for (const [emoji, users] of reactionsMap.entries()) {
    if (users.includes(userId)) { currentEmoji = emoji; break; }
  }

  // Retirer l'ancien
  if (currentEmoji) {
    const users = reactionsMap.get(currentEmoji).filter(u => u !== userId);
    if (users.length === 0) reactionsMap.delete(currentEmoji);
    else reactionsMap.set(currentEmoji, users);
  }

  // Toggle off si même emoji
  if (currentEmoji === newEmoji) return reactionsMap;

  // Ajouter le nouveau
  const users = reactionsMap.get(newEmoji) || [];
  users.push(userId);
  reactionsMap.set(newEmoji, users);

  return reactionsMap;
}

// Récupérer messages d'un chat
router.get('/:chatId', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.chatId, members: req.userId });
    if (!chat) return res.status(403).json({ error: 'Accès refusé' });
    const page = parseInt(req.query.page) || 1;
    const msgs = await Message.find({ chat: req.params.chatId, deleted: false })
      .populate('sender', 'username avatar')
      .sort({ createdAt: -1 }).skip((page-1)*50).limit(50);
    res.json(msgs.reverse());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Supprimer un message
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ error: 'Message introuvable' });
    if (msg.sender.toString() !== req.userId) return res.status(403).json({ error: 'Pas ton message' });
    msg.deleted = true;
    msg.encryptedContent = '';
    msg.mediaData = '';
    await msg.save();
    const chatId = msg.chat.toString();
    const last = await Message.findOne({ chat: chatId, deleted: false }).sort({ createdAt: -1 });
    await Chat.findByIdAndUpdate(chatId, { lastMessage: last?._id || null });
    req.io?.to('c:' + chatId).emit('message_deleted', { messageId: req.params.messageId, chatId });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Marquer comme lu
router.post('/:chatId/read', auth, async (req, res) => {
  try {
    await Message.updateMany(
      { chat: req.params.chatId, readBy: { $ne: req.userId } },
      { $addToSet: { readBy: req.userId } }
    );
    req.io?.to('c:' + req.params.chatId).emit('messages_read', {
      chatId: req.params.chatId,
      userId: req.userId
    });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ✅ Réaction sur un message — une seule réaction par utilisateur
router.post('/:messageId/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'Emoji requis' });
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ error: 'Message introuvable' });

    msg.reactions = applyReaction(msg.reactions || new Map(), req.userId, emoji);
    msg.markModified('reactions');
    await msg.save();

    const chatId = msg.chat.toString();
    req.io?.to('c:' + chatId).emit('message_reaction', {
      messageId: req.params.messageId,
      chatId,
      reactions: Object.fromEntries(msg.reactions)
    });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
