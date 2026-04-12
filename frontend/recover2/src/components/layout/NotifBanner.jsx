import { useNavigate } from 'react-router-dom';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import './NotifBanner.css';

export default function NotifBanner() {
  const navigate = useNavigate();
  const { permission, subscribed, loading, error, supported, subscribe, unsubscribe } =
    usePushNotifications(navigate);

  // Pas de Web Push sur ce navigateur
  if (!supported) return null;

  // Déjà abonné → petit badge vert
  if (subscribed) {
    return (
      <div className="notif-banner subscribed">
        <span>🔔</span>
        <span>Notifs activées</span>
        <button onClick={unsubscribe} className="notif-off" title="Désactiver">✕</button>
      </div>
    );
  }

  // Permission refusée
  if (permission === 'denied') {
    return (
      <div className="notif-banner denied">
        <span>🔕</span>
        <span>Notifs bloquées</span>
      </div>
    );
  }

  // Pas encore demandé → bouton d'activation
  return (
    <div className="notif-banner prompt">
      {error && <div className="notif-error">{error}</div>}
      <button onClick={subscribe} disabled={loading} className="notif-activate">
        {loading
          ? <span className="spinner" style={{width:12,height:12}}/>
          : <><span>🔔</span><span>Activer les notifs</span></>
        }
      </button>
    </div>
  );
}
