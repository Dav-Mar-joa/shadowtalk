/**
 * Plugin Mongoose : chiffre automatiquement les champs listés
 * avant save() et déchiffre après find/findOne
 *
 * Usage :
 *   schema.plugin(encryptPlugin, { fields: ['username', 'content'] });
 */
const { encrypt, decrypt } = require('../utils/crypto');

function encryptPlugin(schema, options = {}) {
  const fields = options.fields || [];

  // Chiffre avant toute sauvegarde
  schema.pre('save', function(next) {
    fields.forEach(field => {
      if (this[field] != null) this[field] = encrypt(String(this[field]));
    });
    next();
  });

  // Chiffre dans les updates (findOneAndUpdate, updateOne, etc.)
  ['findOneAndUpdate', 'updateOne', 'updateMany'].forEach(method => {
    schema.pre(method, function(next) {
      const update = this.getUpdate();
      if (!update) return next();
      const targets = [update, update.$set].filter(Boolean);
      targets.forEach(obj => {
        fields.forEach(field => {
          if (obj[field] != null) obj[field] = encrypt(String(obj[field]));
        });
      });
      next();
    });
  });

  // Déchiffre après lecture
  function decryptDoc(doc) {
    if (!doc) return;
    fields.forEach(field => {
      if (doc[field] != null) doc[field] = decrypt(doc[field]);
    });
  }

  schema.post('save',          doc => decryptDoc(doc));
  schema.post('find',          docs => docs?.forEach(decryptDoc));
  schema.post('findOne',       doc  => decryptDoc(doc));
  schema.post('findOneAndUpdate', doc => decryptDoc(doc));
}

module.exports = encryptPlugin;
