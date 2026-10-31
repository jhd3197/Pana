// Languages: which Spanish phrases the app shows, where their translations
// live, and what is missing. Spanish is the source and the key (engine/i18n.js).
//
//   npm run i18n                        # status: phrases and translations per file
//   npm run i18n -- sync                # place every phrase in its file ("" = to translate)
//   npm run i18n -- sync --game domino  # only that game's file (safe in parallel)
//   npm run i18n -- check               # fails on missing, orphan or mismatched entries
//   npm run i18n -- todo --game domino  # the phrases still to translate, as JSON
//   npm run i18n -- fill <file.json> [--game domino]  # copy translations into the locale file
//   npm run i18n -- wrap <file…>        # wraps clear Spanish literals in loc(); lists the rest
//   npm run i18n -- literals [--game x] [--show]  # Spanish literals not yet in loc()
//
// A phrase lives in engine/locales/<lang>.json when the engine or the hub
// uses it, or when two games do (that is the reuse); otherwise, like the
// game.json description, in games/<id>/public/locales/<lang>.json. A game may
// keep a different translation of a shared phrase in its own file: it wins
// in that game.
import fs from 'node:fs';
import path from 'node:path';

const app = path.resolve(import.meta.dirname, '..');
const rel = file => path.relative(app, file).split(path.sep).join('/');
const read = file => fs.readFileSync(file, 'utf8');
export const TARGETS = ['en'];
export const SHARED = 'shared';
const gamesDir = path.join(app, 'games');
export const games = fs.readdirSync(gamesDir).filter(id => fs.existsSync(path.join(gamesDir, id, 'public', 'index.html')));

function walk(dir, keep, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!['node_modules', 'tests', 'vendor', 'locales'].includes(entry.name)) walk(full, keep, out); }
    else if (keep(entry.name)) out.push(full);
  }
  return out;
}
const code = name => /\.(?:js|mjs|html)$/.test(name) && !/\.(?:test|browser|proof)\.m?js$/.test(name);
// Developer pages (Studio, QA, the character editor) and engine/models, whose
// texts are Studio descriptions and world signage that stays Spanish.
const NOT_PLAYER = /^(?:web\/(?:studio|qa|character|personaje\.html|studio\.html)|engine\/(?:qa|models)\/)/;
export function sources(ns) {
  if (ns === SHARED) return [...walk(path.join(app, 'engine'), code), ...walk(path.join(app, 'web'), code)].filter(f => !NOT_PLAYER.test(rel(f)));
  return [...walk(path.join(gamesDir, ns, 'public'), code), ...walk(path.join(gamesDir, ns, 'server'), code)];
}

// ---------- reading phrases ----------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', middot: '·', laquo: '«', raquo: '»', iexcl: '¡', iquest: '¿' };
const decode = s => s.replace(/&(#x?[\da-f]+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e] ?? m);
const normalize = s => s.replace(/\s+/g, ' ').trim();
// Kept in step with ATTRIBUTES in engine/i18n.js.
const ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt', 'aria-description', 'data-tip'];
const HOLE = '\u0000';
// Text worth translating: has letters, is not a lone key name, has no code holes.
const wordy = s => /\p{L}{2,}/u.test(s) && !s.includes(HOLE) && !/^[\p{Lu}\d]{1,3}$/u.test(s);

export function htmlPhrases(html) {
  const out = [];
  html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|code|pre|textarea)\b[\s\S]*?<\/\1>/gi, '')
    // Left as a tag, so the text either side stays apart as it does in the page.
    .replace(/<(\w+)[^>]*\btranslate=["']no["'][^>]*>[\s\S]*?<\/\1>/gi, '<i>');
  for (const tag of html.match(/<[a-z][^>]*>/gi) || []) {
    for (const name of ATTRIBUTES) {
      const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
      if (m) { const text = normalize(decode(m[1] ?? m[2])); if (wordy(text)) out.push(text); }
    }
  }
  for (const piece of html.split(/<[^>]*>/)) { const text = normalize(decode(piece)); if (wordy(text)) out.push(text); }
  return out;
}

// A JS string literal's value (quotes stripped, escapes read).
function unquote(raw) {
  const q = raw[0], body = raw.slice(1, -1);
  if (q === '`' && body.includes('${')) return null;
  try { return q === '`' ? body.replace(/\\`/g, '`').replace(/\\\\/g, '\\') : JSON.parse(q === '"' ? raw : `"${body.replace(/\\'/g, "'").replace(/"/g, '\\"')}"`); }
  catch { return null; }
}
const STRING = String.raw`'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|\x60(?:\\.|[^\x60\\])*\x60`;
// loc(source), locKey(source), locn(n, one, other): the key is the first string.
const CALL = new RegExp(String.raw`(?<![\w$.])(loc|locn|locKey)\(\s*(?:(?:[^,()'"\x60]|\([^()]*\))+,\s*)?(${STRING})(?:\s*,\s*(${STRING}))?`, 'g');
// The call's own vars object, right after its strings: loc('Mano', { $ctx: 'tambor' }).
const CTX = /^\s*,\s*\{[^{}()]*\$ctx\s*:\s*['"]([\w-]+)['"]/;

// Comments hold examples, not phrases.
const uncomment = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
// Markup a player reads: real elements, not a shader's #include <chunk>.
const MARKUP = /<(?:a|b|br|button|div|em|h[1-6]|i|kbd|label|li|ol|p|small|span|strong|ul|text|title|section|header|footer|article|aside|figure|figcaption|img|option|table|td|th|tr)\b[^>]*>/i;
const codeFragment = s => /\$\{|=>|\)\.\w+\(|^[)}\]]|[{};]\s*$|\b(?:void main|gl_\w+|uniform|varying)\b|#include/.test(s);

export function jsPhrases(src, plurals = new Map()) {
  const out = [];
  src = uncomment(src);
  for (const m of src.matchAll(CALL)) {
    const first = unquote(m[2]);
    if (first == null) continue;
    const ctx = src.slice(m.index + m[0].length, m.index + m[0].length + 200).match(CTX)?.[1];
    const key = ctx ? `${ctx}::${first}` : first;
    out.push(key);
    if (m[1] === 'locn' && m[3]) plurals.set(key, unquote(m[3]));
  }
  // Markup built in code (innerHTML, insertAdjacentHTML): its text is read like a page's.
  for (const m of src.matchAll(new RegExp(STRING, 'g'))) {
    if (!MARKUP.test(m[0]) || codeFragment(m[0].replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, ''))) continue;
    out.push(...htmlPhrases(m[0].slice(1, -1).replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, HOLE)).filter(p => !codeFragment(p)));
  }
  return out;
}

export function phrasesOf(file, plurals) {
  const src = read(file);
  if (!file.endsWith('.html')) return jsPhrases(src, plurals);
  return [...htmlPhrases(src), ...jsPhrases(src.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi)?.join('\n') || '', plurals)];
}

// Every phrase by namespace (shared, or a game id), and the Spanish plural of locn() keys.
export function collect() {
  const byNs = new Map(), plurals = new Map();
  const add = (ns, phrase, file) => {
    if (!byNs.has(ns)) byNs.set(ns, new Map());
    const map = byNs.get(ns); if (!map.has(phrase)) map.set(phrase, new Set()); map.get(phrase).add(rel(file));
  };
  for (const file of sources(SHARED)) for (const p of phrasesOf(file, plurals)) add(SHARED, p, file);
  for (const id of games) {
    const meta = path.join(gamesDir, id, 'game.json'), info = JSON.parse(read(meta));
    // The hub gets it translated from /api/games?lang= (server/src/api.js).
    if (info.description) add(id, normalize(info.description), meta);
    for (const file of sources(id)) for (const p of phrasesOf(file, plurals)) add(id, p, file);
  }
  byNs.plurals = plurals;
  return byNs;
}

// The shared file's phrases: the engine's and hub's, and those two games use.
export function sharedPhrases(byNs) {
  const shared = new Set(byNs.get(SHARED)?.keys() || []), users = new Map();
  for (const id of games) for (const p of byNs.get(id)?.keys() || []) users.set(p, (users.get(p) || 0) + 1);
  for (const [p, n] of users) if (n > 1) shared.add(p);
  return shared;
}

// ---------- locale files ----------
const fileOf = (ns, lang) => ns === SHARED ? path.join(app, 'engine', 'locales', `${lang}.json`) : path.join(gamesDir, ns, 'public', 'locales', `${lang}.json`);
export function load(ns, lang) {
  const file = fileOf(ns, lang);
  return fs.existsSync(file) ? JSON.parse(read(file)) : {};
}
function save(ns, lang, data) {
  const file = fileOf(ns, lang), keys = Object.keys(data).sort((a, b) => a.localeCompare(b, 'es'));
  if (!keys.length) { if (fs.existsSync(file)) fs.rmSync(file); return; }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(Object.fromEntries(keys.map(k => [k, data[k]])), null, 2) + '\n');
}
export const translated = v => typeof v === 'string' ? v !== '' : !!v && typeof v === 'object' && !!v.other;
const holes = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).filter(n => n !== 'n').sort().join(',');
const sourceOf = key => key.replace(/^[\w-]+::/, '');
// What a game's file must hold: its phrases that the shared file does not
// (before a full sync, phrases two games share still sit in each game).
const ownNeeds = (phrases, shared) => [...phrases].filter(p => !(p in shared));

// Rewrites the files to match the phrases in the code. Translations move with
// their phrase (a game's to shared, shared back to a game); a phrase no code
// uses any more is dropped. With `only`, just that game's file changes, so
// games can be worked on in parallel; the full sync promotes shared phrases.
export function sync({ only } = {}) {
  const byNs = collect(), shared = sharedPhrases(byNs), report = [];
  for (const lang of TARGETS) {
    const current = new Map([SHARED, ...games].map(ns => [ns, load(ns, lang)]));
    const known = new Map();   // phrase → its translations anywhere, shared first
    for (const [, data] of current) for (const [k, v] of Object.entries(data)) if (translated(v)) known.set(k, [...(known.get(k) || []), v]);
    const blank = p => byNs.plurals.has(p) ? { one: '', other: '' } : '';
    const pick = (data, p) => translated(data[p]) ? data[p] : known.get(p)?.[0] ?? blank(p);
    let sharedData = current.get(SHARED);
    if (!only) {
      const next = {};
      for (const p of shared) {
        next[p] = pick(sharedData, p);
        if (new Set((known.get(p) || []).map(v => JSON.stringify(v))).size > 1) report.push(`${lang}: "${p}" has different translations; shared keeps ${JSON.stringify(next[p])}`);
      }
      save(SHARED, lang, sharedData = next);
    }
    for (const ns of only ? [only] : games) {
      const data = current.get(ns), mine = byNs.get(ns) || new Map(), next = {};
      for (const p of ownNeeds(mine.keys(), sharedData)) next[p] = pick(data, p);
      // A game's own take on a shared phrase stays, as an override.
      for (const [k, v] of Object.entries(data)) if (mine.has(k) && k in sharedData && translated(v) && JSON.stringify(sharedData[k]) !== JSON.stringify(v)) next[k] = v;
      save(ns, lang, next);
    }
  }
  return report;
}

export function problems({ only } = {}) {
  const byNs = collect(), shared = sharedPhrases(byNs), out = [];
  const check = (file, k, v) => {
    for (const form of typeof v === 'object' ? Object.values(v) : [v]) {
      if (form && holes(form) !== holes(sourceOf(k))) out.push(`${file}: "${k}" has {${holes(form)}}, the Spanish has {${holes(sourceOf(k))}}`);
    }
  };
  for (const lang of TARGETS) {
    const sharedData = load(SHARED, lang);
    if (!only) {
      const file = rel(fileOf(SHARED, lang));
      for (const p of shared) if (!translated(sharedData[p])) out.push(`${file}: missing "${p}"`);
      for (const [k, v] of Object.entries(sharedData)) shared.has(k) ? check(file, k, v) : out.push(`${file}: no code uses "${k}"`);
    }
    for (const ns of only ? [only] : games) {
      const data = load(ns, lang), file = rel(fileOf(ns, lang)), mine = byNs.get(ns) || new Map();
      for (const p of ownNeeds(mine.keys(), sharedData)) if (!translated(data[p])) out.push(`${file}: missing "${p}"`);
      for (const [k, v] of Object.entries(data)) mine.has(k) ? check(file, k, v) : out.push(`${file}: no code uses "${k}"`);
    }
  }
  return out;
}

// ---------- Spanish literals not in loc() ----------
// A literal that is clearly Spanish text: an accent, ¡/¿, or a short sentence
// with a common Spanish word. Capitalised words without accents are listed, not wrapped.
const STOP = /\b(?:de|del|la|las|el|los|un|una|que|en|para|con|por|tu|tus|te|se|no|sin|al|es|y|lo|le|ya|más|mas|cuando|todos|otra|otro|aquí|toca|sala|pana|panas)\b/i;
const SPANISH = /[áéíóúñÁÉÍÓÚÑ¡¿üÜ]/;
const SKIP_BEFORE = /(?:\bimport|\bfrom|console\.\w+\(|Error\(|querySelector(?:All)?\(|getElementById\(|closest\??\.?\(|matches\??\.?\(|addEventListener\(|removeEventListener\(|dispatchEvent\(|new (?:Custom)?Event\(|classList\.\w+\(|setAttribute\('(?!aria-label|title|placeholder|alt)[\w-]+',\s*|dataset\.\w+\s*===?\s*|\b(?:loc|locn|locKey)\(\s*(?:[^,()]+,\s*)?|\.(?:code|key|id|type|name|kind|mode|phase)\s*===?\s*|\.name\s*=\s*(?:[\w.]+\s*\|\|\s*)?|\blocn\([^()]*|\bcase\s+)$/;
// `// i18n-ignore` skips a line, `// i18n-ignore-file: <why>` a whole file
// (content that stays Spanish on purpose: dichos, trivia, narration).
export function literals(src) {
  const sure = [], maybe = [];
  if (/\/\/\s*i18n-ignore-file\b/.test(src)) return { sure, maybe };
  for (const m of src.matchAll(new RegExp(STRING, 'g'))) {
    const raw = m[0], before = src.slice(Math.max(0, m.index - 80), m.index), after = src.slice(m.index + raw.length, m.index + raw.length + 2);
    const lineStart = src.lastIndexOf('\n', m.index) + 1, lineEnd = src.indexOf('\n', m.index), line = src.slice(lineStart, m.index);
    if (/^\s*(?:\/\/|\*)/.test(line) || /\/\/[^'"`]*$/.test(line)) continue;   // inside a comment
    if (/\/\/\s*i18n-ignore\b/.test(src.slice(lineStart, lineEnd < 0 ? undefined : lineEnd))) continue;
    if (SKIP_BEFORE.test(before) || /^\s*:/.test(after) && !/\?[^:]*$/.test(line)) continue;   // object keys, selectors, imports…
    if (/<[a-z][^>]*>/i.test(raw)) continue;   // markup: read as HTML by jsPhrases
    if (/(?:\/\[\^?|\\)$/.test(before)) continue;   // a quote inside a regular expression: /['"]/
    if (/[\w-]=$/.test(before)) continue;   // an attribute value in markup built in code: read as HTML
    const value = raw[0] === '`' ? raw.slice(1, -1) : unquote(raw);
    if (value == null || !/\p{L}{2,}/u.test(value)) continue;
    if (/^[\w./:#@-]+$/.test(value) && !SPANISH.test(value) && !/^\p{Lu}\p{Ll}+$/u.test(value)) continue;   // ids, paths
    if (/^(?:\/|\.\.?\/|https?:|data:|#[\da-f]{3,8}$|[\w-]+\.(?:js|json|css|png|jpg|webp|glb|mp3|ogg)$)/i.test(value)) continue;
    if (/^[a-z]\w*(?:-[\w-]*)+(?:\s+[a-z]\w*(?:-[\w-]*)*)*$/.test(value.trim())) continue;   // class names
    if (/\b(?:void main|gl_\w+|varying|uniform)\b/.test(value)) continue;   // shaders
    if (/\)\.\w+\(|\/[gimsuy]*,\s*$/.test(value)) continue;   // code between two strings (a misread regex)
    if (/^[\w-]+:[\w${}.:-]*$/.test(value)) continue;   // storage keys and event names (pana:settings)
    if (/[,[\]]/.test(value) && /^(?:\s|,|[a-z]+\b|\[[^\]]*\]|[.#:][\w-]+|\([^)]*\)|[>+~*])+$/.test(value)) continue;   // CSS selectors
    const hasHoles = raw[0] === '`' && raw.includes('${');
    const text = value.replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, ' ');
    const clear = SPANISH.test(text) || (/\s/.test(text.trim()) && STOP.test(text) && /\p{Ll}{3,}/u.test(text));
    const at = src.slice(0, m.index).split('\n').length;
    if (clear) sure.push({ at, raw, value, hasHoles, start: m.index, end: m.index + raw.length });
    else if (/^\p{Lu}\p{Ll}{2,}(?: \p{Ll}+)*$/u.test(value)) maybe.push({ at, raw, value });
  }
  return { sure, maybe };
}
export function literalsTotal(files = [...sources(SHARED), ...games.flatMap(sources)]) {
  return files.filter(f => /\.m?js$/.test(f)).reduce((n, f) => n + literals(read(f)).sure.length, 0);
}

// Where a file imports i18n.js from: relative inside engine/ and for code a
// server room loads (rules, server/), the served path elsewhere.
function importPath(r) {
  if (r.startsWith('engine/') || /(?:^|\/)(?:[\w-]*rules|options)\.js$|\/server\//.test(r)) {
    const spec = path.posix.relative(path.posix.dirname(r), 'engine/i18n.js');
    return spec.startsWith('.') ? spec : `./${spec}`;
  }
  return '/engine/i18n.js';
}
// Wraps the clear literals (without ${}) in loc() and adds the import.
function wrapFile(file) {
  let src = read(file);
  const { sure, maybe } = literals(src), plain = sure.filter(s => !s.hasHoles);
  for (const s of [...plain].reverse()) src = src.slice(0, s.start) + `loc(${s.raw})` + src.slice(s.end);
  if (plain.length) {
    const existing = src.match(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]*i18n\.js)['"];?/);
    if (existing) {
      const names = [...new Set([...existing[1].split(',').map(x => x.trim()).filter(Boolean), 'loc'])];
      src = src.replace(existing[0], `import { ${names.join(', ')} } from '${existing[2]}';`);
    } else {
      const last = [...src.matchAll(/^import\b[^;]*;[ \t]*$/gm)].at(-1), line = `import { loc } from '${importPath(rel(file))}';`;
      src = last ? src.slice(0, last.index + last[0].length) + '\n' + line + src.slice(last.index + last[0].length) : `${line}\n${src}`;
    }
  }
  fs.writeFileSync(file, src);
  return { wrapped: plain.length, holes: sure.filter(s => s.hasHoles), maybe };
}

// ---------- command line ----------
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const [command = 'status', ...rest] = process.argv.slice(2);
  const flag = name => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
  const only = flag('game');
  if (only && !games.includes(only)) { console.error(`No game "${only}".`); process.exit(1); }
  if (command === 'sync') {
    for (const line of sync({ only })) console.log(line);
    console.log(`${problems({ only }).filter(p => p.includes('missing')).length} phrases to translate.`);
  } else if (command === 'check') {
    const found = problems({ only });
    for (const p of found) console.log(p);
    console.log(found.length ? `${found.length} problems.` : 'Every phrase is translated.');
    process.exit(found.length ? 1 : 0);
  } else if (command === 'todo') {
    const data = load(only || SHARED, flag('lang') || TARGETS[0]);
    console.log(JSON.stringify(Object.fromEntries(Object.entries(data).filter(([, v]) => !translated(v))), null, 2));
  } else if (command === 'fill') {
    // Copies translations from a JSON file into the locale file (only phrases it holds).
    const ns = only || SHARED, lang = flag('lang') || TARGETS[0], data = load(ns, lang);
    const given = JSON.parse(read(path.resolve(rest.find(f => f.endsWith('.json')))));
    const unknown = Object.keys(given).filter(k => !(k in data));
    for (const [k, v] of Object.entries(given)) if (k in data) data[k] = v;
    save(ns, lang, data);
    for (const k of unknown) console.log(`not in ${rel(fileOf(ns, lang))}: "${k}"`);
    console.log(`${Object.values(data).filter(v => !translated(v)).length} still to translate in ${rel(fileOf(ns, lang))}.`);
  } else if (command === 'wrap') {
    for (const file of rest.filter(f => !f.startsWith('--')).map(f => path.resolve(f))) {
      const { wrapped, holes: h, maybe } = wrapFile(file);
      console.log(`${rel(file)}: wrapped ${wrapped}`);
      for (const s of h) console.log(`  ${s.at}: has variables, write loc('… {name} …', { name }): ${s.raw.slice(0, 100)}`);
      for (const s of maybe) console.log(`  ${s.at}: not sure, wrap it if a player sees it: ${s.raw}`);
    }
  } else if (command === 'literals') {
    let total = 0;
    for (const file of (only ? sources(only) : [...sources(SHARED), ...games.flatMap(sources)]).filter(f => /\.m?js$/.test(f))) {
      const { sure } = literals(read(file));
      if (!sure.length) continue;
      total += sure.length; console.log(`${rel(file)}: ${sure.length}`);
      if (rest.includes('--show')) for (const s of sure) console.log(`  ${s.at}: ${s.raw.slice(0, 110)}`);
    }
    console.log(`${total} Spanish literals outside loc().`);
  } else {
    const byNs = collect(), sharedData = load(SHARED, TARGETS[0]);
    for (const ns of [SHARED, ...games]) {
      const data = load(ns, TARGETS[0]), all = [...(byNs.get(ns)?.keys() || [])];
      const done = all.filter(p => translated(data[p]) || translated(sharedData[p])).length;
      if (all.length) console.log(`${ns.padEnd(12)} ${String(done).padStart(5)} / ${all.length} translated`);
    }
    console.log(`${literalsTotal()} Spanish literals in code outside loc() (npm run i18n -- literals).`);
  }
}
