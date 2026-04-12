const jwt = require('jsonwebtoken');
module.exports = (req, res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Non autorisé' });
  try {
    const { userId } = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET || 'devsecret');
    req.userId = userId;
    next();
  } catch { res.status(401).json({ error: 'Token invalide' }); }
};
