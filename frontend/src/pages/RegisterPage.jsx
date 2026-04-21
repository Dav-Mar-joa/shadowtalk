import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { post } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { AVATARS, AVATAR_FACES } from '../utils/avatars';
import './AuthPages.css';

const QUESTIONS = [
  "Nom de ton premier animal de compagnie ?",
  "Ville où tu es né(e) ?",
  "Surnom d'enfance ?",
  "Couleur préférée quand tu avais 10 ans ?",
  "Nom de ton meilleur ami d'enfance ?",
  "Modèle de ta première console ?",
  "Rue où tu as grandi ?",
  "Plat favori de ta grand-mère ?",
];

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [step,     setStep]     = useState(1); // 1=identité, 2=sécurité, 3=avatar
  const [form,     setForm]     = useState({ username:'', password:'', secretQuestion: QUESTIONS[0], secretAnswer:'', avatar:'face_1' });
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setError(''); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (step < 3) { setStep(s => s + 1); return; }
    setLoading(true);
    setError('');
    try {
      const data = await post('/auth/register', form);
      login(data);
      navigate('/chats');
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-grid"/>
      </div>

      <div className="auth-card fade-up">
        {/* Header */}
        <div className="auth-header">
          <span className="auth-logo">◈</span>
          <h1>SHADOWTALK</h1>
          <p>Crée ton identité fantôme</p>
        </div>

        {/* Steps indicator */}
        <div className="auth-steps">
          {[1,2,3].map(s => (
            <div key={s} className={`auth-step ${step >= s ? 'done' : ''} ${step === s ? 'active' : ''}`}>
              <div className="step-dot">{step > s ? '✓' : s}</div>
              <span>{s===1?'Identité':s===2?'Sécurité':'Avatar'}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="auth-form">

          {/* Step 1 — Identité */}
          {step === 1 && (
            <div className="auth-fields fade-in">
              <div className="field">
                <label>USERNAME</label>
                <input
                  value={form.username}
                  onChange={e => set('username', e.target.value)}
                  placeholder="ex: ghost_07"
                  pattern="[a-zA-Z0-9_]+"
                  minLength={3} maxLength={24}
                  required autoFocus
                />
                <span className="field-hint">3-24 chars, lettres/chiffres/_</span>
              </div>
              <div className="field">
                <label>MOT DE PASSE</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
                <span className="field-hint">6 caractères minimum</span>
              </div>
            </div>
          )}

          {/* Step 2 — Sécurité */}
          {step === 2 && (
            <div className="auth-fields fade-in">
              <div className="field">
                <label>QUESTION SECRÈTE</label>
                <select value={form.secretQuestion} onChange={e => set('secretQuestion', e.target.value)}>
                  {QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <div className="field">
                <label>RÉPONSE SECRÈTE</label>
                <input
                  value={form.secretAnswer}
                  onChange={e => set('secretAnswer', e.target.value)}
                  placeholder="ta réponse..."
                  required autoFocus
                />
                <span className="field-hint">Sert à récupérer ton accès. Mémorise-la.</span>
              </div>
            </div>
          )}

          {/* Step 3 — Avatar */}
          {step === 3 && (
            <div className="auth-fields fade-in">
              <label className="field-label-top">CHOIX DE L'AVATAR</label>
              {/* Onglets faces / emojis */}
              <div className="reg-avatar-tabs">
                <button type="button"
                  className={`reg-av-tab ${!form._emojiMode ? 'active' : ''}`}
                  onClick={() => set('_emojiMode', false)}>🎭 Avatars</button>
                <button type="button"
                  className={`reg-av-tab ${form._emojiMode ? 'active' : ''}`}
                  onClick={() => set('_emojiMode', true)}>😊 Emojis</button>
              </div>
              {!form._emojiMode ? (
                <div className="faces-grid-reg">
                  {AVATAR_FACES.map(f => (
                    <button type="button" key={f.id}
                      className={`face-pick-reg ${form.avatar === f.id ? 'selected' : ''}`}
                      onClick={() => set('avatar', f.id)} title={f.label}>
                      <img src={f.src} alt={f.label}/>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="avatar-grid">
                  {AVATARS.map(a => (
                    <button type="button" key={a.id}
                      className={`avatar-pick ${form.avatar === a.id ? 'selected' : ''}`}
                      onClick={() => set('avatar', a.id)} title={a.label}>
                      <span>{a.emoji}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="selected-avatar">
                {form.avatar?.startsWith('face_')
                  ? <img src={AVATAR_FACES.find(f=>f.id===form.avatar)?.src} alt="avatar"
                      style={{width:52,height:52,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--accent)'}}/>
                  : <div className="avatar avatar-lg">{AVATARS.find(a=>a.id===form.avatar)?.emoji || '👻'}</div>
                }
                <div>
                  <div style={{fontFamily:'var(--font-ui)',fontWeight:700,color:'var(--text-1)'}}>@{form.username}</div>
                  <div style={{color:'var(--text-3)',fontSize:11}}>
                    {form.avatar?.startsWith('face_')
                      ? AVATAR_FACES.find(f=>f.id===form.avatar)?.label
                      : AVATARS.find(a=>a.id===form.avatar)?.label}
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && <div className="banner-err">{error}</div>}

          <div className="auth-actions">
            {step > 1 && (
              <button type="button" className="btn btn-ghost" onClick={() => setStep(s=>s-1)}>
                ← Retour
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner"/> : step < 3 ? 'Continuer →' : '🔒 Créer mon profil'}
            </button>
          </div>
        </form>

        <div className="auth-footer">
          Déjà un profil ? <Link to="/login">Connexion</Link>
          <span className="sep">·</span>
          <Link to="/recover">Accès perdu ?</Link>
        </div>
      </div>
    </div>
  );
}
