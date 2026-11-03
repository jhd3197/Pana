// What the armory's range looks like: the covered lane from the shared model
// (engine/models/props/shooting-range.js), the targets where range-sim.js puts
// them, paint splats on whatever a ball meets, the balls in flight, grenades and
// their blasts, and the equipped marker in first person (viewmodel.js), with the
// game's own recoil and scope. One light for the room, no shadows.
import * as THREE from 'three';
import { createRangeLane, createRangeTarget, createRangeSign } from '/engine/models/props/shooting-range.js';
import { createPaintKit, createPaintGrenade, PAINT_KIT_BORE } from '/engine/models/props/paintball-kit.js';
import { splatTexture } from '/engine/models/props/paintball.js';
import { createRecoil } from '/engine/play/recoil.js';
import { createScope } from '/engine/play/scope.js';
import { createBlastFx } from '/engine/play/blast-fx.js';
import { Puffs } from '/engine/fx.js';
import { pixelRatio } from '/engine/settings.js';
import { FINISHES, WEAPONS, kitModel } from './armory-data.js';
import { EYE } from './rules.js';
import { createViewmodel, recoilOf } from './viewmodel.js';
import { FIRE, LANE, MARKS } from './range-sim.js';

const LOOK_UP = .55, LOOK_DOWN = -.7, MAX_SPLATS = 160;
const isMelee = id => !!WEAPONS.find(w => w.id === id)?.melee;

export function createRangeScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio(1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#2a2f36'); scene.fog = new THREE.Fog('#3a3f45', 60, 135);
  const camera = new THREE.PerspectiveCamera(72, 1, .05, 220); scene.add(camera);
  scene.add(new THREE.HemisphereLight('#fff4dd', '#9a9284', 2.3));
  const key = new THREE.DirectionalLight('#fff1d6', 1.6); key.position.set(FIRE.x - 10, 30, 8); key.target.position.set(FIRE.x + 40, 0, 0); scene.add(key, key.target);
  // The lane, its signs and the rail the moving target slides on.
  const lane = createRangeLane({ length: LANE.length, half: LANE.half, height: LANE.height, marks: MARKS }); lane.position.set(FIRE.x, 0, FIRE.z); scene.add(lane);
  const signs = MARKS.filter(m => m < LANE.length).map(m => { const s = createRangeSign({ meters: m }); s.position.set(FIRE.x + m, LANE.height - .1, 0); s.rotation.y = -Math.PI / 2; scene.add(s); return s; });
  const owned = [lane, ...signs], railGeo = new THREE.BoxGeometry(.08, .05, 8), railMat = new THREE.MeshStandardMaterial({ color: '#8c98a3', metalness: .5, roughness: .4 });
  // Targets: one model per sim target, turned to face the firing line.
  const targets = new Map();
  function addTarget(t) {
    const model = createRangeTarget({ kind: t.kind === 'rail' ? 'paper' : t.kind }); model.rotation.y = -Math.PI / 2; scene.add(model); owned.push(model);
    if (t.kind === 'rail') for (const dx of [-.25, .25]) { const rail = new THREE.Mesh(railGeo, railMat); rail.position.set(FIRE.x + t.d + dx, .025, t.z); scene.add(rail); }
    targets.set(t.id, { model, splats: [], lean: 0, swing: 0 });
  }
  // Splats: glossy alpha-tested planes, four shapes per colour, as in the game.
  const textures = [11, 12, 13, 14].map(seed => splatTexture(seed)), splatGeo = new THREE.PlaneGeometry(1, 1), materials = new Map(), loose = [];
  const splatMaterial = (color, n) => { const k = `${color}:${n % 4}`; if (!materials.has(k)) materials.set(k, new THREE.MeshStandardMaterial({ color, map: textures[n % 4], transparent: true, alphaTest: .4, roughness: .3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })); return materials.get(k); };
  let serial = 0;
  function keep(list, mesh) { list.push(mesh); if (list.length > MAX_SPLATS) list.shift().removeFromParent(); }
  // A hit on target t, `along` m across its face (its own x), `height` m up from the floor.
  function splatTarget(t, along, height, color, size = .34) {
    const view = targets.get(t.id); if (!view) return;
    const { face, size: { w, h } } = view.model.userData, bottom = face.position.y;
    const mesh = new THREE.Mesh(splatGeo, splatMaterial(color, ++serial)); mesh.scale.setScalar(size * (.8 + (serial % 5) * .1));
    mesh.position.set(THREE.MathUtils.clamp(along, -w / 2 + .1, w / 2 - .1), THREE.MathUtils.clamp(height - bottom, .12, h - .1), .004 + (serial % 9) * .0004); mesh.rotation.z = serial * 1.7;
    face.add(mesh); keep(view.splats, mesh); view.swing = 1;
    puffs.spawn(face.localToWorld(mesh.position.clone()), { color, count: 4, spread: .25, size: .25, rise: .6, life: .3 });
  }
  // Paint on the floor, a side wall or the berm where a ball stopped (x, z on the court; y from the shot's pitch).
  function splatWorld(x, y, z, color, size = .5) {
    const mesh = new THREE.Mesh(splatGeo, splatMaterial(color, ++serial)); mesh.scale.setScalar(size); scene.add(mesh); keep(loose, mesh);
    const back = FIRE.x + LANE.length - 1.2;
    if (Math.abs(z) > LANE.half - .3) { mesh.position.set(x, THREE.MathUtils.clamp(y, .2, LANE.height - .3), Math.sign(z) * (LANE.half - .02)); mesh.rotation.set(0, z > 0 ? Math.PI : 0, serial * 1.7); }
    else if (x >= back - .5 && y > .1) { mesh.position.set(back, THREE.MathUtils.clamp(y, .3, LANE.height - .3), z); mesh.rotation.set(0, -Math.PI / 2, serial * 1.7); }
    else { mesh.position.set(x, .012 + (serial % 9) * .0005, z); mesh.rotation.set(-Math.PI / 2, 0, serial * 1.7); }
    puffs.spawn(mesh.position, { color, count: 3, spread: .3, size: .3, rise: .7, life: .35 });
  }
  const puffs = new Puffs(scene), blasts = createBlastFx(scene, puffs);
  // Balls in flight: one material per colour, a short streak behind each.
  const ballGeo = new THREE.SphereGeometry(.06, 8, 6), streakGeo = new THREE.CylinderGeometry(.03, .005, 1, 6, 1, true).rotateX(Math.PI / 2), ballMats = new Map(), balls = new Map(), grenades = new Map();
  const ballMat = color => { if (!ballMats.has(color)) ballMats.set(color, new THREE.MeshBasicMaterial({ color })); return ballMats.get(color); };
  // First person: the marker in hand, its muzzle flash, the view's kick and the scope.
  let held = null, heldKey = '', yaw = -Math.PI / 2, pitch = 0, lastFired = 0, lastSmacks = 0, opticSens = 1, mobile = false;
  const viewmodel = createViewmodel(), feel = createRecoil(), scope = createScope({ zoom: 1.2 });
  function hold(kit, weapon) {
    const options = { ...kit, ...kitModel({ ...kit, weapon }), weapon, color: FINISHES.find(f => f.id === kit.finish)?.color || '#f28b42' }, k = JSON.stringify(options); if (k === heldKey) return;
    held?.removeFromParent(); held?.userData.dispose(); held?.userData.flash?.geometry.dispose(); held?.userData.flash?.material.dispose(); heldKey = k;
    held = createPaintKit(options); held.scale.setScalar(isMelee(weapon) ? (weapon === 'sandal' ? .6 : .42) : .3); camera.add(held);
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    flash.position.set(0, held.userData.bore ?? PAINT_KIT_BORE[weapon] ?? .2, held.userData.tip + .12); flash.visible = false; held.add(flash); held.userData.flash = flash; viewmodel.reset();
  }
  const pos = new THREE.Vector3();
  return {
    renderer, scene, camera, scope, addTarget, splatTarget, splatWorld,
    get yaw() { return yaw; }, get pitch() { return pitch; }, get held() { return held; },
    look(dy, dp) { yaw += dy; pitch = THREE.MathUtils.clamp(pitch + dp, LOOK_DOWN, LOOK_UP); },
    face(y, p) { yaw = y; pitch = THREE.MathUtils.clamp(p, LOOK_DOWN, LOOK_UP); },
    sensitivity() { return scope.sensitivity() * (1 + (opticSens - 1) * scope.amount); },
    boom(b) { blasts.boom({ x: b.x, z: b.z, y: Math.max(.6, b.y || 0), size: Math.max(.6, b.radius / 3), color: b.color }); feel.shake(.5); },
    clear() { for (const v of targets.values()) { v.splats.forEach(m => m.removeFromParent()); v.splats = []; } loose.forEach(m => m.removeFromParent()); loose.length = 0; },
    get splats() { let n = loose.length; for (const v of targets.values()) n += v.splats.length; return n; },
    // sim: range-sim.js; aiming: the aim button is held.
    update(dt, sim, aiming) {
      const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
      const ratio = renderer.getPixelRatio(); if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) renderer.setSize(w, h, false);
      mobile = w < 760; camera.aspect = w / h;
      const me = sim.me, stats = sim.stats;
      for (const t of sim.targets) {
        const v = targets.get(t.id); if (!v) continue;
        v.model.position.set(t.x, 0, t.z + t.offset);
        // A popup drops back on its hinge; a hit target rocks a little.
        v.lean += ((t.raised ? 0 : -Math.PI / 2 + .05) - v.lean) * (1 - Math.exp(-dt * 14)); v.swing = Math.max(0, v.swing - dt * 3);
        v.model.userData.face.rotation.x = v.lean - Math.sin(v.swing * 9) * v.swing * .08;
      }
      // The view: eye height, the look, the shots' kick and shake, aiming zoom.
      if (me.fired > lastFired) feel.fire(recoilOf(me.weapon)); lastFired = me.fired;
      if ((me.smacks || 0) > lastSmacks) feel.shake(.35); lastSmacks = me.smacks || 0;
      const jolt = feel.update(dt);
      scope.setZoom(stats.zoom); opticSens = stats.sens; scope.update(dt, aiming && !(me.reload > 0));
      camera.fov = scope.fov(mobile ? 80 : 72);
      camera.position.set(FIRE.x, EYE, FIRE.z); camera.rotation.set(pitch + jolt.pitch, yaw + jolt.yaw, jolt.roll, 'YXZ');
      camera.updateProjectionMatrix();
      hold(me.kit, me.weapon); held.visible = !scope.scoped && !(stats.melee && me.melee?.phase === 'away');
      const shot = viewmodel.update(dt, { held, weapon: me.weapon, fired: me.fired || 0, reload: me.reload, reloadTime: stats.reload, sprint: false, bob: 0, sway: 0, down: false, air: 0, push: 0, aim: scope.amount,
        melee: stats.melee ? { swings: me.melee?.swings || 0, windup: stats.windup, recovery: stats.recovery } : null });
      const flash = held.userData.flash; flash.visible = held.visible && shot.flash > .05; flash.material.opacity = shot.flash; if (shot.shot) flash.rotation.z = Math.random() * Math.PI;
      flash.scale.setScalar(.9 * (1.15 - shot.flash * .3));
      // Balls: along their flat path, climbing or dropping with the pitch they left at.
      const live = new Set();
      for (const b of sim.arena.balls) {
        live.add(b.id); let mesh = balls.get(b.id);
        if (!mesh) { mesh = new THREE.Mesh(ballGeo, ballMat(b.color)); if (b.rocket) mesh.scale.setScalar(2.6); else { const streak = new THREE.Mesh(streakGeo, ballMat(b.color)); streak.scale.z = Math.min(4, Math.hypot(b.vx, b.vz) * .05); streak.position.z = -streak.scale.z / 2; mesh.add(streak); } scene.add(mesh); balls.set(b.id, mesh); }
        const travel = Math.hypot(b.x - b.x0, b.z - b.z0), p = sim.pitchOf(b.id);
        mesh.position.set(b.x, EYE - .16 + Math.tan(p) * travel + Math.min(.16, travel * .04), b.z); mesh.rotation.y = Math.atan2(b.vx, b.vz);
        if (b.rocket) blasts.trail(b.id, mesh.position, dt);
      }
      blasts.keep?.(live);
      for (const [id, mesh] of balls) if (!live.has(id)) { mesh.removeFromParent(); balls.delete(id); }
      const thrown = new Set();
      for (const g of sim.arena.grenades) {
        thrown.add(g.id); let mesh = grenades.get(g.id);
        if (!mesh) { mesh = createPaintGrenade({ color: g.color }); mesh.scale.setScalar(1.2); scene.add(mesh); grenades.set(g.id, mesh); }
        mesh.position.set(g.x, Math.max(.1, g.y), g.z); mesh.rotation.x += dt * 8;
      }
      for (const [id, mesh] of grenades) if (!thrown.has(id)) { mesh.removeFromParent(); mesh.userData.dispose?.(); grenades.delete(id); }
      blasts.update(dt); puffs.update(dt);
      renderer.render(scene, camera);
    },
    // Where the crosshair points on the court (x, z) at distance d: for tests and aim.
    ahead(d) { camera.getWorldDirection(pos); return { x: FIRE.x + pos.x * d, z: FIRE.z + pos.z * d }; },
    dispose() {
      held?.userData.dispose(); held?.userData.flash?.geometry.dispose(); held?.userData.flash?.material.dispose();
      owned.forEach(o => o.userData.dispose()); grenades.forEach(g => g.userData.dispose?.());
      [ballGeo, streakGeo, splatGeo, railGeo].forEach(g => g.dispose()); railMat.dispose(); ballMats.forEach(m => m.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      blasts.dispose?.(); puffs.clear(); scene.clear(); renderer.dispose(); renderer.forceContextLoss?.();
    },
  };
}
