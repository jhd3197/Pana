import * as THREE from 'three';
import { createTableWorld } from '/engine/table-world.js';
import { createPoolTable, createPoolBall, createPoolCue, POOL_SURFACE } from '/engine/models/props/pool.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar } from '/engine/avatar.js';
import { RADIUS, aimGuide, legalTarget, canPlace } from './rules.js';

export function createPoolScene(canvas) {
  const stage = createTableWorld(canvas), { scene, camera, renderer } = stage;
  const table = createPoolTable(), cue = createPoolCue(); scene.add(table, cue);
  const balls = new Map(), avatars = new Map(), shown = new Map();
  for (let number = 0; number < 16; number++) { const ball = createPoolBall({ number }); scene.add(ball); balls.set(number, ball); }
  const guideMaterial = new THREE.LineDashedMaterial({ color: '#fff4cc', dashSize: .09, gapSize: .07 });
  const guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), guideMaterial); scene.add(guide);
  const contact = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), guideMaterial); scene.add(contact);
  const ring = new THREE.Mesh(new THREE.RingGeometry(RADIUS * .01, .135, 40), new THREE.MeshBasicMaterial({ color: '#fff4cc', side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; scene.add(ring);
  const ghost = createPoolBall({ number: 0 }); ghost.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = .5; } }); scene.add(ghost);
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), hit = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(POOL_SURFACE + .11));
  let rotation = 0, view = 'plaza';
  const bounds = new THREE.Box3(), vec = (x, y, height = POOL_SURFACE + .11) => new THREE.Vector3((x - 500) * .01, height, (y - 250) * .01);
  function line(mesh, from, to) { const a = mesh.geometry.attributes.position; a.setXYZ(0, from.x, from.y, from.z); a.setXYZ(1, to.x, to.y, to.z); a.needsUpdate = true; mesh.geometry.computeBoundingSphere(); mesh.computeLineDistances(); }
  function draw(state, { angle = 0, power = .65, active = false, placement = null, dt = .016 } = {}) {
    stage.setMap(state.mapId);
    const { w, h } = stage.resize(), lobby = state.phase === 'lobby', portrait = w < 650 && h > w;
    rotation = portrait && !lobby ? Math.PI / 2 : 0;
    const short = h < 520 && w > h;
    let safe;
    if (lobby) safe = w > 760 ? { x: 385, y: 80, width: w - 410, height: h - 105 } : { x: 12, y: 64, width: w - 24, height: Math.max(160, h - 490) };
    else safe = short ? { x: 18, y: 80, width: w - 255, height: h - 100 } : { x: 18, y: portrait ? 145 : 130, width: w - 36, height: h - (portrait ? 350 : 300) };
    safe.height = Math.max(120, safe.height); safe.width = Math.max(200, safe.width);
    bounds.min.set(-5.65, .8, -3.2); bounds.max.set(5.65, 2.65, 3.55);
    if (lobby) { bounds.min.x = -6.8; bounds.max.x = 6.8; bounds.max.z = 4.5; }
    const elevation = view === 'mesa' ? 2.5 : portrait ? 1.35 : .78;
    stage.frameCamera(bounds, rotation ? [1, elevation, 0] : [lobby ? .24 : .08, elevation, 1], safe);
    for (const [seat, p] of state.players.entries()) {
      const visible = p.id !== null && (!state.practice || seat === 0), key = JSON.stringify(normalizeAvatar(p.avatar));
      let avatar = avatars.get(seat);
      if (visible && avatar?.key !== key) { avatar?.dispose(); avatar = buildCharacter(p.avatar); avatar.key = key; avatar.group.scale.setScalar(1.25); avatars.set(seat, avatar); scene.add(avatar.group); }
      if (!avatar) continue;
      avatar.group.visible = visible;
      avatar.group.position.set(seat ? 6.15 : -6.15, 0, seat ? -.65 : 1.05); avatar.group.rotation.y = seat ? -Math.PI / 2 : Math.PI / 2;
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
    const aiming = state.phase === 'aiming' && active && !state.ballInHand;
    guide.visible = ring.visible = cue.visible = aiming; contact.visible = false; ghost.visible = state.ballInHand && active;
    if (aiming) {
      const b = state.balls[0], aim = aimGuide(state, angle), valid = !aim.target || legalTarget(state, aim.target.id);
      guideMaterial.color.set(valid ? '#fff4cc' : '#ff7373'); ring.material.color.copy(guideMaterial.color);
      line(guide, vec(b.x, b.y), vec(aim.x, aim.y)); ring.position.copy(vec(aim.x, aim.y, POOL_SURFACE + .012));
      cue.position.copy(vec(b.x - Math.cos(angle) * (22 + power * 28), b.y - Math.sin(angle) * (22 + power * 28))); cue.rotation.y = -angle;
      if (aim.target) { const dx = aim.target.x - aim.x, dy = aim.target.y - aim.y, length = Math.hypot(dx, dy) || 1; contact.visible = true; line(contact, vec(aim.target.x, aim.target.y), vec(aim.target.x + dx / length * 72, aim.target.y + dy / length * 72)); }
    }
    if (ghost.visible) { const p = placement || state.balls[0]; ghost.position.copy(vec(p.x, p.y, POOL_SURFACE)); ring.visible = true; ring.position.copy(vec(p.x, p.y, POOL_SURFACE + .012)); ring.material.color.set(canPlace(state, p.x, p.y) ? '#ffc629' : '#ff4b4b'); }
    stage.draw(dt);
  }
  function point(clientX, clientY) {
    const rect = canvas.getBoundingClientRect(); pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(pointer, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x * 100 + 500, y: hit.z * 100 + 250 };
  }
  function screen(x, y) { const p = vec(x, y).project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; }
  return { scene, camera, renderer, balls, avatars, draw, point, screen, setView(value) { view = value; }, get rotation() { return rotation; },
    dispose() { balls.forEach(b => b.userData.dispose()); avatars.forEach(a => a.dispose()); table.userData.dispose(); cue.userData.dispose(); ghost.userData.dispose(); guide.geometry.dispose(); contact.geometry.dispose(); guideMaterial.dispose(); ring.geometry.dispose(); ring.material.dispose(); stage.dispose(); },
  };
}
