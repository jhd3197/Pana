import { createArenaEnvironment } from '/engine/arenas.js';
import { paintArenaInfo } from '/engine/arena-layouts.js';
import { createMuelle } from './muelle.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { bindRenderer } from '/engine/settings.js';
import { createSky } from '/engine/sky.js';
import { house, church } from '/engine/models/props/plaza-buildings.js';
import { crate, barrel, marketStall, streetLamp } from '/engine/models/props/plaza.js';
import { parkBench, basketballHoop } from '/engine/models/props/pueblo.js';
import { araguaney } from '/engine/models/vegetation/araguaney.js';
import { mangoTree } from '/engine/models/vegetation/mango-tree.js';
import { bake } from '/engine/models/core/static-batch.js';
import { createPaintMarker, splatTexture, pavingTexture } from '/engine/models/props/paintball.js';
import { rng } from '/engine/random.js';
import { WARM_DAY, PALETTE, BUNTING } from '/engine/look.js';
import { COVER, SIZE, SPREAD, coverFor } from './rules.js';

// First person: the camera sits at the pana's eyes and the marker is held in view.
const EYE = 1.55, LOOK_UP = .55, LOOK_DOWN = -.7;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); const unbind = bindRenderer(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(WARM_DAY.background); scene.fog = new THREE.Fog(WARM_DAY.background, 90, 190);
  const sky = createSky(WARM_DAY.sky); scene.add(sky.mesh);
  const camera = new THREE.PerspectiveCamera(72, 1, .05, 220), target = new THREE.Vector3(), destination = new THREE.Vector3(); scene.add(camera);
  let cameraView = 'primera', elapsed = 0, initialized = false, yaw = 0, pitch = 0, previousPhase = 'lobby', wasDown = false, lift = 0, bob = 0, sway = 0, kick = 0, lastAmmo = 12;
  scene.add(new THREE.HemisphereLight(WARM_DAY.hemi[0], WARM_DAY.hemi[1], 2.5));
  const sun = new THREE.DirectionalLight(WARM_DAY.sun.color, 3.2); sun.position.set(-15, 35, 16); sun.castShadow = true; scene.add(sun.target);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 80 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.normalBias = .03; scene.add(sun);
  const defaultCourt = new THREE.Group(); scene.add(defaultCourt);
  let environment = null, mapId = 'plaza'; scene.userData.mapId = mapId;
  const materials = new Map(), avatars = new Map(), ballMeshes = new Map(), splats = new Map();
  const material = color => { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .85 })); return materials.get(color); };
  // Hits splat as glossy blobs, four shapes per colour.
  const hitTextures = [11, 12, 13, 14].map(splatTexture), hitMaterials = new Map();
  const splatMaterial = (color, id) => { const key = `${color}:${id % 4}`; if (!hitMaterials.has(key)) hitMaterials.set(key, new THREE.MeshStandardMaterial({ color, map: hitTextures[id % 4], transparent: true, alphaTest: .4, roughness: .3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })); return hitMaterials.get(key); };
  const box = (w, h, d, color, x, y, z) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color)); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; defaultCourt.add(mesh); return mesh; };
  const fence = SIZE + 1, span = fence * 2 - 1;
  box(200, .3, 200, '#dcb985', 0, -.3, 0);
  const paving = pavingTexture(), court = box(span, .2, span, '#ffffff', 0, -.08, 0); paving.repeat.multiplyScalar(span / 37);
  court.material = new THREE.MeshStandardMaterial({ map: paving, roughness: .9 });
  for (let i = -SIZE; i < SIZE; i += 2) for (const z of [-SIZE, SIZE]) box(1.1, .02, .13, '#fff3e0', i, .04, z);
  for (const side of [-1, 1]) {
    box(.2, .45, span, PALETTE.terracota, side * fence, .225, 0); box(span + 1, .45, .2, PALETTE.terracota, 0, .225, side * fence);
    for (let i = -SIZE; i <= SIZE; i += 4.5) { box(.22, 3, .22, PALETTE.madera, side * fence, 1.5, i); box(.22, 3, .22, PALETTE.madera, i, 1.5, side * fence); }
    // Two ropes keep sight lines to the pueblo and opponents open.
    for (const y of [1.1, 2.85]) { box(.04, .04, span, '#b98a5c', side * fence, y, 0); box(span + 1, .04, .04, '#b98a5c', 0, y, side * fence); }
  }
  // Bunting along the top rope on all four sides, one vertex-coloured mesh.
  {
    const positions = [], colors = [];
    for (const side of [-1, 1]) for (let i = -fence + .5, n = 0; i < fence - .5; i += .9, n++) for (const along of ['x', 'z']) {
      const c = new THREE.Color(BUNTING[(n + (along === 'x' ? 0 : 3) + (side > 0 ? 1 : 0)) % BUNTING.length]);
      const p = (u, y) => along === 'x' ? [u, y, side * fence] : [side * fence, y, u];
      positions.push(...p(i, 2.83), ...p(i + .7, 2.83), ...p(i + .35, 2.3)); for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
    defaultCourt.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide })));
  }
  const scenery = new THREE.Group(), cameraBounds = [];
  // The pueblo around the court spreads with it.
  function place(model, x, z, angle = 0) { model.position.set(x * SPREAD, 0, z * SPREAD); model.rotation.y = angle; scenery.add(model); cameraBounds.push(new THREE.Box3().setFromObject(model)); }
  const colors = [0xe3ad54, 0x5c9da7, 0xe79874, 0x8ba776];
  for (let i = 0; i < 4; i++) {
    const x = [-18, -10.5, 10.5, 18][i]; place(house({ w: 7, h: 7 + i % 2, seed: i, color: colors[i], label: ['CAFÉ COCO', 'BUENA GENTE', 'LA BODEGUITA', 'MÁS PANAS'][i] }), x, -27);
    for (const side of [-1, 1]) place(house({ w: 7, h: 6 + i % 2, seed: i + 4, color: colors[(i + 1) % 4] }), side * 28, -15 + i * 9, -side * Math.PI / 2);
  }
  place(church(), 0, -28);
  for (const side of [-1, 1]) {
    for (const [i, z] of [-19, -3, 14].entries()) place(i % 2 ? mangoTree({ seed: i + 3 }) : araguaney({ seed: i + 8 }), side * 22.5, z);
    place(marketStall({ seed: side + 3 }), side * 13, 24, Math.PI); place(parkBench(), side * 7, 21, Math.PI);
    place(streetLamp(), side * 20.5, -12); place(streetLamp(), side * 20.5, 11);
    place(basketballHoop(), side * 17, 21, Math.PI); place(barrel(), side * 21.5, 20);
  }
  COVER.forEach((o, i) => {
    cameraBounds.push(new THREE.Box3(new THREE.Vector3(o.x - o.w / 2, 0, o.z - o.d / 2), new THREE.Vector3(o.x + o.w / 2, o.h, o.z + o.d / 2)));
    // Fit real crate geometry inside the authoritative COVER box, including height.
    const columns = Math.ceil(o.w / 2), rows = Math.ceil(o.d / 2);
    for (let x = 0; x < columns; x++) for (let z = 0; z < rows; z++) {
      const model = crate(), bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
      const wrapper = new THREE.Group(); model.position.sub(bounds.min); wrapper.add(model); wrapper.scale.set(o.w / columns / size.x, o.h / size.y, o.d / rows / size.z);
      wrapper.position.set(o.x - o.w / 2 + x * o.w / columns, 0, o.z - o.d / 2 + z * o.d / rows); scenery.add(wrapper);
    }
    box(o.w + .01, .24, o.d + .01, i % 2 ? PALETTE.coral : PALETTE.turquesa, o.x, o.h * .7, o.z);
  });
  // Old battles left their mark: splats on every crate stack and the paving.
  const splatTextures = [1, 2, 3, 4].map(splatTexture), paint = [PALETTE.rojo, PALETTE.azul, PALETTE.amarillo, PALETTE.turquesa, PALETTE.verde];
  const decal = (color, n) => new THREE.MeshStandardMaterial({ color, map: splatTextures[n % 4], transparent: true, alphaTest: .4, roughness: .3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const r = rng(77);
  COVER.forEach((o, i) => {
    for (let k = 0; k < 3; k++) {
      const face = Math.floor(r() * 4), size = .9 + r() * .9, mark = new THREE.Mesh(new THREE.PlaneGeometry(size, size), decal(paint[(i + k) % paint.length], i + k));
      const u = (r() - .5) * .7, v = o.h * (.25 + r() * .5);
      if (face < 2) mark.position.set(o.x + u * o.w, v, o.z + (face ? 1 : -1) * (o.d / 2 + .02)); else mark.position.set(o.x + (face === 3 ? 1 : -1) * (o.w / 2 + .02), v, o.z + u * o.d);
      mark.rotation.set(0, face === 1 ? 0 : face === 0 ? Math.PI : face === 3 ? Math.PI / 2 : -Math.PI / 2, r() * 6); defaultCourt.add(mark);
    }
  });
  for (let k = 0; k < 48; k++) {
    const size = 1 + r() * 1.8, mark = new THREE.Mesh(new THREE.PlaneGeometry(size, size), decal(paint[k % paint.length], k));
    mark.rotation.set(-Math.PI / 2, 0, r() * 6); mark.position.set((r() - .5) * span, .025 + k * .0004, (r() - .5) * span); defaultCourt.add(mark);
  }
  // Paint buckets and tyre stacks wait outside the fence.
  for (const [k, [x, z]] of [[-20.6, -6], [20.6, 4], [-20.4, 9], [20.5, -9], [-6, 20.5], [7, -20.6]].map(([x, z]) => [Math.abs(x) > 20 ? Math.sign(x) * (fence + 1.6) : x * SPREAD, Math.abs(z) > 20 ? Math.sign(z) * (fence + 1.6) : z * SPREAD]).entries()) {
    if (k % 2) {
      for (let t = 0; t < 3; t++) { const tyre = new THREE.Mesh(new THREE.TorusGeometry(.42, .17, 10, 22), material('#2b2b2b')); tyre.rotation.x = Math.PI / 2; tyre.position.set(x, .17 + t * .32, z); tyre.castShadow = true; defaultCourt.add(tyre); }
    } else for (let b = 0; b < 3; b++) {
      const color = paint[(k + b) % 3], bucket = new THREE.Mesh(new THREE.CylinderGeometry(.3, .26, .55, 16), material(color)); bucket.position.set(x + (b - 1) * .7, .275, z + (b % 2) * .4); bucket.castShadow = true; defaultCourt.add(bucket);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(.31, .31, .06, 16), material('#f4f1ea')); rim.position.set(bucket.position.x, .56, bucket.position.z); defaultCourt.add(rim);
    }
  }
  const surroundings = bake(scenery); defaultCourt.add(surroundings);
  const originalGeometry = new Set(); scenery.traverse(o => { if (o.geometry) originalGeometry.add(o.geometry); }); originalGeometry.forEach(g => g.dispose());
  const defaultCameraBounds = [...cameraBounds];
  function setMap(id) {
    id = paintArenaInfo(id).id; if (mapId === id) return;
    environment?.dispose(); environment = null; mapId = id; scene.userData.mapId = id;
    defaultCourt.visible = id === 'plaza'; cameraBounds.length = 0;
    if (id === 'plaza') cameraBounds.push(...defaultCameraBounds);
    else { environment = id === 'muelle' ? createMuelle() : createArenaEnvironment(id, { mode: 'paint', size: SIZE, cover: coverFor(id) }); scene.add(environment.group); cameraBounds.push(...environment.cameraBounds); }
    initialized = false;
  }
  const ballGeo = new THREE.SphereGeometry(.16, 8, 6), splatGeo = new THREE.PlaneGeometry(1.25, 1.25), ringGeo = new THREE.RingGeometry(.75, .86, 32);
  const aim = new THREE.Mesh(new THREE.RingGeometry(.25, .32, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })); aim.rotation.x = -Math.PI / 2; aim.position.y = .05; scene.add(aim);
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.1), mouse = new THREE.Vector2(), point = new THREE.Vector3();
  const frontRay = new THREE.Ray(), front = new THREE.Vector3(), hit = new THREE.Vector3();
  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false); }
  // The marker held in first person, rebuilt when the pana's paint colour changes.
  let held = null, heldColor = '';
  function holdMarker(color) {
    if (heldColor === color) return;
    held?.removeFromParent(); held?.userData.dispose(); heldColor = color;
    held = createPaintMarker({ color }); held.scale.setScalar(.3); held.traverse(o => { o.castShadow = false; }); camera.add(held);
  }
  // Paint that stopped against cover splats on that face, not on the paving.
  function stick(mesh, s, cover) {
    for (const o of cover) {
      const gx = Math.abs(s.x - o.x) - o.w / 2, gz = Math.abs(s.z - o.z) - o.d / 2;
      if (gx > .35 || gz > .35) continue;
      const y = Math.min(1.1, o.h - .35);
      if (gx > gz) { mesh.position.set(o.x + Math.sign(s.x - o.x) * (o.w / 2 + .02), y, s.z); mesh.rotation.set(0, Math.sign(s.x - o.x) * Math.PI / 2, s.id * 1.7); }
      else { mesh.position.set(s.x, y, o.z + Math.sign(s.z - o.z) * (o.d / 2 + .02)); mesh.rotation.set(0, s.z > o.z ? 0 : Math.PI, s.id * 1.7); }
      return;
    }
    mesh.rotation.set(-Math.PI / 2, 0, s.id * 1.7); mesh.position.set(s.x, .06, s.z);
  }
  const face = p => { yaw = Math.atan2(p.x, p.z); pitch = 0; };
  const flags = [0, 1].map(team => {
    const root = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 2.7, 8), material('#f8f0d2'));
    root.name = `Bandera ${team}`;
    pole.position.y = 1.35; root.add(pole);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.1, .65, .06), material(team ? '#29c5cd' : '#f28b42')); cloth.position.set(.55, 2.2, 0); root.add(cloth); scene.add(root); return root;
  });
  const bases = flags.map((_, team) => { const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 1.95, 32), material(team ? '#29c5cd' : '#f28b42')); ring.rotation.x = -Math.PI / 2; scene.add(ring); return ring; });
  function draw(state, id, dt, aimPoint) {
    flags.forEach((root, i) => { const flag = state.flags?.[i]; root.visible = !!state.options?.flag && !!flag && state.phase === 'playing'; if (flag) root.position.set(flag.x, flag.carrier == null ? 0 : 2, flag.z); });
    bases.forEach((ring, i) => { const flag = state.flags?.[i]; ring.visible = flags[i].visible; if (flag) ring.position.set(flag.homeX, .035, flag.homeZ); });
    setMap(state.mapId); environment?.update(elapsed, dt);
    canvas.style.width = '100vw'; canvas.style.height = '100dvh';
    resize(); const aspect = canvas.clientWidth / canvas.clientHeight, lobby = state.phase === 'lobby';
    const me = state.players.find(p => p.id === id), first = cameraView === 'primera' && !lobby && !!me, mobile = aspect < 1;
    if (me && state.phase === 'playing' && previousPhase !== 'playing') { face(me); initialized = false; }
    previousPhase = state.phase;
    // After a respawn the pana stands somewhere new: look into the court again.
    const down = !!me && (me.respawn > 0 || me.eliminated);
    if (me && wasDown && !down) face(me);
    wasDown = down;
    for (const p of state.players) {
      let avatar = avatars.get(p.id);
      if (!avatar) {
        avatar = buildCharacter(p.avatar); avatar.group.position.set(p.x, 0, p.z); scene.add(avatar.group);
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: p.color, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .05; avatar.group.add(ring);
        const marker = createPaintMarker({ color: p.color }); marker.position.set(.48, .95, .25); avatar.group.add(marker);
        avatar.ring = ring; avatar.marker = marker; avatar.paintColor = p.color; avatars.set(p.id, avatar);
      }
      if (avatar.paintColor !== p.color) {
        avatar.marker.removeFromParent(); avatar.marker.userData.dispose();
        avatar.marker = createPaintMarker({ color: p.color }); avatar.marker.position.set(.48, .95, .25); avatar.group.add(avatar.marker); avatar.paintColor = p.color;
      }
      avatar.ring.material.color.set(p.color);
      avatar.group.visible = p.connected && !p.eliminated && p.respawn <= 0 && !(first && p.id === id);
      if (Math.hypot(avatar.group.position.x - p.x, avatar.group.position.z - p.z) > 6) avatar.group.position.set(p.x, 0, p.z);
      else avatar.group.position.lerp(new THREE.Vector3(p.x, 0, p.z), 1 - Math.exp(-dt * 20));
      avatar.group.rotation.y = Math.atan2(p.ax, p.az); avatar.ring.scale.setScalar(p.id === id ? 1.25 : 1); avatar.ring.visible = p.shield <= 0 || Math.floor(performance.now() / 140) % 2 === 0;
      avatar.update(dt, { walk: p.walk, run: p.walk });
    }
    for (const [id, avatar] of avatars) if (!state.players.some(p => p.id === id)) { avatar.marker.userData.dispose(); avatar.ring.removeFromParent(); avatar.ring.material.dispose(); avatar.dispose(); avatars.delete(id); }
    camera.aspect = aspect;
    if (first) {
      const body = avatars.get(id).group.position;
      lift += ((down ? 3.2 : 0) - lift) * (1 - Math.exp(-dt * 4));
      sway += ((me.walk && !down ? 1 : 0) - sway) * (1 - Math.exp(-dt * 8)); bob += dt * 9 * sway;
      if (state.phase === 'playing' && me.ammo < lastAmmo) kick = 1;
      kick = Math.max(0, kick - dt * 6); lastAmmo = me.ammo;
      camera.fov = mobile ? 80 : 72;
      camera.position.set(body.x, EYE + lift + Math.abs(Math.sin(bob)) * .05 * sway, body.z);
      camera.rotation.set(pitch - lift * .22 + kick * .03, yaw, Math.sin(bob) * .008 * sway, 'YXZ');
      // Pull the marker in when the pana stands against cover, so it never pokes through.
      camera.updateMatrixWorld(); camera.getWorldDirection(front); front.y = 0; front.normalize(); frontRay.set(camera.position, front);
      let clearance = 2;
      for (const bounds of cameraBounds) if (frontRay.intersectBox(bounds, hit)) clearance = Math.min(clearance, hit.distanceTo(camera.position));
      holdMarker(me.color); held.visible = !down;
      held.position.set(.2 + Math.sin(bob) * .012 * sway, -.25 + Math.abs(Math.cos(bob)) * .01 * sway - kick * .01, -.34 + kick * .05 + Math.max(0, .6 - clearance));
      held.rotation.set(kick * .14, Math.PI, 0);
      camera.clearViewOffset();
    } else {
      if (held) held.visible = false;
      destination.set(lobby ? 0 : THREE.MathUtils.clamp((me?.x || 0) * .4, -10, 10), .8, lobby ? -1 : THREE.MathUtils.clamp((me?.z || 0) * .4, -9, 9));
      if (!initialized) { target.copy(destination); initialized = true; } else target.lerp(destination, 1 - Math.exp(-dt * 5));
      camera.fov = mobile ? 64 : 54;
      camera.position.copy(target).add(new THREE.Vector3(lobby ? 18 : 0, lobby ? 34 : mobile ? 38 : 34, lobby ? 48 : mobile ? 40 : 46)); camera.lookAt(target);
      if (lobby && canvas.clientWidth > 760) camera.setViewOffset(canvas.clientWidth, canvas.clientHeight, -170, 0, canvas.clientWidth, canvas.clientHeight); else camera.clearViewOffset();
    }
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    sun.position.set(camera.position.x - 15, 35, camera.position.z + 16); sun.target.position.set(camera.position.x, 0, camera.position.z);
    for (const b of state.balls) { let mesh = ballMeshes.get(b.id); if (!mesh) { mesh = new THREE.Mesh(ballGeo, material(b.color)); scene.add(mesh); ballMeshes.set(b.id, mesh); } mesh.position.set(b.x, 1.1, b.z); }
    for (const [id, mesh] of ballMeshes) if (!state.balls.some(b => b.id === id)) { mesh.removeFromParent(); ballMeshes.delete(id); }
    for (const s of state.splats) { let mesh = splats.get(s.id); if (!mesh) { mesh = new THREE.Mesh(splatGeo, splatMaterial(s.color, s.id)); stick(mesh, s, coverFor(state.mapId)); scene.add(mesh); splats.set(s.id, mesh); } mesh.scale.setScalar(Math.min(1, s.life)); }
    for (const [id, mesh] of splats) if (!state.splats.some(s => s.id === id)) { mesh.removeFromParent(); splats.delete(id); }
    aim.visible = !lobby && !first && !!aimPoint; if (aimPoint) aim.position.set(aimPoint.x, .07, aimPoint.z);
    elapsed += dt; sky.update(elapsed); renderer.render(scene, camera);
  }
  return { renderer, scene, camera, avatars, draw,
    setView(value) { cameraView = value; initialized = false; },
    get view() { return cameraView; },
    get yaw() { return yaw; },
    look(yawDelta, pitchDelta = 0) { yaw += yawDelta; pitch = THREE.MathUtils.clamp(pitch + pitchDelta, LOOK_DOWN, LOOK_UP); },
    // Where the crosshair points on the court (shots fly level).
    forward() { return { x: -Math.sin(yaw), z: -Math.cos(yaw) }; },
    movement(x, z) { return cameraView === 'primera' ? { x: x * Math.cos(yaw) + z * Math.sin(yaw), z: -x * Math.sin(yaw) + z * Math.cos(yaw) } : { x, z }; },
    point(clientX, clientY) { const rect = canvas.getBoundingClientRect(); mouse.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(mouse, camera); return ray.ray.intersectPlane(plane, point)?.clone(); },
    screen(x, z) { const p = new THREE.Vector3(x, 1.1, z).project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; },
    dispose() { unbind(); sky.dispose(); environment?.dispose(); disposeModel(defaultCourt); held?.userData.dispose(); hitMaterials.forEach(m => m.dispose()); hitTextures.forEach(t => t.dispose()); avatars.forEach(a => { a.marker.userData.dispose(); a.ring.removeFromParent(); a.ring.material.dispose(); a.dispose(); }); const geometries = new Set([ringGeo, ballGeo, splatGeo]), textures = new Set(); scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material?.map) textures.add(o.material.map); }); geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); aim.material.dispose(); renderer.dispose(); },
  };
}
