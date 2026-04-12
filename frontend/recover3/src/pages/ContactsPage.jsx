import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../utils/api';
import { getAvatarEmoji } from '../utils/avatars';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import OnlineDot from '../components/layout/OnlineDot';
import './ContactsPage.css';
import StlkHeader from '../components/StlkHeader';

const API = (path, opts={}) => fetch('/api' + path, {
  headers: { 'Content-Type':'application/json', Authorization:'Bearer '+localStorage.getItem('st_token') },
  ...opts
}).then(r => r.json());

export default function ContactsPage() {
  const navigate = useNavigate();
  const { isOnline } = useOnlineStatus();

  const [contacts,  setContacts]  = useState([]);
  const [searchQ,   setSearchQ]   = useState('');
  const [searchRes, setSearchRes] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const debounce = { current: null };

  useEffect(() => {
    get('/contacts').then(setContacts).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  // Recherche
  useEffect(() => {
    clearTimeout(debounce.current);
    if (!searchQ.trim() || searchQ.length < 2) { setSearchRes([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await get(`/users/search?q=${encodeURIComponent(searchQ)}`);
        setSearchRes(res);
      } catch { setSearchRes([]); }
    }, 300);
  }, [searchQ]);

  async function addContact(user) {
    try {
      await post('/contacts', { contactId: user._id });
      setContacts(prev => prev.find(c => c._id === user._id) ? prev : [...prev, user]);
      setSearchQ(''); setSearchRes([]);
    } catch(e) { setError(e.message); }
  }

  async function removeContact(contactId) {
    try {
      await API(`/contacts/${contactId}`, { method: 'DELETE' });
      setContacts(prev => prev.filter(c => c._id !== contactId));
    } catch(e) { setError(e.message); }
  }

  async function openChat(contactId) {
    try {
      const chat = await post('/chats/direct', { targetUserId: contactId });
      navigate(`/chat/${chat._id}`);
    } catch(e) { setError(e.message); }
  }

  const onlineContacts  = contacts.filter(c => isOnline(c._id));
  const offlineContacts = contacts.filter(c => !isOnline(c._id));

  return (
    <div className="contacts-page">
      {/* <StlkHeader />   */}
      {/* Header */}
      <div className="contacts-header">
        <h2>Contacts</h2>
        <span className="tag tag-cyan">{onlineContacts.length} en ligne</span>
      </div>

      {/* Search */}
      <div className="contacts-search">
        <div className="search-wrap">
          <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Ajouter un contact par username..."/>
          {searchQ && (
            <button className="btn-icon" onClick={() => { setSearchQ(''); setSearchRes([]); }} style={{padding:4}}>✕</button>
          )}
        </div>
      </div>

      {/* Search results */}
      {searchRes.length > 0 && (
        <div className="search-results fade-in">
          <div className="section-label">UTILISATEURS TROUVÉS</div>
          {searchRes.map(u => {
            const alreadyAdded = contacts.find(c => c._id === u._id);
            return (
              <div key={u._id} className="contact-row">
                <div className="contact-avatar-wrap">
                  <div className="avatar">{getAvatarEmoji(u.avatar)}</div>
                  <OnlineDot online={isOnline(u._id)} size="sm" />
                </div>
                <div className="contact-info">
                  <span className="contact-name">{u.username}</span>
                  <span className="contact-status">{isOnline(u._id) ? '● en ligne' : '○ hors ligne'}</span>
                </div>
                <button
                  className={`btn btn-ghost contact-action ${alreadyAdded ? 'already' : ''}`}
                  onClick={() => alreadyAdded ? openChat(u._id) : addContact(u)}
                  style={{width:'auto', padding:'6px 14px', fontSize:11}}
                >
                  {alreadyAdded ? '💬 Chat' : '+ Ajouter'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {error && <div className="banner-err" style={{margin:'0 16px 8px'}}>{error}</div>}

      {/* Contacts en ligne */}
      {!loading && onlineContacts.length > 0 && (
        <div className="contacts-section">
          <div className="section-label">EN LIGNE — {onlineContacts.length}</div>
          {onlineContacts.map(c => (
            <ContactRow key={c._id} contact={c} online={true}
              onChat={() => openChat(c._id)}
              onRemove={() => removeContact(c._id)} />
          ))}
        </div>
      )}

      {/* Contacts hors ligne */}
      {!loading && offlineContacts.length > 0 && (
        <div className="contacts-section">
          <div className="section-label">HORS LIGNE — {offlineContacts.length}</div>
          {offlineContacts.map(c => (
            <ContactRow key={c._id} contact={c} online={false}
              onChat={() => openChat(c._id)}
              onRemove={() => removeContact(c._id)} />
          ))}
        </div>
      )}

      {!loading && contacts.length === 0 && !searchQ && (
        <div className="contacts-empty">
          <span style={{fontSize:40}}>👥</span>
          <p>Aucun contact</p>
          <span>Recherche des usernames pour ajouter des contacts</span>
        </div>
      )}

      {loading && (
        <div className="contacts-empty">
          <span className="spinner" style={{width:24,height:24}}/>
        </div>
      )}
    </div>
  );
}

function ContactRow({ contact, online, onChat, onRemove }) {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div className="contact-row" onClick={() => setShowMenu(false)}>
      <div className="contact-avatar-wrap">
        <div className="avatar">{getAvatarEmoji(contact.avatar)}</div>
        <OnlineDot online={online} size="sm" />
      </div>
      <div className="contact-info">
        <span className="contact-name">{contact.username}</span>
        <span className={`contact-status ${online ? 'online' : ''}`}>
          {online ? '● en ligne' : '○ hors ligne'}
        </span>
      </div>
      <div className="contact-actions">
        <button className="btn-icon" onClick={e => { e.stopPropagation(); onChat(); }} title="Message">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <button className="btn-icon contact-remove" onClick={e => { e.stopPropagation(); onRemove(); }} title="Retirer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
