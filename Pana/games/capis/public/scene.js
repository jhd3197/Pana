// Capis a Pintazos in 3D, seen from the side: a perspective camera looks at
// the playing plane. The ground is the destructible mask painted into a
// texture (engine/play/terrain-mask.js paintRGBA → THREE.DataTexture) on a
// stack of planes, so it reads as a slab of earth with depth; the capis are
// panas (the shared studio character, the player's own look on our lead
// capi) with a team bandana, each holding Pepazo's La Bazuca; the world
// behind is real 3D scenery (backdrop.js).
import * as THREE from 'three';
import { rendererOptions, bindRenderer } from '/engine/settings.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar, randomAvatar } from '/engine/avatar.js';
import { rng } from '/engine/random.js';
import { bakePaintKit, createPaintRocket } from '/engine/models/props/paintball-kit.js';
import { createRigLod } from '/engine/models/core/rig-lod.js';
import { chooseFar } from '/engine/models/core/lod-band.js';
import { createLocalMarker } from '/engine/play/local-outline.js';
import { Puffs } from '/engine/fx.js';
import { createBlastFx } from '/engine/play/blast-fx.js';
import { guideRibbon, pathLength } from '/engine/play/aim-guide.js';
import { createRecoil, shakeAt } from '/engine/play/recoil.js';
import { paintRGBA, takeDirty, solidAt } from '/engine/play/terrain-mask.js';
import { createSpray } from '/engine/play/spray.js';
import { glowTexture } from '/engine/models/props/glow-paintball.js';
import { simulateFlight, aimVelocity } from '/engine/play/ballistic.js';
import { RULES, TEAM_COLORS, alive, muzzle, flightOptions, activeCapy } from './rules.js';
import { aiming, bodyPose, barrelPose } from './poses.js';
import { createBackdrop } from './backdrop.js';
import { rockAt, grassAt } from './map-rules.js';

const FRONT = 1;               // the depth where capis and shells move
const SLAB = [-2.6, .55];      // the earth's back and front faces
const LAYERS = 9, DASHES = 18, HUMAN = 0;
// A pana is 2.16 units tall: ×.8 a capi stands 1.7, its 1.4 body disc plus the head.
const CAPY_SCALE = .8, HEAD = 2.05;
// La Bazuca in the hands: its scale, and how far towards the camera it rides (the near shoulder).
const LAUNCHER = .6, NEAR = .36;
// The body turns a little towards the camera (78 % of a quarter turn) so the
// face reads past the barrel; La Bazuca itself stays exactly in the side plane.
const TURN_IN = .78;
const ROCKET = 2.2;
// Far from the camera (the whole-map view) a capi is drawn as one merged,
// lower-detail copy of itself and its launcher (rig-lod.js): from 55 units on,
// back to full detail under 47. The play view is about 31 to 40 away.
const LOD_BAND = { far: 55, near: 47 }, LOD_CELL = .06;
const rgb = hex => { const c = new THREE.Color(hex); return [c.r * 255, c.g * 255, c.b * 255]; };
// The ground's look: grass with a fringe of blades on top, roots in the topsoil,
// earth darkening with depth, rock strata, sand on the beach and the sandbar,
// shade under overhangs (terrain-mask.js paintRGBA).
const PALETTE = { earth: [178, 112, 62], deep: [88, 52, 34], topsoil: [116, 74, 42], grass: [96, 166, 56], tints: TEAM_COLORS.map(rgb), grassDepth: 5,
  sand: [226, 198, 140], wet: [176, 150, 108], rock: [156, 134, 110], roots: [104, 70, 42], fringe: 3, shade: .5, rockAt, grassAt,
  deepFrom: 14, deepAt: 120 };
// The back wall behind the slab: where the ground was at the start and in the
// map's hollows (caves), so a crater reads as a dent and a cave has a back
// instead of a window onto the sky.
const BACK = [98, 64, 42];
// The colours a blast throws up: topsoil, earth, grass and rock.
const CLODS = ['#6f4a2a', '#9c6a3c', '#5c9a36', '#8f7c66'];
const { damp } = THREE.MathUtils;

// Our lead capi wears the player's own pana; the others are seeded panas in
// their team's shirt, the same look on every load.
function lookFor(c) {
  if (c.team === HUMAN && c.slot === 0) return loadAvatar();
  return { ...randomAvatar(rng(101 + c.team * 31 + c.slot * 7)), outfitColor: TEAM_COLORS[c.team] };
}

export function createCapisScene(canvas, match) {
  const renderer = new THREE.WebGLRenderer(rendererOptions({ canvas, antialias: true }));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const unbind = bindRenderer(renderer, 2);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .5, 600);
  // Late afternoon in the Llanos: warm low sun from the front left, a soft warm rim from behind.
  scene.add(new THREE.HemisphereLight('#ffe9c8', '#5f5a34', 1.45));
  const sun = new THREE.DirectionalLight('#ffd9a8', 2.5); sun.position.set(-34, 30, 34); scene.add(sun);
  const rim = new THREE.DirectionalLight('#ffb27a', .7); rim.position.set(30, 14, -40); scene.add(rim);
  const backdrop = createBackdrop(scene, match.map);
  let mask = match.mask;
  const palette = { ...PALETTE, sandBelow: match.map.water + 2.4 };

  // ---------- the ground ----------
  const pixels = new Uint8Array(mask.cols * mask.rows * 4);
  const texture = new THREE.DataTexture(pixels, mask.cols, mask.rows, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false;
  const plane = new THREE.PlaneGeometry(mask.width, mask.height), layers = [];
  for (let i = 0; i < LAYERS; i++) {
    const k = i / (LAYERS - 1), shade = .55 + .45 * k;
    const layer = new THREE.Mesh(plane, new THREE.MeshLambertMaterial({ map: texture, alphaTest: .5, color: new THREE.Color(shade, shade, shade), side: THREE.DoubleSide }));
    layer.position.set(mask.width / 2, mask.height / 2, SLAB[0] + (SLAB[1] - SLAB[0]) * k); scene.add(layer); layers.push(layer);
  }
  const backPixels = new Uint8Array(mask.cols * mask.rows * 4);
  const backTexture = new THREE.DataTexture(backPixels, mask.cols, mask.rows, THREE.RGBAFormat);
  backTexture.colorSpace = THREE.SRGBColorSpace; backTexture.magFilter = backTexture.minFilter = THREE.LinearFilter; backTexture.generateMipmaps = false;
  const backWall = new THREE.Mesh(plane, new THREE.MeshLambertMaterial({ map: backTexture, alphaTest: .5 }));
  backWall.position.set(mask.width / 2, mask.height / 2, SLAB[0] - .05); scene.add(backWall);
  function paintBack() {
    for (let c = 0; c < mask.cols; c++) {
      for (let r = mask.rows - 1; r >= 0; r--) {
        const i = r * mask.cols + c, o = i * 4;
        if (!mask.solid[i] && !mask.hollow?.[i]) { backPixels[o + 3] = 0; continue; }
        const k = .75 + .25 * Math.min(1, r / 140) + (((c * 73856093) ^ (r * 19349663)) >>> 27) / 160;
        backPixels[o] = BACK[0] * k; backPixels[o + 1] = BACK[1] * k; backPixels[o + 2] = BACK[2] * k; backPixels[o + 3] = 255;
      }
    }
    backTexture.needsUpdate = true;
  }
  function paintTerrain(rect = takeDirty(mask)) {
    if (!rect) return;
    paintRGBA(mask, pixels, palette, rect); texture.needsUpdate = true;
    if (rect.r0 * mask.cell < match.map.water + .2) backdrop.shore(mask);
  }

  // Pooled effects, one draw each while anything flies: paint and water drops,
  // clods of earth, sparks, and rings on the water.
  const drops = createSpray(scene, { shape: 'drop', capacity: 320, roughness: .25 });
  const clods = createSpray(scene, { shape: 'clod', capacity: 160, gravity: 22, drag: .3 });
  const sparks = createSpray(scene, { shape: 'spark', capacity: 96, additive: true, gravity: 6, drag: 2.2 });
  const rings = createSpray(scene, { shape: 'ring', capacity: 48, additive: true });
  const sprays = [drops, clods, sparks, rings];
  const solid = (x, y) => solidAt(mask, x, y);
  let ringBudget = 0;
  const ripple = (x, z) => { if (ringBudget > 0) { ringBudget--; rings.burst({ x, y: match.map.water + .04, z }, { count: 1, color: '#9fc9d6', speed: 0, size: .1, grow: .9, life: .55 }); } };
  // Water thrown up where something falls in the river: a crown of drops, rings, mist.
  function waterSplash(x, size, color = null) {
    const at = { x, y: match.map.water + .1, z: FRONT };
    drops.burst(at, { count: Math.round(30 * size), color: '#dff4ff', speed: 10 * size, dir: { x: 0, y: 1 }, cone: .45, size: .11, life: 1.2, spread: .6 });
    drops.burst(at, { count: Math.round(14 * size), color: '#8cc6d8', speed: 5 * size, dir: { x: 0, y: 1 }, cone: 1.1, size: .09, life: .9, spread: .8 });
    if (color) drops.burst(at, { count: 10, color, speed: 6, dir: { x: 0, y: 1 }, cone: .8, size: .1, life: 1 });
    for (let i = 0; i < 3; i++) rings.burst(at, { count: 1, color: i ? '#a7d3e0' : '#ffffff', speed: 0, size: .3 + i * .2, grow: (1.6 + i * 1.1) * size, life: .7 + i * .35 });
    puffs.spawn(at, { color: '#e9f7ff', count: Math.round(8 * size), spread: 1, size: .55, rise: 2.4, life: .8 });
  }

  // ---------- capis ----------
  // Shared by every capi: the team cloth, the bandana's shape and one batched
  // La Bazuca per team that every capi's launcher clones.
  const cloth = TEAM_COLORS.map(color => new THREE.MeshStandardMaterial({ color, roughness: .6 }));
  const bandanaGeo = new THREE.TorusGeometry(.5, .1, 8, 24), knotGeo = new THREE.ConeGeometry(.16, .42, 4);
  const launchers = TEAM_COLORS.map(color => bakePaintKit({ weapon: 'bazooka', color }));
  const stain = TEAM_COLORS.map(color => new THREE.Color(color));
  function buildCapi(c) {
    const avatar = buildCharacter(lookFor(c)), root = new THREE.Group(), turn = new THREE.Group();
    avatar.group.scale.setScalar(CAPY_SCALE); turn.add(avatar.group); root.add(turn);
    // Every surface of the coat and clothes, to stain with the rival's paint.
    const coat = [];
    avatar.group.traverse(o => { for (const mt of [o.material].flat()) if (mt?.color && !coat.some(k => k.mt === mt)) coat.push({ mt, base: mt.color.clone() }); });
    // The team bandana round the neck, knotted at the back (sculpt units, inside the body).
    const bandana = new THREE.Mesh(bandanaGeo, cloth[c.team]); bandana.name = 'Pañoleta'; bandana.position.set(0, 1.8, .02); bandana.rotation.x = Math.PI / 2 + .25; avatar.body.add(bandana);
    const knot = new THREE.Mesh(knotGeo, cloth[c.team]); knot.position.set(0, 1.92, -.5); knot.rotation.x = -2.2; avatar.body.add(knot);
    // La Bazuca pivots on the shoulder (rules.js `shoulder`); `kick` slides it back on a shot.
    const gun = new THREE.Group(), kick = new THREE.Group(), kit = launchers[c.team], launcher = kit.clone();
    gun.rotation.order = 'YXZ'; root.add(gun); gun.add(kick);
    launcher.scale.setScalar(LAUNCHER); launcher.position.set(0, -kit.userData.bore * LAUNCHER, RULES.muzzle - kit.userData.tip * LAUNCHER); kick.add(launcher);
    const tip = new THREE.Object3D(); tip.position.z = RULES.muzzle; kick.add(tip);
    const ears = avatar.head.children.filter(o => o.name === 'Cupped ear').map(o => ({ o, z: o.rotation.z }));
    const lod = createRigLod(root, { pivots: [turn, avatar.body, avatar.head, ...avatar.arms, ...avatar.legs, kick], cell: LOD_CELL });
    return { avatar, root, turn, gun, kick, launcher, tip, coat, ears, bandana, lod, seed: c.slot * 1.7 + c.team * 2.9 };
  }
  const capis = new Map();
  function setMatch(next) {
    match = next; mask = next.mask;
    for (const c of match.capys) {
      let m = capis.get(c.id);
      if (!m) { m = buildCapi(c); capis.set(c.id, m); scene.add(m.root); }
      const yaw = c.facing > 0 ? Math.PI / 2 : -Math.PI / 2, pose = barrelPose(match, c);
      Object.assign(m, { hit: 0, sink: 0, fall: 0, paint: -1, lastX: c.x, speed: 0, yaw, pitch: pose.pitch, drop: pose.drop });
      m.root.visible = true; m.root.rotation.set(0, 0, 0); m.gun.visible = true;
    }
    takeDirty(mask); paintRGBA(mask, pixels, palette); texture.needsUpdate = true; backdrop.shore(mask); paintBack();
    for (const spray of sprays) spray.clear();
  }
  setMatch(match);
  const marker = createLocalMarker({ color: '#ffc629' }); marker.group.scale.setScalar(3); scene.add(marker.group);
  const aimArrow = guideRibbon('#fff6d8', .14, { segments: 1, opacity: .95 }); aimArrow.rotation.x = Math.PI / 2; scene.add(aimArrow);
  const dashes = Array.from({ length: DASHES }, () => { const d = guideRibbon('#ffffff', .12, { segments: 1, opacity: .85 }); d.rotation.x = Math.PI / 2; scene.add(d); return d; });

  // ---------- the shot: flash, charge, rocket, effects ----------
  const puffs = new Puffs(scene), fx = createBlastFx(scene, puffs), feel = createRecoil(), gunFeel = createRecoil({ recover: 3 });
  // La Bazuca's rocket in flight, one per team colour.
  const rockets = TEAM_COLORS.map(color => { const r = createPaintRocket({ color }); r.scale.setScalar(ROCKET); r.visible = false; scene.add(r); return r; });
  // The muzzle flash, and a drop of paint that swells at the barrel's tip while the shot charges.
  // The flash is a soft glow and a streak along the barrel, both on the shared glow texture.
  const glow = glowTexture();
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glow, color: '#ffe9a8', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const streak = new THREE.Mesh(flash.geometry, new THREE.MeshBasicMaterial({ map: glow, color: '#fff3c4', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  flash.visible = streak.visible = false; scene.add(flash, streak);
  let flashAngle = 0;
  const drip = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: .4, roughness: .2 }));
  drip.visible = false; scene.add(drip);
  const focus = new THREE.Vector2(match.capys[0].x, match.capys[0].y + 2), goal = new THREE.Vector2();
  const at = new THREE.Vector3(), dir = new THREE.Vector3(), tail = new THREE.Vector3(), NOSE = new THREE.Vector3(0, 0, 1), back = new THREE.Vector2(), UP = { x: 0, y: 1 };
  let wide = false, hold = 0, holdAt = null, time = 0, shooter = null, flashT = 0, trailT = 0;
  let closeUp = 0;   // a narrower view for test screenshots (capisDebug)
  const viewWidth = () => wide ? match.map.width + 8 : closeUp || (camera.aspect < 1 ? 22 : 34);

  function event(e) {
    const c = e.capy && capis.get(e.capy), team = e.team ?? e.by;
    if (e.type === 'fire') {
      feel.fire({ cam: 1.2, shake: .35 }); gunFeel.fire({ cam: 5 }); shooter = e.capy; flashT = 1; flash.rotation.z = Math.random() * Math.PI;
      c?.avatar.bounce(.5);
      const k = match.capys.find(x => x.id === e.capy), out = k ? { x: Math.cos(k.aim) * k.facing, y: Math.sin(k.aim) } : { x: 1, y: 0 };
      flashAngle = Math.atan2(out.y, out.x);
      const from = { x: e.x, y: e.y, z: FRONT + NEAR };
      puffs.spawn(from, { color: TEAM_COLORS[e.team], count: 10, spread: .45, size: .45, rise: .9, life: .55 });
      puffs.spawn(from, { color: '#f4efe4', count: 7, spread: .35, size: .55, rise: .6, life: .9 });
      sparks.burst(from, { count: 14, color: '#ffd27a', speed: 9, dir: out, cone: .35, size: .07, life: .28 });
      drops.burst(from, { count: 8, color: TEAM_COLORS[e.team], speed: 5, dir: out, cone: .5, size: .07, life: .8 });
    }
    if (e.type === 'blast') {
      // The blast: flash, fireball, a ring standing towards the camera, then
      // paint, clods of earth, sparks and dust flying out of the crater.
      const from = { x: e.x, y: e.y, z: FRONT }, paint = TEAM_COLORS[team];
      fx.boom({ x: e.x, y: e.y, z: FRONT, size: 1.1, color: paint, ground: e.y, front: true });
      puffs.spawn(from, { color: paint, count: 16, spread: 2.4, size: .5, rise: 3, life: 1.1 });
      puffs.spawn(from, { color: '#dccaa6', count: 10, spread: 3, size: .65, rise: 1.6, life: 1.6 });
      drops.burst(from, { count: 46, color: paint, speed: 12, dir: UP, cone: 1.25, size: .13, life: 1.6, spread: .8 });
      drops.burst(from, { count: 18, color: '#ffffff', speed: 8, dir: UP, cone: 1.4, size: .08, life: 1.1, spread: .6 });
      CLODS.forEach((color, i) => clods.burst(from, { count: i === 2 ? 6 : 9, color, speed: 10, dir: UP, cone: 1.15, size: .16, life: 2.2, spread: 1.2 }));
      sparks.burst(from, { count: 18, color: '#ffc861', speed: 13, cone: Math.PI, size: .08, life: .35 });
      ringBudget = 10;
      feel.shake(shakeAt(Math.hypot(e.x - focus.x, e.y - focus.y), 1.35, 36)); hold = .9; holdAt = { x: e.x, y: e.y };
    }
    if ((e.type === 'plop' || (e.type === 'out' && e.reason === 'water'))) {
      const x = e.x ?? match.capys.find(k => k.id === e.capy)?.x ?? focus.x, shell = e.type === 'plop';
      waterSplash(x, shell ? 1.2 : 1.4, shell ? TEAM_COLORS[match.turn?.team ?? 0] : null); ringBudget = 6;
      hold = 1.1; holdAt = { x, y: match.map.water + 3 };
      feel.shake(shakeAt(Math.abs(x - focus.x), shell ? .5 : .7, 30));
    }
    // A hit: the capi flinches with a squash, a wobble and a splash of the rival's paint.
    if (e.type === 'hit' && c) {
      const k = match.capys.find(x => x.id === e.capy);
      c.hit = 1; c.avatar.bounce(1.4); c.avatar.stagger(1, 0);
      if (k) {
        // The rival's paint bursts over the capi.
        const on = { x: k.x, y: k.y + 1.1, z: FRONT + .4 };
        puffs.spawn(on, { color: TEAM_COLORS[e.by], count: 10, spread: .9, size: .4, rise: 2.2, life: .8 });
        drops.burst(on, { count: 12 + Math.round(e.paint / 3), color: TEAM_COLORS[e.by], speed: 6.5, dir: UP, cone: 1.5, size: .1, life: 1.2, spread: .7 });
        sparks.burst(on, { count: 6, color: '#ffffff', speed: 7, cone: Math.PI, size: .06, life: .22 });
      }
    }
    if (e.type === 'out' && e.reason === 'paint' && c) c.avatar.bounce(1.6);
    if (e.type === 'turn') { hold = 0; holdAt = null; }
  }

  const ARROW = [{ x: 0, z: 0 }, { x: 0, z: 0 }];
  function preview(c, power, difficulty) {
    const show = power != null;
    dashes.forEach(d => { d.visible = false; });
    if (!show) return;
    const start = { ...muzzle(c), ...aimVelocity(c.aim, c.facing, power * RULES.speed) };
    const { points } = simulateFlight(start, flightOptions(match), { dt: 1 / 60, maxTime: 5, every: 1 });
    const reach = pathLength(points.map(p => ({ x: p.x, z: p.y }))) * (difficulty?.guide?.reach ?? 1);
    let walked = 0, n = 0;
    for (let i = 1; i < points.length && n < DASHES && walked < reach; i++) {
      const a = points[i - 1], b = points[i], l = Math.hypot(b.x - a.x, b.y - a.y); walked += l;
      if (Math.floor(walked / .9) === Math.floor((walked - l) / .9)) continue;
      const end = points[Math.min(points.length - 1, i + 2)];
      dashes[n].userData.set([{ x: b.x, z: -b.y }, { x: end.x, z: -end.y }], FRONT + .05); n++;
    }
  }

  // One capi's pose for this frame, from the match (poses.js) and its own
  // timers (a hit's flinch, sinking, toppling).
  function poseCapi(c, m, dt, recoil) {
    const { avatar, root, turn, gun, kick } = m, { body, legs, head } = avatar;
    m.speed = damp(m.speed, dt > 0 ? (c.x - m.lastX) / dt : 0, 12, dt); m.lastX = c.x;
    const pose = bodyPose(match, c, c.grounded ? m.speed : 0), up = aiming(match, c), k = m.hit = Math.max(0, m.hit - dt * 1.6);
    m.yaw = damp(m.yaw, c.facing > 0 ? Math.PI / 2 : -Math.PI / 2, 12, dt);
    root.position.set(c.x, c.y, FRONT); root.visible = true; root.rotation.z = c.facing * k * .45;
    turn.rotation.y = m.yaw * TURN_IN; turn.position.y = 0;
    avatar.update(dt, pose === 'walk' ? { walk: true, open: k > .2 } : { open: k > .2 || pose === 'cheer', dizzy: pose === 'splat' });
    // Paint shows on the coat as the rival's colour soaks in.
    if (m.paint !== c.paint) { m.paint = c.paint; const p = c.paint / 100 * .75; for (const s of m.coat) s.mt.color.copy(s.base).lerp(stain[1 - c.team], p);
      m.lod.material.color.setScalar(1 - p); m.lod.material.emissive.copy(stain[1 - c.team]).multiplyScalar(p * .55); }
    // Breathing, and now and then an ear flick.
    body.position.y += Math.sin(time * 2.3 + m.seed) * .018;
    const flick = Math.max(0, Math.sin(time * .8 + m.seed * 3) - .97) * 33;
    m.ears.forEach((e, i) => { e.o.rotation.z = e.z + Math.sin(time * 34 + i) * .35 * flick + (i ? -1 : 1) * k * .5; });
    // Where the barrel points: aimed on its turn, low otherwise, over the head to cheer.
    const barrel = barrelPose(match, c);
    let pitch = barrel.pitch, drop = barrel.drop;
    if (pose === 'cheer') { pitch = 1.2; drop = -.3; } else if (pose === 'sulk') { pitch = -1; drop = .5; }
    m.pitch = damp(m.pitch, pitch + k * .5, up ? 24 : 9, dt); m.drop = damp(m.drop, drop, 9, dt);
    const shot = c.id === shooter ? recoil : null, back = shot ? shot.kick : 0;
    gun.visible = pose !== 'splat';
    gun.position.set(-c.facing * back * .2, RULES.shoulder - m.drop, NEAR);
    gun.rotation.set(-(m.pitch + (shot ? shot.pitch * 1.6 : 0)), m.yaw, 0);
    kick.position.z = -back * .32;
    turn.position.x = -c.facing * back * .16;
    // Arms: the near paw on the rear grip, the far one across to the front grip.
    const s = c.facing > 0 ? -1 : 1, near = s < 0 ? avatar.armR : avatar.armL, far = s < 0 ? avatar.armL : avatar.armR;
    const reach = -(Math.PI / 2 + m.pitch);
    near.rotation.set(reach + .95 + m.drop * 1.4, 0, s * .1);
    far.rotation.set(reach + .3 + m.drop * 1.1, 0, s * .7);
    if (up) head.rotation.x -= m.pitch * .35;
    // Feet: tucked going up, reaching down coming down.
    if (pose === 'rise') { legs[0].rotation.x = -.9; legs[1].rotation.x = -.35; }
    else if (pose === 'fall') { legs[0].rotation.x = .3; legs[1].rotation.x = -.2; body.rotation.x -= .1; }
    else if (pose === 'cheer') {
      turn.position.y = Math.abs(Math.sin(time * 7 + m.seed)) * .35;
      avatar.arms.forEach((arm, i) => arm.rotation.set(-2.75 + Math.sin(time * 9 + i) * .2, 0, (i ? -1 : 1) * .3));
    } else if (pose === 'sulk') head.rotation.x += .45;
    else if (pose === 'splat') {
      // Painted head to toe: toppled onto the back, paws in the air, seeing stars.
      m.fall = Math.min(1, m.fall + dt * 2.5);
      root.rotation.z = c.facing * Math.PI / 2 * (1 - (1 - m.fall) ** 3); root.position.y += .35 * m.fall;
      legs.forEach((leg, i) => { leg.rotation.x = -1.3 + Math.sin(time * 6 + i * 2) * .25; });
      avatar.arms.forEach((arm, i) => arm.rotation.set(-2.6 + Math.sin(time * 7 + i) * .3, 0, (i ? -1 : 1) * .4));
    } else if (pose === 'sink') {
      // Into the river: paws up, spinning as it goes down.
      m.sink = Math.min(3, m.sink + dt * 1.5); root.position.y = match.map.water - m.sink; root.visible = m.sink < 3;
      turn.rotation.y = m.yaw * TURN_IN + m.sink * 4;
      avatar.arms.forEach((arm, i) => arm.rotation.set(-2.9 + Math.sin(time * 14 + i * 3) * .3, 0, (i ? -1 : 1) * .25));
    }
  }

  // view: { playing, power (0..1 while charging, else null), difficulty info, labels: (list) => void }
  function frame(dt, view = {}) {
    time += dt;
    const w = innerWidth, h = innerHeight;
    if (camera.aspect !== w / h) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
    paintTerrain();
    const active = activeCapy(match), recoil = gunFeel.update(dt, { decay: 3 });
    for (const c of match.capys) poseCapi(c, capis.get(c.id), dt, recoil);
    const turnOn = view.playing && active && alive(active) && match.phase === 'aim';
    marker.group.visible = !!view.playing && !!active && alive(active) && match.phase !== 'finished';
    if (marker.group.visible) marker.group.position.set(active.x, active.y + HEAD + .45, FRONT);
    marker.update(dt);
    aimArrow.visible = !!turnOn;
    if (turnOn) {
      const from = muzzle(active, active.aim), to = { x: from.x + Math.cos(active.aim) * active.facing * 1.4, y: from.y + Math.sin(active.aim) * 1.4 };
      ARROW[0] = { x: from.x, z: -from.y }; ARROW[1] = { x: to.x, z: -to.y }; aimArrow.userData.set(ARROW, FRONT + .1);
    }
    preview(active, turnOn ? view.power : null, view.difficulty);
    // The charge swells a drop of paint at the barrel's tip; the shot flashes there.
    const charging = turnOn && view.power != null;
    flashT = Math.max(0, flashT - dt * 7);
    const tipOf = active && (charging || flashT > 0) ? (shooter && flashT > 0 ? capis.get(shooter) : capis.get(active.id)) : null;
    if (tipOf) { tipOf.root.updateMatrixWorld(true); tipOf.tip.getWorldPosition(at); }
    drip.visible = !!charging;
    if (charging) {
      const p = view.power, r = .06 + p * .12 + Math.sin(time * 18) * .01 * p;
      drip.position.set(at.x, at.y - p * .1, at.z); drip.scale.set(r, r * (1 + p * .35), r);
      drip.material.color.set(TEAM_COLORS[active.team]); drip.material.emissive.set(TEAM_COLORS[active.team]); drip.material.emissiveIntensity = .3 + p * .9;
    }
    flash.visible = streak.visible = flashT > .05 && !!tipOf;
    if (flash.visible) {
      flash.position.copy(at); flash.position.z += .05; flash.material.opacity = flashT; flash.scale.setScalar(2.6 * (1.15 - flashT * .3));
      streak.position.set(at.x + Math.cos(flashAngle) * .7, at.y + Math.sin(flashAngle) * .7, at.z + .06); streak.rotation.z = flashAngle;
      streak.scale.set(2.6 * (1.3 - flashT * .3), .7 * flashT + .2, 1); streak.material.opacity = flashT;
    }
    // La Bazuca's rocket along its velocity, trailing smoke and drops of paint.
    rockets.forEach((r, team) => { r.visible = !!match.shot && match.shot.team === team; });
    if (match.shot) {
      const s = match.shot, r = rockets[s.team];
      r.position.set(s.x, s.y, FRONT);
      if (Math.hypot(s.vx, s.vy) > .01) r.quaternion.setFromUnitVectors(NOSE, dir.set(s.vx, s.vy, 0).normalize());
      tail.copy(r.position).addScaledVector(dir, -.55 * ROCKET / 2.2);
      fx.trail('shell', tail, dt);
      // Drops of paint shaken off the shell fall in their own arcs.
      trailT -= dt;
      if (trailT <= 0) { trailT = .03; back.set(-s.vx, -s.vy); drops.burst(tail, { count: 1, color: TEAM_COLORS[s.team], speed: 2.5, dir: back, cone: .6, size: .075, life: 1.1, spread: .1 }); }
    }
    // Camera: the shell in flight, a fresh blast for a moment, else the capi whose turn it is.
    hold = Math.max(0, hold - dt);
    const target = match.shot ? { x: match.shot.x, y: match.shot.y } : hold && holdAt ? holdAt : active ? { x: active.x, y: active.y + 1.5 } : focus;
    const half = viewWidth() / 2;
    const tx = wide ? match.map.width / 2 : THREE.MathUtils.clamp(target.x, half - 6, match.map.width - half + 6);
    const ty = wide ? match.map.height * .35 : Math.max(match.map.water + 4, target.y);
    focus.lerp(goal.set(tx, ty), 1 - Math.exp(-dt * (match.shot ? 6 : 3)));
    const distance = half / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.aspect;
    const kick = feel.update(dt, { decay: 4 });
    camera.position.set(focus.x + kick.yaw * 25, focus.y + distance * .16 + kick.pitch * 25, FRONT + distance);
    camera.lookAt(focus.x + kick.yaw * 25, focus.y, FRONT);
    camera.rotation.z += kick.roll;
    for (const c of match.capys) { const m = capis.get(c.id); m.lod.setFar(chooseFar(m.lod.far, camera.position.distanceTo(m.root.position), LOD_BAND)); }
    fx.update(dt); puffs.update(dt); backdrop.update(dt);
    drops.update(dt, { solid, water: match.map.water, onWater: ripple }); clods.update(dt, { solid, water: match.map.water, onWater: ripple });
    sparks.update(dt); rings.update(dt);
    if (view.labels) {
      view.labels(match.capys.map(c => {
        const g = capis.get(c.id).root; at.set(g.position.x, g.position.y + HEAD, FRONT).project(camera);
        return { id: c.id, x: (at.x + 1) / 2 * w, y: (1 - at.y) / 2 * h, visible: !c.out && at.z < 1 && g.visible };
      }));
    }
    renderer.render(scene, camera);
  }

  return {
    renderer, scene, camera, frame, event, paintTerrain, setMatch, react: backdrop.react, pana: backdrop.pana,
    get match() { return match; },
    // For tests: what each capi is built from and where its barrel's tip is.
    inspect() {
      scene.updateMatrixWorld(true);
      return match.capys.map(c => {
        const m = capis.get(c.id), tip = m.tip.getWorldPosition(new THREE.Vector3());
        let draws = 0, drawn = 0; m.launcher.traverse(o => { if (o.isMesh) draws++; });
        // Meshes the camera draws for the whole capi: one far away, dozens close up.
        m.root.traverseVisible(o => { if (o.isMesh && o.layers.test(camera.layers)) drawn++; });
        return { id: c.id, model: m.avatar.group.userData.characterVersion, bandana: m.bandana.material.color.getHexString(), launcher: m.launcher.name,
          draws, held: m.gun.visible, raised: aiming(match, c), tip: { x: tip.x, y: tip.y }, muzzle: muzzle(c),
          far: m.lod.far, drawn, farTriangles: m.lod.triangles };
      });
    },
    // The world point under a screen position, on the plane the capis move in.
    pick(clientX, clientY) {
      const ray = new THREE.Raycaster(), hit = new THREE.Vector3();
      ray.setFromCamera(new THREE.Vector2(clientX / innerWidth * 2 - 1, -(clientY / innerHeight) * 2 + 1), camera);
      return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -FRONT), hit) ? { x: hit.x, y: hit.y } : null;
    },
    get wide() { return wide; }, set wide(on) { wide = !!on; },
    set closeUp(width) { closeUp = Number(width) || 0; },
    get calls() { return renderer.info.render.calls; },
    // How a sound at (x, y) reaches the player: volume, and how far (0..1) for muffling.
    hearing(x, y) { const d = Math.hypot(x - focus.x, y - focus.y), far = Math.min(1, d / 60); return { volume: 1 - far * .65, far }; },
    get effects() { return { drops: drops.active, clods: clods.active, sparks: sparks.active, rings: rings.active }; },
    dispose() {
      unbind(); capis.forEach(m => { m.lod.dispose(); m.root.removeFromParent(); m.avatar.dispose(); }); capis.clear();
      launchers.forEach(l => l.userData.dispose()); rockets.forEach(r => { r.removeFromParent(); r.userData.dispose(); });
      bandanaGeo.dispose(); knotGeo.dispose(); cloth.forEach(mt => mt.dispose());
      flash.geometry.dispose(); flash.material.dispose(); streak.material.dispose(); glow.dispose(); drip.geometry.dispose(); drip.material.dispose();
      sprays.forEach(spray => spray.dispose());
      fx.dispose(); marker.dispose(); aimArrow.userData.dispose(); dashes.forEach(d => d.userData.dispose());
      backdrop.dispose(); texture.dispose(); backTexture.dispose(); backWall.material.dispose(); plane.dispose(); layers.forEach(l => l.material.dispose()); renderer.dispose();
    },
  };
}
