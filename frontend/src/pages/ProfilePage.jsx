import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { AVATARS, AVATAR_FACES, getAvatarEmoji, isFaceAvatar, getFaceAvatar } from '../utils/avatars';
import UserAvatar from '../components/layout/UserAvatar';
import './ProfilePage.css';

const BASE_API = import.meta.env.VITE_API_URL || '/api';

function apiDirect(path, opts = {}) {
  return fetch(BASE_API + path, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + localStorage.getItem('st_token')
    },
    ...opts
  }).then(r => r.json());
}

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const { setUserInCache } = useSocket();
  const navigate = useNavigate();
  const fileRef  = useRef(null);

  const [username,    setUsername]    = useState(user?.username || '');
  const [bio,         setBio]         = useState(user?.bio || '');
  const [avatar,      setAvatar]      = useState(user?.avatar || 'ghost');
  const [avatarImage, setAvatarImage] = useState(user?.avatarImage || '');
  const [preview,     setPreview]     = useState(user?.avatarImage || '');

  // tab: 'identity' | 'faces' | 'emoji' | 'custom'
  const [tab,     setTab]     = useState('identity');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  // Avatar courant pour la preview
  const previewUser = {
    ...user,
    avatar:      avatar,
    avatarImage: avatar === 'custom' ? preview : (avatar === 'custom' ? preview : ''),
  };

  function selectFace(faceId) {
    setAvatar(faceId);
    setAvatarImage('');
    setPreview('');
    setError('');
  }

  function selectEmoji(emojiId) {
    setAvatar(emojiId);
    setAvatarImage('');
    setPreview('');
    setError('');
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { setError('Image trop lourde — max 500KB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result);
      setAvatarImage(reader.result);
      setAvatar('custom');
      setError('');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const body = { username, bio };
      if (avatar === 'custom' && avatarImage) {
        body.avatarImage = avatarImage;
        body.avatar      = 'custom';
      } else {
        body.avatar      = avatar;
        body.avatarImage = '';
      }

      const updated = await apiDirect('/users/me', {
        method: 'PUT',
        body: JSON.stringify(body)
      });

      if (updated.error) { setError(updated.error); return; }

      updateUser(updated);
      // ✅ Mettre à jour le cache socket immédiatement
      // (le broadcast socket arrivera aussi mais avec un léger délai)
      setUserInCache(updated);
      setSuccess('Profil mis à jour ✓');
      setTimeout(() => setSuccess(''), 3000);
    } catch(e) {
      setError(e.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-page">
      {/* Header */}
      <div className="profile-header">
        <button className="btn-icon" onClick={() => navigate(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <h2>Mon Profil</h2>
        <button className="btn-icon logout-btn" onClick={() => { logout(); navigate('/login'); }} title="Déconnexion">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>

      <div className="profile-inner">

        {/* Preview avatar */}
        <div className="profile-avatar-preview">
          <div className="avatar-preview-wrap" onClick={() => setTab('faces')}>
            <UserAvatar user={previewUser} size="lg"/>
            <div className="avatar-preview-overlay">✏️</div>
          </div>
          <div className="profile-username-display">@{username || user?.username}</div>
          {bio && <div className="profile-bio-display">{bio}</div>}
        </div>

        {/* Tabs */}
        <div className="profile-tabs">
          <button className={`profile-tab ${tab==='identity'?'active':''}`} onClick={() => setTab('identity')}>
            👤 Identité
          </button>
          <button className={`profile-tab ${tab==='faces'?'active':''}`} onClick={() => setTab('faces')}>
            🎭 Avatars
          </button>
          <button className={`profile-tab ${tab==='emoji'?'active':''}`} onClick={() => setTab('emoji')}>
            😊 Emojis
          </button>
          <button className={`profile-tab ${tab==='custom'?'active':''}`} onClick={() => setTab('custom')}>
            📷 Photo
          </button>
        </div>

        <form onSubmit={handleSave} className="profile-form">

          {/* ── Identité ── */}
          {tab === 'identity' && (
            <div className="profile-fields fade-in">
              <div className="field">
                <label>USERNAME</label>
                <input
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); setSuccess(''); }}
                  placeholder="ton_username"
                  pattern="[a-zA-Z0-9_]+"
                  minLength={3} maxLength={24}
                  required
                />
                <span className="field-hint">3-24 caractères, lettres/chiffres/_</span>
              </div>
              <div className="field">
                <label>BIO <span className="field-count">{bio.length}/200</span></label>
                <textarea
                  value={bio}
                  onChange={e => { setBio(e.target.value); setError(''); setSuccess(''); }}
                  placeholder="Dis quelque chose sur toi..."
                  maxLength={200}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* ── Avatars PNG faces ── */}
          {tab === 'faces' && (
            <div className="profile-fields fade-in">
              <label className="field-label-solo">CHOISIR UN AVATAR</label>
              <div className="faces-grid">
                {AVATAR_FACES.map(f => (
                  <button
                    type="button"
                    key={f.id}
                    className={`face-pick ${avatar === f.id ? 'selected' : ''}`}
                    onClick={() => selectFace(f.id)}
                    title={f.label}
                  >
                    <img src={f.src} alt={f.label}/>
                    {avatar === f.id && <span className="face-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Emojis ── */}
          {tab === 'emoji' && (
            <div className="profile-fields fade-in">
              <label className="field-label-solo">CHOISIR UN EMOJI</label>
              <div className="avatar-grid-profile">
                {AVATARS.map(a => (
                  <button
                    type="button"
                    key={a.id}
                    className={`avatar-pick-profile ${avatar === a.id ? 'selected' : ''}`}
                    onClick={() => selectEmoji(a.id)}
                    title={a.label}
                  >
                    {a.emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Photo perso ── */}
          {tab === 'custom' && (
            <div className="profile-fields fade-in">
              <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleImageUpload}/>
              <div className="field">
                <label>PHOTO PERSONNALISÉE</label>
                <button type="button" className="upload-avatar-btn" onClick={() => fileRef.current?.click()}>
                  {preview
                    ? <><img src={preview} alt="preview" className="upload-preview"/><span>Changer la photo</span></>
                    : <><span style={{fontSize:28}}>📷</span><span>Choisir depuis ma galerie</span></>
                  }
                </button>
                <span className="field-hint">JPG, PNG, GIF — max 500KB</span>
              </div>
              {preview && (
                <button type="button" className="btn btn-ghost" onClick={() => { setPreview(''); setAvatarImage(''); setAvatar('ghost'); }}>
                  ✕ Supprimer la photo
                </button>
              )}
            </div>
          )}

          {error   && <div className="banner-err">{error}</div>}
          {success && <div className="banner-ok">{success}</div>}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner"/> : '💾 Sauvegarder'}
          </button>
        </form>

        <div className="profile-danger">
          <button className="logout-full-btn" onClick={() => { logout(); navigate('/login'); }}>
            🚪 Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
