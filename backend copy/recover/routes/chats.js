const router = require('express').Router();
const auth   = require('../middleware/auth');
const Chat   = require('../models/Chat');
const Message = require('../models/Message');

router.use((req, res, next) => { req.io = req.app.get('io'); next(); });

// Tous mes chats
router.get('/', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ members: req.userId })
      .populate('members', 'username avatar')
      .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'username' } })
      .sort({ updatedAt: -1 });
    res.json(chats);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Chat 1-1
router.post('/direct', auth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const members = [req.userId, targetUserId].sort();
    let chat = await Chat.findOne({ isGroup: false, members: { $all: members, $size: 2 } })
      .populate('members', 'username avatar');
    if (!chat) {
      chat = await (await Chat.create({ isGroup: false, members, createdBy: req.userId }))
        .populate('members', 'username avatar');
      // Notifie le destinataire qu'un nouveau chat existe
      const targetSocketId = req.app.get('online')?.get(targetUserId);
      if (targetSocketId) req.io?.to(targetSocketId).emit('new_chat', chat);
    }
    res.json(chat);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Groupe
router.post('/group', auth, async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || !memberIds?.length) return res.status(400).json({ error: 'Nom et membres requis' });
    const members = [...new Set([req.userId, ...memberIds])];
    const chat = await (await Chat.create({ isGroup: true, name, members, createdBy: req.userId }))
      .populate('members', 'username avatar');
    // Notifie tous les membres
    members.forEach(uid => {
      const sid = req.app.get('online')?.get(uid.toString());
      if (sid) req.io?.to(sid).emit('new_chat', chat);
    });
    res.status(201).json(chat);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Quitter / supprimer un chat
router.delete('/:id', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, members: req.userId });
    if (!chat) return res.status(404).json({ error: 'Chat introuvable' });

    if (chat.isGroup) {
      // Quitter le groupe
      chat.members = chat.members.filter(m => m.toString() !== req.userId);
      if (chat.members.length === 0) {
        await Message.deleteMany({ chat: chat._id });
        await chat.deleteOne();
        req.io?.emit('chat_deleted', { chatId: req.params.id });
      } else {
        await chat.save();
        req.io?.to('c:' + req.params.id).emit('chat_updated', await chat.populate('members', 'username avatar'));
      }
    } else {
      // Supprimer le chat 1-1 + ses messages
      await Message.deleteMany({ chat: chat._id });
      await chat.deleteOne();
      // Notifie les 2 membres
      chat.members.forEach(uid => {
        const sid = req.app.get('online')?.get(uid.toString());
        if (sid) req.io?.to(sid).emit('chat_deleted', { chatId: req.params.id });
      });
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
