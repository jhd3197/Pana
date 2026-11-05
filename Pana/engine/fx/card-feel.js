// Cards and tiles with weight, as table meshes: they lift and tilt toward the pointer,
// grow with a shadow when taken, sway with their speed, snap home on a spring that
// overshoots (so a hand closes its gap by itself), and flick and slap. Only ever draws:
// a game still decides where each card belongs.
//
//   const feel = createCardFeel(THREE, scene, camera, { floor: tableY });
//   canvas.addEventListener('pointermove', feel.pointer);
//   feel.step(card, dt, { dest, rotation, hovered, held, arc: card.lift });   // each, each frame
import { calm } from './feel.js';

const STIFF = 120, DAMP = 15, TILT_STIFF = 170, TILT_DAMP = 17, SCALE_STIFF = 240, SCALE_DAMP = 20;
const HOVER_SCALE = 1.07, HELD_SCALE = 1.14, TILT_MAX = .38, TILT_REACH = .09, SWAY_PER_SPEED = .035, SWAY_MAX = .3;
const MAX_DT = 1 / 30, SHADOWS = 2, SOUND_GAP = .06, SLAP_FROM = .2, TURN_RATE = 10;

export const clampTo = (v, max) => Math.max(-max, Math.min(max, v));
// One step of a spring toward target, as [position, velocity]: under-damped, so it overshoots.
export function springStep(x, v, target, dt, stiffness = STIFF, damping = DAMP) {
  const nv = v + (stiffness * (target - x) - damping * v) * dt;
  return [x + nv * dt, nv];
}
// How much to lean toward the pointer, -1..1 each way, from its offset in screen units.
export const leanToward = (dx, dy, reach = TILT_REACH) => [clampTo(dx / reach, 1), clampTo(dy / reach, 1)];
export const scaleFor = (hovered, held) => held ? HELD_SCALE : hovered ? HOVER_SCALE : 1;

function shadowTexture(THREE) {
  const size = 64, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), glow = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  glow.addColorStop(0, 'rgba(0,0,0,.55)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// Sound loads on first use, so a game keeping audio off its first load still can.
const audio = (use) => { import('../sfx.js').then(({ sfx }) => use(sfx)).catch(console.warn); };

export function createCardFeel(THREE, scene, camera, { floor = 0, size = .9 } = {}) {
  const pointer = new THREE.Vector2(9, 9), states = new WeakMap();
  const ndc = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), axis = new THREE.Vector3(), WORLD_UP = new THREE.Vector3(0, 1, 0);
  const lean = new THREE.Quaternion(), turn = new THREE.Quaternion(), sway = new THREE.Quaternion();
  const texture = shadowTexture(THREE), blobGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const blobs = Array.from({ length: SHADOWS }, () => {
    const mesh = new THREE.Mesh(blobGeometry, new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0 }));
    mesh.visible = false; mesh.renderOrder = 1; scene.add(mesh);
    return mesh;
  });
  let used = 0, soundAt = -1, clock = 0, active = false;
  const sound = (use) => { if (clock - soundAt > SOUND_GAP) { soundAt = clock; audio(use); } };
  const stateOf = (card) => {
    let s = states.get(card);
    if (!s) { s = { vx: 0, vy: 0, vz: 0, tx: 0, ty: 0, tvx: 0, tvy: 0, scale: 1, sv: 0, base: card.model.scale.clone(), rot: card.model.quaternion.clone(), wasOver: false, wasHeld: false, arc: 0 }; states.set(card, s); }
    return s;
  };
  function placeShadow(position, lifted) {
    if (used >= SHADOWS) return;
    const blob = blobs[used++], k = Math.min(1, Math.max(0, lifted));
    blob.visible = true; blob.position.set(position.x, floor + .004, position.z);
    blob.scale.setScalar(size * (1 + k * .9)); blob.material.opacity = .28 + k * .3;
  }
  return {
    pointer(event) {
      pointer.set(event.clientX / innerWidth * 2 - 1, -event.clientY / innerHeight * 2 + 1);
      active = true;
    },
    // Call once a frame before stepping the cards.
    begin(dt) {
      clock += dt; used = 0;
      for (const blob of blobs) blob.visible = false;
      right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
    },
    step(card, dt, { dest, rotation, hovered = false, held = false, arc = 0 }) {
      const { model } = card, s = stateOf(card);
      if (hovered && !s.wasOver) sound((sfx) => sfx.cardFlick(.5));
      if (held && !s.wasHeld) sound((sfx) => sfx.cardFlick(1));
      s.wasOver = hovered; s.wasHeld = held;
      // A card that flew in lands when its arc runs out.
      if (s.arc > 0 && arc <= 0) sound((sfx) => sfx.cardSlap());
      s.arc = arc;
      if (calm()) {
        model.position.copy(dest); model.quaternion.copy(rotation); model.scale.copy(s.base);
        return;
      }
      const h = Math.min(dt, MAX_DT), p = model.position;
      [p.x, s.vx] = springStep(p.x, s.vx, dest.x, h);
      [p.z, s.vz] = springStep(p.z, s.vz, dest.z, h);
      [p.y, s.vy] = springStep(p.y, s.vy, dest.y, h);
      // It may overshoot sideways, never through the table.
      if (p.y < dest.y - .02 && p.y < floor + .02) { p.y = Math.max(floor + .02, dest.y - .02); s.vy = 0; }
      let wantX = 0, wantY = 0;
      if (hovered && active) {
        ndc.copy(p).project(camera);
        [wantX, wantY] = leanToward(pointer.x - ndc.x, pointer.y - ndc.y);
      }
      [s.tx, s.tvx] = springStep(s.tx, s.tvx, wantX, h, TILT_STIFF, TILT_DAMP);
      [s.ty, s.tvy] = springStep(s.ty, s.tvy, wantY, h, TILT_STIFF, TILT_DAMP);
      [s.scale, s.sv] = springStep(s.scale, s.sv, scaleFor(hovered, held), h, SCALE_STIFF, SCALE_DAMP);
      s.rot.slerp(rotation, 1 - Math.exp(-dt * TURN_RATE));
      // The top leans toward the pointer: pitch about the view's right, yaw about its up.
      lean.setFromAxisAngle(right, -s.ty * TILT_MAX).multiply(turn.setFromAxisAngle(up, s.tx * TILT_MAX));
      // And it trails its own speed, leaning back against the way it moves.
      axis.set(s.vx, 0, s.vz);
      const speed = axis.length();
      if (speed > .01) { axis.divideScalar(speed).cross(WORLD_UP); sway.setFromAxisAngle(axis, clampTo(speed * SWAY_PER_SPEED, SWAY_MAX)); } else sway.identity();
      model.quaternion.copy(sway).multiply(lean).multiply(s.rot);
      model.scale.copy(s.base).multiplyScalar(s.scale);
      if (held || hovered || arc > SLAP_FROM) placeShadow(p, (p.y - floor) / 1.2);
    },
    dispose() {
      for (const blob of blobs) { blob.removeFromParent(); blob.material.dispose(); }
      blobGeometry.dispose(); texture.dispose();
    },
  };
}
