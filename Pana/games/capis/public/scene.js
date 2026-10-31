// Capis a Pintazos in 3D, seen from the side: a perspective camera looks at
// the playing plane. The ground is the destructible mask painted into a
// texture (engine/play/terrain-mask.js paintRGBA → THREE.DataTexture) on a
// stack of planes, so it reads as a slab of earth with depth; the capis are
// the shared capybara model with a team bandana; the world behind is real
// 3D scenery (backdrop.js).
import * as THREE from 'three';
import { rendererOptions, bindRenderer } from '/engine/settings.js';
import { wildCapybara } from '/engine/models/fauna/capybara/wild-capybara.js';
import { createLocalMarker } from '/engine/play/local-outline.js';
import { Puffs } from '/engine/fx.js';
import { createBlastFx } from '/engine/play/blast-fx.js';
import { guideRibbon, pathLength } from '/engine/play/aim-guide.js';
import { createRecoil, shakeAt } from '/engine/play/recoil.js';
import { paintRGBA, takeDirty } from '/engine/play/terrain-mask.js';
import { simulateFlight, aimVelocity } from '/engine/play/ballistic.js';
import { RULES, TEAM_COLORS, alive, muzzle, flightOptions, activeCapy } from './rules.js';
import { createBackdrop } from './backdrop.js';

const FRONT = 1;               // the depth where capis and shells move
const SLAB = [-2.6, .55];      // the earth's back and front faces
const LAYERS = 9, CAPY_SCALE = .62, DASHES = 18;
const rgb = hex => { const c = new THREE.Color(hex); return [c.r * 255, c.g * 255, c.b * 255]; };
const PALETTE = { earth: [176, 116, 66], deep: [96, 58, 38], topsoil: [120, 82, 46], grass: [104, 168, 64], tints: TEAM_COLORS.map(rgb), grassDepth: 5 };

function capyModel(team, seed) {
  const group = new THREE.Group(), body = wildCapybara({ seed });
  body.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.userData.base = o.material.color.clone(); } });
  const bandana = new THREE.Mesh(new THREE.TorusGeometry(.44, .09, 8, 20), new THREE.MeshStandardMaterial({ color: TEAM_COLORS[team], roughness: .6 }));
  bandana.position.set(0, 1.0, .62); body.add(bandana);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(.16, .4, 4), bandana.material);
  knot.position.set(0, 1.38, .5); knot.rotation.x = -2.3; body.add(knot);
  body.scale.setScalar(CAPY_SCALE); group.add(body);
  return { group, body };
}

export function createCapisScene(canvas, match) {
  const renderer = new THREE.WebGLRenderer(rendererOptions({ canvas, antialias: true }));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const unbind = bindRenderer(renderer, 2);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .5, 600);
  scene.add(new THREE.HemisphereLight('#fff4dc', '#5d6f3a', 1.6));
  const sun = new THREE.DirectionalLight('#fff1d0', 2.2); sun.position.set(-20, 40, 30); scene.add(sun);
  const backdrop = createBackdrop(scene, match.map);
  let mask = match.mask;

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
  function paintTerrain(rect = takeDirty(mask)) { if (!rect) return; paintRGBA(mask, pixels, PALETTE, rect); texture.needsUpdate = true; }

  // ---------- capis ----------
  const capis = new Map();
  const dropCapis = () => { for (const m of capis.values()) { m.group.removeFromParent(); m.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); } capis.clear(); };
  function setMatch(next) {
    match = next; mask = next.mask; dropCapis();
    for (const c of match.capys) { const m = capyModel(c.team, 7 + c.slot * 3 + c.team * 11); scene.add(m.group); capis.set(c.id, { ...m, wobble: 0, sink: 0 }); }
    takeDirty(mask); paintRGBA(mask, pixels, PALETTE); texture.needsUpdate = true;
  }
  setMatch(match);
  const marker = createLocalMarker({ color: '#ffc629' }); marker.group.scale.setScalar(3); scene.add(marker.group);
  const aimArrow = guideRibbon('#fff6d8', .14, { segments: 1, opacity: .95 }); aimArrow.rotation.x = Math.PI / 2; scene.add(aimArrow);
  const dashes = Array.from({ length: DASHES }, () => { const d = guideRibbon('#ffffff', .12, { segments: 1, opacity: .85 }); d.rotation.x = Math.PI / 2; scene.add(d); return d; });

  // ---------- shells and effects ----------
  const puffs = new Puffs(scene), fx = createBlastFx(scene, puffs), feel = createRecoil();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(.26, 16, 12), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: .25, roughness: .3 }));
  shell.visible = false; scene.add(shell);
  const focus = new THREE.Vector2(match.capys[0].x, match.capys[0].y + 2);
  let wide = false, hold = 0, holdAt = null, time = 0;
  const viewWidth = () => wide ? match.map.width + 8 : camera.aspect < 1 ? 22 : 34;

  function event(e) {
    const c = e.capy && capis.get(e.capy), team = e.team ?? e.by;
    if (e.type === 'fire') { feel.fire({ cam: 1.2, shake: .35 }); puffs.spawn({ x: e.x, y: e.y, z: FRONT }, { color: TEAM_COLORS[e.team], count: 6, spread: .3, size: .4, rise: .6, life: .5 }); }
    if (e.type === 'blast') {
      fx.boom({ x: e.x, y: e.y, z: FRONT, size: 1.1, color: TEAM_COLORS[team], ground: e.y });
      puffs.spawn({ x: e.x, y: e.y, z: FRONT }, { color: TEAM_COLORS[team], count: 22, spread: 2.4, size: .5, rise: 3, life: 1.1 });
      feel.shake(shakeAt(Math.hypot(e.x - focus.x, e.y - focus.y) * .5, 1.2)); hold = .9; holdAt = { x: e.x, y: e.y };
    }
    if ((e.type === 'plop' || (e.type === 'out' && e.reason === 'water'))) {
      const x = e.x ?? match.capys.find(k => k.id === e.capy)?.x ?? focus.x;
      puffs.spawn({ x, y: match.map.water + .2, z: FRONT }, { color: '#d8f1ff', count: 16, spread: 1.2, size: .5, rise: 3.5, life: .9 });
    }
    if (e.type === 'hit' && c) c.wobble = 1;
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

  // view: { playing, power (0..1 while charging, else null), difficulty info, labels: (list) => void }
  function frame(dt, view = {}) {
    time += dt;
    const w = innerWidth, h = innerHeight;
    if (camera.aspect !== w / h) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
    paintTerrain();
    const active = activeCapy(match);
    for (const c of match.capys) {
      const m = capis.get(c.id), g = m.group;
      g.position.set(c.x, c.y, FRONT);
      m.body.rotation.y = THREE.MathUtils.damp(m.body.rotation.y, c.facing > 0 ? Math.PI / 2 : -Math.PI / 2, 10, dt);
      m.wobble = Math.max(0, m.wobble - dt * 2.5);
      m.body.scale.set(CAPY_SCALE * (1 + Math.sin(time * 30) * .12 * m.wobble), CAPY_SCALE * (1 - Math.sin(time * 30) * .12 * m.wobble), CAPY_SCALE);
      const paint = c.paint / 100, tint = new THREE.Color(TEAM_COLORS[1 - c.team]);
      m.body.traverse(o => { if (o.userData.base) o.material.color.copy(o.userData.base).lerp(tint, paint * .8); });
      if (c.out === 'paint') { g.rotation.z = THREE.MathUtils.damp(g.rotation.z, Math.PI, 6, dt); g.position.y += .9 * CAPY_SCALE * 1.6 * Math.min(1, g.rotation.z / Math.PI); }
      if (c.out === 'water') { m.sink = Math.min(3, m.sink + dt * 1.5); g.position.y = match.map.water - m.sink; g.visible = m.sink < 3; }
      else if (!c.grounded && !c.out) m.body.rotation.x = THREE.MathUtils.damp(m.body.rotation.x, -c.vy * .03, 8, dt);
      else m.body.rotation.x = THREE.MathUtils.damp(m.body.rotation.x, 0, 8, dt);
      m.body.userData.tick?.(time);
    }
    const aiming = view.playing && active && alive(active) && match.phase === 'aim';
    marker.group.visible = !!view.playing && !!active && alive(active) && match.phase !== 'finished';
    if (marker.group.visible) marker.group.position.set(active.x, active.y + 2.2, FRONT);
    marker.update(dt);
    aimArrow.visible = !!aiming;
    if (aiming) {
      const from = muzzle(active, active.aim), to = { x: from.x + Math.cos(active.aim) * active.facing * 1.4, y: from.y + Math.sin(active.aim) * 1.4 };
      ARROW[0] = { x: from.x, z: -from.y }; ARROW[1] = { x: to.x, z: -to.y }; aimArrow.userData.set(ARROW, FRONT + .1);
    }
    preview(active, aiming ? view.power : null, view.difficulty);
    shell.visible = !!match.shot;
    if (match.shot) { shell.position.set(match.shot.x, match.shot.y, FRONT); shell.material.color.set(TEAM_COLORS[match.shot.team]); fx.trail('shell', shell.position, dt); }
    // Camera: the shell in flight, a fresh blast for a moment, else the capi whose turn it is.
    hold = Math.max(0, hold - dt);
    const target = match.shot ? { x: match.shot.x, y: match.shot.y } : hold && holdAt ? holdAt : active ? { x: active.x, y: active.y + 1.5 } : focus;
    const half = viewWidth() / 2;
    const tx = wide ? match.map.width / 2 : THREE.MathUtils.clamp(target.x, half - 6, match.map.width - half + 6);
    const ty = wide ? match.map.height * .35 : Math.max(match.map.water + 4, target.y);
    focus.lerp(new THREE.Vector2(tx, ty), 1 - Math.exp(-dt * (match.shot ? 6 : 3)));
    const distance = half / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.aspect;
    const kick = feel.update(dt, { decay: 4 });
    camera.position.set(focus.x + kick.yaw * 25, focus.y + distance * .16 + kick.pitch * 25, FRONT + distance);
    camera.lookAt(focus.x + kick.yaw * 25, focus.y, FRONT);
    camera.rotation.z += kick.roll;
    fx.update(dt); puffs.update(dt); backdrop.update(dt);
    if (view.labels) {
      const v = new THREE.Vector3();
      view.labels(match.capys.map(c => {
        const g = capis.get(c.id).group; v.set(g.position.x, g.position.y + 1.45, FRONT).project(camera);
        return { id: c.id, x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h, visible: !c.out && v.z < 1 && g.visible };
      }));
    }
    renderer.render(scene, camera);
  }

  return {
    renderer, scene, camera, frame, event, paintTerrain, setMatch, react: backdrop.react, pana: backdrop.pana,
    get match() { return match; },
    // The world point under a screen position, on the plane the capis move in.
    pick(clientX, clientY) {
      const ray = new THREE.Raycaster(), hit = new THREE.Vector3();
      ray.setFromCamera(new THREE.Vector2(clientX / innerWidth * 2 - 1, -(clientY / innerHeight) * 2 + 1), camera);
      return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -FRONT), hit) ? { x: hit.x, y: hit.y } : null;
    },
    get wide() { return wide; }, set wide(on) { wide = !!on; },
    dispose() {
      unbind(); dropCapis(); fx.dispose(); marker.dispose(); aimArrow.userData.dispose(); dashes.forEach(d => d.userData.dispose());
      backdrop.dispose(); texture.dispose(); plane.dispose(); layers.forEach(l => l.material.dispose()); renderer.dispose();
    },
  };
}
