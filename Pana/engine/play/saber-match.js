// Looking things up in El Saber (engine/play/saber.js): normalize answers, match
// them with forgiving spelling (accents, b/v, s/z/c, ll/y, a silent h, one or
// two typos) and pick words for bots. Pure: no DOM, shared by rules files and
// Node tests (engine/tests/saber.test.js).
import { SABER, SABER_CATEGORIES, CRUDE_WORDS } from './saber.js';

const MARKS = /[̀-ͯ]/g;

// Lowercase, no accents (ñ stays ñ), punctuation to spaces, single spaces.
export function normalize(text) {
  return String(text ?? '').toLowerCase().replace(/ñ/g, '\u0001').normalize('NFD').replace(MARKS, '')
    .replace(/\u0001/g, 'ñ').replace(/['’`´]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').trim();
}

// The first letter as the libreta sees it: "Ávila" → "A", "Ñame" → "Ñ".
export const letterOf = (text) => normalize(text).charAt(0).toUpperCase();

// How a word sounds when a Venezuelan writes it fast: Barinas = Varinas,
// Cereza = Zeresa, Hormiga = Ormiga, Yuca = Lluca. Spaces never matter.
export function soundKey(text) {
  return normalize(text).replace(/ñ/g, 'n').replace(/\s+/g, '')
    .replace(/ch/g, '%').replace(/h/g, '').replace(/%/g, 'ch')
    .replace(/qu/g, 'k').replace(/c(?=[ei])/g, 's').replace(/z/g, 's').replace(/c(?!h)/g, 'k')
    .replace(/g(?=[ei])/g, 'j').replace(/gu(?=[ei])/g, 'g')
    .replace(/v/g, 'b').replace(/w/g, 'u').replace(/ll/g, 'y').replace(/y(?![aeiou])/g, 'i').replace(/x/g, 'ks')
    .replace(/(.)\1+/g, '$1');
}

// Edit distance with swaps (optimal string alignment); stops past `max`.
export function distance(a, b, max = Infinity) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      row.push(v); best = Math.min(best, v);
    }
    if (best > max) return max + 1;
    prev2 = prev; prev = row;
  }
  return prev[b.length];
}

// How many typos a word of this sound length may carry and still match.
export const tolerance = (key) => key.length <= 3 ? 0 : key.length < 8 ? 1 : 2;

const formsOf = (entry) => [entry.word, ...(entry.variants || [])].map(text => ({ text, norm: normalize(text), key: soundKey(text) }));
const byCategory = new Map();
function indexOf(category) {
  if (!byCategory.has(category)) byCategory.set(category, SABER.filter(e => e.category === category).map(entry => ({ entry, forms: formsOf(entry) })));
  return byCategory.get(category);
}

// The entry an answer means in a category, or null. `extra` adds words a
// table accepted this session ({ category, word, explain? }). `how` says how
// it matched: 'exact', 'sound' (same sound, other spelling), 'typo' or
// 'phrase' (the start of a long dicho). `form` is the spelling it matched.
// `base: false` searches only `extra`.
export function findEntry(category, text, { extra = [], base = true } = {}) {
  const norm = normalize(text), key = soundKey(text);
  if (!key) return null;
  const local = extra.filter(e => e.category === category).map(e => ({
    entry: { category, word: e.word, variants: [], explain: e.explain || 'La aceptó esta mesa', source: 'mesa', crude: false, doubtful: false, joke: null },
    forms: formsOf({ word: e.word }) }));
  const list = base ? [...indexOf(category), ...local] : local;
  for (const pass of ['exact', 'sound']) for (const { entry, forms } of list) for (const f of forms) {
    if (pass === 'exact' ? f.norm === norm : f.key === key) return { entry, form: f.text, how: pass, distance: 0 };
  }
  const limit = tolerance(key); let best = null;
  if (limit) for (const { entry, forms } of list) for (const f of forms) {
    if (tolerance(f.key) === 0) continue;
    const d = distance(key, f.key, limit);
    if (d <= limit && (!best || d < best.distance)) best = { entry, form: f.text, how: 'typo', distance: d };
  }
  if (best) return best;
  // A long dicho counts from its first three words ("Camarón que se duerme").
  const words = norm.split(' ').length;
  if (words >= 3 && key.length >= 10) for (const { entry, forms } of list) for (const f of forms) {
    if (f.norm.split(' ').length >= 4 && f.key.startsWith(key)) return { entry, form: f.text, how: 'phrase', distance: 0 };
  }
  return null;
}

// Crude words compare spelled out (ñ counts, so "cono" is just a cone);
// crude entries compare by sound, like any other answer.
const crudeWords = new Set(CRUDE_WORDS.map(normalize));
const crudeKeys = new Set(SABER.filter(e => e.crude).flatMap(e => formsOf(e).map(f => f.key)));
// True for a crude answer: a crude word anywhere in it, or a crude entry.
export function isCrude(text) {
  const norm = normalize(text);
  if (!norm) return false;
  const words = norm.split(' ');
  return crudeKeys.has(soundKey(norm)) || crudeWords.has(words.join('')) || words.some(word => crudeWords.has(word));
}

// Words a bot could write for a category and letter: [{ entry, form }],
// form being the spelling that starts with the letter (a pelotero by
// surname or first name). Crude and doubtful entries only when asked.
export function wordsFor(category, letter, { crude = false, doubtful = false } = {}) {
  const out = [];
  for (const { entry, forms } of indexOf(category)) {
    if ((entry.crude && !crude) || (entry.doubtful !== doubtful)) continue;
    const form = forms.find(f => f.norm.charAt(0).toUpperCase() === letter);
    if (form) out.push({ entry, form: form.text });
  }
  return out;
}

export const categoryLabel = (id) => SABER_CATEGORIES[id]?.label || id;
export const categoryShort = (id) => SABER_CATEGORIES[id]?.short || categoryLabel(id);
export { SABER, SABER_CATEGORIES };
