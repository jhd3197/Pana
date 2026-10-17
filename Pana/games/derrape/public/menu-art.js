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

export function createFestivalArt(root) {
  const master = document.createElement('img');
  master.className = 'festival-master';
  master.alt = '';
  master.fetchPriority = 'high';
  setMenuImage(master, `${ROOT}raceMaster.webp`);
  root.append(master);
  const motion = matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)');
  let layers = [], requested = false, complete = false, visible = false;
  function sync() {
    root.classList.toggle('is-layered', visible && motion.matches && complete);
    if (!visible || !motion.matches || requested) return;
    requested = true;
    layers = ['raceBackground', 'raceActors', 'raceAtmosphere', 'raceForeground'].map((id, i) => {
      const img = new Image();
      img.alt = ''; img.className = 'festival-layer'; img.style.setProperty('--depth', [3, 8, 12, 16][i]);
      img.src = `${ROOT}${id}.webp`;
      return img;
    });
    Promise.all(layers.map(img => img.decode())).then(() => {
      root.append(...layers); complete = true; sync();
    }).catch(() => { /* The complete illustration remains the fallback. */ });
  }
  function reset() { root.style.setProperty('--mx', 0); root.style.setProperty('--my', 0); }
  root.parentElement.addEventListener('pointermove', event => {
    if (!visible || !motion.matches || event.pointerType !== 'mouse') return;
    root.style.setProperty('--mx', (event.clientX / innerWidth - .5).toFixed(3));
    root.style.setProperty('--my', (event.clientY / innerHeight - .5).toFixed(3));
  }, { passive: true });
  root.parentElement.addEventListener('pointerleave', reset);
  motion.addEventListener('change', () => { reset(); sync(); });
  return { show(on) { visible = on; root.hidden = !on; reset(); sync(); } };
}
