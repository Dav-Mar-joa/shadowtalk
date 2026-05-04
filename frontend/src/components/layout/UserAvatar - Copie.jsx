import { useSocket } from '../../context/SocketContext';
import { getAvatarEmoji, isFaceAvatar, getFaceAvatar } from '../../utils/avatars';
import './UserAvatar.css';

/**
 * Composant Avatar universel — 3 modes :
 * 1. Emoji       → avatar = 'ghost', 'skull', etc.
 * 2. Face PNG    → avatar = 'face_1' ... 'face_24'
 * 3. Custom image → avatar = 'custom' + avatarImage (base64)
 *
 * Se met à jour automatiquement via le cache socket si l'user change son avatar.
 */
export default function UserAvatar({ user, size = 'md' }) {
  const { usersCache } = useSocket();

  if (!user) return (
    <div className={`uavatar uavatar-${size}`}>
      <span>👤</span>
    </div>
  );

  // Résoudre depuis le cache (mise à jour temps réel)
  const id      = (user._id || user)?.toString();
  const cached  = id ? usersCache[id] : null;
  const current = cached ? { ...user, ...cached } : user;

  const avatarId  = current.avatar || 'ghost';
  const isCustom  = avatarId === 'custom' && current.avatarImage;
  const isFace    = isFaceAvatar(avatarId);
  const faceData  = isFace ? getFaceAvatar(avatarId) : null;

  return (
    <div className={`uavatar uavatar-${size}`}>
      {isCustom ? (
        // Image uploadée par l'user
        <img
          src={current.avatarImage}
          alt={current.username || 'avatar'}
          className="uavatar-img"
        />
      ) : isFace && faceData ? (
        // PNG depuis profil_face/
        <img
          src={faceData.src}
          alt={faceData.label}
          className="uavatar-img"
        />
      ) : (
        // Emoji
        <span>{getAvatarEmoji(avatarId)}</span>
      )}
    </div>
  );
}
