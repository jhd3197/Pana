// Cancha de noche: Pepazo's glow field under red floodlights. Renderer-free, so
// the server's collision and the scene's bunkers read the same rows.
// Metres; the court is the usual 54 m square.
export const NOCHE_SIZE = 27;
// [kind, x, z, w, d, h]. Kinds: pallet, can, dorito, snake, brick, tube, tower.
const row = ([kind, x, z, w, d, h]) => ({ kind, x, z, w, d, h, height: h });
// Four-fold turns of one quarter: every spawn sees the same field.
const quarter = rows => rows.flatMap(([kind, x, z, w, d, h]) => [[kind, x, z, w, d, h], [kind, z, -x, d, w, h], [kind, -x, -z, w, d, h], [kind, -z, x, d, w, h]]);
// Mirror across both axes: two ends of a speedball field.
const mirror = rows => rows.flatMap(([kind, x, z, w, d, h]) => [[kind, x, z, w, d, h], [kind, -x, z, w, d, h], [kind, x, -z, w, d, h], [kind, -x, -z, w, d, h]]);
// Three fixed fields, one per round: Torre (a lookout tower in the middle),
// Inflables (a speedball field of air bunkers) and Tubos (pallet lanes and culverts).
export const NOCHE_COVERS = [[
  ['tower', 0, 0, 3.4, 3.4, 2.6],
  ...quarter([
    ['pallet', 8, 3, 1.3, 4, 1.7], ['dorito', 5, 10, 2.2, 2.2, 1.9], ['can', 14, 8, 1.8, 1.8, 2.2],
    ['snake', 12, 17, 5, 1.2, 1], ['tube', 18.5, 5.5, 1.6, 3.6, 1.6], ['pallet', 21, 13, 2.6, 1.3, 1.6],
  ]),
], [
  ['brick', 0, 0, 2.4, 1.4, 1.4], ['snake', 0, 10, 6, 1.2, 1], ['snake', 0, -10, 6, 1.2, 1],
  ...mirror([
    ['dorito', 6, 4, 2.2, 2.2, 1.9], ['can', 12, 3, 1.8, 1.8, 2.2], ['brick', 18, 6, 2.4, 1.4, 1.4],
    ['can', 7, 15, 1.8, 1.8, 2.2], ['dorito', 14, 12, 2.2, 2.2, 1.9], ['snake', 15, 20, 1.2, 4.5, 1],
  ]),
], [
  ['pallet', 0, 0, 2.6, 2.6, 2],
  ...quarter([
    ['pallet', 6.5, 5, 1.3, 5, 1.8], ['tube', 12, 2, 1.6, 4, 1.6], ['pallet', 10, 12, 5, 1.3, 1.8],
    ['can', 17, 9, 1.8, 1.8, 2.2], ['tube', 4, 16, 4, 1.6, 1.6], ['pallet', 20, 15, 1.3, 2.8, 1.6],
  ]),
]].map(rows => rows.map(row));
// Same eight exits as the shared courts, spread to the 54 m field.
export const NOCHE_SPAWNS = [{ x: -22.5, z: -22.5 }, { x: 22.5, z: 22.5 }, { x: 22.5, z: -22.5 }, { x: -22.5, z: 22.5 }, { x: 0, z: -24 }, { x: 0, z: 24 }, { x: -24, z: 0 }, { x: 24, z: 0 }];
// Floodlight masts outside the fence, aimed at the middle: red at the corners, UV purple on two sides.
export const MASTS = [[-31, -31, 'red'], [31, 31, 'red'], [31, -31, 'red'], [-31, 31, 'red'], [0, -32, 'uv'], [0, 32, 'uv']];
