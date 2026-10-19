// Small, versioned stills keyed by the entire normalized wardrobe. No Three.js.
import { normalizeAvatar } from './avatar.js';
const PREFIX = 'pana:portrait:v1:', ORDER = 'pana:portrait-order:v1', LIMIT = 24;
export const portraitKey = avatar => JSON.stringify(normalizeAvatar(avatar));
// Most recently used last, so the cache forgets the panas you haven't seen in a while.
function touch(key) {
  let list = null;
  try { list = JSON.parse(localStorage.getItem(ORDER)); } catch { /* fresh order */ }
  // Portraits saved before the order existed join it oldest-first.
  if (!Array.isArray(list)) list = Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).map(k => k.slice(PREFIX.length));
  list = list.filter(k => k !== key); list.push(key);
  return list;
}
export function cachedPortrait(avatar) {
  try {
    const key = portraitKey(avatar), image = localStorage.getItem(PREFIX + key);
    if (image) localStorage.setItem(ORDER, JSON.stringify(touch(key)));
    return image;
  } catch { return null; }
}
export function savePortrait(avatar, image, current = false) {
  if (!/^data:image\/(?:webp|png);base64,/.test(image) || image.length > 65536) return;
  try {
    const key = portraitKey(avatar), list = touch(key);
    while (list.length > LIMIT) localStorage.removeItem(PREFIX + list.shift());
    localStorage.setItem(ORDER, JSON.stringify(list));
    localStorage.setItem(PREFIX + key, image);
    if (current) {
      localStorage.setItem('pana:portrait-current', JSON.stringify({ avatar: key, image }));
      window.dispatchEvent(new CustomEvent('pana:portrait', { detail: { avatar: key, image } }));
    }
  } catch { /* Quota/private browsing: the image still works for this page. */ }
}
