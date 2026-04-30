import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth }   from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import UserAvatar  from './UserAvatar';
import NotifBanner from './NotifBanner';
import './Layout.css';

function MobileNotifBtn() {
  const navigate = useNavigate();
  const { permission, subscribed, loading, subscribe } = usePushNotifications(navigate);
  if (subscribed)              return <span className="mobile-notif-icon" title="Notifs actives">🔔</span>;
  if (permission === 'denied') return <span className="mobile-notif-icon" title="Bloquées">🔕</span>;
  return (
    <button onClick={subscribe} disabled={loading} className="mobile-notif-btn" title="Activer notifications">
      {loading ? <span className="spinner" style={{width:11,height:11}}/> : '🔔'}
    </button>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { connected, notifications } = useSocket();
  const navigate = useNavigate();
  const unread   = notifications.length;

  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div className="layout">

      {/* ══ SIDEBAR desktop ══ */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">S<em>TLK</em></span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/chats"    className={({isActive})=>`nav-item ${isActive?'active':''}`}>
            <span className="nav-icon">💬</span><span className="nav-label">Chats</span>
            {unread > 0 && <span className="nav-badge">{unread > 9 ? '9+' : unread}</span>}
          </NavLink>
          <NavLink to="/contacts" className={({isActive})=>`nav-item ${isActive?'active':''}`}>
            <span className="nav-icon">👥</span><span className="nav-label">Contacts</span>
          </NavLink>
          <NavLink to="/feed"     className={({isActive})=>`nav-item ${isActive?'active':''}`}>
            <span className="nav-icon">📡</span><span className="nav-label">Fil d'actu</span>
          </NavLink>
          <NavLink to="/profile"  className={({isActive})=>`nav-item ${isActive?'active':''}`}>
            {/* ✅ UserAvatar au lieu de getAvatarEmoji */}
            <span className="nav-icon"><UserAvatar user={user} size="sm"/></span>
            <span className="nav-label">Mon profil</span>
          </NavLink>
        </nav>
        <NotifBanner />
        <div className="sidebar-footer">
          <div className="conn-status">
            <span className={`conn-dot ${connected ? 'online' : 'offline'}`}/>
            <span>{connected ? 'CONNECTÉ' : 'HORS-LIGNE'}</span>
          </div>
          <div className="sidebar-user">
            {/* ✅ UserAvatar */}
            <UserAvatar user={user} size="sm"/>
            <span className="user-name">@{user?.username}</span>
            <button className="btn-icon" onClick={handleLogout} title="Déconnexion">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ══ STICKY HEADER mobile ══ */}
      <header className="mobile-header">
        <div className="mobile-logo">
          <span>◈</span>S<em>TLK</em>
        </div>
        <div className="mobile-header-right">
          <MobileNotifBtn />
          <span className={`mobile-conn-dot ${connected ? 'online' : 'offline'}`}/>
          {/* ✅ UserAvatar cliquable → profil */}
          <div style={{cursor:'pointer'}} onClick={() => navigate('/profile')} title="Mon profil">
            <UserAvatar user={user} size="sm"/>
          </div>
          <span className="mobile-username" onClick={() => navigate('/profile')} style={{cursor:'pointer'}}>
            @{user?.username}
          </span>
        </div>
      </header>

      {/* ══ CONTENU ══ */}
      <main className="layout-main">
        <Outlet/>
      </main>

      {/* ══ BOTTOM NAV mobile ══ */}
      <nav className="bottom-nav">
        <NavLink to="/chats" className={({isActive})=>`bnav-item ${isActive?'active':''}`}>
          <div className="bnav-icon-wrap">
            <span>💬</span>
            {unread > 0 && <span className="bnav-badge">{unread > 9 ? '9+' : unread}</span>}
          </div>
          <span>Chats</span>
        </NavLink>
        <NavLink to="/contacts" className={({isActive})=>`bnav-item ${isActive?'active':''}`}>
          <div className="bnav-icon-wrap"><span>👥</span></div>
          <span>Contacts</span>
        </NavLink>
        <NavLink to="/feed" className={({isActive})=>`bnav-item ${isActive?'active':''}`}>
          <div className="bnav-icon-wrap"><span>📡</span></div>
          <span>Actu</span>
        </NavLink>
        {/* ✅ UserAvatar dans bottom nav */}
        <NavLink to="/profile" className={({isActive})=>`bnav-item ${isActive?'active':''}`}>
          <div className="bnav-icon-wrap">
            <UserAvatar user={user} size="sm"/>
          </div>
          <span>Profil</span>
        </NavLink>
      </nav>

    </div>
  );
}
