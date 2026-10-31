// Parapente's 3D world: the Galipán map (engine/worlds/coastal) in a golden
// afternoon, the course drawn over it (beacon cylinders, boost rings, thermal
// columns with circling zamuros, the diana at Boca de Tigre, the launch deck
// on the crest) and every pana under its wing.
import * as THREE from 'three';
import { createSky } from '/engine/worlds/sky.js';
import { shadowSize, pixelRatio, bindRenderer, rendererOptions } from '/engine/settings.js';
import { createParapente, PARAPENTE } from '/engine/models/vehicles/parapente.js';
import { soaringVulture } from '/engine/models/fauna/birds/soaring-vulture.js';
import { orbitBird } from '/engine/models/animation/orbit-bird.js';
import { tickWind } from '/engine/models/vegetation/plant-kit.js';
import { M, box } from '/engine/models/core/primitives.js';
import { galipanWorld } from './galipan.js';
import { angle } from './rules.js';
import { label, dianaTexture, softTexture, fadeTexture } from './textures.js';

// Late afternoon over El Ávila: a low warm sun from the west, Caracas hazy below.
export const PALETTE = { skySeed: 53, cloudCover: .38, horizon: 0xf2cfa0, skyTop: 0x3f86d2, daylight: .85,
  sunDirection: new THREE.Vector3(-.75, .32, .3), hemiSky: 0xdfe8ff, hemiGround: 0x5a6a3a, hemiInt: 1.25,
  sun: 0xffd9a8, sunInt: 2.3, fog: [520, 3600] };
const GOLD = 0xffc629, GAME = 0x2fa3e0;

// The course over the map: rebuilt when the course object changes (thermal strength).
function courseMarkers(course) {
  const group = new THREE.Group(); group.name = 'Recorrido';
  const beacons = course.beacons.map((b, i) => {
    const g = new THREE.Group(); g.position.set(b.x, b.ground, b.z);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(b.r, b.r, 320, 48, 1, true), new THREE.MeshBasicMaterial({ color: GAME, alphaMap: fadeTexture(), transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    wall.position.y = 160; wall.renderOrder = 2;
    const base = new THREE.Mesh(new THREE.TorusGeometry(b.r, .5, 6, 64), new THREE.MeshBasicMaterial({ color: GAME })); base.rotation.x = Math.PI / 2; base.position.y = 1;
    // An inflatable pylon in the middle with the beacon's number on a tag.
    const pylon = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 16), M(0xff8a1f, { roughness: .5 })); pylon.position.y = 4.5;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.55, 1.6, 16), M(0xfaf6ec)); band.position.y = 4.6;
    const tag = label(`${i + 1} · ${b.name}`, { scale: 7 }); tag.position.y = 22;
    g.add(wall, base, pylon, band, tag); group.add(g);
    return { g, wall, base, tag };
  });
  const ringMaterial = new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: .6, roughness: .35, metalness: .2 });
  const rings = course.rings.map(r => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r.r, .45, 10, 48), ringMaterial.clone()); m.position.set(r.x, r.y, r.z); m.rotation.y = r.h; m.userData.ring = r; group.add(m); return m;
  });
  // Thermals: rising dust in a slow helix, a cumulus cap and two zamuros circling.
  const dust = course.thermals.map((t, k) => {
    const n = 140, geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffe9b8, size: 2.4, map: softTexture(), transparent: true, opacity: .55, depthWrite: false }));
    points.frustumCulled = false; group.add(points);
    const cap = new THREE.Group(); cap.position.set(t.x, t.top + 14, t.z);
    // Flat puffs, shaded underneath, so the cap reads as a cumulus and not a glow.
    for (let i = 0; i < 14; i++) {
      const low = i % 3 === 0, s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(), color: low ? 0xd9d4cc : 0xfffaf0, transparent: true, opacity: low ? .55 : .7, depthWrite: false }));
      const a = i * 2.4, r = 6 + (i % 4) * 7; s.position.set(Math.cos(a) * r * 1.4, low ? -3 : 2 + (i % 2) * 5, Math.sin(a) * r);
      const size = 22 + (i % 5) * 6; s.scale.set(size * 1.8, size * .8, 1); cap.add(s);
    }
    group.add(cap);
    const birds = [0, 1].map(i => orbitBird(soaringVulture({ seed: 70 + k * 3 + i }), { cx: t.x, cz: t.z, cy: t.ground + 70 + i * 40, r: t.r * (.5 + i * .3), speed: .25 + i * .07, phase: i * 2 + k }));
    birds.forEach(b => { b.scale.setScalar(1.6); group.add(b); });
    return { t, points, n, birds, seed: k * 1.7 };
  });
  // The diana painted on Boca de Tigre's plaza, with a windsock beside it.
  const L = course.landing;
  const target = new THREE.Mesh(new THREE.CircleGeometry(L.r, 64), new THREE.MeshStandardMaterial({ map: dianaTexture(), roughness: .9, polygonOffset: true, polygonOffsetFactor: -4 }));
  target.rotation.x = -Math.PI / 2; target.position.set(L.x, L.y + .12, L.z); target.receiveShadow = true; group.add(target);
  const sock = new THREE.Group(); sock.position.set(L.x + L.r + 4, L.y, L.z);
  sock.add(box(.16, 7, .16, M(0xd8d8d8), 0, 3.5, 0));
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(.55, .25, 3, 12, 1, true).rotateZ(Math.PI / 2).translate(1.6, 0, 0), M(0xff8a1f, { side: THREE.DoubleSide })); cone.position.y = 6.6; sock.add(cone); group.add(sock);
  const landingTag = label(`Diana · ${L.name}`, { bg: 'rgba(232,68,58,.85)', scale: 7 }); landingTag.position.set(L.x, L.y + 26, L.z); group.add(landingTag);
  // The launch deck on the crest: planks on stilts and a banner over the edge.
  const S = course.launch, deck = new THREE.Group(), wood = M(0x9a6a3c, { roughness: .9 }), dark = M(0x5b3d22);
  const width = course.slots.length * 5 + 6;
  deck.add(box(width, .3, 14, wood, 0, -.7, -4));
  for (const x of [-width / 2 + .5, 0, width / 2 - .5]) for (const z of [-10, 2.5]) deck.add(box(.4, 30, .4, dark, x, -15.7, z));
  for (const x of [-width / 2 - .4, width / 2 + .4]) deck.add(box(.3, 9, .3, dark, x, 3.6, 2.6));
  const banner = label('DESPEGUE · GALIPÁN', { bg: 'rgba(47,163,224,.92)', scale: 4.4 }); banner.position.set(0, 8, 2.6); deck.add(banner); // i18n-ignore: world signage
  deck.position.set(S.x, S.y, S.z); group.add(deck);
  // M() materials and the zamuros' are shared with every other model: never disposed here.
  const shared = new Set();
  for (const root of [sock, deck, ...beacons.flatMap(b => b.g.children.filter(o => o.material?.flatShading)), ...dust.flatMap(d => d.birds)]) root.traverse(o => { if (!o.isSprite) for (const m of [].concat(o.material || [])) shared.add(m); });
  let lastTime = 0;
  return {
    group, beacons, rings, landingTag,
    update(own, t, guide, eye) {
      const next = own ? own.beacon : 0;
      beacons.forEach((b, i) => {
        const passed = i < next, current = i === next;
        // The next beacon's column, fading upward; hidden while the camera is inside it.
        b.wall.visible = current && Math.hypot(eye.x - b.g.position.x, eye.z - b.g.position.z) > b.r + 4; b.wall.material.opacity = .28 + Math.sin(t * 2) * .06; b.base.material.color.setHex(passed ? 0x9aa0a6 : current ? GOLD : GAME);
        b.tag.visible = !passed && (current || !guide);
      });
      landingTag.visible = (next >= beacons.length || !guide) && !(own && Math.hypot(own.x - L.x, own.z - L.z) < 120);
      for (const m of rings) {
        const taken = own?.rings.includes(m.userData.ring.id);
        m.material.opacity = taken ? .25 : 1; m.material.transparent = taken; m.material.emissiveIntensity = taken ? .1 : .5 + Math.sin(t * 4 + m.position.x) * .25;
      }
      const dt = Math.min(.1, t - lastTime); lastTime = t;
      for (const d of dust) {
        const p = d.points.geometry.attributes.position, { t: T } = d, height = T.top - T.ground;
        for (let i = 0; i < d.n; i++) {
          const u = ((i / d.n) + t * .035) % 1, a = i * 2.39 + t * .5 + d.seed, r = T.r * (.25 + .55 * ((i * 7) % 10) / 10);
          p.setXYZ(i, T.x + Math.cos(a) * r, T.ground + 4 + u * height, T.z + Math.sin(a) * r);
        }
        p.needsUpdate = true;
        d.birds.forEach(b => b.userData.tick(t));
      }
      cone.rotation.y = Math.sin(t * .7) * .4 + .6; cone.rotation.z = -.15 + Math.sin(t * 2.3) * .05;
      return dt;
    },
    dispose() { group.traverse(o => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) if (!shared.has(m)) { if (m.map !== softTexture()) m.map?.dispose(); m.dispose(); } }); group.removeFromParent(); },
  };
}

export function createParapenteScene(canvas, { course: courseOf }) {
  const renderer = new THREE.WebGLRenderer(rendererOptions({ canvas, antialias: true }));
  renderer.setPixelRatio(pixelRatio(1.5)); const unbind = bindRenderer(renderer, 1.5, { fit: 'canvas' });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(PALETTE.horizon, ...PALETTE.fog);
  renderer.setClearColor(PALETTE.horizon);
  const sky = createSky(PALETTE); scene.add(sky.mesh);
  scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, PALETTE.hemiInt));
  const sun = new THREE.DirectionalLight(PALETTE.sun, PALETTE.sunInt);
  sun.castShadow = true; sun.shadow.mapSize.setScalar(shadowSize(1024));
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 400 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .04; scene.add(sun, sun.target);
  const world = galipanWorld(new THREE.Group()); scene.add(world.group);
  const camera = new THREE.PerspectiveCamera(58, 1, .3, 6000);
  const pilots = new Map();
  let course = null, markers = null, state = null, room = null, clock = 0, camReady = false, camH = 0;
  const look = new THREE.Vector3(), goal = new THREE.Vector3(), target = new THREE.Vector3();

  function ensureCourse(options) {
    const next = courseOf(options);
    if (next === course) return;
    markers?.dispose(); course = next; markers = courseMarkers(course); scene.add(markers.group);
  }
  // Snapshot in: rebuild models whose look changed, drop pilots who left.
  function update(next, link) {
    state = next; room = link; ensureCourse(state.options);
    const live = new Set();
    for (const p of state.pilots) {
      live.add(p.id);
      const key = JSON.stringify([p.color, p.avatar]); let entry = pilots.get(p.id);
      if (entry?.key !== key) {
        entry?.model.dispose();
        const model = createParapente(p.avatar || {}, p.color); model.group.position.set(p.x, p.y, p.z); model.group.rotation.y = p.h; scene.add(model.group);
        const tag = label(p.name, { scale: 2.6 }); tag.position.y = PARAPENTE.height + 2.4; model.group.add(tag);
        entry = { model, key, tag }; pilots.set(p.id, entry);
      }
      entry.pilot = p;
    }
    for (const [id, entry] of pilots) if (!live.has(id)) { entry.tag.material.map.dispose(); entry.tag.material.dispose(); entry.model.dispose(); pilots.delete(id); }
  }

  function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); addEventListener('resize', resize);

  function frame(dt) {
    if (!state || !course) return;
    const roomId = room.id, predicted = room.predicted;
    clock += dt;
    let focus = null;
    for (const [id, entry] of pilots) {
      // Your own wing where you predict it, not a round trip behind.
      const p = id === roomId ? predicted ?? entry.pilot : entry.pilot, g = entry.model.group;
      target.set(p.x, p.y, p.z);
      if (g.position.distanceTo(target) > 25) g.position.copy(target); else g.position.lerp(target, 1 - Math.exp(-dt * 14));
      g.rotation.y += angle(p.h - g.rotation.y) * (1 - Math.exp(-dt * 10));
      entry.model.update(dt, p, clock);
      const far = g.position.distanceTo(camera.position);
      entry.tag.visible = id !== roomId && far > 24 && far < 160;
      if (id === roomId) focus = entry;
    }
    focus ??= [...pilots.values()].sort((a, b) => b.pilot.progress - a.pilot.progress)[0];
    const own = focus?.pilot, q = focus ? focus.model.group.position : new THREE.Vector3(course.launch.x, course.launch.y, course.launch.z);
    // Before the start: behind the deck, over the line of wings, looking south
    // across the whole course to Galipán (north of it the map ends).
    if (state.phase === 'lobby' || state.phase === 'countdown' || !focus) {
      const L = course.launch, wide = innerWidth < 700 ? 1.5 : 1;
      goal.set(L.x - 8, L.y + 16 * wide, L.z - 18 * wide); look.set(L.x, L.y - 18, L.z + 70);
      camH = L.h; camReady = false;
      camera.position.lerp(goal, camera.position.distanceTo(goal) > 60 ? 1 : 1 - Math.exp(-dt * 3));
    } else {
      // Chase camera behind and above the wing, easing round the turns.
      const wantH = focus.model.group.rotation.y;
      camH = camReady ? camH + angle(wantH - camH) * (1 - Math.exp(-dt * 2.6)) : wantH;
      const back = innerHeight > innerWidth ? 20 : 16, v = own.v || 16;
      goal.set(q.x - Math.sin(camH) * back, q.y + PARAPENTE.height * .7 + 2, q.z - Math.cos(camH) * back);
      look.set(q.x + Math.sin(camH) * 18, q.y + 2.2, q.z + Math.cos(camH) * 18);
      const floor = world.groundAt(goal.x, goal.z) + 2; if (goal.y < floor) goal.y = floor;
      if (!camReady || camera.position.distanceTo(goal) > 60) { camera.position.copy(goal); camReady = true; } else camera.position.lerp(goal, 1 - Math.exp(-dt * 4));
      const fov = 56 + Math.min(12, Math.max(0, v - 14) * 1.2) + (own.boost > 0 ? 5 : 0);
      if (Math.abs(camera.fov - fov) > .05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
    }
    camera.lookAt(look);
    const sunDir = PALETTE.sunDirection;
    sun.position.set(q.x + sunDir.x * 200, q.y + sunDir.y * 200, q.z + sunDir.z * 200); sun.target.position.copy(q); sun.target.updateMatrixWorld();
    tickWind(clock, .8);
    world.update?.(clock); sky.update(clock, PALETTE.daylight);
    markers.update(state.pilots.find(p => p.id === roomId) ? (predicted ?? state.pilots.find(p => p.id === roomId)) : null, clock, state.options.guide, camera.position);
    renderer.render(scene, camera);
  }

  function dispose() {
    removeEventListener('resize', resize); unbind();
    for (const entry of pilots.values()) entry.model.dispose();
    markers?.dispose(); world.group.userData.dispose?.(); sky.dispose(); renderer.dispose();
  }
  return { renderer, scene, camera, sun, world, update, frame, dispose, get course() { return course; } };
}
