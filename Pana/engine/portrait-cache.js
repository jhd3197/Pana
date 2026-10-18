// Small, versioned stills keyed by the entire normalized wardrobe. No Three.js.
import { normalizeAvatar } from './avatar.js';
const PREFIX = 'pana:portrait:v1:';
export const portraitKey = avatar => JSON.stringify(normalizeAvatar(avatar));
export function cachedPortrait(avatar) {
  try { return localStorage.getItem(PREFIX + portraitKey(avatar)); } catch { return null; }
}
export function savePortrait(avatar, image, current = false) {
  if (!/^data:image\/(?:webp|png);base64,/.test(image) || image.length > 65536) return;
  try {
    const key = portraitKey(avatar);
    const entries = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
    while (entries.length >= 24) localStorage.removeItem(entries.shift());
    localStorage.setItem(PREFIX + key, image);
    if (current) {
      localStorage.setItem('pana:portrait-current', JSON.stringify({ avatar: key, image }));
      window.dispatchEvent(new CustomEvent('pana:portrait', { detail: { avatar: key, image } }));
    }
  } catch { /* Quota/private browsing: the image still works for this page. */ }
}
