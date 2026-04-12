const webpush = require('web-push');

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@shadowtalk.app',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Envoie une notification push à un ou plusieurs subscriptions
 * @param {Object|Object[]} subscriptions - subscription(s) stockée(s) en DB
 * @param {Object} payload - { title, body, icon, url, chatId }
 */
async function sendPush(subscriptions, payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('⚠️  VAPID keys manquantes — push désactivé');
    return;
  }

  const subs = Array.isArray(subscriptions) ? subscriptions : [subscriptions];
  const data = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subs.map(sub => webpush.sendNotification(sub, data))
  );

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`Push failed [${i}]:`, r.reason?.statusCode, r.reason?.message);
    }
  });
}

module.exports = { sendPush };
