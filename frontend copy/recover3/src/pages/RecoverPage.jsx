import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { get, post } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './AuthPages.css';
import StlkHeader from '../components/StlkHeader';

export default function RecoverPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [step,    setStep]    = useState(1); // 1=username, 2=question+newpass
  const [username,setUsername]= useState('');
  const [question,setQuestion]= useState('');
  const [answer,  setAnswer]  = useState('');
  const [newPass, setNewPass] = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function findUser(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await get(`/auth/recover/${username}`);
      setQuestion(data.secretQuestion);
      setStep(2);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function resetPass(e) {
    e.preventDefault();
    if (newPass.length < 6) { setError('Mot de passe trop court (6 min)'); return; }
    setLoading(true); setError('');
    try {
      const data = await post('/auth/recover', { username, secretAnswer: answer, newPassword: newPass });
      login(data);
      navigate('/chats');
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg"><div className="auth-grid"/></div>
      {/* <StlkHeader /> */}
      <div className="auth-card fade-up">
        <div className="auth-header">
          <span className="auth-logo">🗝️</span>
          <h1>RÉCUPÉRATION</h1>
          <p>Retrouve ton accès via ta question secrète</p>
        </div>

        {step === 1 && (
          <form onSubmit={findUser} className="auth-form">
            <div className="auth-fields fade-in">
              <div className="field">
                <label>TON USERNAME</label>
                <input value={username} onChange={e=>{setUsername(e.target.value);setError('');}}
                  placeholder="ton_username" required autoFocus/>
              </div>
            </div>
            {error && <div className="banner-err">{error}</div>}
            <div className="auth-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner"/> : 'Rechercher →'}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={resetPass} className="auth-form">
            <div className="auth-fields fade-in">
              <div className="field">
                <label>QUESTION SECRÈTE</label>
                <div className="field-readonly">{question}</div>
              </div>
              <div className="field">
                <label>TA RÉPONSE</label>
                <input value={answer} onChange={e=>{setAnswer(e.target.value);setError('');}}
                  placeholder="ta réponse secrète" required autoFocus/>
              </div>
              <div className="field">
                <label>NOUVEAU MOT DE PASSE</label>
                <input type="password" value={newPass} onChange={e=>{setNewPass(e.target.value);setError('');}}
                  placeholder="••••••••" minLength={6} required/>
              </div>
            </div>
            {error && <div className="banner-err">{error}</div>}
            <div className="auth-actions">
              <button type="button" className="btn btn-ghost" onClick={()=>setStep(1)}>← Retour</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner"/> : '🔒 Réinitialiser'}
              </button>
            </div>
          </form>
        )}

        <div className="auth-footer">
          <Link to="/login">← Retour connexion</Link>
        </div>
      </div>
    </div>
  );
}
