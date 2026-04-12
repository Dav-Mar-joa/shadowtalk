import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get, post, encrypt, decrypt, formatTime } from '../utils/api';
import { getAvatarEmoji } from '../utils/avatars';
import { useAuth }         from '../context/AuthContext';
import { useSocket }       from '../context/SocketContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import OnlineDot           from '../components/layout/OnlineDot';
import './ChatRoom.css';

const REACTIONS = ['❤️','😂','👍','😮','😢','🔥'];

const API = (path, opts={}) => fetch('/api' + path, {
  headers: { 'Content-Type':'application/json', Authorization:'Bearer '+localStorage.getItem('st_token') },
  ...opts
}).then(r => r.json());

export default function ChatRoom() {
  const { id }       = useParams();
  const { user }     = useAuth();
  const { socket }   = useSocket();
  const { isOnline } = useOnlineStatus();
  const navigate     = useNavigate();

  const [chat,       setChat]       = useState(null);
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(true);
  const [typing,     setTyping]     = useState(null);
  const [menuMsg,    setMenuMsg]    = useState(null);
  const [reactMenu,  setReactMenu]  = useState(null);
  const [recording,  setRecording]  = useState(false);
  const [recSec,     setRecSec]     = useState(0);
  const [isContact,  setIsContact]  = useState(false);
  const [addingContact, setAddingContact] = useState(false);

  const bottomRef   = useRef(null);
  const typingTimer = useRef(null);
  const idRef       = useRef(id);
  const mediaRecRef = useRef(null);
  const audioChunks = useRef([]);
  const recTimer    = useRef(null);
  const fileRef     = useRef(null);

  useEffect(() => { idRef.current = id; }, [id]);

  useEffect(() => {
    setLoading(true); setMessages([]);
    Promise.all([
      get('/chats').then(cs => cs.find(c => c._id === id)),
      get(`/messages/${id}`),
      get('/contacts')
    ]).then(([c, msgs, contacts]) => {
      setChat(c);
      setMessages(msgs);
      // Vérifie si l'autre personne est déjà dans les contacts
      if (c && !c.isGroup) {
        const other = c.members?.find(m => m._id !== user._id);
        if (other) setIsContact(contacts.some(ct => ct._id === other._id));
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [id, user._id]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join_chat', id);
    API(`/messages/${id}/read`, { method: 'POST' }).catch(() => {});
    return () => socket.emit('leave_chat', id);
  }, [socket, id]);

  useEffect(() => {
    if (!socket) return;
    socket.on('new_message', msg => {
      if ((msg.chat?._id || msg.chat) !== idRef.current) return;
      setMessages(prev => {
        if (msg.tempId) {
          const ex = prev.find(m => m.tempId === msg.tempId);
          if (ex) return prev.map(m => m.tempId === msg.tempId ? msg : m);
        }
        if (prev.find(m => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      API(`/messages/${idRef.current}/read`, { method: 'POST' }).catch(() => {});
    });
    socket.on('message_deleted',  ({ messageId }) =>
      setMessages(prev => prev.filter(m => m._id !== messageId)));
    socket.on('message_reaction', ({ messageId, reactions }) =>
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m)));
    socket.on('messages_read', ({ userId: uid }) =>
      setMessages(prev => prev.map(m => ({
        ...m, readBy: m.readBy?.includes(uid) ? m.readBy : [...(m.readBy||[]), uid]
      }))));
    socket.on('chat_deleted', ({ chatId }) => { if (chatId === idRef.current) navigate('/chats'); });
    socket.on('chat_updated', u => { if (u._id === idRef.current) setChat(u); });
    socket.on('typing', ({ userId: uid, typing: t }) => {
      if (uid !== user._id) setTyping(t ? uid : null);
    });
    return () => {
      ['new_message','message_deleted','message_reaction','messages_read',
       'chat_deleted','chat_updated','typing'].forEach(e => socket.off(e));
    };
  }, [socket, navigate, user._id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    const h = () => { setMenuMsg(null); setReactMenu(null); };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  // Ajouter aux contacts
  async function addContact() {
    if (!chat || chat.isGroup) return;
    const other = chat.members?.find(m => m._id !== user._id);
    if (!other) return;
    setAddingContact(true);
    try {
      await post('/contacts', { contactId: other._id });
      setIsContact(true);
    } catch(e) { console.error(e); }
    finally { setAddingContact(false); }
  }

  function handleInput(e) {
    setInput(e.target.value);
    if (!socket) return;
    socket.emit('typing', { chatId: id, typing: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit('typing', { chatId: id, typing: false }), 1500);
  }

  function sendText(e) {
    e?.preventDefault();
    if (!input.trim() || !socket) return;
    const tempId = 'tmp_' + Date.now();
    const enc = encrypt(input.trim());
    setMessages(prev => [...prev, {
      _id: tempId, tempId, chat: id, type: 'text',
      sender: { _id: user._id, username: user.username, avatar: user.avatar },
      encryptedContent: enc, createdAt: new Date().toISOString(), readBy: [user._id]
    }]);
    socket.emit('send_message', { chatId: id, type: 'text', encryptedContent: enc, tempId });
    setInput('');
    socket.emit('typing', { chatId: id, typing: false });
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !socket) return;
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result;
      const tempId = 'tmp_img_' + Date.now();
      setMessages(prev => [...prev, {
        _id: tempId, tempId, chat: id, type: 'image',
        sender: { _id: user._id, username: user.username, avatar: user.avatar },
        mediaData: b64, encryptedContent: '',
        createdAt: new Date().toISOString(), readBy: [user._id]
      }]);
      socket.emit('send_message', { chatId: id, type: 'image', mediaData: encrypt(b64), encryptedContent: '', fileName: file.name, tempId });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecRef.current = mr; audioChunks.current = [];
      mr.ondataavailable = e => audioChunks.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const b64 = reader.result;
          const tempId = 'tmp_aud_' + Date.now();
          setMessages(prev => [...prev, {
            _id: tempId, tempId, chat: id, type: 'audio',
            sender: { _id: user._id, username: user.username, avatar: user.avatar },
            mediaData: b64, encryptedContent: '',
            createdAt: new Date().toISOString(), readBy: [user._id]
          }]);
          socket.emit('send_message', { chatId: id, type: 'audio', mediaData: encrypt(b64), encryptedContent: '', tempId });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setRecording(true); setRecSec(0);
      recTimer.current = setInterval(() => setRecSec(s => s + 1), 1000);
    } catch { alert('Micro non autorisé'); }
  }

  function stopRecording(send = true) {
    clearInterval(recTimer.current); setRecording(false); setRecSec(0);
    if (send) mediaRecRef.current?.stop();
    else { mediaRecRef.current?.stream?.getTracks().forEach(t => t.stop()); mediaRecRef.current = null; }
  }

  async function deleteMessage(msgId) {
    setMenuMsg(null);
    await API(`/messages/${msgId}`, { method: 'DELETE' });
  }

  async function react(msgId, emoji) {
    setReactMenu(null);
    await API(`/messages/${msgId}/react`, { method: 'POST', body: JSON.stringify({ emoji }) });
  }

  async function deleteChat() {
    if (!confirm('Supprimer ce chat et tous les messages ?')) return;
    await API(`/chats/${id}`, { method: 'DELETE' });
  }

  function isSelf(msg) { return (msg.sender?._id || msg.sender) === user._id; }
  function showAvatar(msgs, i) {
    if (isSelf(msgs[i])) return false;
    return i === 0 || isSelf(msgs[i-1]) ||
      (msgs[i].sender?._id||msgs[i].sender) !== (msgs[i-1].sender?._id||msgs[i-1].sender);
  }
  function isRead(msg) { return (msg.readBy||[]).some(r => (r._id||r) !== user._id); }

  const other      = chat?.members?.find(m => m._id !== user._id);
  const chatName   = chat ? (chat.isGroup ? chat.name : other?.username || '?') : '...';
  const chatAvatar = chat ? (chat.isGroup ? '👥' : getAvatarEmoji(other?.avatar)) : '💬';
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div style={{position:'relative',flexShrink:0}}>
          <div className="avatar">{chatAvatar}</div>
          {!chat?.isGroup && other && (
            <span style={{position:'absolute',bottom:0,right:0}}>
              <OnlineDot online={isOnline(other._id)} size="sm"/>
            </span>
          )}
        </div>
        <div className="chatroom-info">
          <span className="chatroom-name">{chatName}</span>
          {chat?.isGroup
            ? <span className="chatroom-sub">{chat.members?.length} membres</span>
            : <span className={`chatroom-sub ${other && isOnline(other._id) ? 'sub-online' : ''}`}>
                {other && isOnline(other._id) ? '● en ligne' : '○ hors ligne'}
              </span>
          }
        </div>

        {/* ✅ Bouton ajouter aux contacts (chat 1-1 seulement) */}
        {!chat?.isGroup && other && (
          <button
            className={`btn-icon contact-toggle ${isContact ? 'is-contact' : ''}`}
            onClick={addContact}
            disabled={isContact || addingContact}
            title={isContact ? 'Déjà dans tes contacts' : 'Ajouter aux contacts'}
          >
            {addingContact
              ? <span className="spinner" style={{width:14,height:14}}/>
              : isContact
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            }
          </button>
        )}

        <span className="tag tag-accent" style={{fontSize:10}}>🔒 E2E</span>
        <button className="btn-icon" onClick={deleteChat} title="Supprimer le chat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="chatroom-messages" onClick={() => { setMenuMsg(null); setReactMenu(null); }}>
        {messages.length === 0 && (
          <div className="messages-empty">
            <span style={{fontSize:36}}>🔒</span>
            <p>Chiffrement de bout en bout</p>
            <span>Envoie le premier message</span>
          </div>
        )}

        {messages.map((msg, i) => {
          const self      = isSelf(msg);
          const showAv    = showAvatar(messages, i);
          const content   = msg.type === 'text' ? decrypt(msg.encryptedContent) : '';
          const media     = (msg.type === 'image' || msg.type === 'audio')
            ? (msg.mediaData?.startsWith('data:') ? msg.mediaData : decrypt(msg.mediaData)) : '';
          const isTemp    = msg._id?.startsWith('tmp_');
          const menuOpen  = menuMsg === msg._id;
          const reactOpen = reactMenu === msg._id;
          const reactions = msg.reactions
            ? (msg.reactions instanceof Map ? Object.fromEntries(msg.reactions) : msg.reactions)
            : {};
          const hasReact  = Object.values(reactions).some(u => u?.length > 0);

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

                  {/* Bulle */}
                  <div
                    className={`bubble ${self?'bubble-self':'bubble-other'} ${isTemp?'bubble-pending':''}`}
                    onContextMenu={e => { e.preventDefault(); if (!isTemp) setMenuMsg(msg._id); }}
                    onClick={e => { e.stopPropagation(); if (!isTemp) setMenuMsg(menuOpen ? null : msg._id); }}
                  >
                    {msg.type === 'text' && <span>{content}</span>}
                    {msg.type === 'image' && media && (
                      <img src={media} alt="img" className="msg-image"
                        onClick={e => { e.stopPropagation(); window.open(media); }}/>
                    )}
                    {msg.type === 'audio' && media && (
                      <div className="msg-audio">
                        <span style={{fontSize:18,flexShrink:0}}>🎤</span>
                        <audio controls src={media} style={{height:30,flex:1,minWidth:0}}/>
                      </div>
                    )}
                  </div>

                  {/* ✅ Réactions affichées sous la bulle */}
                  {hasReact && (
                    <div className={`msg-reactions ${self?'reactions-self':'reactions-other'}`}>
                      {Object.entries(reactions).map(([emoji, users]) =>
                        users?.length > 0 && (
                          <span key={emoji}
                            className={`reaction-chip ${(users||[]).includes(user._id)?'mine':''}`}
                            onClick={e => { e.stopPropagation(); react(msg._id, emoji); }}>
                            {emoji} {users.length}
                          </span>
                        )
                      )}
                    </div>
                  )}

                  {/* Menu contextuel */}
                  {menuOpen && (
                    <div className={`msg-menu ${self?'msg-menu-self':'msg-menu-other'}`}
                      onClick={e => e.stopPropagation()}>
                      <button className="msg-menu-btn"
                        onClick={e => { e.stopPropagation(); setReactMenu(msg._id); setMenuMsg(null); }}>
                        😊 Réagir
                      </button>
                      {self && (
                        <button className="msg-menu-btn delete" onClick={() => deleteMessage(msg._id)}>
                          🗑️ Supprimer
                        </button>
                      )}
                    </div>
                  )}

                  {/* ✅ Picker réactions — fonctionne sur texte, image ET audio */}
                  {reactOpen && (
                    <div className={`reaction-picker ${self?'picker-self':'picker-other'}`}
                      onClick={e => e.stopPropagation()}>
                      {REACTIONS.map(e => {
                        const users = reactions[e] || [];
                        return (
                          <button key={e} className={`reaction-pick-btn ${users.includes(user._id)?'active':''}`}
                            onClick={() => react(msg._id, e)}>
                            {e}
                            {users.length > 0 && <span className="rpick-count">{users.length}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Meta */}
                <div className="msg-meta">
                  <span className="msg-time">{formatTime(msg.createdAt)}</span>
                  {self && !isTemp && (
                    <span className={`msg-read ${isRead(msg)?'read':''}`}>
                      {isRead(msg) ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {typingUser && (
          <div className="msg-row other fade-in">
            <div className="avatar avatar-sm">{getAvatarEmoji(typingUser.avatar)}</div>
            <div className="msg-block">
              <div className="bubble bubble-other typing-bubble"><span/><span/><span/></div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Barre enregistrement */}
      {recording && (
        <div className="recording-bar">
          <span className="rec-dot"/>
          <span className="rec-time">
            {String(Math.floor(recSec/60)).padStart(2,'0')}:{String(recSec%60).padStart(2,'0')}
          </span>
          <span style={{flex:1,color:'var(--text-3)',fontSize:12}}>En cours...</span>
          <button className="btn-ghost" style={{padding:'6px 12px',fontSize:12,color:'var(--danger)',borderColor:'rgba(255,68,102,.3)'}}
            onClick={() => stopRecording(false)}>✕ Annuler</button>
          <button className="btn btn-primary" style={{padding:'6px 14px',fontSize:12,width:'auto'}}
            onClick={() => stopRecording(true)}>■ Envoyer</button>
        </div>
      )}

      {/* Input */}
      {!recording && (
        <form className="chatroom-input-area" onSubmit={sendText}>
          <input ref={fileRef} type="file" accept="image/*,image/gif" style={{display:'none'}} onChange={handleImageUpload}/>
          <div className="input-wrap">
            <button type="button" className="btn-icon input-action" onClick={() => fileRef.current?.click()} title="Image">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </button>
            <textarea value={input} onChange={handleInput}
              onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendText();} }}
              placeholder="Message chiffré..." rows={1} className="msg-input"/>
            <button type="button" className="btn-icon input-action" onClick={startRecording} title="Vocal">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
              </svg>
            </button>
            <button type="submit" className="send-btn" disabled={!input.trim()}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
