// The old expedition's gear on the camp: a headframe over the mine, scaffolds up the
// rock, a winch on the gantry, a derrick standing in the lake, strings of bulbs across
// the hall, the searchlight and the stores. Baked with the cavern, so all of it is
// one batch per material. Looks only: nothing tall stands inside CAMP_RECT (a test
// reads PROP_SPOTS), and what crosses over the camp hangs far above anyone's head.
import * as THREE from 'three';
import { mineLantern, mineLanternPost, mineLadder, bulbWire, mineCrate } from '/engine/models/props/mine.js';
import { supplyCrate, hoopedBarrel, campTools } from '/engine/models/props/expedition-camp.js';
import { coiledRope } from '/engine/models/props/fosa-biomes.js';
import { LAKE_Y, PIT, PROP_SPOTS, SEARCHLIGHT, HEAD } from './camp-vista.js';

const WARM = 0xffb35c;

export function dressExpedition({ statics, bar, put, wood, iron, rope, unlit }) {
  const glows = [], glow = (x, y, z, size = 2.4) => glows.push({ x, y, z, color: WARM, size });
  const lantern = (x, y, z) => { put(mineLantern(), x, y + .48, z); glow(x, y, z); };
  const wheel = (x, y, z, h, r = 1.1) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * .1, 5, 14), iron); ring.position.set(x, y, z); ring.rotation.y = h; statics.add(ring);
    const c = Math.cos(h), s = Math.sin(h); for (let i = 0; i < 2; i++) { const a = i * Math.PI / 2; bar(iron, x - Math.cos(a) * r * c, y - Math.sin(a) * r, z + Math.cos(a) * r * s, x + Math.cos(a) * r * c, y + Math.sin(a) * r, z - Math.cos(a) * r * s, .07); }
  };

  // The headframe over the mine mouth: this is the lift's own wheel, its cable going in over the sign.
  const HF = 14;
  for (const s of [-1, 1]) { bar(wood, s * 4.4, 0, -2.45, s * 2.1, HF, -2.6, .3); bar(wood, s * 4.4, 4.2, -2.45, s * 1.2, 6.8, -2.5, .14); bar(wood, s * 4.4, 8.6, -2.45, s * 1.2, 11.2, -2.55, .14); }
  bar(wood, -3.8, 6.6, -2.6, 3.8, 6.6, -2.6, .2); bar(wood, -3.1, 10.8, -2.6, 3.1, 10.8, -2.6, .18); bar(wood, -2.5, HF, -2.6, 2.5, HF, -2.6, .28);
  wheel(0, HF + 1.3, -2.6, 0, 1.45); bar(wood, -.1, HF, -2.6, -.1, HF + 1.3, -2.6, .1);
  for (const x of [-.5, .5]) bar(iron, x, HF + 1, -2.7, x, 5.6, -3.05, .04);
  bar(iron, 0, HF + 2.6, -2.7, -6, 30, -7.5, .04);
  lantern(-2.4, 6.1, -2.6); lantern(2.4, 6.1, -2.6); lantern(0, 10.3, -2.65);

  // Scaffolds zigzag up the rock's east face, from the rim into the dark.
  const FX = 5.6, Z0 = -3.6, Z1 = -13;
  for (let k = 0; k < 7; k++) {
    const y = k * 6.5, x = FX + (k % 2) * .25, nx = FX + ((k + 1) % 2) * .25, a = k % 2 ? Z1 : Z0, b = k % 2 ? Z0 : Z1;
    for (const z of [Z0, Z1]) { bar(wood, x + 1.6, y, z, nx + 1.6, y + 6.5, z, .16); bar(wood, x - .2, y, z, nx - .2, y + 6.5, z, .12); bar(wood, x - .3, y + 3.2, z, x + 1.7, y + 3.2, z, .1); }
    if (k) { bar(wood, x + .2, y, Z0, x + .2, y, Z1, .12); bar(wood, x + 1.4, y, Z0, x + 1.4, y, Z1, .12); bar(rope, x + 1.6, y + 1, Z0, x + 1.6, y + 1, Z1, .03); }
    bar(wood, x + .8, y + .1, a, nx + .8, y + 6.4, b, .22);
    if (k % 2) lantern(x + 1.7, y + 3, a); else glow(x + 1.7, y + 3, a, 1.7);
  }
  // Legs for the scaffold's foot, down to the rock of the pit's collar.
  for (const z of [Z0, Z1]) { bar(wood, FX + 1.6, -8, z, FX + 1.6, 0, z, .22); bar(wood, FX - .2, -8, z, FX - .2, 0, z, .16); }
  // A long ladder bolted to the rock over the shop, with a little landing, going nowhere you can follow.
  for (let k = 0; k < 3; k++) put(mineLadder({ height: 7, lean: 0 }), -11.5, k * 7, -3.1);
  bar(wood, -13, 21, -3.2, -10, 21, -3.2, .14); bar(wood, -13, 21, -4.4, -10, 21, -4.4, .14); lantern(-13.1, 19.9, -3.2);

  // A winch on the gantry, the drum wound with the cables that go down the pit.
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 1.5, 10).rotateZ(Math.PI / 2), iron); drum.position.set(11, 5.95, -3.5); statics.add(drum);
  for (const s of [-1, 1]) { bar(wood, 11 + s * .85, 5.15, -3.5, 11 + s * .85, 6.5, -3.5, .16); }
  bar(iron, 11, 5.95, -3.9, 11, 5.6, -8, .05); wheel(11, 5.75, -8, Math.PI / 2, .46);
  lantern(9.8, 4.2, -7.6);

  // Down the pit: a lit string of bulbs into the well, a stair of timbers, and the cage partway.
  for (let k = 0; k < 9; k++) {
    const y = PIT.top - 2.5 - k * 3.8, a = k * 1.3, r = PIT.r * .86;
    const light = new THREE.Mesh(new THREE.BoxGeometry(.3, .4, .3), unlit); light.position.set(PIT.x + Math.cos(a) * r, y, PIT.z + Math.sin(a) * r); statics.add(light);
    glows.push({ x: light.position.x, y, z: light.position.z, color: WARM, size: 2.2 });
    if (k) { const b = (k - 1) * 1.3; bar(iron, PIT.x + Math.cos(b) * r, y + 3.8, PIT.z + Math.sin(b) * r, PIT.x + Math.cos(a) * r, y, PIT.z + Math.sin(a) * r, .03); }
  }
  // A timber stair from the rim to the pit's lip, and lanterns standing all around that lip.
  bar(wood, 6.4, -.05, -2.9, 6.6, -6.4, -4.4, .24); bar(wood, 8.2, -.05, -2.9, 7.7, -6.4, -3.6, .24);
  for (let k = 1; k < 6; k++) { const t = k / 6; bar(wood, 6.4 + t * .2 - .1, -.05 - t * 6.35, -2.9 - t * 1.5, 8.2 - t * .5 + .1, -.05 - t * 6.35, -2.9 - t * .7, .09); }
  for (let k = 0; k < 8; k++) {
    const a = .7 + k / 8 * Math.PI * 2, x = PIT.x + Math.cos(a) * (PIT.r + .95), z = PIT.z + Math.sin(a) * (PIT.r + .95);
    bar(wood, x, PIT.top, z, x, PIT.top + 2.1, z, .12);
    const light = new THREE.Mesh(new THREE.BoxGeometry(.32, .42, .32), unlit); light.position.set(x, PIT.top + 2.2, z); statics.add(light);
    glows.push({ x, y: PIT.top + 2.2, z, color: WARM, size: 3.2 });
  }

  // A derrick out on the water, knee-braced, with its own lamp and sheave.
  const DX = 25.5, DZ = 25, DTOP = 24, foot = 4.2, leg = (y, sx, sz) => { const k = 1 - (y - LAKE_Y) / (DTOP - LAKE_Y); return [DX + sx * (foot * k + .5), y, DZ + sz * (foot * k + .5)]; }, corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of corners) bar(wood, ...leg(LAKE_Y - 1, sx, sz), ...leg(DTOP, sx, sz), .34);
  for (let y = LAKE_Y + 5; y < DTOP; y += 6.2) corners.forEach(([sx, sz], i) => { const [nx, nz] = corners[(i + 1) % 4]; bar(wood, ...leg(y, sx, sz), ...leg(y, nx, nz), .16); bar(wood, ...leg(y, sx, sz), ...leg(Math.min(DTOP, y + 6.2), nx, nz), .08); });
  wheel(DX, DTOP + 1.1, DZ, .7, 1.2); bar(wood, DX - 1.3, DTOP, DZ, DX + 1.3, DTOP, DZ, .2); bar(iron, DX + .4, DTOP + 1, DZ, DX + .4, LAKE_Y + .5, DZ, .04);
  lantern(DX - 1.1, DTOP - 1.2, DZ); lantern(DX + 2.4, 13, DZ - 2.4);

  // Strings of bulbs crossing the hall, from mast to mast.
  const mast = (x, z, height) => { bar(wood, x, -.05, z, x, height + .6, z, .18); glow(x, height + .2, z, 1.8); return [x, height, z]; };
  const string = ([ax, ay, az], [bx, by, bz], sag) => {
    const span = Math.hypot(bx - ax, bz - az), h = Math.atan2(-(bz - az), bx - ax), y = (ay + by) / 2;
    put(bulbWire({ span, sag, height: y, posts: false }), (ax + bx) / 2, 0, (az + bz) / 2, h);
  };
  const north = [4.4, 11.5, -2.5], westA = mast(-19.6, 14, 11.5), south = mast(-11, 31.6, 11.5), east = [DX - 3, 11.5, DZ - 2.4], low = mast(19.8, 16, 7.5), rim = [FX + 1.6, 9.8, Z1 + .2];
  string(north, westA, 2.2); string(westA, south, 1.8); string(south, east, 2.6); string(east, north, 2.8);
  string([low[0], low[1] - 1, low[2]], [FX + 1.6, 6.5, Z0], 1.3);
  string(rim, [36, 9.8, -6], 2.2);
  const midMast = [36, 9.8, -6]; bar(wood, 36, LAKE_Y, -6, 36, 10.4, -6, .18); glow(36, 10, -6, 2.4);

  // Standing lanterns and stores along the foot of the rock.
  for (const [kind, x, z] of PROP_SPOTS) {
    if (kind === 'post') { put(mineLanternPost(), x, 0, z, x > 0 ? Math.PI : z > 30 ? -Math.PI / 2 : 0); glow(x + (x > 0 ? -.75 : z > 30 ? 0 : .75), 2.7, z + (z > 30 ? -.75 : 0), 1.9); }
    else if (kind === 'crate') put(supplyCrate({ size: .72, olive: (x * 3 + z | 0) % 2 === 0 }), x, 0, z, x + z);
    else if (kind === 'tnt') put(mineCrate({ seed: Math.round(z), size: .7, tnt: true }), x, 0, z, z);
    else if (kind === 'barrel') put(hoopedBarrel({ scale: .82 }), x, 0, z);
    else if (kind === 'rope') put(coiledRope({ size: .3 }), x, 0, z);
    else if (kind === 'tools') put(campTools(), x, 0, z, Math.PI / 2);
  }
  // The searchlight on its outrigger past the rail, aimed for good at the far wall.
  const S = SEARCHLIGHT;
  for (const z of [S.z - 1.2, S.z + 1.2]) { bar(wood, 18.65, -.04, z, S.x, S.y - .6, S.z, .14); bar(iron, 18.65, .9, z, S.x, S.y - .5, S.z, .05); }
  bar(iron, S.x, S.y - .7, S.z, S.x, S.y, S.z, .12);
  const aim = new THREE.Vector3(HEAD.x - S.x, HEAD.y - S.y, HEAD.z - S.z).normalize(), spin = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), aim);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.56, .42, 1.1, 12), iron); lamp.position.set(S.x, S.y, S.z); lamp.quaternion.copy(spin); statics.add(lamp);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(.5, 12).rotateX(-Math.PI / 2), unlit); lens.position.set(S.x + aim.x * .57, S.y + aim.y * .57, S.z + aim.z * .57); lens.quaternion.copy(spin); statics.add(lens);
  glow(S.x + aim.x * .6, S.y + aim.y * .6, S.z + aim.z * .6, 3.4);
  return glows;
}
