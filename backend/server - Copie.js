require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const mongoose   = require('mongoose');
const jwt        = require('jsonwebtoken');

const app    = express();
const server = http.createServer(app);

// CORS dynamique — lit process.env à chaque requête
function getAllowedOrigins() {
  return [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://shadowtalk-front.onrender.com',
    process.env.CLIENT_URL
  ].filter(Boolean);
}

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || getAllowedOrigins().includes(origin)) return cb(null, true);
    console.warn('CORS bloqué:', origin, '| Allowed:', getAllowedOrigins());
    cb(new Error('CORS bloqué: ' + origin));
  },
  credentials: true
};

const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin || getAllowedOrigins().includes(origin)) return cb(null, true);
      cb(null, false);
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  // ✅ Fix Render : accepter polling ET websocket
  // Le plan gratuit Render peut bloquer les WS purs — polling en fallback
  transports: ['polling', 'websocket'],
  allowUpgrades: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 10e6
});

const online = new Map();
app.set('io', io);
app.set('online', online);

app.use(cors(corsOptions));
app.use(express.json({ limit: '15mb' }));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/chats',    require('./routes/chats'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/posts',    require('./routes/posts'));
app.use('/api/push',     require('./routes/push'));
app.use('/api/contacts', require('./routes/contacts'));

app.get('/ping', (_, res) => res.json({ ok: true, ts: Date.now(), env: process.env.NODE_ENV }));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(e => console.error('❌ MongoDB:', e.message));

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('no_token'));
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = userId;
    next();
  } catch { next(new Error('bad_token')); }
});

io.on('connection', socket => {
  const uid = socket.userId;
  online.set(uid, socket.id);
  io.emit('user_online', uid);

  socket.on('join_chat',  id => socket.join('c:' + id));
  socket.on('leave_chat', id => socket.leave('c:' + id));

  socket.on('send_message', async ({ chatId, encryptedContent, type, mediaData, fileName, tempId }) => {
    try {
      const Message      = require('./models/Message');
      const Chat         = require('./models/Chat');
      const PushSub      = require('./models/PushSubscription');
      const { sendPush } = require('./utils/webpush');

      const msg = await Message.create({
        chat: chatId, sender: uid,
        encryptedContent: encryptedContent || '',
        type: type || 'text',
        mediaData: mediaData || '',
        fileName:  fileName  || '',
        tempId,
        readBy: [uid]
      });
      await Chat.findByIdAndUpdate(chatId, { lastMessage: msg._id, updatedAt: new Date() });
      const full = await msg.populate('sender', 'username avatar avatarImage');
      io.to('c:' + chatId).emit('new_message', full);

      const chat = await Chat.findById(chatId);
      for (const memberId of chat.members) {
        const mStr = memberId.toString();
        if (mStr === uid) continue;
        const sid = online.get(mStr);
        if (sid) io.to(sid).emit('notification', { type: 'message', chatId, from: full.sender.username });
        const subs = await PushSub.find({ user: memberId });
        if (subs.length > 0) {
          const bodyText = type === 'image' ? '📷 Image' : type === 'audio' ? '🎤 Vocal' : 'Nouveau message';
          await sendPush(subs.map(s => s.subscription), {
            title: `💬 ${full.sender.username}`,
            body: bodyText,
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            url: `/chat/${chatId}`,
            chatId
          });
        }
      }
    } catch(e) { socket.emit('msg_error', { tempId, error: e.message }); }
  });

  socket.on('typing', ({ chatId, typing }) =>
    socket.to('c:' + chatId).emit('typing', { userId: uid, typing }));

  // ✅ Client reconnecté — il va re-join ses rooms lui-même
  // On notifie juste les autres qu'il est de nouveau en ligne
  socket.on('client_reconnected', () => {
    online.set(uid, socket.id);
    io.emit('user_online', uid);
  });

  socket.on('disconnect', () => {
    online.delete(uid);
    io.emit('user_offline', uid);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`🚀 ShadowTalk — port ${PORT} — ${process.env.NODE_ENV || 'development'}`)
);
