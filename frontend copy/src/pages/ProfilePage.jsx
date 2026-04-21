import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { AVATARS, getAvatarEmoji } from '../utils/avatars';
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
  const navigate = useNavigate();
  const fileRef  = useRef(null);

  const [username,    setUsername]    = useState(user?.username || '');
  const [bio,         setBio]         = useState(user?.bio || '');
  const [avatar,      setAvatar]      = useState(user?.avatar || 'ghost');
  const [avatarImage, setAvatarImage] = useState(user?.avatarImage || '');
  const [preview,     setPreview]     = useState(user?.avatarImage || '');
  const [tab,         setTab]         = useState('identity'); // identity | avatar
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérif taille côté client
    if (file.size > 500 * 1024) {
      setError('Image trop lourde — max 500KB');
      return;
    }

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

  function selectEmoji(id) {
    setAvatar(id);
    setAvatarImage('');
    setPreview('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');

    try {
      const body = { username, bio };
      if (avatar === 'custom' && avatarImage) {
        body.avatarImage = avatarImage;
        body.avatar      = 'custom';
      } else if (avatar !== 'custom') {
        body.avatar      = avatar;
        body.avatarImage = '';
      }

      const updated = await apiDirect('/users/me', {
        method: 'PUT',
        body: JSON.stringify(body)
      });

      if (updated.error) {
        setError(updated.error);
        return;
      }

      // Mettre à jour le state global
      updateUser(updated);
      setSuccess('Profil mis à jour ✓');

      // Effacer le succès après 3s
      setTimeout(() => setSuccess(''), 3000);
    } catch(e) {
      setError(e.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  // Avatar actuel à afficher
  const currentAvatar = avatar === 'custom' && preview
    ? { type: 'image', value: preview }
    : { type: 'emoji', value: getAvatarEmoji(avatar) };

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
        <button className="btn-icon logout-btn" onClick={handleLogout} title="Déconnexion">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>

      <div className="profile-inner">
        {/* Avatar preview */}
        <div className="profile-avatar-preview">
          <div className="avatar-preview-wrap" onClick={() => fileRef.current?.click()}>
            {currentAvatar.type === 'image'
              ? <img src={currentAvatar.value} alt="avatar" className="avatar-preview-img"/>
              : <span className="avatar-preview-emoji">{currentAvatar.value}</span>
            }
            <div className="avatar-preview-overlay">📷</div>
          </div>
          <div className="profile-username-display">@{user?.username}</div>
          {user?.bio && <div className="profile-bio-display">{user.bio}</div>}
        </div>

        {/* Tabs */}
        <div className="profile-tabs">
          <button className={`profile-tab ${tab === 'identity' ? 'active' : ''}`} onClick={() => setTab('identity')}>
            👤 Identité
          </button>
          <button className={`profile-tab ${tab === 'avatar' ? 'active' : ''}`} onClick={() => setTab('avatar')}>
            🎨 Avatar
          </button>
        </div>

        <form onSubmit={handleSave} className="profile-form">

          {/* ── Onglet Identité ── */}
          {tab === 'identity' && (
            <div className="profile-fields fade-in">
              <div className="field">
                <label>USERNAME</label>
                <input
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); setSuccess(''); }}
                  placeholder="ton_username"
                  pattern="[a-zA-Z0-9_]+"
                  minLength={3}
                  maxLength={24}
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

          {/* ── Onglet Avatar ── */}
          {tab === 'avatar' && (
            <div className="profile-fields fade-in">
              {/* Upload image */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
              <div className="field">
                <label>IMAGE PERSONNALISÉE</label>
                <button
                  type="button"
                  className="upload-avatar-btn"
                  onClick={() => fileRef.current?.click()}
                >
                  {preview
                    ? <><img src={preview} alt="preview" className="upload-preview"/><span>Changer l'image</span></>
                    : <><span style={{fontSize:24}}>📷</span><span>Choisir une photo</span></>
                  }
                </button>
                <span className="field-hint">JPG, PNG, GIF — max 500KB</span>
              </div>

              {/* Ou choisir un emoji */}
              <div className="field">
                <label>OU CHOISIR UN AVATAR</label>
                <div className="avatar-grid-profile">
                  {AVATARS.map(a => (
                    <button
                      type="button"
                      key={a.id}
                      className={`avatar-pick-profile ${avatar === a.id && !preview ? 'selected' : ''}`}
                      onClick={() => selectEmoji(a.id)}
                      title={a.label}
                    >
                      {a.emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error   && <div className="banner-err">{error}</div>}
          {success && <div className="banner-ok">{success}</div>}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner"/> : '💾 Sauvegarder'}
          </button>
        </form>

        {/* Danger zone */}
        <div className="profile-danger">
          <button className="logout-full-btn" onClick={handleLogout}>
            🚪 Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
