// Small inline SVG icons for HUDs and buttons. Phones turn many symbol
// characters (👑 ⚙ ♥ ↗) into colour emoji, so the interface draws these
// instead (tests/conventions.test.js keeps emoji out). Each icon is 1em
// square and sits on the text baseline; use as innerHTML or via icon(name).

const svg = (body, label = '') =>
  `<svg class="pk-ico" viewBox="0 0 40 40" width="1em" height="1em"${label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"'}>${body}</svg>`;
const INK = '#16161a';

export const ICONS = {
  close: svg('<path d="m10 10 20 20M30 10 10 30" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>'),
  chevronLeft: svg('<path d="m24 10-8 10 8 10" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'),
  plus: svg('<path d="M20 9v22M9 20h22" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>'),
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
  heartEmpty: svg(`<path d="M20 34S5 25 5 14c0-5 4-8 8-8 3 0 6 2 7 5 1-3 4-5 7-5 4 0 8 3 8 8 0 11-15 20-15 20z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" opacity=".5"/>`),
};

// An icon as an element, for code that builds DOM nodes.
export function icon(name) {
  const template = document.createElement('template');
  template.innerHTML = ICONS[name];
  return template.content.firstChild;
}
