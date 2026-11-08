// The free-for-all's setup screen: the three maps (the host switches), the
// capis this pana places (pick one, then tap the map), what went wrong, and
// the host's start. Draws a setup view (online.js setupView) and reports taps;
// game.js decides what they do.
import { loc } from '/engine/i18n.js';

export const SETUP_ERRORS = {
  'out-of-bounds': () => loc('Fuera del mapa'), unsafe: () => loc('Ahí no se puede parar'), overlap: () => loc('Muy cerca de otro capi'),
  unreachable: () => loc('Desde ahí no se llega'), stale: () => loc('El mapa cambió'), locked: () => loc('La partida ya empezó'),
  'not-owner': () => loc('Ese capi no es tuyo'), 'not-host': () => loc('Solo el anfitrión cambia el mapa'),
};
export const setupError = reason => SETUP_ERRORS[reason]?.() || loc('No se pudo');

export function createSetupView($, { pick, select, go, back }) {
  const maps = $('setup-maps'), capis = $('setup-capis');
  let shown = '';
  maps.onclick = e => { const b = e.target.closest('[data-map]'); if (b && !b.disabled) pick(Number(b.dataset.map)); };
  capis.onclick = e => { const b = e.target.closest('[data-capi]'); if (b) select(Number(b.dataset.capi)); };
  $('setup-go').onclick = go; $('setup-back').onclick = back;
  return {
    // view: { seeds, pick, places, mine: [capi], selected, host, names: [name] }
    render(v) {
      const key = JSON.stringify([v.seeds, v.pick, v.places, v.mine, v.selected, v.host]);
      if (key === shown) return; shown = key;
      maps.replaceChildren(...v.seeds.map((seed, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'pk-btn pk-btn--ghost setup-map'; b.dataset.map = i; b.disabled = !v.host;
        b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(i === v.pick));
        b.textContent = loc('Mapa {n}', { n: i + 1 }); b.title = `#${seed}`;
        return b;
      }));
      capis.replaceChildren(...v.mine.map(capi => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'pk-btn pk-btn--ghost setup-capi'; b.dataset.capi = capi;
        b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(capi === v.selected));
        b.dataset.placed = String(Object.hasOwn(v.places, capi));
        b.textContent = v.names[capi] || ''; b.translate = false;
        return b;
      }));
      $('setup-note').textContent = !v.mine.length ? loc('Mira el mapa') : Object.hasOwn(v.places, v.selected) ? loc('Listo. Puedes moverlo') : loc('Elige su lugar en el mapa');
      $('setup-go').disabled = !v.host;
      $('setup-go').textContent = v.host ? loc('¡A pintar!') : loc('Espera al anfitrión');
    },
    reset() { shown = ''; },
  };
}
