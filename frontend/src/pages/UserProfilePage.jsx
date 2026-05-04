import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get, post } from '../utils/api';
import { useAuth }   from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import UserAvatar from '../components/layout/UserAvatar';
import OnlineDot  from '../components/layout/OnlineDot';
import './UserProfilePage.css';

export default function UserProfilePage() {
  const { id }          = useParams();
  const navigate        = useNavigate();
  const { user: me }    = useAuth();
  const { resolveUser } = useSocket();
  const { isOnline }    = useOnlineStatus();

  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [adding,   setAdding]   = useState(false);
  const [addedIds, setAddedIds] = useState(new Set());

  useEffect(() => {
    if (!id) return;
    if (id === me?._id) { navigate('/profile'); return; }
    setLoading(true);
    get(`/users/${id}/profile`)
      .then(setProfile)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAddContact() {
    setAdding(true); setError('');
    try {
      await post('/contacts', { contactId: id });
      setProfile(prev => ({ ...prev, relation: 'pending' }));
    } catch(e) { setError(e.message); }
    finally { setAdding(false); }
  }

  async function addFriendOfFriend(contactId) {
    try {
      await post('/contacts', { contactId });
      setAddedIds(prev => new Set([...prev, contactId]));
    } catch(e) { setError(e.message); }
  }

  async function openChat() {
    try {
      const chat = await post('/chats/direct', { targetUserId: id });
      navigate(`/chat/${chat._id}`);
    } catch(e) { setError(e.message); }
  }

  if (loading) return (
    <div className="up-loading">
      <span className="spinner" style={{width:28,height:28}}/>
    </div>
  );

  if (error || !profile) return (
    <div className="up-loading">
      <span style={{fontSize:40}}>💀</span>
      <p style={{color:'var(--text-3)',marginTop:12}}>Profil introuvable</p>
      <button className="btn btn-ghost" onClick={() => navigate(-1)}
        style={{width:'auto',padding:'8px 20px',marginTop:12}}>← Retour</button>
    </div>
  );

  const resolved  = resolveUser(profile);
  const online    = isOnline(id);
  const isFriend  = profile.relation === 'accepted';
  const isPending = profile.relation === 'pending';

  return (
    <div className="user-profile-page">

      {/* ── Header ── */}
      <div className="up-header">
        <button className="btn-icon" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <h2>@{resolved.username}</h2>
        <div style={{width:32}}/>
      </div>

      <div className="up-inner">

        {/* ── Hero ── */}
        <div className="up-hero">
          <div className="up-avatar-wrap">
            <UserAvatar user={resolved} size="lg"/>
            <div className="up-online-dot">
              <OnlineDot online={online} size="md"/>
            </div>
          </div>
          <div className="up-name">@{resolved.username}</div>
          <div className={`up-status ${online ? 'online' : ''}`}>
            {online ? '● en ligne' : '○ hors ligne'}
          </div>

          {/* Bio — visible seulement si ami */}
          {isFriend && resolved.bio && (
            <p className="up-bio">{resolved.bio}</p>
          )}

          {/* Pas encore ami — message */}
          {!isFriend && !isPending && (
            <p className="up-locked">🔒 Ajoute ce contact pour voir son profil complet</p>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="up-actions">
          {isFriend ? (
            <button className="btn btn-primary up-btn" onClick={openChat}>
              💬 Envoyer un message
            </button>
          ) : isPending ? (
            <button className="btn btn-ghost up-btn" disabled>
              ⏳ Demande envoyée — en attente
            </button>
          ) : (
            <button className="btn btn-primary up-btn" onClick={handleAddContact} disabled={adding}>
              {adding ? <span className="spinner"/> : '👤 Ajouter en contact'}
            </button>
          )}
        </div>

        {error && <div className="banner-err" style={{margin:'0 0 12px'}}>{error}</div>}

        {/* ── Contacts (visibles seulement si ami) ── */}
        {isFriend && (
          <div className="up-section">
            <div className="up-section-title">
              Contacts de @{resolved.username}
              {profile.contacts?.length > 0 && (
                <span className="up-count">{profile.contacts.length}</span>
              )}
            </div>

            {!profile.contacts?.length ? (
              <p className="up-empty">Aucun contact</p>
            ) : (
              <div className="up-contacts-list">
                {profile.contacts.map(c => {
                  if (c._id === me?._id) return null;
                  const rc       = resolveUser(c);
                  const isAdded  = addedIds.has(c._id);
                  return (
                    <div key={c._id} className="up-contact-row">
                      {/* Cliquable → profil de cet ami */}
                      <div className="up-contact-left"
                        onClick={() => navigate(`/user/${c._id}`)}>
                        <div style={{position:'relative', flexShrink:0}}>
                          <UserAvatar user={rc} size="sm"/>
                          <div style={{position:'absolute',bottom:0,right:0}}>
                            <OnlineDot online={isOnline(c._id)} size="sm"/>
                          </div>
                        </div>
                        <span className="up-contact-name">@{rc.username}</span>
                      </div>
                      {/* Bouton ajouter */}
                      <button
                        className={`up-add-btn ${isAdded ? 'added' : ''}`}
                        onClick={() => !isAdded && addFriendOfFriend(c._id)}
                        disabled={isAdded}
                        title={isAdded ? 'Demande envoyée' : 'Ajouter'}
                      >
                        {isAdded ? '✓' : '+'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
