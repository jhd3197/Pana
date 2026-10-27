// Starts a new game from the 3D templates in scripts/templates/, so every game
// begins wired to the shared engine: plaza stage, the player's pana, room kit,
// lobby, menu, results, pure rules with tests and a two-client browser suite.
//
//   npm run new-game -- <id> [--kind table|live] [--name "Nombre"] [--players 4]
//                            [--color #rrggbb] [--description "…"] [--description-en "…"]
//   .\dev.ps1 new-game <id> -Kind live
//
// --kind table: turn-based at a table (cards, dice, board games) → TableRoom.
// --kind live:  real-time panas moving in the world → LiveRoom.
// Every game is 3D; there is no 2D template on purpose (AGENTS.md).
import fs from 'node:fs';
import path from 'node:path';

const app = path.resolve(import.meta.dirname, '..');
const repo = path.resolve(app, '..');
const templates = path.join(import.meta.dirname, 'templates');

function parse(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) { const [key, inline] = arg.slice(2).split('='); out[key] = inline ?? argv[++i]; }
    else out._.push(arg);
  }
  return out;
}

export function options(argv) {
  const args = parse(argv), id = args._[0];
  const fail = (message) => { throw new Error(`${message}\nUsage: npm run new-game -- <id> [--kind table|live] [--name "Nombre"] [--players 4] [--color #rrggbb]`); };
  if (!id || !/^[a-z]+$/.test(id)) fail('The game id is one lowercase Spanish word, e.g. "trompo".');
  const kind = args.kind || 'table';
  if (!['table', 'live'].includes(kind)) fail(`Unknown kind "${kind}". Use table or live.`);
  const players = Number(args.players || (kind === 'table' ? 4 : 8));
  if (!Number.isInteger(players) || players < 2 || players > 8) fail('Players must be 2–8. Pana games are played with your panas, bots fill empty seats.');
  const color = args.color || '#ff8a3d';
  if (!/^#[0-9a-f]{6}$/i.test(color)) fail('Color must be #rrggbb.');
  const name = args.name || id[0].toUpperCase() + id.slice(1);
  const description = args.description || (kind === 'table'
    ? `Una mesa 3D en la plaza para ${players} panas. Juega con tus panas o contra bots.`
    : `Corre por la plaza 3D con tus panas. Recoge más mangos que nadie antes de que se acabe el tiempo.`);
  // The English the hub shows (public/locales/en.json); a custom description
  // without one is left to translate (npm run i18n -- check names it).
  const descriptionEn = args['description-en'] || (args.description ? '' : kind === 'table'
    ? `A 3D table in the plaza for ${players} players. Play with your friends or against bots.`
    : `Run around the 3D plaza with your friends. Grab more mangos than anyone before time runs out.`);
  return { id, kind, players, color: color.toLowerCase(), name, description, descriptionEn };
}

// HTML templates get their values escaped: a quote in --description must not end an attribute.
const escapeHtml = (value) => String(value).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function fill(text, values, escape = String) {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in values)) throw new Error(`Template placeholder {{${key}}} has no value`);
    return escape(values[key]);
  });
}

function copyTree(from, to, values, written) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    if (entry.isDirectory()) { copyTree(source, path.join(to, entry.name), values, written); continue; }
    if (!entry.name.endsWith('.tmpl') || entry.name === 'knowledge.md.tmpl') continue;
    const target = path.join(to, entry.name.replace(/\.tmpl$/, ''));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, fill(fs.readFileSync(source, 'utf8'), values, target.endsWith('.html') ? escapeHtml : String));
    written.push(target);
  }
}

export function createGame(argv, { root = app, docs = path.join(repo, 'docs', 'knowledge') } = {}) {
  const o = options(argv);
  const dir = path.join(root, 'games', o.id);
  if (fs.existsSync(dir)) throw new Error(`games/${o.id} already exists.`);
  const values = {
    ...o,
    Class: o.id[0].toUpperCase() + o.id.slice(1),
    caption: `${o.name.toUpperCase()} · ENTRE PANAS`,
    target: 15,
    kindText: o.kind === 'table' ? 'turn-based table game' : 'real-time game',
    roomText: o.kind === 'table' ? 'table room' : 'live room',
    roomFile: o.kind === 'table' ? 'table-room.js' : 'live-room.js',
    // Whole JS strings, so a name like Pa'lante stays valid code.
    nameJs: JSON.stringify(o.name), titleJs: JSON.stringify(`${o.name} · Pana`),
    // Inside JSON strings (public/locales/en.json).
    ...Object.fromEntries(['name', 'description', 'descriptionEn'].map(k => [`${k}Json`, JSON.stringify(o[k]).slice(1, -1)])),
  };
  const written = [];
  copyTree(path.join(templates, 'common'), dir, values, written);
  copyTree(path.join(templates, o.kind), dir, values, written);
  const note = path.join(docs, `${o.id}.md`);
  if (!fs.existsSync(note)) { fs.writeFileSync(note, fill(fs.readFileSync(path.join(templates, 'common', 'knowledge.md.tmpl'), 'utf8'), values)); written.push(note); }
  return { ...o, dir, written };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    const game = createGame(process.argv.slice(2));
    console.log(`Created ${game.name} (${game.kind}, ${game.players} players):`);
    for (const file of game.written) console.log(`  ${path.relative(repo, file).split(path.sep).join('/')}`);
    console.log(`
Next:
  1. Open http://localhost:8461/g/${game.id}/ (.\\dev.ps1) and play the scaffold.
  2. Replace the scaffold rules in public/rules.js and its tests; keep the 3D scene.
  3. npm test, then npm run test:browser -- ${game.id}
  4. Add the game to README.md, docs/knowledge/README.md and CHANGELOG.md (Unreleased).
  5. Launcher art: npm run launcher-art -- ${game.id} <image> --row <Carreras|Mesa|Fiesta|Aventura>
     (until then the hub tile is its color, or public/card.js if the game has one).
  6. English for every new phrase: npm run i18n -- sync --game ${game.id}, fill the "" in
     public/locales/en.json, then npm run i18n -- check (docs/knowledge/pana-i18n.md).`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
