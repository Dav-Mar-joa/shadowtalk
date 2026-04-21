// Banque d'avatars — emojis thématiques underground/anonyme
export const AVATARS = [
  { id: 'ghost',    emoji: '👻', label: 'Ghost'      },
  { id: 'skull',    emoji: '💀', label: 'Skull'      },
  { id: 'alien',    emoji: '👾', label: 'Alien'      },
  { id: 'mask',     emoji: '🎭', label: 'Mask'       },
  { id: 'robot',    emoji: '🤖', label: 'Robot'      },
  { id: 'ninja',    emoji: '🥷', label: 'Ninja'      },
  { id: 'wolf',     emoji: '🐺', label: 'Wolf'       },
  { id: 'crow',     emoji: '🐦‍⬛', label: 'Crow'      },
  { id: 'snake',    emoji: '🐍', label: 'Snake'      },
  { id: 'spider',   emoji: '🕷️', label: 'Spider'     },
  { id: 'shadow',   emoji: '🌑', label: 'Shadow'     },
  { id: 'void',     emoji: '🕳️', label: 'Void'       },
  { id: 'eye',      emoji: '👁️', label: 'Eye'        },
  { id: 'flame',    emoji: '🔥', label: 'Flame'      },
  { id: 'storm',    emoji: '⚡', label: 'Storm'      },
  { id: 'dagger',   emoji: '🗡️', label: 'Dagger'     },
  { id: 'key',      emoji: '🗝️', label: 'Key'        },
  { id: 'lock',     emoji: '🔒', label: 'Lock'       },
  { id: 'satellite',emoji: '📡', label: 'Satellite'  },
  { id: 'signal',   emoji: '📶', label: 'Signal'     },
  { id: 'cipher',   emoji: '🔐', label: 'Cipher'     },
  { id: 'anon',     emoji: '🎪', label: 'Anon'       },
  { id: 'glitch',   emoji: '👤', label: 'Glitch'     },
  { id: 'hex',      emoji: '⬡',  label: 'Hex'        },
];

export function getAvatar(id) {
  return AVATARS.find(a => a.id === id) || AVATARS[0];
}

export function getAvatarEmoji(id) {
  return getAvatar(id).emoji;
}

/**
 * Retourne les infos d'affichage d'un avatar
 * @param {string} avatarId - id emoji ou 'custom'
 * @param {string} avatarImage - base64 si custom
 * @returns {{ type: 'emoji'|'image', value: string }}
 */
export function getAvatarDisplay(avatarId, avatarImage) {
  if (avatarId === 'custom' && avatarImage) {
    return { type: 'image', value: avatarImage };
  }
  return { type: 'emoji', value: getAvatarEmoji(avatarId) };
}

// ── Avatars PNG (profil_face folder) ────────────────────────────────
export const AVATAR_FACES = [
  { id: 'face_1',  src: '/profil_face/avatar1.png',  label: 'Avatar 1'  },
  { id: 'face_2',  src: '/profil_face/avatar2.png',  label: 'Avatar 2'  },
  { id: 'face_3',  src: '/profil_face/avatar3.png',  label: 'Avatar 3'  },
  { id: 'face_4',  src: '/profil_face/avatar4.png',  label: 'Avatar 4'  },
  { id: 'face_5',  src: '/profil_face/avatar5.png',  label: 'Avatar 5'  },
  { id: 'face_6',  src: '/profil_face/avatar6.png',  label: 'Avatar 6'  },
  { id: 'face_7',  src: '/profil_face/avatar7.png',  label: 'Avatar 7'  },
  { id: 'face_8',  src: '/profil_face/avatar8.png',  label: 'Avatar 8'  },
  { id: 'face_9',  src: '/profil_face/avatar9.png',  label: 'Avatar 9'  },
  { id: 'face_10', src: '/profil_face/avatar10.png', label: 'Avatar 10' },
  { id: 'face_11', src: '/profil_face/avatar11.png', label: 'Avatar 11' },
  { id: 'face_12', src: '/profil_face/avatar12.png', label: 'Avatar 12' },
  { id: 'face_13', src: '/profil_face/avatar13.png', label: 'Avatar 13' },
  { id: 'face_14', src: '/profil_face/avatar14.png', label: 'Avatar 14' },
  { id: 'face_15', src: '/profil_face/avatar15.png', label: 'Avatar 15' },
  { id: 'face_16', src: '/profil_face/avatar16.png', label: 'Avatar 16' },
  { id: 'face_17', src: '/profil_face/avatar17.png', label: 'Avatar 17' },
  { id: 'face_18', src: '/profil_face/avatar18.png', label: 'Avatar 18' },
  { id: 'face_19', src: '/profil_face/avatar19.png', label: 'Avatar 19' },
  { id: 'face_20', src: '/profil_face/avatar20.png', label: 'Avatar 20' },
];

/**
 * Retourne le src d'un avatar face par son id
 */
export function getFaceAvatar(id) {
  return AVATAR_FACES.find(f => f.id === id);
}

/**
 * Vérifie si un id est un avatar face PNG
 */
export function isFaceAvatar(id) {
  return typeof id === 'string' && id.startsWith('face_');
}

