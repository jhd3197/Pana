// Adds (or replaces) a game's hub launcher art from one supplied image:
//
//   npm run launcher-art -- <gameId> <image> [--row "Mesa"] [--dry-run]
//   node Pana/scripts/launcher-art.js trifulca ~/Downloads/trifulca.png --row Fiesta
//
// It writes web/images/launcher/<id>.jpg (the hero and lobby cover, 1536 × 1024)
// and <id>-card.jpg (the hub tile, 640 × 427, under 600 KB), both center-cropped
// to 3:2, registers the game and its row in web/launcher-art.js, and adds the
// game to the card checks in web/tests/launcher.browser.js. --row defaults to
// the game's current row; a new game needs one. --dry-run encodes and reports
// without writing. Encoding uses Playwright's Chromium canvas (no image deps).
import fs from 'node:fs';
import path from 'node:path';

const app = path.resolve(import.meta.dirname, '..');
const repo = path.resolve(app, '..');

export const USAGE = 'Usage: npm run launcher-art -- <gameId> <image> [--row "Mesa"] [--dry-run]';
export const ASPECT = 3 / 2;
export const MAIN = { width: 1536, quality: 0.86, budget: 900_000 };
export const CARD = { width: 640, quality: 0.85, budget: 600_000 };
export const DEFAULT_ROW = 'Fiesta';   // what category() falls back to without art

export function parseArgs(argv) {
  const out = { _: [], dryRun: false, row: null, root: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg.startsWith('--')) {
      const [key, inline] = arg.slice(2).split('=');
      const value = inline ?? argv[++i];
      if (!['row', 'root'].includes(key) || value === undefined) throw new Error(`Unknown or empty option ${arg}.\n${USAGE}`);
      out[key] = value;
    } else out._.push(arg);
  }
  return out;
}

// Largest centered box of the given aspect inside a w × h image.
export function cropBox(w, h, aspect = ASPECT) {
  if (w / h > aspect) { const cw = Math.round(h * aspect); return { x: Math.floor((w - cw) / 2), y: 0, w: cw, h }; }
  const ch = Math.round(w / aspect);
  return { x: 0, y: Math.floor((h - ch) / 2), w, h: ch };
}

// Output size: the target width, never upscaled past the crop.
export function outputSize(crop, width, aspect = ASPECT) {
  const w = Math.min(width, crop.w);
  return { w, h: Math.round(w / aspect) };
}

const quote = s => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

// Reads `categories` and `artwork` out of web/launcher-art.js. A duplicated key
// keeps the last value (as JS does) at the last position.
export function parseArtwork(source) {
  const cats = source.match(/export const categories = \[([^\]]*)\];/);
  const block = source.match(/export const artwork = \{([\s\S]*?)\n\};/);
  if (!cats || !block) throw new Error('web/launcher-art.js no longer has the `categories` / `artwork` shape this script edits.');
  const strings = text => [...text.matchAll(/'([^']*)'/g)].map(m => m[1]);
  const artwork = new Map();
  for (const m of block[1].matchAll(/([a-z][\w]*)\s*:\s*\[([^\]]*)\]/g)) { artwork.delete(m[1]); artwork.set(m[1], strings(m[2])); }
  return { categories: strings(cats[1]), artwork };
}

// Writes the artwork block back, one or more wrapped lines per row in category order.
export function renderArtwork(categories, artwork, width = 150) {
  const lines = [];
  for (const row of categories) {
    let line = '';
    for (const [id, value] of artwork) {
      if (value[0] !== row) continue;
      const entry = `${id}: [${value.map(quote).join(', ')}],`;
      if (line && 2 + line.length + 1 + entry.length > width) { lines.push(`  ${line}`); line = entry; }
      else line = line ? `${line} ${entry}` : entry;
    }
    if (line) lines.push(`  ${line}`);
  }
  return `export const artwork = {\n${lines.join('\n')}\n};`;
}

export function registerArt(source, id, row) {
  const { categories, artwork } = parseArtwork(source);
  const before = artwork.get(id)?.[0] || DEFAULT_ROW;
  const target = row || artwork.get(id)?.[0];
  if (!target) throw new Error(`${id} has no launcher row yet: pass --row (${categories.filter(c => c !== 'Todos').join(', ')}, or a new one).`);
  const nextCats = categories.includes(target) ? categories : [...categories, target];
  artwork.delete(id);
  artwork.set(id, [target, `${id}.jpg`, `${id}-card.jpg`]);
  const text = source
    .replace(/export const categories = \[[^\]]*\];/, `export const categories = [${nextCats.map(quote).join(', ')}];`)
    .replace(/export const artwork = \{[\s\S]*?\n\};/, renderArtwork(nextCats, artwork));
  return { text, row: target, before, newRow: nextCats.length !== categories.length, categories: nextCats };
}

// Adds the game to the last `for (const game of [...])` card check in
// launcher.browser.js and keeps the row assertions in step with the move.
export function registerBrowserCheck(source, { id, row, before, categories }) {
  const warnings = [];
  let text = source;
  const loops = [...text.matchAll(/for \(const game of \[([^\]]*)\]\)/g)];
  const listed = loops.some(m => [...m[1].matchAll(/'([^']*)'/g)].some(s => s[1] === id));
  if (!loops.length) warnings.push('launcher.browser.js has no `for (const game of [...])` card check; add the game by hand.');
  else if (!listed) {
    const last = loops.at(-1);
    const ids = [...last[1].matchAll(/'([^']*)'/g)].map(s => s[1]);
    const replacement = `for (const game of [${[...ids, id].map(quote).join(', ')}])`;
    text = text.slice(0, last.index) + replacement + text.slice(last.index + last[0].length);
  }
  const titles = /(\.game-row-title'\)\.evaluateAll\([^)]*\)\), )\[[^\]]*\]\)/;
  if (titles.test(text)) text = text.replace(titles, `$1[${categories.filter(c => c !== 'Todos').map(quote).join(', ')}])`);
  else warnings.push('launcher.browser.js row-title assertion not found; check the row list by hand.');
  const delta = (row === 'Mesa') - (before === 'Mesa');
  if (delta) {
    const mesa = /(\[data-row="Mesa"\] \.game'\)\.count\(\), [^?]*\? )(\d+) : (\d+)\)/;
    if (mesa.test(text)) text = text.replace(mesa, (m, head, a, b) => `${head}${+a + delta} : ${+b + delta})`);
    else warnings.push('launcher.browser.js Mesa row count assertion not found; update the count by hand.');
  }
  return { text, warnings };
}

// Encodes one image to both JPEGs in headless Chromium. Each pass lowers the
// quality until the file fits its budget.
export async function encode(imagePath, sizes = { main: MAIN, card: CARD }) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const data = fs.readFileSync(imagePath).toString('base64');
    const source = await page.evaluate(async data => {
      const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
      window.bitmap = await createImageBitmap(new Blob([bytes]));
      return { width: bitmap.width, height: bitmap.height };
    }, data);
    const crop = cropBox(source.width, source.height);
    const jobs = Object.entries(sizes).map(([name, s]) => ({ name, ...s, ...outputSize(crop, s.width) }));
    const out = await page.evaluate(async ({ crop, jobs }) => {
      const out = {};
      for (const { name, w: ow, h: oh, quality, budget } of jobs) {
        // Halve in steps first: one big drawImage downscale aliases.
        let src = window.bitmap, sx = crop.x, sy = crop.y, sw = crop.w, sh = crop.h;
        while (sw / 2 >= ow) {
          const step = new OffscreenCanvas(Math.round(sw / 2), Math.round(sh / 2));
          const g = step.getContext('2d'); g.imageSmoothingQuality = 'high';
          g.drawImage(src, sx, sy, sw, sh, 0, 0, step.width, step.height);
          src = step; sx = 0; sy = 0; sw = step.width; sh = step.height;
        }
        const canvas = new OffscreenCanvas(ow, oh);
        const g = canvas.getContext('2d'); g.imageSmoothingQuality = 'high';
        g.fillStyle = '#fff'; g.fillRect(0, 0, ow, oh);   // transparent PNGs flatten onto white, not black
        g.drawImage(src, sx, sy, sw, sh, 0, 0, ow, oh);
        let q = quality, blob;
        for (;;) {
          blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: q });
          if (blob.size <= budget || q <= 0.5) break;
          q = Math.round((q - 0.05) * 100) / 100;
        }
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        out[name] = { width: ow, height: oh, quality: q, bytes: blob.size, base64: btoa(bin) };
      }
      return out;
    }, { crop, jobs });
    const result = { source, crop, out };
    for (const name of Object.keys(result.out)) {
      const o = result.out[name];
      if (o.bytes > sizes[name].budget) throw new Error(`${name} JPEG is ${o.bytes} bytes even at quality ${o.quality}; budget is ${sizes[name].budget}.`);
      o.buffer = Buffer.from(o.base64, 'base64'); delete o.base64;
    }
    return result;
  } finally {
    await browser.close();
  }
}

export async function run(argv, { root = app, log = console.log } = {}) {
  const args = parseArgs(argv);
  if (args.help) { log(USAGE); return null; }
  if (args.root) root = path.resolve(args.root);
  const [id, image] = args._;
  if (!id || !image || args._.length > 2) throw new Error(USAGE);
  if (!/^[a-z]+$/.test(id) || !fs.existsSync(path.join(root, 'games', id, 'game.json'))) {
    throw new Error(`Unknown game "${id}": there is no games/${id}/game.json.`);
  }
  if (!fs.existsSync(image) || !fs.statSync(image).isFile()) throw new Error(`No image at ${image}.`);
  const artFile = path.join(root, 'web', 'launcher-art.js');
  const suiteFile = path.join(root, 'web', 'tests', 'launcher.browser.js');
  const art = registerArt(fs.readFileSync(artFile, 'utf8'), id, args.row);
  const suite = registerBrowserCheck(fs.readFileSync(suiteFile, 'utf8'), { id, ...art });
  const encoded = await encode(image);
  const dir = path.join(root, 'web', 'images', 'launcher');
  const files = { main: path.join(dir, `${id}.jpg`), card: path.join(dir, `${id}-card.jpg`) };
  const rel = f => { const r = path.relative(repo, f); return r.startsWith('..') ? f : r.split(path.sep).join('/'); };
  const { source, crop } = encoded;
  log(`${args.dryRun ? '[dry run] ' : ''}${id} → row ${art.row}${art.newRow ? ' (new row)' : ''}; source ${source.width} × ${source.height}, crop ${crop.w} × ${crop.h} at ${crop.x},${crop.y}`);
  if (encoded.out.main.width < MAIN.width) log(`  note: the source is small; the hero stays ${encoded.out.main.width} px wide instead of ${MAIN.width}.`);
  for (const name of ['main', 'card']) {
    const o = encoded.out[name];
    log(`  ${rel(files[name])}  ${o.width} × ${o.height}, q${o.quality}, ${(o.bytes / 1024).toFixed(0)} KB`);
    if (!args.dryRun) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(files[name], o.buffer); }
  }
  for (const [file, text] of [[artFile, art.text], [suiteFile, suite.text]]) {
    const changed = text !== fs.readFileSync(file, 'utf8');
    log(`  ${rel(file)}  ${changed ? 'updated' : 'unchanged'}`);
    if (changed && !args.dryRun) fs.writeFileSync(file, text);
  }
  for (const warning of suite.warnings) log(`  warning: ${warning}`);
  if (!args.dryRun) log(`\nNext: npm run test:browser -- launcher, then commit the two JPEGs with both .js files.`);
  return { id, row: art.row, files, encoded, warnings: suite.warnings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  run(process.argv.slice(2)).catch(error => { console.error(error.message); process.exit(1); });
}
