import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, decrypt, timeAgo } from '../utils/api';
import { getAvatarEmoji } from '../utils/avatars';
import { useAuth }        from '../context/AuthContext';
import { useSocket }      from '../context/SocketContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import OnlineDot          from '../components/layout/OnlineDot';
import './ChatsPage.css';
import { getAvatarDisplay } from '../utils/avatars';

export default function ChatsPage() {
  const { user }   = useAuth();
  const { socket } = useSocket();
  const { isOnline } = useOnlineStatus();
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
  const debounce = useRef(null);

  useEffect(() => {
    get('/chats').then(setChats).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  // Tous les events socket
  useEffect(() => {
    if (!socket) return;
    socket.on('new_message', msg => {
      setChats(prev => prev.map(c =>
        c._id === (msg.chat?._id||msg.chat) ? {...c, lastMessage:msg, updatedAt:new Date()} : c
      ).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)));
    });
    socket.on('new_chat',    chat    => setChats(prev => prev.find(c=>c._id===chat._id) ? prev : [chat,...prev]));
    socket.on('chat_deleted',({chatId}) => setChats(prev => prev.filter(c=>c._id!==chatId)));
    socket.on('chat_updated', updated  => setChats(prev => prev.map(c=>c._id===updated._id?updated:c)));
    return () => { socket.off('new_message'); socket.off('new_chat'); socket.off('chat_deleted'); socket.off('chat_updated'); };
  }, [socket]);

  // Recherche
  useEffect(() => {
    clearTimeout(debounce.current);
    if (!searchQ.trim() || searchQ.length < 2) { setSearchRes([]); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try { setSearchRes(await get(`/users/search?q=${encodeURIComponent(searchQ)}`)); }
      catch { setSearchRes([]); }
      finally { setSearching(false); }
    }, 300);
  }, [searchQ]);

  async function openDirect(targetUser) {
    try {
      // ✅ Le backend retourne le chat existant OU en crée un nouveau
      const chat = await post('/chats/direct', { targetUserId: targetUser._id });
      setSearchQ(''); setSearchRes([]);
      // Met à jour la liste si nouveau
      setChats(prev => prev.find(c=>c._id===chat._id) ? prev : [chat,...prev]);
      navigate(`/chat/${chat._id}`);
    } catch(e) { setError(e.message); }
  }

  function toggleGroupPick(u) {
    setGroupPicked(prev =>
      prev.find(p=>p._id===u._id) ? prev.filter(p=>p._id!==u._id) : [...prev,u]
    );
  }

  async function createGroup() {
    if (!groupName.trim() || groupPicked.length < 1) return;
    try {
      const chat = await post('/chats/group', { name:groupName, memberIds:groupPicked.map(u=>u._id) });
      setGroupMode(false); setGroupName(''); setGroupPicked([]);
      setChats(prev => [chat,...prev]);
      navigate(`/chat/${chat._id}`);
    } catch(e) { setError(e.message); }
  }

  function getChatName(chat) {
    if (chat.isGroup) return chat.name;
    return chat.members?.find(m=>m._id!==user._id)?.username || '?';
  }

  function getChatOtherUser(chat) {
    if (chat.isGroup) return null;
    return chat.members?.find(m=>m._id!==user._id);
  }

  function getChatAvatar(chat) {
    if (chat.isGroup) return '👥';
    return getAvatarEmoji(getChatOtherUser(chat)?.avatar);
  }

  function getLastMsg(chat) {
    const msg = chat.lastMessage;
    if (!msg) return 'Pas encore de message';
    const text = decrypt(msg.encryptedContent);
    const who  = msg.sender?.username === user.username ? 'Toi' : msg.sender?.username;
    return `${who}: ${text.length > 35 ? text.slice(0,35)+'…' : text}`;
  }

  return (
    <div className="chats-page">
      <div className="chats-header">
        <div className="chats-title">
          <h2>Mes Chats</h2>
          <span className="tag tag-accent">{chats.length}</span>
        </div>
        <button className="btn-icon" onClick={() => { setGroupMode(m=>!m); setSearchQ(''); setSearchRes([]); }} title="Nouveau groupe">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </button>
      </div>

      <div className="chats-search">
        <div className="search-wrap">
          <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)}
            placeholder={groupMode ? 'Chercher un membre...' : 'Nouveau chat — cherche un username...'}/>
          {searchQ && <button className="btn-icon" onClick={()=>{setSearchQ('');setSearchRes([]);}} style={{padding:4}}>✕</button>}
        </div>
      </div>

      {groupMode && (
        <div className="group-creator fade-in">
          <input value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="Nom du groupe..."/>
          {groupPicked.length > 0 && (
            <div className="group-picked">
              {groupPicked.map(u=>(
                <span key={u._id} className="picked-chip" onClick={()=>toggleGroupPick(u)}>
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

      {(searchRes.length > 0 || searching) && (
        <div className="search-results fade-in">
          <div className="search-results-label">UTILISATEURS</div>
          {searching && <div style={{padding:'8px 16px'}}><span className="spinner" style={{width:14,height:14}}/></div>}
          {searchRes.map(u => (
            <div key={u._id} className="search-user-row" onClick={()=>groupMode?toggleGroupPick(u):openDirect(u)}>
              <div style={{position:'relative',flexShrink:0}}>
                <div className="avatar">{getAvatarEmoji(u.avatar)}</div>
                <OnlineDot online={isOnline(u._id)} size="sm" style={{position:'absolute',bottom:0,right:0}}/>
              </div>
              <span className="su-name">{u.username}</span>
              <span className="su-status">{isOnline(u._id) ? '● en ligne' : '○ hors ligne'}</span>
              {groupMode
                ? <span className="su-action">{groupPicked.find(p=>p._id===u._id)?'✓':'+'}</span>
                : <span className="su-action">→</span>
              }
            </div>
          ))}
        </div>
      )}

      {error && <div className="banner-err" style={{margin:'0 16px'}}>{error}</div>}

      <div className="chats-list">
        {loading && <div className="chats-empty"><span className="spinner" style={{width:24,height:24}}/></div>}
        {!loading && chats.length === 0 && !searchQ && (
          <div className="chats-empty">
            <span style={{fontSize:40}}>💬</span>
            <p>Aucun chat pour l'instant</p>
            <span style={{color:'var(--text-3)',fontSize:12}}>Recherche un username pour commencer</span>
          </div>
        )}
        {chats.map(chat => {
          const other   = getChatOtherUser(chat);
          const online  = other ? isOnline(other._id) : false;
          return (
            <div key={chat._id} className="chat-row" onClick={()=>navigate(`/chat/${chat._id}`)}>
              <div style={{position:'relative',flexShrink:0}}>
                <div className="avatar avatar-lg">{getChatAvatar(chat)}</div>
                {!chat.isGroup && (
                  <span style={{position:'absolute',bottom:1,right:1}}>
                    <OnlineDot online={online} size="sm"/>
                  </span>
                )}
              </div>
              <div className="chat-row-info">
                <div className="chat-row-top">
                  <span className="chat-row-name">{getChatName(chat)}</span>
                  <span className="chat-row-time">{timeAgo(chat.updatedAt)}</span>
                </div>
                <div className="chat-row-last">{getLastMsg(chat)}</div>
              </div>
              {chat.isGroup && <span className="tag tag-cyan" style={{fontSize:9}}>GROUPE</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
