import './OnlineDot.css';

/**
 * Petit point coloré indiquant le statut en ligne
 * online: true = vert, false = gris
 */
export default function OnlineDot({ online, size = 'md' }) {
  return (
    <span className={`online-dot ${online ? 'is-online' : 'is-offline'} size-${size}`} />
  );
}
