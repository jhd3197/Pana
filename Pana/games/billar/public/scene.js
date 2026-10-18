import * as THREE from 'three';
import { createTableWorld } from '/engine/table-world.js';
import { createPoolTable, createPoolBall, createPoolCue, POOL_SURFACE } from '/engine/models/props/pool.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar } from '/engine/avatar.js';
import { difficultyInfo } from '/engine/difficulty.js';
import { guideRibbon, trimPath, pathLength } from '/engine/aim-guide.js';
import { RADIUS, predictShot, legalTarget, canPlace } from './rules.js';

// Camera views: 'taco' rides behind the cue ball like a player bending over
// the shot; 'plaza' frames the table in its setting; 'mesa' looks straight down.
export const VIEWS = [['taco', 'Detrás de la bola'], ['mesa', 'Desde arriba'], ['plaza', 'Vista del lugar']];

export function createPoolScene(canvas) {
  const stage = createTableWorld(canvas), { scene, camera, renderer } = stage;
  const table = createPoolTable(), cue = createPoolCue(); scene.add(table, cue);
  const balls = new Map(), avatars = new Map(), shown = new Map();
  for (let number = 0; number < 16; number++) { const ball = createPoolBall({ number }); scene.add(ball); balls.set(number, ball); }
  const aimLine = guideRibbon('#ffffff', .03), objectLine = guideRibbon('#ffffff', .03, { opacity: .85 }), cueLine = guideRibbon('#7fe9f5', .028, { opacity: .85 });
  scene.add(aimLine, objectLine, cueLine);
  const ring = new THREE.Mesh(new THREE.RingGeometry(RADIUS * .0085, RADIUS * .01 + .006, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, transparent: true, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.renderOrder = 3; scene.add(ring);
  const ghost = createPoolBall({ number: 0 }); ghost.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = .45; o.material.depthWrite = false; } }); scene.add(ghost);
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), hit = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(POOL_SURFACE + .11));
  let rotation = 0, view = 'taco', lastAngle = 0;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let chasing = false, lastMode = '';
  const bounds = new THREE.Box3(), vec = (x, y, height = POOL_SURFACE + .11) => new THREE.Vector3((x - 500) * .01, height, (y - 250) * .01);
  const flat = p => { const v = vec(p.x, p.y); return { x: v.x, z: v.z }; };

  // Smoothly follows a target pose; the first frame of a mode snaps.
  function follow(mode, dt, rate, w, h, lift = 0) {
    // `lift` raises the picture above the bottom HUD, as a view offset.
    camera.aspect = w / h; if (lift) camera.setViewOffset(w, h, 0, lift, w, h); else camera.clearViewOffset();
    if (!chasing || lastMode === '') { camPos.copy(wantPos); camLook.copy(wantLook); }
    else { const k = 1 - Math.exp(-dt * rate); camPos.lerp(wantPos, k); camLook.lerp(wantLook, k); }
    chasing = true; lastMode = mode;
    camera.position.copy(camPos); camera.lookAt(camLook); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  function frame(state, { angle, active, aiming, dt, lobby, portrait, w, h, safe }) {
    const placing = state.ballInHand && active;
    if (view === 'taco' && !lobby && !placing) {
      // Behind the ball while you aim; between shots, a high look down the same line.
      const own = aiming && active; if (own) lastAngle = angle;
      const dx = Math.cos(lastAngle), dz = Math.sin(lastAngle), b = state.balls[0], c = vec(b.x, b.y, POOL_SURFACE);
      const back = portrait ? 3.9 : 2.9, up = portrait ? 2.6 : 1.9;
      if (own) { wantPos.set(c.x - dx * back, c.y + up, c.z - dz * back); wantLook.set(c.x + dx * 2.2, POOL_SURFACE - .3, c.z + dz * 2.2); }
      else { wantPos.set(-dx * (portrait ? 8.5 : 6.6), POOL_SURFACE + (portrait ? 7.5 : 5.4), -dz * (portrait ? 8.5 : 6.6)); wantLook.set(0, POOL_SURFACE - .4, 0); }
      follow('taco', dt, own ? 9 : 2.6, w, h, portrait ? 40 : Math.min(90, h * .11)); return;
    }
    if (placing && view === 'taco') {
      // Ball in hand: straight down so the free spots read clearly.
      wantPos.set(0, POOL_SURFACE + (portrait ? 13 : 8.4), .01); wantLook.set(0, POOL_SURFACE, 0);
      if (portrait) { wantPos.set(.01, POOL_SURFACE + 13, 0); }
      follow('arriba', dt, 5, w, h); camera.up.set(0, 1, 0); return;
    }
    chasing = false; lastMode = '';
    bounds.min.set(-5.65, .8, -3.2); bounds.max.set(5.65, 2.65, 3.55);
    if (lobby) { bounds.min.x = -6.8; bounds.max.x = 6.8; bounds.max.z = 4.5; }
    const elevation = view === 'mesa' ? 2.5 : portrait ? 1.35 : .78;
    stage.frameCamera(bounds, rotation ? [1, elevation, 0] : [lobby ? .24 : .08, elevation, 1], safe);
  }
  function guide(state, { angle, power, spin }) {
    const info = difficultyInfo(state.difficulty).guide, b = state.balls[0];
    const shot = predictShot(state, angle, power, spin, { bounces: info.bounces });
    const valid = !shot.target || legalTarget(state, shot.target.id), color = valid ? '#ffffff' : '#ff6b6b';
    const full = [b, shot.contact].map(flat), reach = pathLength(full) * info.reach;
    // Expert play still shows a stub of direction, never less than a cue's length.
    aimLine.material.color.set(color); aimLine.userData.set(trimPath(full, Math.max(info.reach < 1 ? .9 : 0, reach)), POOL_SURFACE + .004);
    const reaches = info.reach >= 1;
    ring.visible = ghost.visible = reaches && info.ghost;
    ring.material.color.set(color); ring.position.copy(vec(shot.contact.x, shot.contact.y, POOL_SURFACE + .006));
    ghost.position.copy(vec(shot.contact.x, shot.contact.y, POOL_SURFACE));
    const after = path => { const world = path.map(flat); return trimPath(world, pathLength(world) * info.after); };
    objectLine.material.color.set(color);
    objectLine.userData.set(reaches && info.after ? after(shot.objectPath) : [], POOL_SURFACE + .005);
    // With nothing to hit, the cue ball's own banks continue past the first cushion.
    const cuePath = shot.target ? [shot.contact, ...shot.cuePath.slice(1)] : shot.cuePath;
    cueLine.userData.set(reaches && info.after ? after(cuePath) : [], POOL_SURFACE + .006);
  }
  function draw(state, { angle = 0, power = .65, spin = { x: 0, y: 0 }, active = false, placement = null, dt = .016 } = {}) {
    stage.setMap(state.mapId);
    const { w, h } = stage.resize(), lobby = state.phase === 'lobby', portrait = w < 650 && h > w;
    const aiming = state.phase === 'aiming' && !state.ballInHand;
    rotation = portrait && !lobby && view !== 'taco' ? Math.PI / 2 : 0;
    const short = h < 520 && w > h;
    let safe;
    if (lobby) safe = w > 760 ? { x: 385, y: 80, width: w - 410, height: h - 105 } : { x: 12, y: 64, width: w - 24, height: Math.max(160, h - 490) };
    else safe = short ? { x: 70, y: 70, width: w - 150, height: h - 120 } : { x: portrait ? 12 : 90, y: portrait ? 120 : 130, width: w - (portrait ? 80 : 190), height: h - (portrait ? 270 : 250) };
    safe.height = Math.max(120, safe.height); safe.width = Math.max(200, safe.width);
    frame(state, { angle, active, aiming, dt, lobby, portrait, w, h, safe });
    for (const [seat, p] of state.players.entries()) {
      const visible = p.id !== null && (!state.practice || seat === 0), key = JSON.stringify(normalizeAvatar(p.avatar));
      let avatar = avatars.get(seat);
      if (visible && avatar?.key !== key) { avatar?.dispose(); avatar = buildCharacter(p.avatar); avatar.key = key; avatar.group.scale.setScalar(1.25); avatars.set(seat, avatar); scene.add(avatar.group); }
      if (!avatar) continue;
      // Each pana waits off a corner, facing the cloth, clear of the shot line.
      avatar.group.position.set(seat ? 6.5 : -6.5, 0, seat ? -3.7 : 3.7); avatar.group.rotation.y = Math.atan2(-avatar.group.position.x, -avatar.group.position.z);
      // A pana right beside the low camera would fill the screen: step out of shot.
      avatar.group.visible = visible && Math.hypot(camera.position.x - avatar.group.position.x, camera.position.z - avatar.group.position.z) > 1.8;
      avatar.update(dt, {}); avatar.neck.rotation.x = .17;
      avatar.arms.forEach((arm, i) => arm.rotation.x = seat === state.turn && state.phase === 'aiming' ? -.55 + i * .08 : -.13);
    }
    for (const b of state.balls) {
      const mesh = balls.get(b.id); mesh.visible = !b.pocketed && !(b.id === 0 && state.ballInHand && active);
      const old = shown.get(b.id), smooth = old && state.phase === 'rolling' ? Math.min(1, dt * 28) : 1;
      const display = { x: old ? old.x + (b.x - old.x) * smooth : b.x, y: old ? old.y + (b.y - old.y) * smooth : b.y };
      if (old && state.phase === 'rolling') { mesh.userData.ball.rotation.z -= (display.x - old.x) / RADIUS; mesh.userData.ball.rotation.x += (display.y - old.y) / RADIUS; }
      mesh.position.copy(vec(display.x, display.y, POOL_SURFACE)); shown.set(b.id, display);
    }
    const mine = aiming && active;
    cue.visible = mine;
    for (const m of [aimLine, objectLine, cueLine]) m.visible = false;
    ring.visible = false; ghost.visible = false;
    if (mine) {
      guide(state, { angle, power, spin });
      // The tip offsets with the chosen english, and pulls back with power.
      const b = state.balls[0], pull = 22 + power * 28, side = spin.x * RADIUS * .55;
      cue.position.copy(vec(b.x - Math.cos(angle) * pull - Math.sin(angle) * side, b.y - Math.sin(angle) * pull + Math.cos(angle) * side));
      cue.position.y += spin.y * .045; cue.rotation.y = -angle;
    }
    if (state.ballInHand && active) {
      const p = placement || state.balls[0]; ghost.visible = ring.visible = true;
      ghost.position.copy(vec(p.x, p.y, POOL_SURFACE)); ring.position.copy(vec(p.x, p.y, POOL_SURFACE + .006));
      ring.material.color.set(canPlace(state, p.x, p.y) ? '#ffc83d' : '#ff4b4b');
    }
    stage.draw(dt);
  }
  function point(clientX, clientY) {
    const rect = canvas.getBoundingClientRect(); pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(pointer, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x * 100 + 500, y: hit.z * 100 + 250 };
  }
  function screen(x, y) { const p = vec(x, y).project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; }
  return { scene, camera, renderer, balls, avatars, draw, point, screen,
    setView(value) { view = value; chasing = false; lastMode = ''; }, get view() { return view; }, get rotation() { return rotation; },
    get guides() { return { aim: aimLine.visible, ghost: ghost.visible, object: objectLine.visible }; },
    dispose() { balls.forEach(b => b.userData.dispose()); avatars.forEach(a => a.dispose()); table.userData.dispose(); cue.userData.dispose(); ghost.userData.dispose();
      for (const m of [aimLine, objectLine, cueLine]) m.userData.dispose(); ring.geometry.dispose(); ring.material.dispose(); stage.dispose(); },
  };
}
