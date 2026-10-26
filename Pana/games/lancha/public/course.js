// i18n-ignore-file: river sections and landmarks are place names.
// Lancha's course: Caño del Sipapo → Raudales de Atures → el Orinoco →
// Puerto Ayacucho. About twice Curiara's river in length and width, because a
// lancha runs near 55 km/h. The machinery (splines, levels, currents, guide
// line, buoys) is the shared /engine/river/river.js.
import { buildRiver, clamp, smooth } from '../../../engine/river/river.js';

const wave = (s, a, b) => Math.sin(s * a + b);
const ease = (s, a, b, from, to) => from + (to - from) * smooth(a, b, s);
// Where each tramo starts, and the two raudales.
export const TRAMOS = Object.freeze({ cano: 620, r1: 756, r2: 916, orinoco: 1056 });
const { cano: CANO, r1: R1, r2: R2, orinoco: ORINOCO } = TRAMOS;

// Raudal lanes [from, to] across, each with its steps [ds, drop m]; every lane
// drops 1.5 m in total. The fast lane falls at once: the big jump.
const lanes = fastSide => {
  const steps3 = [[-8, .5], [0, .5], [8, .5]], steps2 = [[-5, .75], [5, .75]], fast = [[0, 1.5]];
  if (fastSide === 0) return [{ from: -20, to: -6.8, steps: steps3, boost: .5 }, { from: -5.3, to: 5.3, steps: fast, boost: 2.2, fast: true }, { from: 6.8, to: 20, steps: steps3, boost: .5 }];
  return [{ from: -20, to: -6.8, steps: steps3, boost: .5 }, { from: -5.3, to: 7.1, steps: steps2, boost: 1.1 }, { from: 8.6, to: 20, steps: fast, boost: 2.2, fast: true }];
};

export function sipapoDefinition() {
  let curvature = () => 0, LEN = 1830;
  return {
    nodes: [[0, 46], [0, 14], [-12, -16], [-6, -44], [10, -62], [16, -88], [30, -106], [52, -114], [66, -136], [60, -164], [40, -180], [22, -196],
      [8, -222], [2, -258], [-1, -296], [1, -334], [5, -372], [4, -408],
      [-6, -446], [-30, -486], [-42, -532], [-30, -580], [4, -620], [28, -664], [24, -712], [4, -752], [-6, -790], [-8, -818]].map(([x, z]) => [-x * 1.9, z * 1.9]),
    setup(main) { curvature = s => main.at(s).k; LEN = main.length; },
    width(s) {
      let w = ease(s, 30, 90, 26, 20 + 2.5 * wave(s, .024, 1));
      w = ease(s, CANO - 15, CANO + 40, w, 44);
      w = ease(s, R2 + 40, ORINOCO + 30, w, 58 + 7 * wave(s, .011, .4));
      // The landing narrows to fit the finish arch (at most 60 m).
      return ease(s, LEN - 130, LEN - 45, w, 56);
    },
    top: 14, slope: .0028,
    depth: s => s < CANO ? 1.8 : s < ORINOCO ? 1.6 : 3,
    current: s => ease(s, CANO - 30, CANO + 30, 2.3, 2.6) + ease(s, R2 + 50, ORINOCO, 0, -.4) - ease(s, LEN - 110, LEN - 40, 0, 1.3),
    // The chorro rides the outside of the caño's bends and snakes across the Orinoco.
    chorro(s) {
      const half = this.width(s) / 2;
      if (s < CANO) return clamp(-curvature(s + 10) * 85, -1, 1) * half * .45;
      if (s < R2 + 30) return 0;
      return ease(s, R2 + 30, ORINOCO + 20, 0, 1) * half * .5 * wave(s, .01, 2.2);
    },
    chorroBoost: s => s < 70 ? 0 : s < CANO ? 1.5 : s < ORINOCO ? 1.2 : s > LEN - 90 ? 0 : 2.6,
    drops: [{ s: R1, span: 14, lanes: lanes(0) }, { s: R2, span: 14, lanes: lanes(1) }],
    bank(s, offset) {
      if (s < CANO) return { lip: 1.3, run: 2.4, rise: 8 };
      if (s < ORINOCO - 50) return { lip: 1.6, run: 2, rise: 12 };
      const inside = Math.sign(offset) === Math.sign(curvature(s)) ? 0 : 1;
      return inside ? { lip: .35, run: 16, rise: 4 } : { lip: .9, run: 4, rise: 7 };
    },
    look(s, offset) {
      if (s < CANO - 30) return {};
      if (s < ORINOCO - 50) return { rock: 1 };
      return { sand: Math.sign(offset) === Math.sign(curvature(s)) ? .2 : 1 };
    },
    // El atajo del igapó: short, narrow and full of flooded trunks.
    branch: { from: 274, to: 562, width: 10, current: 1.4, nodes: [[-36, -220], [-42, -274], [-44, -327]] },
    whirl: { s: 1474, offset: -12, r: 13, swirl: 3.6, pull: 1.5 },
    eddies(main) {
      const out = [];
      for (let s = 90; s < CANO - 20; s += 3) {
        const k = main.at(s).k, before = main.at(s - 3).k, after = main.at(s + 3).k;
        if (Math.abs(k) > .016 && Math.abs(k) >= Math.abs(before) && Math.abs(k) >= Math.abs(after)) out.push({ s, offset: Math.sign(k) * (this.width(s) / 2 - 2.2), r: 4.5, k: 1.25 });
      }
      for (const d of [R1, R2]) for (const side of [-1, 1]) out.push({ s: d + 34, offset: side * 14, r: 7, k: 1.3 });
      for (const [s, offset] of [[1163, 15], [1311, -18], [1649, -15]]) out.push({ s: s + 8, offset, r: 9, k: 1.2 });
      return out;
    },
    rocks() {
      const out = [];
      for (const d of this.drops) {
        for (let i = 1; i < d.lanes.length; i++) for (let ds = -d.span - 1, k = 0; ds <= d.span - 2; ds += 1.9, k++) out.push({ s: d.s + ds, offset: (d.lanes[i - 1].to + d.lanes[i].from) / 2, r: k ? .62 + .14 * Math.abs(wave(ds, 1.7, d.s)) : .45 });
        for (const side of [-1, 1]) out.push({ s: d.s - d.span - 3, offset: side * 21.5, r: 1.6 });
      }
      for (const [s, offset, r] of [[1163, 15, 2.6], [1311, -18, 3], [1649, -15, 2.4], [479, -2.5, 1.2], [209, 0, 1.1]]) out.push({ s, offset, r });
      return out;
    },
    sectors: [[0, 'Caño del Sipapo'], [CANO, 'Raudales de Atures'], [ORINOCO, 'El Orinoco'], [1720, 'Puerto Ayacucho']],
    tints: [R1 - 16, R2 + 16], gates: 24,
    logs() {
      const out = [];
      for (let s = 100, i = 0; s < CANO - 25; s += 38 + (i * 11) % 14, i++) {
        if (s > 266 && s < 290) continue;
        const side = i % 2 ? 1 : -1;
        out.push({ id: i, s, offset: side * (this.width(s) / 2 - .35), side, caiman: i % 3 === 1 });
      }
      return out;
    },
    toninas() { const out = []; for (let s = ORINOCO + 40; s < LEN - 130; s += 62) out.push({ s, offset: this.chorro(s) }); return out; },
    caimanes: [{ s: ORINOCO + 120, offset: 0, span: 14, period: 30 }, { s: ORINOCO + 260, offset: 4, span: 12, period: 26 }, { s: ORINOCO + 410, offset: 6, span: 13, period: 32 }, { s: ORINOCO + 560, offset: -3, span: 14, period: 28 }, { s: ORINOCO + 690, offset: 2, span: 12, period: 34 }],
    buoys: { from: ORINOCO + 30, every: 55, gap: 9, minHalf: 18 },
    tepui: { x: -19, z: -2185, width: 150, depth: 100, height: 240, name: 'Tepui del Sipapo' },
    finish: { secondary: 'PUERTO AYACUCHO' },
    fog: [120, 1500],
  };
}

export const RIVER = buildRiver(sipapoDefinition());

// Room options can drop the raudales or the river's objects; the plain course
// is built once and shared.
export function courseRiver(options = {}) {
  if (options.falls !== false && options.items !== false) return RIVER;
  const def = sipapoDefinition();
  if (options.falls === false) def.drops = [];
  if (options.items === false) { def.rocks = () => []; def.logs = () => []; def.toninas = () => []; def.caimanes = []; }
  const river = buildRiver(def);
  if (options.items === false) { river.snags = []; if (river.branch) river.branch.snags = []; }
  return river;
}
