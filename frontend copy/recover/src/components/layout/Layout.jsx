import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth }    from '../../context/AuthContext';
import { useSocket }  from '../../context/SocketContext';
import { getAvatarEmoji } from '../../utils/avatars';
import NotifBanner    from './NotifBanner';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const { connected, notifications } = useSocket();
  const navigate = useNavigate();
  const unread   = notifications.length;

  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div className="layout">
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <span className="logo-icon">◈</span>
          <span className="logo-text">S<em>TK</em></span>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <NavLink to="/chats" className={({isActive})=>`nav-item ${isActive?'active':''}`}>
            <span className="nav-icon">💬</span>
            <span className="nav-label">Chats</span>
            {unread > 0 && <span className="nav-badge">{unread > 9 ? '9+' : unread}</span>}
          </NavLink>
          <NavLink to="/feed" className={({isActive})=>`nav-item ${isActive?'active':''}`}>
            <span className="nav-icon">📡</span>
            <span className="nav-label">Wall</span>
          </NavLink>
        </nav>

        {/* Bouton activation notifs push */}
        <NotifBanner />

        {/* Statut + user */}
        <div className="sidebar-footer">
          <div className="conn-status">
            <span className={`conn-dot ${connected ? 'online' : 'offline'}`}/>
            <span>{connected ? 'CONNECTÉ' : 'HORS-LIGNE'}</span>
          </div>
          <div className="sidebar-user">
            <div className="avatar avatar-sm">{getAvatarEmoji(user?.avatar)}</div>
            <span className="user-name">{user?.username}</span>
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

      <main className="layout-main">
        <Outlet/>
      </main>
    </div>
  );
}
