// Small inline SVG icons for HUDs and buttons. Phones turn many symbol
// characters (👑 ⚙ ♥ ↗) into colour emoji, so the interface draws these
// instead (tests/conventions.test.js keeps emoji out). Each icon is 1em
// square and sits on the text baseline; use as innerHTML or via icon(name).
import { loc } from './i18n.js';

const svg = (body, label = '') =>
  `<svg class="pk-ico" viewBox="0 0 40 40" width="1em" height="1em"${label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"'}>${body}</svg>`;
const INK = '#16161a';

export const ICONS = {
  kitBarrel: svg('<path d="M4 16h26v8H4z M30 14h6v12h-6z" fill="currentColor"/>'),
  kitHopper: svg('<path d="M7 27C7 9 33 9 33 27z M16 27h8v7h-8z" fill="currentColor"/>'),
  // A marker's stock in profile, and a sight on its rail (Pepazo's Culata and Mira).
  kitStock: svg('<path d="M4 13h18l12 9v7H23l-7-8H4z" fill="currentColor"/>'),
  kitOptic: svg('<path d="M6 13h28v10H6z M12 23h4v6h-4z M24 23h4v6h-4z" fill="currentColor"/><circle cx="20" cy="18" r="3" fill="#16161a"/>'),
  kitVest: svg('<path d="M12 6l4 4h8l4-4 6 6-3 6v16H9V18l-3-6z" fill="currentColor"/>'),
  kitGrenade: svg('<circle cx="20" cy="23" r="12" fill="currentColor"/><path d="M16 8h8v5h-8z" fill="currentColor"/>'),
  kitMotor: svg('<rect x="8" y="14" width="22" height="16" rx="2" fill="currentColor"/><rect x="12" y="8" width="9" height="6" fill="currentColor"/><path d="M30 18h4v8h-4M8 19H4v6h4" fill="none" stroke="currentColor" stroke-width="2.5"/>'),
  kitWheel: svg('<circle cx="20" cy="20" r="15" fill="#2b2b33" stroke="#16161a" stroke-width="2.5"/><circle cx="20" cy="20" r="6" fill="#d9d4c7" stroke="#16161a" stroke-width="2.5"/>'),
  kitSpoiler: svg('<path d="M4 12h32l-3 6H7z" fill="currentColor"/><path d="M12 18v12M28 18v12" fill="none" stroke="currentColor" stroke-width="3"/>'),
  kitPaint: svg('<path d="M20 5C14 15 10 20 10 25a10 10 0 0 0 20 0c0-5-4-10-10-20z" fill="currentColor" stroke="#16161a" stroke-width="2.5"/>'),
  kitHorn: svg('<path d="M6 16h8l16-8v24l-16-8H6z" fill="currentColor" stroke="#16161a" stroke-width="2.5"/>'),
  kitHull: svg('<path d="M4 16h32l-6 14H10z" fill="currentColor" stroke="#16161a" stroke-width="2.5"/>'),
  kitProp: svg('<path d="M20 20L14 6a6 6 0 0 1 12 0zM20 20l14 6a6 6 0 0 1-6 10zM20 20L6 30a6 6 0 0 1-2-12z" fill="currentColor" stroke="#16161a" stroke-width="2.5"/><circle cx="20" cy="20" r="3" fill="#16161a"/>'),
  kitWing: svg('<path d="M4 18h26l6 6H8z" fill="currentColor" stroke="#16161a" stroke-width="2.5"/>'),
  'wardrobe-pelaje': svg("<path d=\"M12 20c-3 0-5 3-5 6 0 4 3 6 6 5 2-.5 3-1 7-1s5 .5 7 1c3 1 6-1 6-5 0-3-2-6-5-6-4 0-4-4-8-4s-4 4-8 4z\"/><circle cx=\"9\" cy=\"11\" r=\"3\"/><circle cx=\"16\" cy=\"7\" r=\"3\"/><circle cx=\"24\" cy=\"7\" r=\"3\"/><circle cx=\"31\" cy=\"11\" r=\"3\"/>"),
  'wardrobe-cara': svg("<circle cx=\"20\" cy=\"20\" r=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.4\"/><circle cx=\"14.5\" cy=\"17\" r=\"2.4\"/><circle cx=\"25.5\" cy=\"17\" r=\"2.4\"/><path d=\"M13 23c3 5 11 5 14 0\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.4\" stroke-linecap=\"round\"/>"),
  'wardrobe-cabeza': svg("<path d=\"M7 25c0-9 6-15 13-15s13 6 13 15z\"/><path d=\"M5 26h30a2 2 0 0 1 0 4H5a2 2 0 0 1 0-4z\"/><circle cx=\"20\" cy=\"8\" r=\"2.6\"/>"),
  'wardrobe-lentes': svg("<circle cx=\"11\" cy=\"22\" r=\"7\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.4\"/><circle cx=\"29\" cy=\"22\" r=\"7\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.4\"/><path d=\"M18 21c1.5-1.5 2.5-1.5 4 0M4 20l-1-6M36 20l1-6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\"/>"),
  'wardrobe-ropa': svg("<path d=\"M14 6l-9 5 3 8 4-2v17h16V17l4 2 3-8-9-5c-1 3-3 5-6 5s-5-2-6-5z\"/>"),
  'wardrobe-cuello': svg("<path d=\"M8 8c0 11 5 17 12 17S32 19 32 8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"round\"/><circle cx=\"20\" cy=\"30\" r=\"6\"/>"),
  'wardrobe-espalda': svg("<rect x=\"9\" y=\"11\" width=\"22\" height=\"24\" rx=\"6\"/><path d=\"M15 11V9a5 5 0 0 1 10 0v2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\"/><rect x=\"13\" y=\"24\" width=\"14\" height=\"7\" rx=\"2\" fill=\"var(--panel)\"/>"),
  dice: svg('<rect x="5" y="5" width="30" height="30" rx="7" fill="none" stroke="currentColor" stroke-width="3"/><g fill="currentColor"><circle cx="13" cy="13" r="3"/><circle cx="27" cy="27" r="3"/><circle cx="13" cy="27" r="3"/><circle cx="27" cy="13" r="3"/></g>'),
  // A padlock: something not yours yet (Pepazo's locked camos).
  lock: svg('<path d="M13 18v-5a7 7 0 0 1 14 0v5" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><rect x="8" y="18" width="24" height="17" rx="3" fill="currentColor" stroke="#16161a" stroke-width="2.5"/><circle cx="20" cy="26" r="2.5" fill="#16161a"/>'),
  close: svg('<path d="m10 10 20 20M30 10 10 30" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>'),
  chevronLeft: svg('<path d="m24 10-8 10 8 10" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'),
  plus: svg('<path d="M20 9v22M9 20h22" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>'),
  // Ajustes categories (engine/settings-workspace.js).
  mouse: svg('<rect x="11" y="4" width="18" height="32" rx="9" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M20 5v10" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>'),
  gamepad: svg('<path d="M12 11h16a9 9 0 0 1 8.8 10.8l-1.7 8a4.2 4.2 0 0 1-7.3 1.7L24 27h-8l-3.8 4.5a4.2 4.2 0 0 1-7.3-1.7l-1.7-8A9 9 0 0 1 12 11z" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/><path d="M12 16v7M8.5 19.5h7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="26.5" cy="17.5" r="2" fill="currentColor"/><circle cx="30" cy="21.5" r="2" fill="currentColor"/>'),
  touch: svg('<rect x="11" y="3" width="18" height="34" rx="3.5" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="20" cy="31" r="2" fill="currentColor"/>'),
  picture: svg('<rect x="4" y="7" width="32" height="22" rx="1.5" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M9 25l8-8 6 6 3-3 5 5" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M13 35h14" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>'),
  speaker: svg('<path d="M5 15h7l8-7v24l-8-7H5z" fill="currentColor"/><path d="M26 14a8 8 0 0 1 0 12M30 9a14 14 0 0 1 0 22" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>'),
  globe: svg('<circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" stroke-width="3.2"/><path d="M5 20h30M20 5c-5 4-7 9-7 15s2 11 7 15c5-4 7-9 7-15s-2-11-7-15z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>'),
  controller: svg('<rect x="5" y="5" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3.2"/><rect x="22" y="5" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3.2"/><rect x="5" y="22" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3.2"/><rect x="22" y="22" width="13" height="13" fill="currentColor"/>'),
  chevronRight: svg('<path d="m16 10 8 10-8 10" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'),
  mango: svg(`<path d="M8 24c0-10 9-17 18-15 6 1 8 7 7 13-2 9-11 13-18 11-4-1-7-4-7-9z" fill="#ffc629" stroke="#9a6400" stroke-width="3"/><path d="M27 9c1-3 4-5 7-5-1 3-3 5-7 5z" fill="#3a9d3a"/><path d="M14 17c2-3 5-4 8-4" stroke="#fff3b0" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  juice: svg(`<path d="M11 13h18l-2 22H13z" fill="#ffae2b" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M11 13l4-6h10l4 6" fill="#fff3b0" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 7l3-5" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/><path d="M14 22h12" stroke="#7cc242" stroke-width="3"/>`),
  coin: svg(`<circle cx="20" cy="20" r="14" fill="#ffc629" stroke="#9a6400" stroke-width="3"/><circle cx="20" cy="20" r="8" fill="none" stroke="#ffe58a" stroke-width="2.5"/><path d="M15 15c2-2 4-3 6-3" stroke="#fff3b0" stroke-width="2.5" fill="none" stroke-linecap="round"/>`),
  crate: svg(`<rect x="6" y="8" width="28" height="26" rx="2" fill="#bf8348" stroke="${INK}" stroke-width="2.5"/><path d="M6 17h28M6 25h28M10 9l20 24" stroke="${INK}" stroke-width="2.2"/>`),
  back: svg(`<path d="M30 30c0-9-6-14-15-14h-5" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M30 30c0-9-6-14-15-14h-5" fill="none" stroke="#2ad1b2" stroke-width="3.5" stroke-linecap="round"/><path d="M13 7L4 16l9 9z" fill="#2ad1b2" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`),
  crown: svg(`<path d="M5 30l2-18 8 8 5-12 5 12 8-8 2 18z" fill="#ffc629" stroke="#9a6400" stroke-width="3" stroke-linejoin="round"/><circle cx="20" cy="25" r="2.5" fill="#ff4b4b"/>`, 'Corona'),
  card: svg(`<rect x="9" y="4" width="22" height="32" rx="3" fill="#fbf2df" stroke="${INK}" stroke-width="2.5"/><circle cx="20" cy="20" r="6.5" fill="#ffc629" stroke="#9a6400" stroke-width="2.5"/>`),
  relic: svg(`<path d="M20 3l3 7 7-3-3 7 7 3-7 3 3 7-7-3-3 7-3-7-7 3 3-7-7-3 7-3-3-7 7 3z" fill="#e6b65d" stroke="#8a6222" stroke-width="2.2" stroke-linejoin="round"/><path d="M20 13l6 7-6 7-6-7z" fill="#76e5c8" stroke="${INK}" stroke-width="2"/>`),
  bull: svg(`<path d="M5 9c2 5 6 6 9 5M35 9c-2 5-6 6-9 5" fill="none" stroke="#dac9a3" stroke-width="3.5" stroke-linecap="round"/><path d="M11 15c0-3 4-5 9-5s9 2 9 5l-2 13c-1 5-4 8-7 8s-6-3-7-8z" fill="#a57850" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><ellipse cx="20" cy="30" rx="5.5" ry="4" fill="#9f7566" stroke="${INK}" stroke-width="2"/><circle cx="15.5" cy="19" r="1.8" fill="${INK}"/><circle cx="24.5" cy="19" r="1.8" fill="${INK}"/>`),
  car: svg(`<path d="M6 25v-6l4-8h17l6 8h2v6z" fill="#ff4b4b" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 13h6v6h-9zM21 13h5l4 6h-9z" fill="#bfe6ff" stroke="${INK}" stroke-width="2"/><circle cx="12" cy="27" r="4.5" fill="#2b2b33" stroke="${INK}" stroke-width="2"/><circle cx="28" cy="27" r="4.5" fill="#2b2b33" stroke="${INK}" stroke-width="2"/>`),
  mummy: svg(`<path d="M9 19c0-8 5-14 11-14s11 6 11 14v7c0 6-5 10-11 10S9 32 9 26z" fill="#e6d6ae" stroke="${INK}" stroke-width="2.5"/><path d="M9.5 13.5l21 4M9 25l22-3M10 31l20 1.5" stroke="#9c8d6f" stroke-width="2.5" fill="none"/><rect x="12" y="16" width="16" height="5" rx="2" fill="#263a35"/><circle cx="16" cy="18.5" r="1.8" fill="#70e2bd"/><circle cx="24" cy="18.5" r="1.8" fill="#70e2bd"/>`),
  canoe: svg(`<path d="M3 22c6 5 28 5 34 0l-3 6c-6 3-22 3-28 0z" fill="#b07a45" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M27 5l-9 22" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M16 26l-3 7 6-3z" fill="#2ad1b2" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M4 34c4-2 8 2 12 0s8 2 12 0 6 2 9 0" fill="none" stroke="#5fc3e4" stroke-width="2.5" stroke-linecap="round"/>`),
  iguana: svg(`<path d="M13 24c-6 0-10 3-10 7s4 5 6 3" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M13 24c-6 0-10 3-10 7s4 5 6 3" fill="none" stroke="#4f9a35" stroke-width="3" stroke-linecap="round" stroke-dasharray="3 2.4"/><path d="M15 25l-3 6M25 26l3 5" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M11 23c1-5 7-8 14-7 3 0 5 1 6 3l-1 5c-3 2-12 3-17 2-2 0-3-1-2-3z" fill="#5fae3c" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M14 18l1-3 2 2 1-3.5 2 2.5 1-3.5 2 2.5 1-3 2 2" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M27 15c3-4 9-4 11 0 1 3-1 5-4 5h-6z" fill="#5fae3c" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M29 20c0 4 2 6 4.5 5 .8-2-.2-4-1.5-5z" fill="#9ccf5e" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="30.5" cy="18" r="1.8" fill="#d6dfb0"/><circle cx="34" cy="15.5" r="1.4" fill="${INK}"/>`),
  whirl: svg(`<circle cx="20" cy="20" r="15" fill="#2f7f9a" stroke="${INK}" stroke-width="2.5"/><path d="M20 20c0-3 4-4 6-2s1 7-4 8-10-3-9-8 6-9 11-8 9 5 9 9" fill="none" stroke="#dff6ff" stroke-width="2.8" stroke-linecap="round"/><circle cx="20" cy="20" r="2.2" fill="${INK}"/>`),
  gear: svg(`<path d="M17 3h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2z" fill="currentColor"/><circle cx="20" cy="20" r="6" fill="var(--pk-night, #0e0b24)"/>`),
  share: svg(`<path d="M14 8h18v18" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 9L9 31" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>`),
  heart: svg(`<path d="M20 34S5 25 5 14c0-5 4-8 8-8 3 0 6 2 7 5 1-3 4-5 7-5 4 0 8 3 8 8 0 11-15 20-15 20z" fill="#ff4b4b" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`),
  camera: svg('<circle cx="12" cy="11" r="5.5" fill="currentColor"/><circle cx="24" cy="11" r="5.5" fill="currentColor"/><rect x="5" y="17" width="23" height="15" rx="3.5" fill="currentColor"/><path d="M28 22l8-4.5v14L28 27z" fill="currentColor"/>'),
  thumbUp: svg('<path d="M5 18h6v16H5z" fill="currentColor"/><path d="M13 18l6-12c3 0 5 2 4.4 5.4L22.6 16h9.4c2.4 0 4 2.1 3.4 4.4l-2.7 10.8c-.5 1.8-2 2.8-3.9 2.8H13z" fill="currentColor"/>', loc('A favor')),
  thumbDown: svg('<g transform="rotate(180 20 20)"><path d="M5 18h6v16H5z" fill="currentColor"/><path d="M13 18l6-12c3 0 5 2 4.4 5.4L22.6 16h9.4c2.4 0 4 2.1 3.4 4.4l-2.7 10.8c-.5 1.8-2 2.8-3.9 2.8H13z" fill="currentColor"/></g>', loc('En contra')),
  heartEmpty:svg(`<path d="M20 34S5 25 5 14c0-5 4-8 8-8 3 0 6 2 7 5 1-3 4-5 7-5 4 0 8 3 8 8 0 11-15 20-15 20z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" opacity=".5"/>`),
};

// An icon as an element, for code that builds DOM nodes.
export function icon(name) {
  const template = document.createElement('template');
  template.innerHTML = ICONS[name];
  return template.content.firstChild;
}
