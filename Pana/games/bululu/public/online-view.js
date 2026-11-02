// Small, typed presentation snapshots. Never accept HTML from another browser.
// Text travels as its Spanish source, never as words on the host's screen:
// a string, or [source, vars], shown by line() in each pana's own language.
import { loc, locKey } from '/engine/i18n.js';
const $ = id => document.getElementById(id);
const visible = id => !$(id).classList.contains('hidden');
const make = (tag, text) => { const node = document.createElement(tag); node.textContent = text; return node; };
export const line = l => l == null ? '' : Array.isArray(l) ? loc(l[0], l[1]) : loc(String(l));
export function setLine(el, l) { el.line = l; el.textContent = line(l); }
export function setLines(el, lines, tags) { el.lines = lines; el.replaceChildren(...lines.map((l, i) => make(tags[i] || 'span', line(l)))); }
export function readPresentation() {
  return {
    plank: $('plank').line ?? locKey('¡A JUGAR!'), sign: $('sign').line ?? '', count: $('count').line ?? '',
    toast: visible('toast') ? $('toast').lines : null,
    miniIntro: visible('mini-intro') ? { title: $('mini-title').line, goal: $('mini-goal').line } : null,
    winner: visible('winner') ? $('winner').lines : null,
    results: visible('results'),
  };
}
export function writePresentation(state) {
  for (const id of ['plank', 'sign', 'count']) setLine($(id), state[id]);
  $('sign').classList.toggle('hidden', !state.sign);
  for (const [id, values, tags] of [['toast', state.toast, ['b', 'span']], ['winner', state.winner, ['small', 'b', 'em']]]) {
    $(id).classList.toggle('hidden', !values);
    if (values) setLines($(id), values, tags);
  }
  $('mini-intro').classList.toggle('hidden', !state.miniIntro);
  if (state.miniIntro) {
    setLine($('mini-title'), state.miniIntro.title);
    setLine($('mini-goal'), state.miniIntro.goal);
  }
}
