import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get, post, encrypt, decrypt, formatTime } from '../utils/api';
import { getAvatarEmoji } from '../utils/avatars';
import { useAuth }   from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './ChatRoom.css';

const API = (path, opts={}) => fetch('/api' + path, {
  headers: { 'Content-Type':'application/json', Authorization:'Bearer '+localStorage.getItem('st_token') },
  ...opts
}).then(r => r.json());

export default function ChatRoom() {
  const { id }     = useParams();
  const { user }   = useAuth();
  const { socket } = useSocket();
  const navigate   = useNavigate();

  const [chat,      setChat]      = useState(null);
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(true);
  const [typing,    setTyping]    = useState(null);
  const [menuMsg,   setMenuMsg]   = useState(null); // id du message avec menu ouvert
  const bottomRef   = useRef(null);
  const typingTimer = useRef(null);
  const idRef       = useRef(id);
  useEffect(() => { idRef.current = id; }, [id]);

  // Charger chat + messages
  useEffect(() => {
    setLoading(true); setMessages([]);
    Promise.all([
      get('/chats').then(cs => cs.find(c => c._id === id)),
      get(`/messages/${id}`)
    ]).then(([c, msgs]) => { setChat(c); setMessages(msgs); })
      .catch(console.error).finally(() => setLoading(false));
  }, [id]);

  // Join/leave room
  useEffect(() => {
    if (!socket) return;
    socket.emit('join_chat', id);
    return () => socket.emit('leave_chat', id);
  }, [socket, id]);

  // ✅ Tous les events socket temps réel
  useEffect(() => {
    if (!socket) return;

    // Nouveau message
    socket.on('new_message', msg => {
      const msgChatId = msg.chat?._id || msg.chat;
      if (msgChatId !== idRef.current) return;
      setMessages(prev => {
        if (msg.tempId) {
          const exists = prev.find(m => m.tempId === msg.tempId);
          if (exists) return prev.map(m => m.tempId === msg.tempId ? msg : m);
        }
        if (prev.find(m => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    });

    // ✅ Suppression de message
    socket.on('message_deleted', ({ messageId, chatId }) => {
      if (chatId !== idRef.current) return;
      setMessages(prev => prev.filter(m => m._id !== messageId));
    });

    // ✅ Chat supprimé → rediriger
    socket.on('chat_deleted', ({ chatId }) => {
      if (chatId === idRef.current) navigate('/chats');
    });

    // ✅ Chat mis à jour (ex: quelqu'un quitte le groupe)
    socket.on('chat_updated', updatedChat => {
      if (updatedChat._id === idRef.current) setChat(updatedChat);
    });

    // Typing
    socket.on('typing', ({ userId: uid, typing: t }) => {
      if (uid !== user._id) setTyping(t ? uid : null);
    });

    return () => {
      socket.off('new_message');
      socket.off('message_deleted');
      socket.off('chat_deleted');
      socket.off('chat_updated');
      socket.off('typing');
    };
  }, [socket, navigate, user._id]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fermer menu au clic dehors
  useEffect(() => {
    const h = () => setMenuMsg(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  function handleInput(e) {
    setInput(e.target.value);
    if (!socket) return;
    socket.emit('typing', { chatId: id, typing: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() =>
      socket.emit('typing', { chatId: id, typing: false }), 1500);
  }

  function sendMessage(e) {
    e?.preventDefault();
    if (!input.trim() || !socket) return;
    const tempId = 'tmp_' + Date.now();
    const encryptedContent = encrypt(input.trim());
    setMessages(prev => [...prev, {
      _id: tempId, tempId, chat: id,
      sender: { _id: user._id, username: user.username, avatar: user.avatar },
      encryptedContent, createdAt: new Date().toISOString()
    }]);
    socket.emit('send_message', { chatId: id, encryptedContent, tempId });
    setInput('');
    socket.emit('typing', { chatId: id, typing: false });
  }

  async function deleteMessage(msgId) {
    setMenuMsg(null);
    try {
      await API(`/messages/${msgId}`, { method: 'DELETE' });
      // Le state se met à jour via socket 'message_deleted'
    } catch(e) { console.error(e); }
  }

  async function deleteChat() {
    if (!confirm('Supprimer ce chat ?')) return;
    try {
      await API(`/chats/${id}`, { method: 'DELETE' });
      // Redirection via socket 'chat_deleted'
    } catch(e) { console.error(e); }
  }

  function getChatName() {
    if (!chat) return '...';
    if (chat.isGroup) return chat.name;
    return chat.members?.find(m => m._id !== user._id)?.username || '?';
  }

  function getChatAvatar() {
    if (!chat) return '💬';
    if (chat.isGroup) return '👥';
    return getAvatarEmoji(chat.members?.find(m => m._id !== user._id)?.avatar);
  }

  function isSelf(msg) { return (msg.sender?._id || msg.sender) === user._id; }
  function showAvatar(msgs, i) {
    if (isSelf(msgs[i])) return false;
    return i === 0 || isSelf(msgs[i-1]) ||
      (msgs[i].sender?._id||msgs[i].sender) !== (msgs[i-1].sender?._id||msgs[i-1].sender);
  }

  const typingUser = typing && chat?.members?.find(m => m._id === typing);

  if (loading) return (
    <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <span className="spinner" style={{width:28,height:28}}/>
    </div>
  );

  return (
    <div className="chatroom">
      {/* Header */}
      <div className="chatroom-header">
        <button className="btn-icon" onClick={() => navigate('/chats')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <div className="avatar">{getChatAvatar()}</div>
        <div className="chatroom-info">
          <span className="chatroom-name">{getChatName()}</span>
          {chat?.isGroup && <span className="chatroom-sub">{chat.members?.length} membres</span>}
        </div>
        <div className="tag tag-accent">🔒 CHIFFRÉ</div>
        <button className="btn-icon" onClick={deleteChat} title={chat?.isGroup ? 'Quitter le groupe' : 'Supprimer le chat'}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="chatroom-messages" onClick={() => setMenuMsg(null)}>
        {messages.length === 0 && (
          <div className="messages-empty">
            <span style={{fontSize:36}}>🔒</span>
            <p>Conversation chiffrée</p>
            <span>Envoie le premier message</span>
          </div>
        )}
        {messages.map((msg, i) => {
          const self    = isSelf(msg);
          const showAv  = showAvatar(messages, i);
          const content = decrypt(msg.encryptedContent);
          const isTemp  = msg._id?.startsWith('tmp_');
          const menuOpen = menuMsg === msg._id;

          return (
            <div key={msg._id} className={`msg-row ${self ? 'self' : 'other'}`}>
              {!self && (
                <div className={`avatar avatar-sm ${showAv ? '' : 'invisible'}`}>
                  {showAv ? getAvatarEmoji(msg.sender?.avatar) : ''}
                </div>
              )}
              <div className="msg-block">
                {showAv && !self && <span className="msg-sender">{msg.sender?.username}</span>}
                <div className="bubble-wrap">
                  <div
                    className={`bubble ${self ? 'bubble-self' : 'bubble-other'} ${isTemp ? 'bubble-pending' : ''}`}
                    onContextMenu={e => { e.preventDefault(); if (!isTemp) setMenuMsg(msg._id); }}
                    onClick={e => { e.stopPropagation(); if (!isTemp && self) setMenuMsg(menuOpen ? null : msg._id); }}
                  >
                    {content}
                  </div>
                  {/* Menu contextuel */}
                  {menuOpen && self && (
                    <div className={`msg-menu ${self ? 'msg-menu-self' : 'msg-menu-other'}`}
                      onClick={e => e.stopPropagation()}>
                      <button onClick={() => deleteMessage(msg._id)} className="msg-menu-btn delete">
                        🗑️ Supprimer
                      </button>
                    </div>
                  )}
                </div>
                <span className="msg-time">{formatTime(msg.createdAt)}</span>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingUser && (
          <div className="msg-row other fade-in">
            <div className="avatar avatar-sm">{getAvatarEmoji(typingUser.avatar)}</div>
            <div className="msg-block">
              <div className="bubble bubble-other typing-bubble">
                <span/><span/><span/>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <form className="chatroom-input-area" onSubmit={sendMessage}>
        <div className="input-wrap">
          <textarea
            value={input} onChange={handleInput}
            onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();} }}
            placeholder="Message chiffré... (Entrée pour envoyer)"
            rows={1} className="msg-input"
          />
          <button type="submit" className="send-btn" disabled={!input.trim()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
