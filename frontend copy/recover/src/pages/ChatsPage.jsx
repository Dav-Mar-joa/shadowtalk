import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../utils/api';
import { decrypt, timeAgo } from '../utils/api';
import { getAvatarEmoji } from '../utils/avatars';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './ChatsPage.css';

export default function ChatsPage() {
  const { user }   = useAuth();
  const { socket } = useSocket();
  const navigate   = useNavigate();

  const [chats,       setChats]       = useState([]);
  const [searchQ,     setSearchQ]     = useState('');
  const [searchRes,   setSearchRes]   = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [groupMode,   setGroupMode]   = useState(false);
  const [groupName,   setGroupName]   = useState('');
  const [groupPicked, setGroupPicked] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const debounce      = useRef(null);

  // Charger les chats
  useEffect(() => {
    get('/chats').then(setChats).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  // ✅ Tous les events socket temps réel
  useEffect(() => {
    if (!socket) return;

    // Mise à jour lastMessage
    socket.on('new_message', msg => {
      setChats(prev => prev.map(c =>
        c._id === (msg.chat?._id||msg.chat) ? { ...c, lastMessage: msg, updatedAt: new Date() } : c
      ).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
    });

    // Nouveau chat créé (ex: quelqu'un t'ajoute)
    socket.on('new_chat', chat => {
      setChats(prev => prev.find(c => c._id === chat._id) ? prev : [chat, ...prev]);
    });

    // Chat supprimé
    socket.on('chat_deleted', ({ chatId }) => {
      setChats(prev => prev.filter(c => c._id !== chatId));
    });

    // Groupe mis à jour
    socket.on('chat_updated', updated => {
      setChats(prev => prev.map(c => c._id === updated._id ? updated : c));
    });

    return () => {
      socket.off('new_message');
      socket.off('new_chat');
      socket.off('chat_deleted');
      socket.off('chat_updated');
    };
  }, [socket]);

  // Recherche utilisateurs
  useEffect(() => {
    clearTimeout(debounce.current);
    if (!searchQ.trim() || searchQ.length < 2) { setSearchRes([]); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await get(`/users/search?q=${encodeURIComponent(searchQ)}`);
        setSearchRes(res);
      } catch { setSearchRes([]); }
      finally { setSearching(false); }
    }, 300);
  }, [searchQ]);

  async function openDirect(targetUser) {
    try {
      const chat = await post('/chats/direct', { targetUserId: targetUser._id });
      setSearchQ(''); setSearchRes([]);
      navigate(`/chat/${chat._id}`);
    } catch(e) { setError(e.message); }
  }

  function toggleGroupPick(u) {
    setGroupPicked(prev =>
      prev.find(p => p._id === u._id) ? prev.filter(p => p._id !== u._id) : [...prev, u]
    );
  }

  async function createGroup() {
    if (!groupName.trim() || groupPicked.length < 1) return;
    try {
      const chat = await post('/chats/group', { name: groupName, memberIds: groupPicked.map(u => u._id) });
      setGroupMode(false); setGroupName(''); setGroupPicked([]);
      setChats(prev => [chat, ...prev]);
      navigate(`/chat/${chat._id}`);
    } catch(e) { setError(e.message); }
  }

  function getChatName(chat) {
    if (chat.isGroup) return chat.name;
    const other = chat.members?.find(m => m._id !== user._id);
    return other?.username || '?';
  }

  function getChatAvatar(chat) {
    if (chat.isGroup) return '👥';
    const other = chat.members?.find(m => m._id !== user._id);
    return getAvatarEmoji(other?.avatar);
  }

  function getLastMsg(chat) {
    const msg = chat.lastMessage;
    if (!msg) return 'Pas encore de message';
    const text = decrypt(msg.encryptedContent);
    const who  = msg.sender?.username === user.username ? 'Toi' : msg.sender?.username;
    return `${who}: ${text.length > 32 ? text.slice(0,32)+'…' : text}`;
  }

  return (
    <div className="chats-page">
      {/* Header */}
      <div className="chats-header">
        <div className="chats-title">
          <h2>Mes Chats</h2>
          <span className="tag tag-accent">{chats.length}</span>
        </div>
        <div className="chats-actions">
          <button className="btn-icon" onClick={() => { setGroupMode(m=>!m); setSearchQ(''); setSearchRes([]); }} title="Nouveau groupe">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="chats-search">
        <div className="search-wrap">
          <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder={groupMode ? 'Chercher un membre à ajouter...' : 'Chercher un username...'}
          />
          {searchQ && (
            <button className="btn-icon" onClick={() => { setSearchQ(''); setSearchRes([]); }} style={{padding:4}}>✕</button>
          )}
        </div>
      </div>

      {/* Group creator */}
      {groupMode && (
        <div className="group-creator fade-in">
          <input value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="Nom du groupe..." style={{marginBottom:8}}/>
          {groupPicked.length > 0 && (
            <div className="group-picked">
              {groupPicked.map(u => (
                <span key={u._id} className="picked-chip" onClick={() => toggleGroupPick(u)}>
                  {getAvatarEmoji(u.avatar)} {u.username} ✕
                </span>
              ))}
            </div>
          )}
          <button className="btn btn-primary" onClick={createGroup} disabled={!groupName.trim()||groupPicked.length<1}>
            Créer le groupe ({groupPicked.length} membre{groupPicked.length>1?'s':''})
          </button>
        </div>
      )}

      {/* Search results */}
      {searchRes.length > 0 && (
        <div className="search-results fade-in">
          <div className="search-results-label">UTILISATEURS TROUVÉS</div>
          {searching && <div style={{padding:'8px 16px'}}><span className="spinner" style={{width:14,height:14}}/></div>}
          {searchRes.map(u => (
            <div key={u._id} className="search-user-row" onClick={() => groupMode ? toggleGroupPick(u) : openDirect(u)}>
              <div className="avatar">{getAvatarEmoji(u.avatar)}</div>
              <span className="su-name">{u.username}</span>
              {groupMode
                ? <span className="su-action">{groupPicked.find(p=>p._id===u._id) ? '✓ Ajouté' : '+ Ajouter'}</span>
                : <span className="su-action">Message →</span>
              }
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && <div className="banner-err" style={{margin:'0 16px'}}>{error}</div>}

      {/* Chat list */}
      <div className="chats-list">
        {loading && (
          <div className="chats-empty">
            <span className="spinner" style={{width:24,height:24}}/>
          </div>
        )}
        {!loading && chats.length === 0 && !searchQ && (
          <div className="chats-empty">
            <span style={{fontSize:40}}>💬</span>
            <p>Aucun chat pour l'instant</p>
            <span style={{color:'var(--text-3)',fontSize:12}}>Recherche un username pour commencer</span>
          </div>
        )}
        {chats.map(chat => (
          <div key={chat._id} className="chat-row" onClick={() => navigate(`/chat/${chat._id}`)}>
            <div className="avatar avatar-lg">{getChatAvatar(chat)}</div>
            <div className="chat-row-info">
              <div className="chat-row-top">
                <span className="chat-row-name">{getChatName(chat)}</span>
                <span className="chat-row-time">{timeAgo(chat.updatedAt)}</span>
              </div>
              <div className="chat-row-last">{getLastMsg(chat)}</div>
            </div>
            {chat.isGroup && <span className="tag tag-cyan" style={{fontSize:9}}>GROUPE</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
// Note: les events new_chat et chat_deleted sont gérés dans useEffect socket
