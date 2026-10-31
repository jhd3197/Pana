// i18n-ignore-file: language names are written in their own language.
// Languages. Spanish is the source: the Spanish text itself is the key, so
// loc('Seguir jugando') needs no id and the same phrase in any game or engine
// file shares one translation. Other languages are flat dictionaries,
// engine/locales/<lang>.json (engine, hub, game.json texts and phrases two
// games share) and games/<id>/public/locales/<lang>.json (the rest of a game).
// See docs/knowledge/pana-i18n.md.
//
//   loc('Seguir jugando')                          → 'Keep playing'
//   loc('Panas en la sala · {n} / {max}', { n, max })
//   locn(count, '{n} ficha', '{n} fichas')          → plural by the language's rules
//   loc('Mando', { $ctx: 'gamepad' })              → key 'gamepad::Mando' when one
//                                                  Spanish word needs two translations
//
// In any language but Spanish, text already in the page and text the code
// writes later is translated when it matches a key exactly (an observer), so
// static markup needs nothing. Text with variables, text drawn on a canvas and
// text compared in code go through loc(). `translate="no"` (player names, chat)
// is left alone. The language loads before any module that imports this one
// runs (top-level await); a change applies on the next load.
// The names are loc/locn/locKey, not t(): games use `t` for time everywhere.

export const LANGUAGES = Object.freeze([
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
]);
export const SOURCE = 'es';
const CODES = LANGUAGES.map(l => l.code);
const SETTINGS_KEY = 'pana:settings';

// '-'/'_' variants and regions reduce to a supported code: 'en-GB' → 'en'.
export function matchLanguage(tag) {
  const base = String(tag || '').toLowerCase().split(/[-_]/)[0];
  return CODES.includes(base) ? base : null;
}

// Address (?pana-language=en) → saved choice → the browser's languages →
// Spanish. Automated browsers report en-US whatever the suite expects, so with
// 'auto' they stay in Spanish unless the address names a language.
export function resolveLanguage({ url, saved, browser = [], automated = false } = {}) {
  return matchLanguage(url) || matchLanguage(saved)
    || (automated ? null : browser.map(matchLanguage).find(Boolean)) || SOURCE;
}

function detect() {
  if (typeof location === 'undefined' || typeof navigator === 'undefined') return SOURCE;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')?.language; } catch { /* Storage blocked: follow the browser. */ }
  return resolveLanguage({
    url: new URLSearchParams(location.search).get('pana-language'),
    saved: saved === 'auto' ? null : saved,
    browser: navigator.languages?.length ? navigator.languages : [navigator.language],
    automated: navigator.webdriver === true,
  });
}

export const language = detect();
let dictionary = new Map();
let plural = null;

const normalize = text => text.replace(/\s+/g, ' ').trim();
const keyOf = (source, ctx) => ctx ? `${ctx}::${source}` : source;
function fill(text, vars) {
  return vars ? text.replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match) : text;
}

// Marks Spanish text that is translated where it is shown, not where it is
// made: rules and hosts put it in room state, and each client passes what it
// receives through loc() in its own language. Returns the text unchanged.
//   rules:  return { text: locKey('Mantén E para abrir'), … }
//   scene:  label.textContent = loc(view.text, view.vars)
export const locKey = source => source;

// The translation of `source`, or `source` itself when there is none.
export function loc(source, vars) {
  const found = language === SOURCE ? null : dictionary.get(keyOf(source, vars?.$ctx));
  const text = typeof found === 'string' ? found : found?.other ?? source;
  return fill(text, vars);
}

// Picks the form for `n` ({n} is filled in). Spanish passes its two forms;
// a translation may hold every form its language has ({ one, few, other }).
export function locn(n, one, other, vars) {
  const all = { n, ...vars };
  if (language === SOURCE) return fill(n === 1 ? one : other, all);
  const found = dictionary.get(keyOf(one, vars?.$ctx));
  if (found == null) return fill(n === 1 ? one : other, all);
  if (typeof found === 'string') return fill(found, all);
  plural ??= new Intl.PluralRules(language);
  return fill(found[plural.select(n)] || found.other || found.one, all);
}

// Numbers and lists in the player's language.
const formatters = new Map();
const cached = (kind, options, make) => {
  const id = `${kind}:${JSON.stringify(options)}`;
  if (!formatters.has(id)) formatters.set(id, make());
  return formatters.get(id);
};
export const locale = language === SOURCE ? 'es-VE' : language;
export const formatNumber = (n, options = {}) => cached('n', options, () => new Intl.NumberFormat(locale, options)).format(n);
export const formatList = (items, options = {}) => cached('l', options, () => new Intl.ListFormat(locale, options)).format(items);

// ---------- loading ----------
async function readDictionary(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return {};
    return await response.json();
  } catch { return {}; }
}

// ---------- the page ----------
const ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt', 'aria-description', 'data-tip'];
const SKIP = 'script, style, code, pre, textarea, [translate="no"]';
const done = new WeakMap();   // text node → the translation it was given

function translateText(node) {
  const value = node.nodeValue;
  if (done.get(node) === value || !value.trim()) return;
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP)) return;
  const found = dictionary.get(normalize(value));
  if (typeof found !== 'string' && typeof found?.other !== 'string') return;
  const text = typeof found === 'string' ? found : found.other;
  // Keep the spaces around the words: markup relies on them between inline tags.
  const next = value.match(/^\s*/)[0] + text + value.match(/\s*$/)[0];
  done.set(node, next);
  if (next !== value) node.nodeValue = next;
}
function translateAttributes(element) {
  for (const name of ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (!value) continue;
    const found = dictionary.get(normalize(value));
    if (typeof found === 'string' && found !== value && !element.closest(SKIP)) element.setAttribute(name, found);
  }
}
export function translateTree(root) {
  if (language === SOURCE || !root) return;
  if (root.nodeType === Node.TEXT_NODE) { translateText(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) translateText(node); else translateAttributes(node);
  }
}

function watchDocument() {
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') translateText(record.target);
      else if (record.type === 'attributes') translateAttributes(record.target);
      else for (const node of record.addedNodes) translateTree(node);
    }
  });
  const start = () => {
    translateTree(document.head.querySelector('title'));
    translateTree(document.body);
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
    document.documentElement.classList.remove('pana-i18n-wait');
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
}

// Last, so everything above exists when the page is first translated.
if (language !== SOURCE) {
  // A game page is /g/<id>/…; its own phrases sit next to its index.html.
  const game = location.pathname.match(/^((?:\/_v\/[^/]+)?\/g\/[^/]+\/)/)?.[1];
  const [shared, own] = await Promise.all([
    readDictionary(new URL(`./locales/${language}.json`, import.meta.url)),
    game ? readDictionary(`${game}locales/${language}.json`) : {},
  ]);
  // A game's entry for a shared phrase overrides it in that game only.
  for (const [key, value] of Object.entries({ ...shared, ...own })) {
    // Untranslated entries ("" or empty plural forms) fall back to Spanish.
    if (typeof value === 'string' ? value : value?.other) dictionary.set(key, value);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
    watchDocument();
  }
}
