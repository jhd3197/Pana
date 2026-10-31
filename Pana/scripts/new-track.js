// Scaffold a new Carreritas circuit and register it everywhere it must appear:
// the track list, the standalone list (not in a saved cup), the maps suite's
// id list, its song and groove, and the README count. The three track files
// are a plain placeholder loop that already loads and races; replace the
// layout and world with the real port.
//
//   npm run new-track -- <id> --name "Nombre" [options]
//   npm run new-track -- morrocoy --name "Morrocoy" --style calipso --dry-run
//
// Options:
//   --name TEXT     player-facing name (required)
//   --blurb TEXT    one Spanish sentence for the circuit card (only promise
//                   what the finished port shows)
//   --style NAME    synth groove: joropo, gaita, calipso, tambor, andina, estadio
//                   (default calipso)
//   --song NAME     existing recorded song to borrow: carreritas-<NAME> (default
//                   follows the style: calipso→bululu, tambor→selva, ...)
//   --dry-run       print every change, write nothing
//
// It refuses an id that is already registered or already has track files.
// Menu art comes after the port: npm run shots -- carreritas --track <id> --menu
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const REPO = path.resolve(import.meta.dirname, '../..');
export const STYLES = ['joropo', 'gaita', 'calipso', 'tambor', 'andina', 'estadio'];
// A circuit borrows a recording until it gets its own (scripts/music/songs.json).
export const STYLE_SONG = { joropo: 'llanos', gaita: 'plaza', calipso: 'bululu', tambor: 'selva', andina: 'paramo', estadio: 'estadio' };

export const PATHS = {
  definitions: 'Pana/games/carreritas/public/track-definitions.js',
  water: 'Pana/games/carreritas/public/tracks/water-track-definitions.js',
  cups: 'Pana/games/carreritas/public/cup-definitions.js',
  music: 'Pana/games/carreritas/public/music.js',
  maps: 'Pana/games/carreritas/tests/maps.browser.js',
  readme: 'README.md',
  songs: 'Pana/scripts/music/songs.json',
  tracks: 'Pana/games/carreritas/public/tracks',
};

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
export const numberWord = n => n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
export const wordNumber = word => {
  for (let n = 0; n < 100; n++) if (numberWord(n) === word.toLowerCase()) return n;
  return -1;
};

const quote = text => `'${String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
// A stable seed per id, so two scaffolds never share scenery.
const seedOf = id => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9000, 7) + 1000;

function replaceOnce(text, pattern, replace, what) {
  const match = text.match(pattern);
  if (!match) throw new Error(`could not find ${what}`);
  return text.replace(pattern, replace);
}

// Append an id to a JS array literal found by `pattern` (group 1 = the items).
function appendToList(text, pattern, id, what) {
  return replaceOnce(text, pattern, (all, items) => {
    if (new RegExp(`'${id}'`).test(items)) throw new Error(`${what} already lists '${id}'`);
    return items.trim() ? all.replace(items, `${items}, '${id}'`) : all.replace('[]', `['${id}']`);
  }, what);
}

export function parseArgs(argv) {
  const out = { id: null, name: null, blurb: null, style: 'calipso', song: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--')) {
      const key = a.slice(2), value = argv[++i];
      if (!['name', 'blurb', 'style', 'song'].includes(key)) throw new Error(`unknown option ${a}`);
      if (value == null) throw new Error(`${a} needs a value`);
      out[key] = value;
    } else if (!out.id) out.id = a;
    else throw new Error(`unexpected argument ${a}`);
  }
  return out;
}

// Every file change as {file, before, after}; before is null for a new file.
// Pure apart from reading `root`, so tests run it against a copy.
export function planTrack(root, { id, name, blurb, style = 'calipso', song }) {
  if (!id || !/^[a-z][a-z0-9]{1,15}$/.test(id)) throw new Error('the id is a short lowercase word (letters and digits, like "sabana")');
  if (!name) throw new Error('--name "Nombre" is required');
  if (!STYLES.includes(style)) throw new Error(`--style must be one of ${STYLES.join(', ')}`);
  song ??= STYLE_SONG[style];
  const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
  const songs = JSON.parse(read(PATHS.songs)).songs.map(s => s.id);
  if (!songs.includes(`carreritas-${song}`)) throw new Error(`no recorded song carreritas-${song} in ${PATHS.songs}`);

  for (const file of [PATHS.definitions, PATHS.water]) {
    if (new RegExp(`id:\\s*'${id}'`).test(read(file))) throw new Error(`track '${id}' is already in ${file}`);
  }
  const trackFiles = [`${id}.js`, `${id}-layout.js`, `${id}-world.js`].map(f => `${PATHS.tracks}/${f}`);
  for (const f of trackFiles) if (fs.existsSync(path.join(root, f))) throw new Error(`${f} already exists`);

  const changes = [];
  // Edits work on LF text and keep the file's own line endings.
  const edit = (file, change) => {
    const before = read(file), crlf = before.includes('\r\n');
    const after = change(before.replace(/\r\n/g, '\n'));
    changes.push({ file, before, after: crlf ? after.replace(/\n/g, '\r\n') : after });
  };

  edit(PATHS.definitions, text => replaceOnce(text, /\n\];\s*$/,
    `\n  {id:${quote(id)}, name:${quote(name)}, blurb:${quote(blurb || `Circuito nuevo: ${name}.`)}},\n];\n`, 'the end of TRACK_DEFINITIONS'));
  edit(PATHS.cups, text => appendToList(text, /STANDALONE_TRACKS = \[([^\]]*)\]/, id, 'STANDALONE_TRACKS'));
  edit(PATHS.maps, text => appendToList(text, /assert\.deepEqual\(ids, \[([^\]]*)\]/, id, 'the maps suite id list'));
  edit(PATHS.music, text => {
    text = replaceOnce(text, /TRACK_STYLE = \{ /, `TRACK_STYLE = { ${id}: '${style}', `, 'TRACK_STYLE');
    return replaceOnce(text, /SONG_REMAP = \{ /, `SONG_REMAP = { ${id}: '${song}', `, 'SONG_REMAP');
  });
  edit(PATHS.readme, text => replaceOnce(text, /Toy-car racing on ([a-z-]+) circuits/, (all, word) => {
    const n = wordNumber(word);
    if (n < 0) throw new Error(`README circuit count "${word}" is not a number word`);
    return `Toy-car racing on ${numberWord(n + 1)} circuits`;
  }, 'the README circuit count'));

  const seed = seedOf(id);
  changes.push({ file: trackFiles[0], before: null, after: trackTemplate(id, name) });
  changes.push({ file: trackFiles[1], before: null, after: layoutTemplate(name, seed) });
  changes.push({ file: trackFiles[2], before: null, after: worldTemplate(id, name) });
  return changes;
}

export function applyPlan(root, changes) {
  for (const { file, after } of changes) {
    const full = path.join(root, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, after);
  }
}

// A short line diff: the changed lines only, enough to review a dry run.
export function describe(changes) {
  const lines = [];
  for (const { file, before, after } of changes) {
    if (before == null) { lines.push(`+ new ${file} (${after.split('\n').length} lines)`); continue; }
    const a = before.split('\n'), b = after.split('\n');
    lines.push(`~ ${file}`);
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    let ea = a.length - 1, eb = b.length - 1; while (ea >= i && eb >= i && a[ea] === b[eb]) { ea--; eb--; }
    // Long lines show the part around their first difference.
    const clip = (s, other = '') => {
      s = s.trim(); other = other.trim();
      if (s.length <= 160) return s;
      let p = 0; while (p < s.length && s[p] === other[p]) p++;
      const from = Math.max(0, Math.min(p - 60, s.length - 150));
      return `${from ? '...' : ''}${s.slice(from, from + 150)}${from + 150 < s.length ? '...' : ''}`;
    };
    for (let k = i; k <= ea; k++) if (b.slice(i, eb + 1).indexOf(a[k]) < 0) lines.push(`    - ${clip(a[k], b[k])}`);
    for (let k = i; k <= eb; k++) if (a.slice(i, ea + 1).indexOf(b[k]) < 0) lines.push(`    + ${clip(b[k], a[k])}`);
  }
  return lines.join('\n');
}

function trackTemplate(id, name) {
  return `import { createLayout } from './${id}-layout.js';
import { createWorld } from './${id}-world.js';
import { coastalTrack } from './coastal-track.js';

// ${name}. Raise scale (1.2-1.6) before reshaping a corner under a 15 m radius.
const scale = 1;
export default coastalTrack('${id}', createLayout(), (group, layout, roadDistance) => createWorld(group, layout, roadDistance, scale), {
  scale,
  previewBounds: [[-420, 0, -420], [420, 60, 420]],
  palette: { skySeed: 31, cloudCover: .35, horizon: 0xd7e8df, skyTop: 0x249ee8,
    hemiSky: 0xd2e6ff, hemiGround: 0x639450, hemiInt: 1.6, sun: 0xffddb0,
    sunInt: 2.4, ground: 0x549631, track: 0x6a6a6c, dune: 0, fog: [600, 4200] },
});
`;
}

function layoutTemplate(name, seed) {
  return `import * as THREE from 'three';
import { clamp, lerp } from '/engine/random.js';
import { fairRoute, fairHeights } from '/engine/worlds/coastal/coastal-road.js';

// ${name}. Metres, +x east, +z south, y up. A placeholder loop from
// npm run new-track: replace MAP.road with the ported route.
export const MAP = {
  seed: ${seed},
  area: { x0: -450, z0: -450, size: 900 },
  // Road control points: [x, y, z, half-width]. Racing needs half-widths of 8 m or more.
  // A kidney, so the lap bends both ways.
  road: [[-300, 4, 0, 8], [-250, 8, -190, 8], [0, 12, -280, 8], [250, 8, -190, 8], [300, 4, 0, 8], [230, 2, 200, 8],
    [100, 0, 240, 8], [0, 0, 160, 8], [-100, 0, 240, 8], [-230, 2, 200, 8]],
  startAt: [-300, 40],
};

export const noise = (x, z) => 0.5 * Math.sin(x * 0.013 + Math.sin(z * 0.011) * 2) * Math.cos(z * 0.012 - x * 0.004) + 0.3 * Math.sin(x * 0.041 + z * 0.037);

export function createLayout() {
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const AR = MAP.area, SIZE = AR.size, CELL = 2, GR = SIZE / CELL, X0 = AR.x0, Z0 = AR.z0;
  // Distance to the road on a 2 m raster, with the nearest road sample.
  function raster(pts, far) {
    const dist = new Float32Array(GR * GR).fill(far), idx = new Int32Array(GR * GR).fill(-1), rc = Math.ceil(far / CELL);
    pts.forEach((p, i) => {
      const cx = Math.floor((p.x - X0) / CELL), cz = Math.floor((p.z - Z0) / CELL);
      for (let z = Math.max(0, cz - rc); z <= Math.min(GR - 1, cz + rc); z++) for (let x = Math.max(0, cx - rc); x <= Math.min(GR - 1, cx + rc); x++) {
        const dx = X0 + (x + 0.5) * CELL - p.x, dz = Z0 + (z + 0.5) * CELL - p.z, q = dx * dx + dz * dz;
        if (q > far * far) continue;
        const k = z * GR + x, dd = Math.sqrt(q);
        if (dd < dist[k]) { dist[k] = dd; idx[k] = i; }
      }
    });
    return { dist, idx, far };
  }
  function sampleR(R, x, z) {
    const fx = (x - X0) / CELL - 0.5, fz = (z - Z0) / CELL - 0.5;
    if (fx < 0 || fz < 0 || fx > GR - 1 || fz > GR - 1) return { dist: R.far, i: -1 };
    const x0 = clamp(Math.floor(fx), 0, GR - 2), z0 = clamp(Math.floor(fz), 0, GR - 2), tx = clamp(fx - x0, 0, 1), tz = clamp(fz - z0, 0, 1), k = z0 * GR + x0;
    const dist = lerp(lerp(R.dist[k], R.dist[k + 1], tx), lerp(R.dist[k + GR], R.dist[k + GR + 1], tx), tz);
    return { dist, i: R.idx[clamp(Math.round(fz), 0, GR - 1) * GR + clamp(Math.round(fx), 0, GR - 1)] };
  }
  const inArea = (x, z, m = 0) => x > X0 + m && x < X0 + SIZE - m && z > Z0 + m && z < Z0 + SIZE - m;

  // The lap starts at MAP.startAt: rotate the samples so index 0 sits there.
  const CTRL = MAP.road, NR = 2400;
  const curve = new THREE.CatmullRomCurve3(CTRL.map(([x, y, z]) => new THREE.Vector3(x, y, z)), true, 'centripetal');
  const ctrlAt = i => CTRL[Math.min(CTRL.length - 1, Math.floor(curve.getUtoTmapping(i / NR) * CTRL.length))];
  let RP = curve.getSpacedPoints(NR).slice(0, NR), rawHW = RP.map((_, i) => ctrlAt(i)[3]);
  {
    let i0 = 0, best = Infinity;
    RP.forEach((p, i) => { const d = (p.x - MAP.startAt[0]) ** 2 + (p.z - MAP.startAt[1]) ** 2; if (d < best) { best = d; i0 = i; } });
    const rot = a => a.slice(i0).concat(a.slice(0, i0));
    RP = rot(RP); rawHW = rot(rawHW);
  }
  const rawY = RP.map(p => p.y);
  fairRoute(RP, 24);
  const RR = raster(RP, 100);
  const hwL = new Float32Array(NR), hwR = new Float32Array(NR), roadY = Float32Array.from(rawY), bank = new Float32Array(NR);
  for (let i = 0; i < NR; i++) hwL[i] = hwR[i] = Math.max(8, rawHW[i]);
  fairHeights(RP, roadY);
  const roadFrame = i => { const p = RP[(i + NR) % NR], q = RP[(i + 1 + NR) % NR], t = new THREE.Vector3().subVectors(q, p).setY(0).normalize(); return { p, t, n: new THREE.Vector3(-t.z, 0, t.x) }; };
  const roadAt = (i, lat, dy = 0) => { const k = (i % NR + NR) % NR, f = roadFrame(k); return f.p.clone().addScaledVector(f.n, lat).setY(roadY[k] + bank[k] * lat + dy); };

  // Gentle hills that settle onto the road and never rise through it.
  const farH = (x, z) => 6 + 10 * noise(x * 0.6, z * 0.6);
  function terrainH(x, z) {
    let h = farH(x, z);
    const r = sampleR(RR, x, z);
    if (r.i >= 0) {
      h = lerp(roadY[r.i] - 0.15, h, sstep(hwR[r.i] + 1, hwR[r.i] + 30, r.dist));
      if (r.dist < hwR[r.i] + 1.5) h = Math.min(h, roadY[r.i] - 0.2);
    }
    return h;
  }
  const groundH = (x, z) => (inArea(x, z, 4) ? terrainH(x, z) : farH(x, z));
  return { SIZE, CELL, GR, X0, Z0, NR, RP, RR, hwL, hwR, roadY, bank, roadFrame, roadAt, sampleR, inArea, farH, terrainH, groundH, wet: () => false };
}
`;
}

function worldTemplate(id, name) {
  return `import * as THREE from 'three';
import { rng } from '/engine/random.js';
import { extendTerrain } from '/engine/worlds/coastal/world-horizon.js';
import { coastalVegetation } from '/engine/worlds/coastal/coastal-vegetation.js';
import { MAP, noise } from './${id}-layout.js';

// ${name}: placeholder ground, road and trees from npm run new-track.
// Port the reference scene here; keep trees in coastalVegetation.
export function createWorld(scene, layout, roadDistance, scale = 1) {
  const vegetation = coastalVegetation(scene, scale, roadDistance);
  const rand = rng(MAP.seed);
  const { SIZE, X0, Z0, NR, RR, hwL, hwR, roadAt, sampleR, inArea, farH, terrainH, groundH: baseGroundH } = layout;
  let horizon = null;
  const groundH = (x, z) => horizon?.heightAt(x, z) ?? baseGroundH(x, z);

  /* ---------------- terrain ---------------- */
  const grass = new THREE.Color('#5c9a38'), grass2 = new THREE.Color('#86b046'), verge = new THREE.Color('#b9a77a');
  const paint = (x, z, target = new THREE.Color()) => target.copy(grass).lerp(grass2, 0.5 + 0.5 * noise(x * 2, z * 2));
  {
    const SEGS = 200, geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
    geo.rotateX(-Math.PI / 2); geo.translate(X0 + SIZE / 2, 0, Z0 + SIZE / 2);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), r = sampleR(RR, x, z);
      pos.setY(i, terrainH(x, z));
      paint(x, z, tmp);
      if (r.i >= 0) tmp.lerp(verge, Math.max(0, 1 - Math.max(0, r.dist - hwR[r.i]) / 3) * 0.7);
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    land.receiveShadow = true; scene.add(land);
    horizon = extendTerrain(land, { bounds: [X0, Z0, X0 + SIZE, Z0 + SIZE], nx: SEGS, nz: SEGS, height: farH, color: (x, z) => paint(x, z), biome: '${id}' });
  }

  /* ---------------- road ---------------- */
  {
    const pos = [], uv = [], idx = [];
    let dist = 0, prev = null;
    for (let n = 0; n <= NR; n++) {
      const i = n % NR, a = roadAt(i, -hwL[i], 0.12), b = roadAt(i, hwR[i], 0.12);
      if (prev) dist += a.distanceTo(prev);
      prev = a;
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z); uv.push(0, dist / 20, 1, dist / 20);
      if (n) { const k = (n - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#6a6a6c', roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    road.name = 'coastal-road-strip'; road.receiveShadow = true; scene.add(road);
  }

  /* ---------------- trees ---------------- */
  for (let k = 0; k < 500; k++) {
    const x = X0 + rand() * SIZE, z = Z0 + rand() * SIZE;
    if (!inArea(x, z, 10)) continue;
    vegetation.add(rand() < 0.6 ? 'tree' : 'palm', x, z, baseGroundH(x, z), 0.8 + rand() * 0.4, sampleR(RR, x, z).dist);
  }

  const ownedMaterials = new Set();
  scene.traverse(o => { for (const material of [].concat(o.material || [])) ownedMaterials.add(material); });
  vegetation.flush();
  scene.userData.dispose = () => ownedMaterials.forEach(m => m.dispose());
  return { group: scene, groundAt: groundH, update() {} };
}
`;
}

async function main(argv) {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    console.log(fs.readFileSync(import.meta.filename, 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
    return argv.length ? 0 : 1;
  }
  const options = parseArgs(argv);
  const changes = planTrack(REPO, options);
  console.log(describe(changes));
  if (options.dryRun) { console.log('\nDry run: nothing written.'); return 0; }
  applyPlan(REPO, changes);
  console.log(`\nRegistered '${options.id}'. Next:
  1. Port the scene into Pana/games/carreritas/public/tracks/${options.id}-layout.js and -world.js.
  2. npm run shots -- carreritas --track ${options.id} --at 0.4     (look at it)
  3. PANA_MAP_TEST_TRACKS=${options.id} npm run test:browser -- carreritas/tests/maps.browser --fresh
  4. npm run shots -- carreritas --track ${options.id} --menu       (menu art + sources.json)
  5. CHANGELOG.md (Spanish, players' voice) and a docs/knowledge note.`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (e) { console.error(`new-track: ${e.message}`); process.exitCode = 1; }
}
