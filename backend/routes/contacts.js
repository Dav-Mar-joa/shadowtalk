const router  = require('express').Router();
const auth    = require('../middleware/auth');
const Contact = require('../models/Contact');
const User    = require('../models/User');

router.use((req, res, next) => { req.io = req.app.get('io'); next(); });

// Liste de mes contacts
router.get('/', auth, async (req, res) => {
  try {
    const contacts = await Contact.find({ owner: req.userId })
      .populate('contact', 'username avatar')
      .sort({ addedAt: -1 });
    res.json(contacts.map(c => c.contact));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Ajouter un contact
router.post('/', auth, async (req, res) => {
  try {
    const { contactId } = req.body;
    if (contactId === req.userId) return res.status(400).json({ error: 'Tu ne peux pas t\'ajouter toi-même' });
    const user = await User.findById(contactId).select('username avatar');
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    await Contact.findOneAndUpdate(
      { owner: req.userId, contact: contactId },
      { owner: req.userId, contact: contactId },
      { upsert: true, new: true }
    );
    res.json(user);
  } catch(e) {
    if (e.code === 11000) return res.json({ already: true });
    res.status(500).json({ error: e.message });
  }
});

// Supprimer un contact
router.delete('/:contactId', auth, async (req, res) => {
  try {
    await Contact.deleteOne({ owner: req.userId, contact: req.params.contactId });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
