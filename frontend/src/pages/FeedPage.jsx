import { useState, useEffect, useRef } from 'react';
import { get, post, timeAgo, detectUrlType, getYoutubeId, apiDirect } from '../utils/api';
import { getAvatarEmoji } from '../utils/avatars';
import { useAuth }   from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import UserAvatar from '../components/layout/UserAvatar';
import './FeedPage.css';
import { getAvatarDisplay } from '../utils/avatars';

const REACTIONS = ['❤️','😂','👍','😮','😢','🔥'];



function ReactionBar({ reactions = {}, userId, onReact, small = false }) {
  const obj = reactions instanceof Map ? Object.fromEntries(reactions) : (reactions || {});
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  const total = Object.values(obj).reduce((s, users) => s + (users?.length || 0), 0);

  return (
    <div className="reaction-bar" ref={ref}>
      {/* Bouton ajouter réaction */}
      <button
        className={`react-add-btn ${small ? 'react-add-sm' : ''}`}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
      >
        {total > 0 ? '😊 +' : '😊'}
      </button>

      {/* Picker */}
      {open && (
        <div className="reaction-picker-feed" onClick={e => e.stopPropagation()}>
          {REACTIONS.map(emoji => {
            const users   = obj[emoji] || [];
            const reacted = users.includes(userId);
            return (
              <button key={emoji} className={`rpf-btn ${reacted ? 'active' : ''}`}
                onClick={() => { onReact(emoji); setOpen(false); }}>
                {emoji}
                {users.length > 0 && <span className="rpf-count">{users.length}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Réactions existantes */}
      {Object.entries(obj).map(([emoji, users]) =>
        users?.length > 0 && (
          <button key={emoji}
            className={`reaction-chip-feed ${users.includes(userId) ? 'mine' : ''}`}
            onClick={e => { e.stopPropagation(); onReact(emoji); }}>
            {emoji} {users.length}
          </button>
        )
      )}
    </div>
  );
}

export default function FeedPage() {
  const { user }   = useAuth();
  const { socket, resolveUser } = useSocket();
  const [posts,      setPosts]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [postForm,   setPostForm]   = useState({ content:'', url:'' });
  const [posting,    setPosting]    = useState(false);
  const [error,      setError]      = useState('');
  const [expanded,   setExpanded]   = useState({});
  const [commenting, setCommenting] = useState({});

  useEffect(() => {
    get('/posts').then(setPosts).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('new_post',      p       => setPosts(prev => prev.find(x=>x._id===p._id) ? prev : [p,...prev]));
    socket.on('post_deleted',  ({postId}) => setPosts(prev => prev.filter(p=>p._id!==postId)));
    socket.on('post_liked',    ({ postId, likes, liked, userId }) =>
      setPosts(prev => prev.map(p => {
        if (p._id !== postId) return p;
        const nl = liked ? [...p.likes.filter(l=>(l._id||l)!==userId), userId] : p.likes.filter(l=>(l._id||l)!==userId);
        return { ...p, likes: nl };
      }))
    );
    socket.on('post_commented', updated => setPosts(prev => prev.map(p=>p._id===updated._id?updated:p)));
    socket.on('post_reacted',  ({ postId, reactions }) =>
      setPosts(prev => prev.map(p => p._id===postId ? { ...p, reactions } : p))
    );
    return () => {
      ['new_post','post_deleted','post_liked','post_commented','post_reacted'].forEach(e => socket.off(e));
    };
  }, [socket]);

  async function submitPost(e) {
    e.preventDefault();
    if (!postForm.content.trim() && !postForm.url.trim()) return;
    setPosting(true); setError('');
    try {
      await post('/posts', { ...postForm, urlType: detectUrlType(postForm.url) });
      setPostForm({ content:'', url:'' });
    } catch(e) { setError(e.message); }
    finally { setPosting(false); }
  }

  async function deletePost(postId) {
    if (!confirm('Supprimer ce post ?')) return;
    await apiDirect(`/posts/${postId}`, { method: 'DELETE' });
  }

  async function reactPost(postId, emoji) {
    await apiDirect(`/posts/${postId}/react`, { method:'POST', body: JSON.stringify({ emoji }) });
  }

  async function submitComment(postId) {
    const content = commenting[postId]?.trim();
    if (!content) return;
    try {
      await post(`/posts/${postId}/comment`, { content });
      setCommenting(prev => ({ ...prev, [postId]: '' }));
    } catch(e) { console.error(e); }
  }

  async function deleteComment(postId, commentId) {
    await apiDirect(`/posts/${postId}/comment/${commentId}`, { method: 'DELETE' });
  }

  async function reactComment(postId, commentId, emoji) {
    await apiDirect(`/posts/${postId}/comment/${commentId}/react`, { method:'POST', body: JSON.stringify({ emoji }) });
  }

  function renderUrl(p) {
    if (!p.url) return null;
    const ytId = p.urlType === 'youtube' ? getYoutubeId(p.url) : null;
    return (
      <div className="post-url-card">
        {ytId ? (
          <div className="yt-embed">
            <iframe src={`https://www.youtube.com/embed/${ytId}`} title="YouTube"
              frameBorder="0" allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"/>
          </div>
        ) : (
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="url-link">
            <span className="url-icon">{p.urlType==='event'?'📅':'🌐'}</span>
            <span className="url-text">{p.url}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="feed-page">
      <div className="feed-inner">

        {/* Composer */}
        <div className="post-composer fade-up">
          <div className="composer-header">
            <UserAvatar user={user} size="md"/>
            <span className="composer-who">@{user?.username}</span>
            <span className="tag tag-accent">POST</span>
          </div>
          <form onSubmit={submitPost} className="composer-form">
            <textarea value={postForm.content}
              onChange={e => setPostForm(f=>({...f,content:e.target.value}))}
              placeholder="Partage quelque chose avec la communauté..." rows={3}/>
            <div className="composer-url">
              <input value={postForm.url}
                onChange={e => setPostForm(f=>({...f,url:e.target.value}))}
                placeholder="🔗 Lien YouTube / soirée / article (optionnel)"/>
            </div>
            {error && <div className="banner-err">{error}</div>}
            <div className="composer-actions">
              {postForm.url && (
                <div className="url-type-badge">
                  {detectUrlType(postForm.url)==='youtube' ? '▶ YouTube' : '🌐 Lien web'}
                </div>
              )}
              <button type="submit" className="btn btn-primary"
                disabled={posting||(!postForm.content.trim()&&!postForm.url.trim())}
                style={{width:'auto',padding:'9px 22px'}}>
                {posting ? <span className="spinner"/> : 'Publier →'}
              </button>
            </div>
          </form>
        </div>

        <div className="feed-divider"><span>FIL D'ACTU COMMUNAUTÉ</span></div>

        {loading && (
          <div style={{display:'flex',justifyContent:'center',padding:40}}>
            <span className="spinner" style={{width:28,height:28}}/>
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="feed-empty">
            <span style={{fontSize:40}}>📡</span>
            <p>Aucun post pour l'instant</p>
            <span>Sois le premier à publier !</span>
          </div>
        )}

        {posts.map((p, idx) => {
          const commentsOpen = expanded[p._id];
          const commentText  = commenting[p._id] || '';
          const isOwner      = (p.author?._id || p.author) === user._id;
          const reactions    = p.reactions instanceof Map ? Object.fromEntries(p.reactions) : (p.reactions || {});

          return (
            <div key={p._id} className="post-card fade-up" style={{animationDelay:`${idx*0.04}s`}}>
              {/* Header */}
              <div className="post-header">
                <UserAvatar user={resolveUser(p.author)} size="md"/>
                <div className="post-meta">
                  <span className="post-author">@{resolveUser(p.author)?.username}</span>
                  <span className="post-time">{timeAgo(p.createdAt)}</span>
                </div>
                {p.urlType==='event' && <span className="tag tag-cyan">📅 SOIRÉE</span>}
                {isOwner && (
                  <button className="btn-icon post-delete-btn" onClick={() => deletePost(p._id)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    </svg>
                  </button>
                )}
              </div>

              {p.content && <p className="post-content">{p.content}</p>}
              {renderUrl(p)}

              {/* ✅ Réactions sur le post */}
              <div className="post-reactions-area">
                <ReactionBar
                  reactions={reactions}
                  userId={user._id}
                  onReact={emoji => reactPost(p._id, emoji)}
                />
                {/* Bouton commentaires */}
                <button className="action-btn"
                  onClick={() => setExpanded(prev=>({...prev,[p._id]:!prev[p._id]}))}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span>{p.comments?.length || 0}</span>
                </button>
              </div>

              {/* Commentaires */}
              {commentsOpen && (
                <div className="post-comments fade-in">
                  {p.comments?.map(c => {
                    const isCommentOwner = (c.author?._id||c.author) === user._id;
                    const cReactions = c.reactions instanceof Map ? Object.fromEntries(c.reactions) : (c.reactions || {});
                    return (
                      <div key={c._id} className="comment-row">
                        <UserAvatar user={resolveUser(c.author)} size="sm"/>
                        <div className="comment-body">
                          <span className="comment-author">@{resolveUser(c.author)?.username}</span>
                          <span className="comment-text">{c.content}</span>
                          {/* ✅ Réactions sur commentaire */}
                          <div className="comment-reactions">
                            <ReactionBar
                              reactions={cReactions}
                              userId={user._id}
                              onReact={emoji => reactComment(p._id, c._id, emoji)}
                              small
                            />
                          </div>
                          <span className="comment-time">{timeAgo(c.createdAt)}</span>
                        </div>
                        {isCommentOwner && (
                          <button className="btn-icon comment-del"
                            onClick={() => deleteComment(p._id, c._id)}>✕</button>
                        )}
                      </div>
                    );
                  })}
                  <div className="comment-input-row">
                    <UserAvatar user={user} size="sm"/>
                    <input value={commentText}
                      onChange={e => setCommenting(prev=>({...prev,[p._id]:e.target.value}))}
                      onKeyDown={e => { if(e.key==='Enter'){e.preventDefault();submitComment(p._id);}}}
                      placeholder="Commenter... (Entrée)" style={{padding:'7px 12px',fontSize:12}}/>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
