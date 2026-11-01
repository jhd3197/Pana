// Pepazo collision report: opens the game headless with ?debugCollision=1, stands
// every court variant one after another and saves what the debug mode measures
// (each collider, what it blocks, its health, how much visible geometry fills
// it, and the flagged ones with a proposed fix).
//
//   npm run collision-report                       # every arena, every variant
//   npm run collision-report -- terminal noche     # only these arenas
//   npm run collision-report -- --out <dir>        # default Pana/reports/collision (ignored by Git)
//   npm run collision-report -- terminal --fix     # write the proposed fixes, then audit again
//
// --fix records every proposed fix in games/pintura/public/collision-fixes.js
// (remove an orphan, refit or split an oversized box, unblock shots on a broken
// piece), keyed by the raw layout row so coverFor applies it on the server and
// in the scene alike, then reloads the game and audits the same courts again.
//
// Exits 1 when a collider is (still) flagged. Courts run sequentially in one
// page, so the machine renders one map at a time.
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './pana-server.js';
import { PAINT_ARENAS } from '../engine/worlds/arena-layouts.js';
import { VARIANTS } from '../games/pintura/public/rules.js';

const args = process.argv.slice(2), fix = args.includes('--fix');
if (fix) args.splice(args.indexOf('--fix'), 1);
const flag = name => { const i = args.indexOf(`--${name}`); return i < 0 ? null : args.splice(i, 2)[1]; };
const out = path.resolve(flag('out') || path.join(import.meta.dirname, '..', 'reports', 'collision'));
const variants = (flag('variants') || [...Array(VARIANTS).keys()].join(',')).split(',').map(Number);
const FIXES = path.join(import.meta.dirname, '..', 'games', 'pintura', 'public', 'collision-fixes.js');
const known = PAINT_ARENAS.map(a => a.id), arenas = args.length ? args : known;
for (const id of arenas) if (!known.includes(id)) throw new Error(`Unknown Pepazo arena "${id}" (${known.join(', ')})`);

const server = await startServer();
process.env.PANA_TEST_URL = server.base;
const { launch, openGame } = await import('../tests/browser-kit.js');
const browser = await launch();
const summary = { at: new Date().toISOString(), arenas: {} }, reports = {};
const line = c => `  ${c.id} ${c.source} at ${c.position.x},${c.position.z} ${c.size.w}x${c.size.d}x${c.size.h} [${c.flags.join(', ')}] coverage ${c.mesh.coverage} -> ${c.fix?.action}`;
fs.mkdirSync(out, { recursive: true });
try {
  const page = await openGame(browser, 'pintura', { query: 'debugCollision=1' });
  const audit = (id, variant) => page.evaluate(([id, variant]) => window.PANA_COLLISION.audit(id, variant), [id, variant]);
  await page.waitForFunction(() => window.PANA_COLLISION, null, { timeout: 60_000 });
  for (const id of arenas) for (const variant of variants) {
    const report = reports[`${id}:${variant}`] = await audit(id, variant);
    fs.writeFileSync(path.join(out, `${id}-${variant}.json`), JSON.stringify(report, null, 2) + '\n');
    summary.arenas[`${id}:${variant}`] = { name: report.mapName, colliders: report.colliders.length, flagged: report.flagged.map(c => ({ id: c.id, source: c.source, flags: c.flags, fix: c.fix })) };
    console.log(`${id} #${variant} (${report.mapName}): ${report.colliders.length} colliders, ${report.flagged.length} flagged`);
    report.flagged.forEach(c => console.log(line(c)));
  }
  if (fix && Object.values(summary.arenas).some(a => a.flagged.length)) {
    const count = await writeFixes(Object.values(reports));
    console.log(`Wrote ${count} fix(es) to ${path.relative(process.cwd(), FIXES)}; auditing again:`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.PANA_COLLISION, null, { timeout: 120_000 });
    for (const [key, arena] of Object.entries(summary.arenas)) {
      if (!arena.flagged.length) continue;
      const [id, variant] = key.split(':'), report = await audit(id, Number(variant));
      fs.writeFileSync(path.join(out, `${id}-${variant}.json`), JSON.stringify(report, null, 2) + '\n');
      arena.after = report.flagged.map(c => ({ id: c.id, source: c.source, flags: c.flags, fix: c.fix }));
      console.log(`  ${id} #${variant}: ${arena.flagged.length} flagged before, ${report.flagged.length} after`);
      report.flagged.forEach(c => console.log(line(c)));
    }
  }
  if (page.errors.length) console.warn(page.errors.join('\n'));
} finally { await browser.close(); server.stop(); }
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(`Reports in ${path.relative(process.cwd(), out)}`);
process.exitCode = Object.values(summary.arenas).some(a => (a.after ?? a.flagged).length) ? 1 : 0;

// Merges the proposed fixes into collision-fixes.js. Only raw rows (`map:variant:index`)
// can be keyed: a piece of a row fixed before is left for a hand fix.
async function writeFixes(list) {
  const { COLLISION_FIXES } = await import('../games/pintura/public/collision-fixes.js'), fixes = { ...COLLISION_FIXES };
  let count = 0;
  for (const c of list.flatMap(r => r.flagged)) {
    if (!c.fix || !/^[a-z-]+:\d+:\d+$/.test(c.id)) { console.warn(`  ${c.id}: no automatic fix (${c.fix ? 'a piece of a fixed row' : 'nothing proposed'}), fix it by hand`); continue; }
    const { action, reason, box, boxes } = c.fix;
    // A row fixed before keeps the raw box it was keyed on; the new fix replaces the old one.
    fixes[c.id] = { from: fixes[c.id]?.from ?? { x: c.position.x, z: c.position.z, w: c.size.w, d: c.size.d, h: c.size.h }, action, reason, ...(box ? { box } : {}), ...(boxes ? { boxes } : {}) };
    count++;
  }
  const literal = value => JSON.stringify(value).replace(/"(\w+)":/g, '$1: ').replace(/"/g, "'").replace(/,(?=\S)/g, ', ').replace(/\{(?=\S)/g, '{ ').replace(/(\S)\}/g, '$1 }');
  const body = Object.keys(fixes).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map(k => `  '${k}': ${literal(fixes[k])},`).join('\n');
  const source = fs.readFileSync(FIXES, 'utf8').replace(/\r\n/g, '\n');
  fs.writeFileSync(FIXES, source.replace(/export const COLLISION_FIXES = \{[\s\S]*?\n\};/, `export const COLLISION_FIXES = {\n${body}\n};`));
  return count;
}
