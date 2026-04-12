import { useState, useEffect } from 'react';
import { get, post, timeAgo, detectUrlType, getYoutubeId } from '../utils/api';
import { getAvatarEmoji } from '../utils/avatars';
import { useAuth }   from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import './FeedPage.css';

const API = (path, opts={}) => fetch('/api' + path, {
  headers: { 'Content-Type':'application/json', Authorization:'Bearer '+localStorage.getItem('st_token') },
  ...opts
}).then(r => r.json());

export default function FeedPage() {
  const { user }   = useAuth();
  const { socket } = useSocket();
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

  // ✅ Tous les events socket du feed en temps réel
  useEffect(() => {
    if (!socket) return;

    socket.on('new_post', p => {
      setPosts(prev => prev.find(x => x._id === p._id) ? prev : [p, ...prev]);
    });

    socket.on('post_deleted', ({ postId }) => {
      setPosts(prev => prev.filter(p => p._id !== postId));
    });

    socket.on('post_liked', ({ postId, likes, liked, userId }) => {
      setPosts(prev => prev.map(p => {
        if (p._id !== postId) return p;
        const newLikes = liked
          ? [...p.likes.filter(l=>(l._id||l)!==userId), userId]
          : p.likes.filter(l => (l._id||l) !== userId);
        return { ...p, likes: newLikes };
      }));
    });

    socket.on('post_commented', updated => {
      setPosts(prev => prev.map(p => p._id === updated._id ? updated : p));
    });

    return () => {
      socket.off('new_post');
      socket.off('post_deleted');
      socket.off('post_liked');
      socket.off('post_commented');
    };
  }, [socket]);

  async function submitPost(e) {
    e.preventDefault();
    if (!postForm.content.trim() && !postForm.url.trim()) return;
    setPosting(true); setError('');
    try {
      await post('/posts', { ...postForm, urlType: detectUrlType(postForm.url) });
      setPostForm({ content:'', url:'' }); // state mis à jour via socket
    } catch(e) { setError(e.message); }
    finally { setPosting(false); }
  }

  async function deletePost(postId) {
    if (!confirm('Supprimer ce post ?')) return;
    try {
      await API(`/posts/${postId}`, { method: 'DELETE' });
      // state mis à jour via socket 'post_deleted'
    } catch(e) { console.error(e); }
  }

  async function toggleLike(postId) {
    try {
      await post(`/posts/${postId}/like`, {});
      // state mis à jour via socket 'post_liked'
    } catch(e) { console.error(e); }
  }

  async function submitComment(postId) {
    const content = commenting[postId]?.trim();
    if (!content) return;
    try {
      await post(`/posts/${postId}/comment`, { content });
      setCommenting(prev => ({ ...prev, [postId]: '' }));
      // state mis à jour via socket 'post_commented'
    } catch(e) { console.error(e); }
  }

  async function deleteComment(postId, commentId) {
    try {
      await API(`/posts/${postId}/comment/${commentId}`, { method: 'DELETE' });
      // state mis à jour via socket 'post_commented'
    } catch(e) { console.error(e); }
  }

  function isLiked(p) { return p.likes?.some(l => (l._id||l) === user._id); }

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
            <div className="avatar">{getAvatarEmoji(user?.avatar)}</div>
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
          const liked        = isLiked(p);
          const commentsOpen = expanded[p._id];
          const commentText  = commenting[p._id] || '';
          const isOwner      = (p.author?._id || p.author) === user._id;

          return (
            <div key={p._id} className="post-card fade-up" style={{animationDelay:`${idx*0.04}s`}}>
              <div className="post-header">
                <div className="avatar">{getAvatarEmoji(p.author?.avatar)}</div>
                <div className="post-meta">
                  <span className="post-author">@{p.author?.username}</span>
                  <span className="post-time">{timeAgo(p.createdAt)}</span>
                </div>
                {p.urlType==='event' && <span className="tag tag-cyan">📅 SOIRÉE</span>}
                {/* ✅ Bouton supprimer post (auteur seulement) */}
                {isOwner && (
                  <button className="btn-icon post-delete-btn" onClick={() => deletePost(p._id)} title="Supprimer">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    </svg>
                  </button>
                )}
              </div>

              {p.content && <p className="post-content">{p.content}</p>}
              {renderUrl(p)}

              <div className="post-actions">
                <button className={`action-btn ${liked?'liked':''}`} onClick={() => toggleLike(p._id)}>
                  <span>{liked ? '❤️' : '🤍'}</span>
                  <span>{p.likes?.length || 0}</span>
                </button>
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
                    return (
                      <div key={c._id} className="comment-row">
                        <div className="avatar avatar-sm">{getAvatarEmoji(c.author?.avatar)}</div>
                        <div className="comment-body">
                          <span className="comment-author">@{c.author?.username}</span>
                          <span className="comment-text">{c.content}</span>
                          <span className="comment-time">{timeAgo(c.createdAt)}</span>
                        </div>
                        {/* ✅ Supprimer commentaire */}
                        {isCommentOwner && (
                          <button className="btn-icon comment-del" onClick={() => deleteComment(p._id, c._id)} title="Supprimer">
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <div className="comment-input-row">
                    <div className="avatar avatar-sm">{getAvatarEmoji(user?.avatar)}</div>
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
