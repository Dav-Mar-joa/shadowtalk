import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { post } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './AuthPages.css';
import StlkHeader from '../components/StlkHeader';

export default function LoginPage() {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const [form,     setForm]    = useState({ username:'', password:'' });
  const [error,    setError]   = useState('');
  const [loading,  setLoading] = useState(false);

  function set(k, v) { setForm(f=>({...f,[k]:v})); setError(''); }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await post('/auth/login', form);
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
      <div className="auth-bg"><div className="auth-grid"/></div>

      <div className="auth-card fade-up">
        {/* <StlkHeader /> */}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-fields">
            <div className="field">
              <label>USERNAME</label>
              <input value={form.username} onChange={e=>set('username',e.target.value)}
                placeholder="ton_username" required autoFocus/>
            </div>
            <div className="field">
              <label>MOT DE PASSE</label>
              <input type="password" value={form.password} onChange={e=>set('password',e.target.value)}
                placeholder="••••••••" required/>
            </div>
          </div>

          {error && <div className="banner-err">{error}</div>}

          <div className="auth-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner"/> : '→ Entrer dans l\'ombre'}
            </button>
          </div>
        </form>

        <div className="auth-footer">
          Pas de profil ? <Link to="/register">Créer</Link>
          <span className="sep">·</span>
          <Link to="/recover">Accès perdu ?</Link>
        </div>
      </div>
    </div>
  );
}
