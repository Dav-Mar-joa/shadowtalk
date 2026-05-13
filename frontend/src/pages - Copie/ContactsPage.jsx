import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post, apiDirect } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import OnlineDot from '../components/layout/OnlineDot';
import UserAvatar from '../components/layout/UserAvatar';
import './ContactsPage.css';

export default function ContactsPage() {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const { isOnline } = useOnlineStatus();
  const { socket, contactRequests, setContactRequests } = useSocket();

  const [contacts,  setContacts]  = useState([]);
  const [requests,  setRequests]  = useState([]); // demandes reçues
  const [searchQ,   setSearchQ]   = useState('');
  const [searchRes, setSearchRes] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [pendingSent, setPendingSent] = useState(new Set()); // demandes envoyées
  const debounce = useRef(null);

  useEffect(() => {
    Promise.all([
      get('/contacts'),
      get('/contacts/requests'),
    ]).then(([c, r]) => {
      setContacts(c);
      setRequests(r);
    }).catch(e => setError(e.message))
    .finally(() => setLoading(false));
  }, []);

  // ✅ Contact supprimé par l'autre — mise à jour en temps réel
  useEffect(() => {
    if (!socket) return;
    const handler = ({ userId }) => {
      setContacts(prev => prev.filter(c => c._id !== userId));
    };
    socket.on('contact_removed', handler);
    return () => socket.off('contact_removed', handler);
  }, [socket]);

  // Demandes reçues en temps réel via socket
  useEffect(() => {
    if (contactRequests.length > 0) {
      setRequests(prev => {
        const newOnes = contactRequests.filter(r =>
          !prev.find(p => p.user._id === r.user._id)
        );
        return [...newOnes, ...prev];
      });
    }
  }, [contactRequests]);

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

  async function sendRequest(u) {
    try {
      const res = await post('/contacts', { contactId: u._id });
      if (res.already) {
        setError(res.status === 'accepted' ? 'Déjà dans tes contacts' : 'Demande déjà envoyée');
        return;
      }
      setPendingSent(prev => new Set([...prev, u._id]));
      setSearchQ(''); setSearchRes([]);
    } catch(e) { setError(e.message); }
  }

  async function acceptRequest(ownerId) {
    try {
      const res = await post(`/contacts/accept/${ownerId}`);
      setRequests(prev => prev.filter(r => r.user._id !== ownerId));
      setContactRequests(prev => prev.filter(r => r.user._id !== ownerId));
      if (res.user) setContacts(prev => [...prev, res.user]);
    } catch(e) { setError(e.message); }
  }

  async function declineRequest(ownerId) {
    try {
      await post(`/contacts/decline/${ownerId}`);
      setRequests(prev => prev.filter(r => r.user._id !== ownerId));
      setContactRequests(prev => prev.filter(r => r.user._id !== ownerId));
    } catch(e) { setError(e.message); }
  }

  async function removeContact(contactId) {
    try {
      await apiDirect(`/contacts/${contactId}`, { method: 'DELETE' });
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
      <div className="contacts-header">
        <h2>Contacts</h2>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {requests.length > 0 && (
            <span className="tag tag-accent">{requests.length} demande{requests.length > 1 ? 's' : ''}</span>
          )}
          <span className="tag tag-cyan">{onlineContacts.length} en ligne</span>
        </div>
      </div>

      {/* Recherche */}
      <div className="contacts-search">
        <div className="search-wrap">
          <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={searchQ} onChange={e => { setSearchQ(e.target.value); setError(''); }}
            placeholder="Rechercher un username..."/>
          {searchQ && <button className="btn-icon" onClick={() => { setSearchQ(''); setSearchRes([]); }} style={{padding:4}}>✕</button>}
        </div>
      </div>

      {/* Résultats de recherche */}
      {searchRes.length > 0 && (
        <div className="search-results fade-in">
          <div className="section-label">UTILISATEURS TROUVÉS</div>
          {searchRes.filter(u => u._id !== user._id).map(u => {
            const isContact = contacts.find(c => c._id === u._id);
            const isPending = pendingSent.has(u._id);
            return (
              <div key={u._id} className="contact-row">
                <div className="contact-avatar-wrap">
                  <UserAvatar user={u} size="md"/>
                  <OnlineDot online={isOnline(u._id)} size="sm"/>
                </div>
                <div className="contact-info">
                  <span className="contact-name">@{u.username}</span>
                  <span className="contact-status">{isOnline(u._id) ? '● en ligne' : '○ hors ligne'}</span>
                </div>
                <button
                  className="btn btn-ghost contact-action"
                  onClick={() => isContact ? openChat(u._id) : sendRequest(u)}
                  disabled={isPending}
                  style={{width:'auto', padding:'6px 14px', fontSize:11}}
                >
                  {isContact ? '💬 Chat' : isPending ? '⏳ Envoyée' : '+ Demande'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {error && <div className="banner-err" style={{margin:'0 16px 8px'}}>{error}</div>}

      {/* ✅ Demandes reçues */}
      {requests.length > 0 && (
        <div className="contacts-section">
          <div className="section-label">DEMANDES REÇUES — {requests.length}</div>
          {requests.map(r => (
            <div key={r.user._id} className="contact-row request-row">
              <div className="contact-avatar-wrap">
                <UserAvatar user={r.user} size="md"/>
              </div>
              <div className="contact-info">
                <span className="contact-name">@{r.user.username}</span>
                <span className="contact-status">veut t'ajouter</span>
              </div>
              <div className="request-actions">
                <button className="btn-accept" onClick={() => acceptRequest(r.user._id)}>✓</button>
                <button className="btn-decline" onClick={() => declineRequest(r.user._id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contacts en ligne */}
      {!loading && onlineContacts.length > 0 && (
        <div className="contacts-section">
          <div className="section-label">EN LIGNE — {onlineContacts.length}</div>
          {onlineContacts.map(c => (
            <ContactRow key={c._id} contact={c} online={true}
              onChat={() => openChat(c._id)}
              onRemove={() => removeContact(c._id)}/>
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
              onRemove={() => removeContact(c._id)}/>
          ))}
        </div>
      )}

      {!loading && contacts.length === 0 && requests.length === 0 && !searchQ && (
        <div className="contacts-empty">
          <span style={{fontSize:40}}>👥</span>
          <p>Aucun contact</p>
          <span>Recherche un username pour envoyer une demande</span>
        </div>
      )}

      {loading && <div className="contacts-empty"><span className="spinner" style={{width:24,height:24}}/></div>}
    </div>
  );
}

function ContactRow({ contact, online, onChat, onRemove }) {
  return (
    <div className="contact-row">
      <div className="contact-avatar-wrap">
        <UserAvatar user={contact} size="md"/>
        <OnlineDot online={online} size="sm"/>
      </div>
      <div className="contact-info">
        <span className="contact-name">@{contact.username}</span>
        <span className={`contact-status ${online ? 'online' : ''}`}>
          {online ? '● en ligne' : '○ hors ligne'}
        </span>
      </div>
      <div className="contact-actions">
        <button className="btn-icon" onClick={onChat} title="Message">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <button className="btn-icon contact-remove" onClick={onRemove} title="Retirer">
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
