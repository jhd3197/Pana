// Curiara's courses. The river machinery (splines, levels, currents, the
// guide line) is shared with Lancha in /engine/river/river.js.
import { buildRiver, clamp, smooth } from '../../../engine/river/river.js';
export { buildRiver, makePath, clamp, angle, smooth, formatTime, TONINA } from '../../../engine/river/river.js';

const GREY = { lip: .8, run: 3, rise: 3 };
const wave = (s, a, b) => Math.sin(s * a + b);
const ease = (s, a, b, from, to) => from + (to - from) * smooth(a, b, s);

// The race: Caño de la Selva → Raudal del Autana → Río Negro → la churuata.
// Raudales: each lane is [from, to] across the river with its own steps
// [ds from the raudal's s, drop m]; every lane drops the same in total.
const R1 = 398, R2 = 482, CANO = 330, NEGRO = 556;
const lanes = (fastSide) => {
  const steps3 = [[-8, .5], [0, .5], [8, .5]], steps2 = [[-5, .75], [5, .75]], fast = [[0, 1.5]];
  if (fastSide === 0) return [{ from: -12, to: -4.1, steps: steps3, boost: .5 }, { from: -3.2, to: 3.2, steps: fast, boost: 2.2, fast: true }, { from: 4.1, to: 12, steps: steps3, boost: .5 }];
  return [{ from: -12, to: -5.2, steps: fast, boost: 2.2, fast: true }, { from: -4.3, to: 3.2, steps: steps2, boost: 1.1 }, { from: 4.1, to: 12, steps: steps3, boost: .5 }];
};
export function amazonasDefinition() {
let curvature = () => 0, LEN = 1000;
return {
  nodes: [[0, 46], [0, 14], [-12, -16], [-6, -44], [10, -62], [16, -88], [30, -106], [52, -114], [66, -136], [60, -164], [40, -180], [22, -196],
    [8, -222], [2, -258], [-1, -296], [1, -334], [5, -372], [4, -408],
    [-6, -446], [-30, -486], [-42, -532], [-30, -580], [4, -620], [28, -664], [24, -712], [4, -752], [-6, -790], [-8, -818]],
  setup(main) { curvature = s => main.at(s).k; LEN = main.length; },
  width(s) {
    let w = ease(s, 22, 48, 16, 10.5 + 1.6 * wave(s, .045, 1));
    w = ease(s, CANO - 10, CANO + 30, w, 24.5);
    w = ease(s, R2 + 25, NEGRO + 20, w, 34 + 4 * wave(s, .021, .4));
    return ease(s, LEN - 70, LEN - 25, w, 42);
  },
  top: 8, slope: .0028,
  depth: s => s < CANO ? 1.5 : s < NEGRO ? 1.3 : 3,
  current: s => ease(s, CANO - 20, CANO + 20, 2.3, 2.5) + ease(s, R2 + 30, NEGRO, 0, -.3) - ease(s, LEN - 60, LEN - 20, 0, 1.2),
  // The chorro rides the outside of the caño's bends and snakes across the Río Negro.
  chorro(s) {
    const half = this.width(s) / 2;
    if (s < CANO) return clamp(-curvature(s + 6) * 45, -1, 1) * half * .45;
    if (s < R2 + 20) return 0;
    return ease(s, R2 + 20, NEGRO + 10, 0, 1) * half * .55 * wave(s, .019, 2.2);
  },
  chorroBoost: s => s < 40 ? 0 : s < CANO ? 1.5 : s < NEGRO ? 1.2 : s > LEN - 50 ? 0 : 2.6,
  drops: [{ s: R1, span: 14, lanes: lanes(0) }, { s: R2, span: 14, lanes: lanes(1) }],
  bank(s, offset) {
    if (s < CANO) return { lip: 1.3, run: 2.2, rise: 7 };
    if (s < NEGRO - 30) return { lip: 1.6, run: 1.8, rise: 11 };
    // Playas: low sand on the inside of the Río Negro's bends.
    const inside = Math.sign(offset) === Math.sign(curvature(s)) ? 0 : 1;
    return inside ? { lip: .35, run: 11, rise: 4 } : { lip: .9, run: 3.5, rise: 6 };
  },
  look(s, offset) {
    if (s < CANO - 20) return {};
    if (s < NEGRO - 30) return { rock: 1 };
    return { sand: Math.sign(offset) === Math.sign(curvature(s)) ? .2 : 1 };
  },
  branch: { from: 144, to: 296, width: 7, current: 1.25, nodes: [[19, -116], [22, -144], [23, -172]] },
  whirl: { s: 776, offset: 7.5, r: 9, swirl: 3.2, pull: 1.3 },
  eddies(main) {
    const out = [];
    // Inside of every tight caño bend, and below the raudales on both sides.
    for (let s = 50; s < CANO - 10; s += 2) {
      const k = main.at(s).k, before = main.at(s - 2).k, after = main.at(s + 2).k;
      if (Math.abs(k) > .03 && Math.abs(k) >= Math.abs(before) && Math.abs(k) >= Math.abs(after)) out.push({ s, offset: Math.sign(k) * (this.width(s) / 2 - 1.6), r: 3, k: 1.25 });
    }
    for (const d of [R1, R2]) for (const side of [-1, 1]) out.push({ s: d + 24, offset: side * 8, r: 5, k: 1.3 });
    for (const [s, offset] of [[612, -9], [690, 11], [868, 9]]) out.push({ s: s + 5, offset, r: 6, k: 1.2 });
    return out;
  },
  rocks() {
    const out = [];
    // Laja bars split each raudal into its lanes; a few boulders in the Negro.
    for (const d of this.drops) {
      // Each bar starts with a small nose stone so canoes glance off it.
      for (let i = 1; i < d.lanes.length; i++) for (let ds = -d.span - 1, k = 0; ds <= d.span - 2; ds += 1.9, k++) out.push({ s: d.s + ds, offset: (d.lanes[i - 1].to + d.lanes[i].from) / 2, r: k ? .62 + .14 * Math.abs(wave(ds, 1.7, d.s)) : .45 });
      for (const side of [-1, 1]) out.push({ s: d.s - d.span - 3, offset: side * 13.2, r: 1.4 });
    }
    for (const [s, offset, r] of [[612, -9, 1.8], [690, 11, 2.2], [868, 9, 1.7], [252, 1.5, .9], [110, 0, .8]]) out.push({ s, offset, r });
    return out;
  },
  sectors: [[0, 'Caño de la Selva'], [CANO, 'Raudal del Autana'], [NEGRO, 'Río Negro'], [910, 'La churuata']],
  tints: [R1 - 16, R2 + 16], gates: 16,
  // Logs on the caño's banks; one in three is a caimán.
  logs() {
    const out = [];
    for (let s = 58, i = 0; s < CANO - 15; s += 23 + (i * 7) % 9, i++) {
      if (s > 140 && s < 150) continue;
      const side = i % 2 ? 1 : -1;
      out.push({ id: i, s, offset: side * (this.width(s) / 2 - .35), side, caiman: i % 3 === 1 });
    }
    return out;
  },
  // Where pods of toninas surface in the Río Negro, near the chorro.
  toninas() { const out = []; for (let s = NEGRO + 25; s < LEN - 70; s += 34) out.push({ s, offset: this.chorro(s) }); return out; },
  // Babos swimming across the Río Negro, and buoys marking its open water.
  caimanes: [{ s: NEGRO + 84, offset: 0, span: 9, period: 28 }, { s: NEGRO + 176, offset: -2, span: 8, period: 24 }, { s: NEGRO + 272, offset: 2, span: 9, period: 30 }],
  buoys: { from: NEGRO + 20, every: 40, gap: 6 },
};
}
export const AMAZONAS = amazonasDefinition();
// Step 0's grey box: a straight 200 m channel to tune the paddle on.
export const GREYBOX = buildRiver({
  nodes: [[0, 0], [0, -100], [0, -200]], width: () => 14, top: 2, slope: 0, depth: () => 1.5,
  current: () => 1.5, chorro: () => 0, chorroBoost: () => 0, bank: () => GREY,
  sectors: [[0, 'Canal de prueba']], gates: 4,
});
export const RIVER = buildRiver(AMAZONAS);

// Each definition owns its curvature/length closure: building another map cannot
// mutate an active race's current, banks or shortcut geometry.
export function configuredRiver(options = {}) {
  if ((!options.river || options.river === 'amazonas') && options.falls !== false && options.items !== false) return RIVER;
  const def = amazonasDefinition(), kind = options.river || 'amazonas';
  if (kind !== 'amazonas') {
    const scale = kind === 'orinoco' ? 1.6 : .72;
    def.nodes = def.nodes.map(([x,z]) => [x * scale, z]);
    def.branch = { ...def.branch, nodes: def.branch.nodes.map(([x,z]) => [x * scale,z]) };
    const width = def.width; def.width = s => width(s) * (kind === 'orinoco' ? 1.35 : .96);
    def.sectors = [[0,kind === 'orinoco' ? 'Caño del Orinoco' : 'Caroní'], [360,'Los raudales'], [600,kind === 'orinoco' ? 'Playas del Orinoco' : 'Curvas del Caroní'], [910,'La churuata']];
    if(kind === 'orinoco'){def.look = () => ({sand:1});def.bank=()=>({lip:.6,run:9,rise:5});}
  }
  if (options.falls === false) def.drops = [];
  if(options.items === false){def.rocks=()=>[];def.logs=()=>[];def.toninas=()=>[];def.caimanes=[];}
  const river=buildRiver(def);
  if(options.items === false){river.snags=[];if(river.branch)river.branch.snags=[];}
  return river;
}
