// Artwork is optional: a missing image must never block a race or its controls.
const ROOT = './images/menu/';
export const trackArt = (id, thumb = false) => `${ROOT}${id}${thumb ? '-thumb' : ''}.webp`;

export function setMenuImage(img, src) {
  if (img.getAttribute('src') === src) return;
  img.style.visibility = '';
  img.onerror = () => { img.style.visibility = 'hidden'; };
  img.onload = () => { img.style.visibility = ''; };
  img.src = src;
}
