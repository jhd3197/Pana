// The TV studio for ¿Quién quiere ser mi pana?: a round stage, a podium per
// pana that rises with their ladder, the host's desk, the big screen and the
// spotlights. Registered in Pana Studio (web/studio/catalog/qqsmp.js). Each
// factory returns a group whose userData.dispose frees what it built.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { disposeModel } from '/engine/models/props/game-table.js';

export const GOLD = '#f2b632';
export const NIGHT = '#1b1440';
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .55, ...extra });
const glow = (color, intensity = 1.6) => new THREE.MeshStandardMaterial({ color: '#111', emissive: color, emissiveIntensity: intensity, roughness: .4 });
function part(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
const owned = (group) => { group.userData.dispose = () => disposeModel(group); return group; };

// A canvas painted onto a plane: the screen, the podium plates.
function paintedPlane(width, height, px = 512) {
  const canvas = document.createElement('canvas'); canvas.width = px; canvas.height = Math.round(px * height / width);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  return { mesh, canvas, ctx: canvas.getContext('2d'), texture };
}

// Round stage, 9 m across, with a gold rim and a ring of bulbs. Top at 0,32 m.
export function createQuizStage({ radius = 9 } = {}) {
  const group = new THREE.Group(); group.name = 'Tarima del concurso';
  part(group, new THREE.CylinderGeometry(radius, radius + .25, .3, 72), mat('#2a1d5c', { roughness: .25, metalness: .3 }), 0, .15, 0);
  part(group, new THREE.TorusGeometry(radius, .07, 8, 96), mat(GOLD, { metalness: .8, roughness: .3 }), 0, .31, 0).rotation.x = Math.PI / 2;
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 1.1 : 2.6; star[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
  const inlay = part(group, new THREE.ShapeGeometry(star), mat(GOLD, { metalness: .6, roughness: .35, emissive: '#5a3a00', emissiveIntensity: .4 }), 0, .305, 1.2);
  inlay.rotation.x = -Math.PI / 2;
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.07, 8, 6), glow('#ffe7a1', 2.2), 48), m = new THREE.Matrix4();
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; m.makeTranslation(Math.cos(a) * (radius + .12), .2, Math.sin(a) * (radius + .12)); bulbs.setMatrixAt(i, m); }
  group.add(bulbs);
  group.userData.top = .3;
  return owned(group);
}

// A contestant's podium: a column that rises (setHeight), a desk with a lamp
// strip (setLight: off, locked, right, wrong, gold) and a painted plate.
export function createQuizPodium({ color = '#ff4b4b' } = {}) {
  const group = new THREE.Group(); group.name = 'Podio del concurso';
  const column = new THREE.Group(); group.add(column);
  part(column, new THREE.CylinderGeometry(.62, .7, 1, 32), mat('#30246a', { roughness: .3, metalness: .25 }), 0, .5, 0);
  const band = part(column, new THREE.CylinderGeometry(.705, .705, .06, 32, 1, true), mat(color, { emissive: color, emissiveIntensity: .5 }), 0, .2, 0);
  const top = new THREE.Group(); group.add(top);
  part(top, new THREE.CylinderGeometry(.74, .74, .08, 32), mat(GOLD, { metalness: .7, roughness: .3 }), 0, .04, 0);
  const desk = new THREE.Group(); desk.position.set(0, 0, .52); top.add(desk);
  part(desk, new RoundedBoxGeometry(1.2, .95, .34, 3, .06), mat('#241a52', { roughness: .3, metalness: .3 }), 0, .55, 0);
  part(desk, new RoundedBoxGeometry(1.32, .08, .46, 2, .03), mat(GOLD, { metalness: .7, roughness: .3 }), 0, 1.04, 0);
  const lamp = part(desk, new THREE.BoxGeometry(1.1, .07, .02), glow('#3a3360', 1), 0, .9, .175);
  const plate = paintedPlane(1.02, .56, 384); plate.mesh.position.set(0, .5, .176); desk.add(plate.mesh);
  const colors = { off: ['#3a3360', .6], locked: ['#ffc629', 2.4], right: ['#3ef08a', 2.6], wrong: ['#ff4040', 2.4], gold: ['#ffd84a', 3.2] };
  let height = 0;
  const api = {
    setHeight(h) { height = Math.max(.05, h); column.scale.y = height; top.position.y = height; },
    get height() { return height; },
    setLight(mode) { const [c, i] = colors[mode] || colors.off; lamp.material.emissive.set(c); lamp.material.emissiveIntensity = i; },
    // paint(ctx, w, h) draws the plate; the texture refreshes after.
    paint(draw) { draw(plate.ctx, plate.canvas.width, plate.canvas.height); plate.texture.needsUpdate = true; },
    band, top,
  };
  Object.assign(group.userData, api);
  api.setHeight(.4); api.setLight('off');
  api.paint((ctx, w, h) => { ctx.fillStyle = NIGHT; ctx.fillRect(0, 0, w, h); ctx.fillStyle = color; ctx.fillRect(0, h - 14, w, 14); });
  return owned(group);
}

// The host's desk, slimmer and all gold, with a mic. Top at 1,12 m, front +Z.
export function createHostDesk() {
  const group = new THREE.Group(); group.name = 'Atril del animador';
  part(group, new THREE.CylinderGeometry(.42, .55, 1.05, 6), mat('#2b1f5e', { roughness: .25, metalness: .4 }), 0, .525, 0);
  part(group, new THREE.CylinderGeometry(.56, .56, .07, 6), mat(GOLD, { metalness: .8, roughness: .25 }), 0, 1.08, 0);
  part(group, new THREE.TorusGeometry(.5, .03, 6, 6), glow('#ffc629', 2), 0, .4, 0).rotation.x = Math.PI / 2;
  const stem = part(group, new THREE.CylinderGeometry(.015, .015, .45, 8), mat('#222', { metalness: .8 }), 0, 1.3, .25); stem.rotation.x = .5;
  part(group, new THREE.SphereGeometry(.06, 12, 10), mat('#333', { roughness: .8 }), 0, 1.5, .36);
  return owned(group);
}

// The big screen: a gold frame around a painted 16:9 panel, on two legs.
// paint(draw) repaints it; the panel's centre sits at y (3,6 m by default).
export function createQuizScreen({ width = 8.4, y = 3.6 } = {}) {
  const group = new THREE.Group(); group.name = 'Pantalla del concurso';
  const height = width * 9 / 16;
  part(group, new RoundedBoxGeometry(width + .4, height + .4, .3, 3, .1), mat('#151032', { roughness: .4, metalness: .4 }), 0, y, -.16);
  const gold = mat(GOLD, { metalness: .8, roughness: .25 });
  for (const side of [-1, 1]) {
    part(group, new THREE.BoxGeometry(width + .42, .12, .12), gold, 0, y + side * (height / 2 + .15), 0);
    part(group, new THREE.BoxGeometry(.12, height + .42, .12), gold, side * (width / 2 + .15), y, 0);
  }
  for (const x of [-width / 3, width / 3]) part(group, new THREE.BoxGeometry(.25, y - height / 2, .25), mat('#151032', { metalness: .4 }), x, (y - height / 2) / 2, -.2);
  const panel = paintedPlane(width, height, 1280); panel.mesh.position.set(0, y, .005); group.add(panel.mesh);
  group.userData.paint = (draw) => { draw(panel.ctx, panel.canvas.width, panel.canvas.height); panel.texture.needsUpdate = true; };
  group.userData.paint((ctx, w, h) => { ctx.fillStyle = NIGHT; ctx.fillRect(0, 0, w, h); });
  return owned(group);
}

// A stage spotlight on a truss post: the lamp head aims at aim(x, y, z) and
// carries a soft light cone. Post 5,6 m tall.
export function createStageSpotlight({ color = '#fff1c9', light = true } = {}) {
  const group = new THREE.Group(); group.name = 'Reflector';
  part(group, new THREE.CylinderGeometry(.08, .12, 5.6, 8), mat('#3b3b46', { metalness: .7, roughness: .4 }), 0, 2.8, 0);
  part(group, new THREE.CylinderGeometry(.45, .5, .12, 16), mat('#2b2b33', { metalness: .6 }), 0, .06, 0);
  const head = new THREE.Group(); head.position.y = 5.6; group.add(head);
  const can = part(head, new THREE.CylinderGeometry(.24, .3, .6, 16), mat('#24242c', { metalness: .6, roughness: .4 }));
  can.rotation.x = Math.PI / 2;
  part(head, new THREE.CircleGeometry(.23, 20), glow(color, 3), 0, 0, .31);
  const coneGeometry = new THREE.ConeGeometry(1.4, 1, 28, 1, true); coneGeometry.translate(0, -.5, 0); coneGeometry.rotateX(-Math.PI / 2);
  const cone = new THREE.Mesh(coneGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  cone.position.z = .3; head.add(cone);
  const spot = light ? new THREE.SpotLight(color, 60, 30, .32, .6, 1.6) : null;
  if (spot) { spot.position.set(0, 0, .3); head.add(spot); group.add(spot.target); }
  const world = new THREE.Vector3(), aimAt = new THREE.Vector3();
  group.userData.aim = (x, y, z) => {
    aimAt.set(x, y, z); head.lookAt(aimAt);
    head.getWorldPosition(world); cone.scale.set(1, 1, Math.max(.5, world.distanceTo(aimAt) - .3));
    if (spot) { spot.target.position.copy(group.worldToLocal(aimAt.clone())); }
  };
  group.userData.setPower = (on) => { cone.material.opacity = on * .1; if (spot) spot.intensity = on * 60; };
  group.userData.aim(0, 0, 6);
  return owned(group);
}
