// Pepazo collision report: opens the game headless with ?debugCollision=1, stands
// every court variant one after another and saves what the debug mode measures
// (each collider, what it blocks, its health, how much visible geometry fills
// it, and the flagged ones with a proposed fix).
//
//   npm run collision-report                       # every arena, every variant
//   npm run collision-report -- terminal noche     # only these arenas
//   npm run collision-report -- --out <dir>        # default Pana/reports/collision (ignored by Git)
//
// Exits 1 when a collider is flagged. Courts run sequentially in one page, so
// the machine renders one map at a time.
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './pana-server.js';
import { PAINT_ARENAS } from '../engine/worlds/arena-layouts.js';
import { VARIANTS } from '../games/pintura/public/rules.js';

const args = process.argv.slice(2), flag = name => { const i = args.indexOf(`--${name}`); return i < 0 ? null : args.splice(i, 2)[1]; };
const out = path.resolve(flag('out') || path.join(import.meta.dirname, '..', 'reports', 'collision'));
const variants = (flag('variants') || [...Array(VARIANTS).keys()].join(',')).split(',').map(Number);
const known = PAINT_ARENAS.map(a => a.id), arenas = args.length ? args : known;
for (const id of arenas) if (!known.includes(id)) throw new Error(`Unknown Pepazo arena "${id}" (${known.join(', ')})`);

const server = await startServer();
process.env.PANA_TEST_URL = server.base;
const { launch, openGame } = await import('../tests/browser-kit.js');
const browser = await launch();
const summary = { at: new Date().toISOString(), arenas: {} };
fs.mkdirSync(out, { recursive: true });
try {
  const page = await openGame(browser, 'pintura', { query: 'debugCollision=1' });
  await page.waitForFunction(() => window.PANA_COLLISION, null, { timeout: 60_000 });
  for (const id of arenas) for (const variant of variants) {
    const report = await page.evaluate(([id, variant]) => window.PANA_COLLISION.audit(id, variant), [id, variant]);
    fs.writeFileSync(path.join(out, `${id}-${variant}.json`), JSON.stringify(report, null, 2) + '\n');
    summary.arenas[`${id}:${variant}`] = { name: report.mapName, colliders: report.colliders.length, flagged: report.flagged.map(c => ({ id: c.id, source: c.source, flags: c.flags, fix: c.fix })) };
    console.log(`${id} #${variant} (${report.mapName}): ${report.colliders.length} colliders, ${report.flagged.length} flagged`);
    for (const c of report.flagged) console.log(`  ${c.id} ${c.source} at ${c.position.x},${c.position.z} ${c.size.w}x${c.size.d}x${c.size.h} [${c.flags.join(', ')}] coverage ${c.mesh.coverage} -> ${c.fix?.action}`);
  }
  if (page.errors.length) console.warn(page.errors.join('\n'));
} finally { await browser.close(); server.stop(); }
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(`Reports in ${path.relative(process.cwd(), out)}`);
process.exitCode = Object.values(summary.arenas).some(a => a.flagged.length) ? 1 : 0;
