// Small inline SVG icons for HUDs and buttons. Phones turn many symbol
// characters (👑 ⚙ ♥ ↗) into colour emoji, so the interface draws these
// instead (tests/conventions.test.js keeps emoji out). Each icon is 1em
// square and sits on the text baseline; use as innerHTML or via icon(name).

const svg = (body, label = '') =>
  `<svg class="pk-ico" viewBox="0 0 40 40" width="1em" height="1em"${label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"'}>${body}</svg>`;
const INK = '#16161a';

export const ICONS = {
  mango: svg(`<path d="M8 24c0-10 9-17 18-15 6 1 8 7 7 13-2 9-11 13-18 11-4-1-7-4-7-9z" fill="#ffc629" stroke="#9a6400" stroke-width="3"/><path d="M27 9c1-3 4-5 7-5-1 3-3 5-7 5z" fill="#3a9d3a"/><path d="M14 17c2-3 5-4 8-4" stroke="#fff3b0" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  juice: svg(`<path d="M11 13h18l-2 22H13z" fill="#ffae2b" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M11 13l4-6h10l4 6" fill="#fff3b0" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M24 7l3-5" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/><path d="M14 22h12" stroke="#7cc242" stroke-width="3"/>`),
  coin: svg(`<circle cx="20" cy="20" r="14" fill="#ffc629" stroke="#9a6400" stroke-width="3"/><circle cx="20" cy="20" r="8" fill="none" stroke="#ffe58a" stroke-width="2.5"/><path d="M15 15c2-2 4-3 6-3" stroke="#fff3b0" stroke-width="2.5" fill="none" stroke-linecap="round"/>`),
  crate: svg(`<rect x="6" y="8" width="28" height="26" rx="2" fill="#bf8348" stroke="${INK}" stroke-width="2.5"/><path d="M6 17h28M6 25h28M10 9l20 24" stroke="${INK}" stroke-width="2.2"/>`),
  back: svg(`<path d="M30 30c0-9-6-14-15-14h-5" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M30 30c0-9-6-14-15-14h-5" fill="none" stroke="#2ad1b2" stroke-width="3.5" stroke-linecap="round"/><path d="M13 7L4 16l9 9z" fill="#2ad1b2" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`),
  crown: svg(`<path d="M5 30l2-18 8 8 5-12 5 12 8-8 2 18z" fill="#ffc629" stroke="#9a6400" stroke-width="3" stroke-linejoin="round"/><circle cx="20" cy="25" r="2.5" fill="#ff4b4b"/>`, 'Corona'),
  gear: svg(`<path d="M17 3h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2z" fill="currentColor"/><circle cx="20" cy="20" r="6" fill="var(--pk-night, #0e0b24)"/>`),
  share: svg(`<path d="M14 8h18v18" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 9L9 31" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>`),
  heart: svg(`<path d="M20 34S5 25 5 14c0-5 4-8 8-8 3 0 6 2 7 5 1-3 4-5 7-5 4 0 8 3 8 8 0 11-15 20-15 20z" fill="#ff4b4b" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`),
  heartEmpty: svg(`<path d="M20 34S5 25 5 14c0-5 4-8 8-8 3 0 6 2 7 5 1-3 4-5 7-5 4 0 8 3 8 8 0 11-15 20-15 20z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" opacity=".5"/>`),
};

// An icon as an element, for code that builds DOM nodes.
export function icon(name) {
  const template = document.createElement('template');
  template.innerHTML = ICONS[name];
  return template.content.firstChild;
}
