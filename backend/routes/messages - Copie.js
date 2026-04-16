const router  = require('express').Router();
const auth    = require('../middleware/auth');
const Message = require('../models/Message');
const Chat    = require('../models/Chat');

router.use((req, res, next) => { req.io = req.app.get('io'); next(); });

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

// Supprimer un message (soft delete)
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ error: 'Message introuvable' });
    if (msg.sender.toString() !== req.userId)
      return res.status(403).json({ error: 'Pas ton message' });
    msg.deleted          = true;
    msg.encryptedContent = '';
    msg.mediaData        = '';
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

// Réaction emoji
router.post('/:messageId/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'Emoji requis' });
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ error: 'Message introuvable' });

    const reactions = msg.reactions || new Map();
    const users = reactions.get(emoji) || [];
    const idx   = users.indexOf(req.userId);
    if (idx > -1) users.splice(idx, 1); else users.push(req.userId);
    if (users.length === 0) reactions.delete(emoji); else reactions.set(emoji, users);
    msg.reactions = reactions;
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
