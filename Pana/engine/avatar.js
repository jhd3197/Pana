// A player's look: picked once in the hub, saved in the browser, read by
// every game. Every pana uses the shared studio sculpt. Plain data only (no
// Three.js) so any page can import it.

import { normalizeWardrobe, wardrobeColor } from './wardrobe.js';
import { loc } from './i18n.js';
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
    { id: 'chef', label: loc('Gorro de chef') },
    { id: 'band', label: loc('Cinta deportiva') },
    { id: 'gorra', label: loc('Gorra') },
    { id: 'gorra-atras', label: loc('Gorra al revés') },
    { id: 'pesca', label: loc('Pescador') },
    { id: 'lana', label: loc('Gorro de lana') },
    { id: 'llanero', label: loc('Llanero') },
    { id: 'corona', label: loc('Corona') },
    { id: 'none', label: loc('Nada') },
  ],
  glasses: [
    { id: 'redondos', label: loc('Redondos') },
    { id: 'sol', label: loc('De sol') },
    { id: 'fiesta', label: loc('De fiesta') },
    { id: 'none', label: loc('Nada') },
  ],
  outfit: [
    { id: 'franela', label: loc('Franela') },
    { id: 'deportivo', label: loc('Deportivo') },
    { id: 'hoodie', label: loc('Hoodie') },
    { id: 'hawaiana', label: loc('Playera') },
    { id: 'chef', label: loc('Delantal de chef') },
  ],
  face: [
    { id: 'cool', label: loc('Tranquilo') },
    { id: 'feliz', label: loc('Feliz') },
    { id: 'lengua', label: loc('Hablar') },
    { id: 'ojazos', label: loc('Ojazos') },
    { id: 'wow', label: loc('Reír') },
  ],
  extra: [
    { id: 'none', label: loc('Nada') },
    { id: 'cadena', label: loc('Cadena') },
    { id: 'pulseras', label: loc('Muñequeras') },
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
  if (a.wardrobe && typeof a.wardrobe === 'object') {
    out.wardrobe = normalizeWardrobe({ ...a.wardrobe, fur: out.fur });
    delete out.wardrobe.name;
  }
  return out;
}

const tops = { franela: 'shirt', deportivo: 'sport', hoodie: 'hoodie', hawaiana: 'tropical', chef: 'chef' };
const faces = { cool: 'natural', feliz: 'smile', lengua: 'talk', ojazos: 'natural', wow: 'laugh' };
const reverse = (map, value, fallback) => Object.keys(map).find(key => map[key] === value) || fallback;

export function avatarToWardrobe(input, name = 'pana') {
  const a = normalizeAvatar(input);
  if (a.wardrobe) return normalizeWardrobe({ ...a.wardrobe, fur: a.fur, name });
  const hat = a.hat === 'band' ? 'cinta' : a.hat, top = tops[a.outfit];
  return normalizeWardrobe({ name, fur: a.fur, hat, top,
    glasses: { redondos: 'round', sol: 'sun', fiesta: 'round' }[a.glasses] || 'none',
    face: faces[a.face], wrist: a.extra === 'pulseras', neck: a.extra === 'cadena' ? 'cadena' : 'none',
    colors: { [`top:${top}:main`]: a.outfitColor, [`hat:${hat}:main`]: a.hatColor } });
}

export function wardrobeToAvatar(input) {
  const w = normalizeWardrobe(input);
  return normalizeAvatar({ fur: w.fur, wardrobe: w,
    outfit: reverse(tops, w.top, 'franela'), outfitColor: wardrobeColor(w, 'top', w.top, 'main') || '#ee3024',
    hat: w.hat === 'cinta' ? 'band' : w.hat, hatColor: wardrobeColor(w, 'hat', w.hat, 'main') || '#ff4b4b',
    glasses: { round: 'redondos', sun: 'sol' }[w.glasses] || 'none', face: reverse(faces, w.face, 'cool'),
    extra: w.wrist ? 'pulseras' : w.neck === 'cadena' ? 'cadena' : 'none' });
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
