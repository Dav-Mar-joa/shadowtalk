const router  = require('express').Router();
const auth    = require('../middleware/auth');
const Message = require('../models/Message');
const Chat    = require('../models/Chat');

router.use((req, res, next) => { req.io = req.app.get('io'); next(); });

// Récupérer les messages d'un chat
router.get('/:chatId', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.chatId, members: req.userId });
    if (!chat) return res.status(403).json({ error: 'Accès refusé' });
    const page = parseInt(req.query.page) || 1;
    const msgs = await Message.find({ chat: req.params.chatId })
      .populate('sender', 'username avatar')
      .sort({ createdAt: -1 }).skip((page-1)*50).limit(50);
    res.json(msgs.reverse());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Supprimer un message (seulement l'auteur)
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ error: 'Message introuvable' });
    if (msg.sender.toString() !== req.userId)
      return res.status(403).json({ error: 'Pas ton message' });

    const chatId = msg.chat.toString();
    await msg.deleteOne();

    // Si c'était le dernier message, mettre à jour lastMessage
    const last = await Message.findOne({ chat: chatId }).sort({ createdAt: -1 });
    await Chat.findByIdAndUpdate(chatId, { lastMessage: last?._id || null });

    // ✅ Broadcast suppression à toute la room
    req.io?.to('c:' + chatId).emit('message_deleted', {
      messageId: req.params.messageId,
      chatId
    });

    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
