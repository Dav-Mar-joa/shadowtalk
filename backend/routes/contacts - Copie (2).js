const router  = require('express').Router();
const auth    = require('../middleware/auth');
const Contact = require('../models/Contact');
const User    = require('../models/User');

router.use((req, res, next) => { req.io = req.app.get('io'); req.online = req.app.get('online'); next(); });

// ── Mes contacts acceptés ──────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const contacts = await Contact.find({ owner: req.userId, status: 'accepted' })
      .populate('contact', 'username avatar avatarImage')
      .sort({ addedAt: -1 });
    res.json(contacts.map(c => c.contact));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Demandes reçues (pending, je suis le contact) ─────────
router.get('/requests', auth, async (req, res) => {
  try {
    const requests = await Contact.find({ contact: req.userId, status: 'pending' })
      .populate('owner', 'username avatar avatarImage')
      .sort({ addedAt: -1 });
    res.json(requests.map(r => ({ requestId: r._id, user: r.owner, createdAt: r.addedAt })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Envoyer une demande ────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    const { contactId } = req.body;
    if (contactId === req.userId) return res.status(400).json({ error: 'Tu ne peux pas t\'ajouter toi-même' });

    const user = await User.findById(contactId).select('username avatar avatarImage');
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    // Vérifier si une relation existe déjà dans les deux sens
    const existing = await Contact.findOne({
      $or: [
        { owner: req.userId, contact: contactId },
        { owner: contactId, contact: req.userId }
      ]
    });

    if (existing) {
      if (existing.status === 'accepted') return res.json({ already: true, status: 'accepted' });
      if (existing.status === 'pending')  return res.json({ already: true, status: 'pending' });
    }

    // Créer la demande
    await Contact.create({ owner: req.userId, contact: contactId, status: 'pending' });

    // Notifier la personne demandée via socket
    const me = await User.findById(req.userId).select('username avatar avatarImage');
    const targetSocketId = req.online?.get(contactId);
    if (targetSocketId) {
      req.io?.to(targetSocketId).emit('contact_request', {
        requestId: null,
        user: { _id: me._id, username: me.username, avatar: me.avatar, avatarImage: me.avatarImage }
      });
    }

    res.json({ ok: true, status: 'pending' });
  } catch(e) {
    if (e.code === 11000) return res.json({ already: true });
    res.status(500).json({ error: e.message });
  }
});

// ── Accepter une demande ───────────────────────────────────
router.post('/accept/:ownerId', auth, async (req, res) => {
  try {
    const { ownerId } = req.params;

    // Mettre à jour la demande existante
    const request = await Contact.findOneAndUpdate(
      { owner: ownerId, contact: req.userId, status: 'pending' },
      { status: 'accepted' },
      { new: true }
    ).populate('owner', 'username avatar avatarImage');

    if (!request) return res.status(404).json({ error: 'Demande introuvable' });

    // ✅ Créer la relation inverse (moi → lui aussi)
    await Contact.findOneAndUpdate(
      { owner: req.userId, contact: ownerId },
      { owner: req.userId, contact: ownerId, status: 'accepted' },
      { upsert: true, new: true }
    );

    // Notifier l'expéditeur que sa demande a été acceptée
    const me = await User.findById(req.userId).select('username avatar avatarImage');
    const senderSocketId = req.online?.get(ownerId);
    if (senderSocketId) {
      req.io?.to(senderSocketId).emit('contact_accepted', {
        user: { _id: me._id, username: me.username, avatar: me.avatar, avatarImage: me.avatarImage }
      });
    }

    res.json({ ok: true, user: request.owner });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Refuser / annuler une demande ──────────────────────────
router.post('/decline/:ownerId', auth, async (req, res) => {
  try {
    await Contact.deleteOne({ owner: req.params.ownerId, contact: req.userId, status: 'pending' });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Supprimer un contact accepté ──────────────────────────
router.delete('/:contactId', auth, async (req, res) => {
  try {
    // Supprimer dans les deux sens
    await Contact.deleteMany({
      $or: [
        { owner: req.userId, contact: req.params.contactId },
        { owner: req.params.contactId, contact: req.userId }
      ]
    });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
