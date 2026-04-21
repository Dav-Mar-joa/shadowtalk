import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import RegisterPage  from './pages/RegisterPage';
import LoginPage     from './pages/LoginPage';
import RecoverPage   from './pages/RecoverPage';
import ChatsPage     from './pages/ChatsPage';
import ChatRoom      from './pages/ChatRoom';
import FeedPage      from './pages/FeedPage';
import ContactsPage  from './pages/ContactsPage';
import ProfilePage   from './pages/ProfilePage';

import Layout        from './components/layout/Layout';

function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <div className="spinner" style={{width:32,height:32}}/>
      <span style={{color:'var(--text-3)',fontSize:11,letterSpacing:'0.1em'}}>CONNEXION...</span>
    </div>
  );
  return user ? children : <Navigate to="/login" replace/>;
}

function Public({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/chats" replace/> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/"         element={<Navigate to="/chats" replace/>}/>
            <Route path="/register" element={<Public><RegisterPage/></Public>}/>
            <Route path="/login"    element={<Public><LoginPage/></Public>}/>
            <Route path="/recover"  element={<Public><RecoverPage/></Public>}/>
            <Route path="/" element={<Private><Layout/></Private>}>
              <Route path="chats"    element={<ChatsPage/>}/>
              <Route path="chat/:id" element={<ChatRoom/>}/>
              <Route path="contacts" element={<ContactsPage/>}/>
              <Route path="feed"     element={<FeedPage/>}/>
              <Route path="profile"  element={<ProfilePage/>}/>
            </Route>
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
