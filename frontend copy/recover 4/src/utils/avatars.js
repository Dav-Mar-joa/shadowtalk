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
