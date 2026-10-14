// A player's look: picked once in the hub, saved in the browser, read by
// every game. Every pana uses the shared studio sculpt. Plain data only (no
// Three.js) so any page can import it.

const KEY = 'pana:avatar';
const NAME_KEY = 'pana:name';

// Brand palette (PANA brand guide) plus a few extra outfit colors.
export const PALETTE = {
  deepPurple: '#1a1336',
  nightNavy: '#0e0b24',
  yellow: '#ffc629',
  coral: '#ff4b4b',
  teal: '#2ad1b2',
  cream: '#f3e9d7',
  cocoa: '#8b5e3c',
};

// warm caramel tones, brightest first (matches the character art)
export const FURS = ['#cf7d22', '#d4914f', '#e0a463', '#c47f42', '#e8b97f', '#b06d3b', '#9a6038'];
export const COLORS = ['#ff4b4b', '#ffc629', '#2ad1b2', '#3d7bf2', '#8e4de8', '#f15bb5', '#ff8a1f', '#5fc93a', '#f3e9d7', '#2b2d42'];

export const OPTIONS = {
  hat: [
    { id: 'chef', label: 'Gorro de chef' },
    { id: 'band', label: 'Cinta deportiva' },
    { id: 'gorra', label: 'Gorra' },
    { id: 'gorra-atras', label: 'Gorra al revés' },
    { id: 'pesca', label: 'Pescador' },
    { id: 'lana', label: 'Gorro de lana' },
    { id: 'llanero', label: 'Llanero' },
    { id: 'corona', label: 'Corona' },
    { id: 'none', label: 'Nada' },
  ],
  glasses: [
    { id: 'redondos', label: 'Redondos' },
    { id: 'sol', label: 'De sol' },
    { id: 'fiesta', label: 'De fiesta' },
    { id: 'none', label: 'Nada' },
  ],
  outfit: [
    { id: 'franela', label: 'Franela' },
    { id: 'deportivo', label: 'Deportivo' },
    { id: 'hoodie', label: 'Hoodie' },
    { id: 'hawaiana', label: 'Playera' },
    { id: 'chef', label: 'Delantal de chef' },
  ],
  face: [
    { id: 'cool', label: 'Tranquilo' },
    { id: 'feliz', label: 'Feliz' },
    { id: 'lengua', label: 'Hablar' },
    { id: 'ojazos', label: 'Ojazos' },
    { id: 'wow', label: 'Reír' },
  ],
  extra: [
    { id: 'none', label: 'Nada' },
    { id: 'cadena', label: 'Cadena' },
    { id: 'pulseras', label: 'Muñequeras' },
  ],
};

export const DEFAULT_AVATAR = {
  fur: FURS[0],
  hat: 'none',
  hatColor: PALETTE.coral,
  glasses: 'none',
  outfit: 'franela',
  outfitColor: '#ee3024',
  face: 'cool',
  extra: 'none',
};

const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];

export function randomAvatar(rnd = Math.random) {
  return {
    fur: pick(FURS, rnd),
    hat: pick(OPTIONS.hat, rnd).id,
    hatColor: pick(COLORS, rnd),
    glasses: rnd() < 0.7 ? 'sol' : pick(OPTIONS.glasses, rnd).id,
    outfit: pick(OPTIONS.outfit, rnd).id,
    outfitColor: pick(COLORS, rnd),
    face: pick(OPTIONS.face, rnd).id,
    extra: rnd() < 0.7 ? 'none' : 'cadena',
  };
}

// Fill in anything missing or unknown, so old saves never break a game.
export function normalizeAvatar(a = {}) {
  if (!a || typeof a !== 'object') a = {};
  const out = { ...DEFAULT_AVATAR };
  for (const key of Object.keys(out)) {
    const v = a[key];
    if (typeof v !== 'string') continue;
    const choices = OPTIONS[key];
    if (key === 'fur' && !FURS.includes(v)) continue;   // fur only comes in the brand tones
    if (choices ? choices.some((c) => c.id === v) : /^#[0-9a-f]{6}$/i.test(v)) out[key] = v;
  }
  return out;
}

export function loadAvatar() {
  try {
    return normalizeAvatar(JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch {
    return { ...DEFAULT_AVATAR };
  }
}

export function saveAvatar(avatar) {
  try {
    localStorage.setItem(KEY, JSON.stringify(normalizeAvatar(avatar)));
    return true;
  } catch { return false; /* private mode: the look just won't persist */ }
}

export function loadName() {
  const fromUrl = new URLSearchParams(location.search).get('name');
  try {
    return (fromUrl || localStorage.getItem(NAME_KEY) || 'pana').slice(0, 16);
  } catch {
    return fromUrl || 'pana';
  }
}
