import { createKnockout } from './knockout.js';
import { createPaintKit, createPaintVest } from '/engine/models/props/paintball-kit.js';
import { FINISHES } from './armory-data.js';
import { createArenaEnvironment } from '/engine/worlds/arenas.js';
import { paintArenaInfo } from '/engine/worlds/arena-layouts.js';
import { createMuelle } from './muelle.js';
import { createNoche } from './noche.js';
import { glowTexture } from '/engine/models/props/glow-paintball.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { bindRenderer, shadowSize } from '/engine/settings.js';
import { createSky } from '/engine/worlds/sky.js';
import { house, church } from '/engine/models/props/plaza-buildings.js';
import { crate, barrel, marketStall, streetLamp } from '/engine/models/props/plaza.js';
import { parkBench, basketballHoop } from '/engine/models/props/pueblo.js';
import { araguaney } from '/engine/models/vegetation/araguaney.js';
import { mangoTree } from '/engine/models/vegetation/mango-tree.js';
import { bake } from '/engine/models/core/static-batch.js';
import { splatTexture, pavingTexture } from '/engine/models/props/paintball.js';
import { rng } from '/engine/random.js';
import { WARM_DAY, PALETTE, BUNTING } from '/engine/worlds/look.js';
import { Puffs } from '/engine/fx.js';
import { SIZE, SPREAD, coverFor } from './rules.js';

// First person: the camera sits at the pana's eyes and the marker is held in view.
const EYE = 1.55, LOOK_UP = .55, LOOK_DOWN = -.7;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); const unbind = bindRenderer(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(WARM_DAY.background); scene.fog = new THREE.Fog(WARM_DAY.background, 90, 190);
  const sky = createSky(WARM_DAY.sky); scene.add(sky.mesh);
  const camera = new THREE.PerspectiveCamera(72, 1, .05, 220), target = new THREE.Vector3(), destination = new THREE.Vector3(); scene.add(camera);
  let cameraView = 'primera', elapsed = 0, initialized = false, yaw = 0, pitch = 0, previousPhase = 'lobby', wasDown = false, lift = 0, bob = 0, sway = 0, kick = 0, shake = 0, sprintFov = 0, lastAmmo = 12;
  const hemi = new THREE.HemisphereLight(WARM_DAY.hemi[0], WARM_DAY.hemi[1], 2.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight(WARM_DAY.sun.color, 3.2); sun.position.set(-15, 35, 16); sun.castShadow = true; scene.add(sun.target);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 80 }); sun.shadow.mapSize.setScalar(shadowSize(2048)); sun.shadow.normalBias = .03; scene.add(sun);
  // Maps may bring their own light (the night field); everything else plays in the warm day.
  const DAY = { background: WARM_DAY.background, fog: [90, 190], hemi: [WARM_DAY.hemi[0], WARM_DAY.hemi[1], 2.5], sun: [WARM_DAY.sun.color, 3.2], exposure: 1.05, sky: true, glow: false };
  // At night a headlamp follows the camera and paint glows: balls carry a halo, splats shine.
  const headlamp = new THREE.SpotLight('#fff1d6', 60, 30, .42, .6, 1.3); headlamp.visible = false; headlamp.position.set(0, .1, 0); headlamp.target.position.set(0, -.6, -10); camera.add(headlamp, headlamp.target);
  const halo = glowTexture(), halos = new Map();
  const haloMaterial = color => { if (!halos.has(color)) halos.set(color, new THREE.SpriteMaterial({ map: halo, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); return halos.get(color); };
  let glow = false;
  function light(look) {
    scene.background.set(look.background); scene.fog.color.set(look.background); [scene.fog.near, scene.fog.far] = look.fog;
    hemi.color.set(look.hemi[0]); hemi.groundColor.set(look.hemi[1]); hemi.intensity = look.hemi[2];
    sun.color.set(look.sun[0]); sun.intensity = look.sun[1]; renderer.toneMappingExposure = look.exposure;
    sky.mesh.visible = look.sky !== false; glow = !!look.glow; headlamp.visible = glow;
  }
  const defaultCourt = new THREE.Group(); scene.add(defaultCourt);
  let environment = null, mapId = ''; scene.userData.mapId = mapId;
  const materials = new Map(), avatars = new Map(), ballMeshes = new Map(), splats = new Map();
  const material = color => { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .85 })); return materials.get(color); };
  // Hits splat as glossy blobs, four shapes per colour.
  const hitTextures = [11, 12, 13, 14].map(seed=>splatTexture(seed)).concat(splatTexture(11,'stripe'),splatTexture(11,'dots')), hitMaterials = new Map();
  const splatMaterial = (color, id, pattern) => { const index=pattern==='stripe'?4:pattern==='dots'?5:id%4; const key = `${color}:${index}:${glow}`; if (!hitMaterials.has(key)) hitMaterials.set(key, new THREE.MeshStandardMaterial({ color, map: hitTextures[index], transparent: true, alphaTest: .4, roughness: .3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, ...(glow ? { emissive: color, emissiveIntensity: 1.1 } : {}) })); return hitMaterials.get(key); };
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
  // Old battles left their mark: splats on every crate stack and the paving.
  const splatTextures = [1, 2, 3, 4].map(seed=>splatTexture(seed)), paint = [PALETTE.rojo, PALETTE.azul, PALETTE.amarillo, PALETTE.turquesa, PALETTE.verde];
  const decal = (color, n) => new THREE.MeshStandardMaterial({ color, map: splatTextures[n % 4], transparent: true, alphaTest: .4, roughness: .3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  // The plaza's crate stacks follow the round's layout, so they rebuild with it.
  function plazaCover(cover) {
    const group = new THREE.Group(), crates = new THREE.Group(), bounds = [], r = rng(31);
    cover.forEach((o, i) => {
      bounds.push(new THREE.Box3(new THREE.Vector3(o.x - o.w / 2, 0, o.z - o.d / 2), new THREE.Vector3(o.x + o.w / 2, o.h, o.z + o.d / 2)));
      // Fit real crate geometry inside the authoritative cover box, including height.
      const columns = Math.ceil(o.w / 2), rows = Math.ceil(o.d / 2);
      for (let x = 0; x < columns; x++) for (let z = 0; z < rows; z++) {
        const model = crate(), box3 = new THREE.Box3().setFromObject(model), size = box3.getSize(new THREE.Vector3());
        const wrapper = new THREE.Group(); model.position.sub(box3.min); wrapper.add(model); wrapper.scale.set(o.w / columns / size.x, o.h / size.y, o.d / rows / size.z);
        wrapper.position.set(o.x - o.w / 2 + x * o.w / columns, 0, o.z - o.d / 2 + z * o.d / rows); crates.add(wrapper);
      }
      const band = new THREE.Mesh(new THREE.BoxGeometry(o.w + .01, .24, o.d + .01), material(i % 2 ? PALETTE.coral : PALETTE.turquesa)); band.position.set(o.x, o.h * .7, o.z); band.castShadow = band.receiveShadow = true; group.add(band);
      for (let k = 0; k < 3; k++) {
        const face = Math.floor(r() * 4), size = .9 + r() * .9, mark = new THREE.Mesh(new THREE.PlaneGeometry(size, size), decal(paint[(i + k) % paint.length], i + k));
        const u = (r() - .5) * .7, v = o.h * (.25 + r() * .5);
        if (face < 2) mark.position.set(o.x + u * o.w, v, o.z + (face ? 1 : -1) * (o.d / 2 + .02)); else mark.position.set(o.x + (face === 3 ? 1 : -1) * (o.w / 2 + .02), v, o.z + u * o.d);
        mark.rotation.set(0, face === 1 ? 0 : face === 0 ? Math.PI : face === 3 ? Math.PI / 2 : -Math.PI / 2, r() * 6); mark.userData.decal = true; group.add(mark);
      }
    });
    group.add(bake(crates)); const original = new Set(); crates.traverse(o => { if (o.geometry) original.add(o.geometry); }); original.forEach(g => g.dispose());
    // Decal materials are this layout's own; crate and band materials are shared.
    return { group, bounds, dispose() { group.removeFromParent(); group.traverse(o => { o.geometry?.dispose(); if (o.userData.decal) o.material.dispose(); }); } };
  }
  const r = rng(77);
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
  let crates = null, variant = 0;
  function setMap(id, layout = 0) {
    id = paintArenaInfo(id).id; if (mapId === id && variant === layout && (crates || environment)) return;
    environment?.dispose(); environment = null; crates?.dispose(); crates = null; mapId = id; variant = layout; scene.userData.mapId = id;
    defaultCourt.visible = id === 'plaza'; cameraBounds.length = 0;
    if (id === 'plaza') { crates = plazaCover(coverFor(id, layout)); defaultCourt.add(crates.group); cameraBounds.push(...defaultCameraBounds, ...crates.bounds); }
    else { environment = id === 'muelle' ? createMuelle(layout) : id === 'noche' ? createNoche(layout) : createArenaEnvironment(id, { mode: 'paint', size: SIZE, cover: coverFor(id, layout) }); scene.add(environment.group); cameraBounds.push(...environment.cameraBounds); }
    light(environment?.lighting || DAY);
    initialized = false;
  }
  // Paint bursts: impacts, knockouts. Stains are glossy blobs stuck to a pana's body.
  const puffs = new Puffs(scene), stainGeo = new THREE.SphereGeometry(.12, 10, 8), glossy = new Map();
  const gloss = color => { if (!glossy.has(color)) glossy.set(color, new THREE.MeshStandardMaterial({ color, roughness: .25 })); return glossy.get(color); };
  function syncStains(avatar, p) {
    const stains = p.stains || [];
    while (avatar.stains.length > stains.length) avatar.stains.shift().removeFromParent();
    while (avatar.stains.length < stains.length) {
      const blob = new THREE.Mesh(stainGeo), n = avatar.stainCount++, a = n * 2.4 + p.id * 1.3;
      blob.position.set(Math.sin(a) * .26, .7 + (n * .37) % .75, Math.cos(a) * .26); blob.rotation.y = a; blob.scale.set(1.2 + (n % 3) * .25, 1.4, .45);
      avatar.group.add(blob); avatar.body.attach(blob); avatar.stains.push(blob);
    }
    avatar.stains.forEach((blob, i) => { blob.material = gloss(stains[i]); });
  }
  const ballGeo = new THREE.SphereGeometry(.16, 8, 6), splatGeo = new THREE.PlaneGeometry(1.25, 1.25), ringGeo = new THREE.RingGeometry(.75, .86, 32);
  const aim = new THREE.Mesh(new THREE.RingGeometry(.25, .32, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })); aim.rotation.x = -Math.PI / 2; aim.position.y = .05; scene.add(aim);
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.1), mouse = new THREE.Vector2(), point = new THREE.Vector3();
  const frontRay = new THREE.Ray(), front = new THREE.Vector3(), hit = new THREE.Vector3();
  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false); }
  // The marker held in first person, rebuilt when the pana's paint colour changes.
  const modelOptions = p => ({...p.kit, weapon:p.weapon, color:FINISHES.find(f=>f.id===p.kit?.finish)?.color || p.color});
  let held = null, heldColor = '';
  function holdMarker(p) {
    const key=JSON.stringify(modelOptions(p)); if(heldColor===key) return;
    held?.removeFromParent(); held?.userData.dispose(); heldColor = key;
    held = createPaintKit(modelOptions(p)); held.scale.setScalar(.3); held.traverse(o => { o.castShadow = false; }); camera.add(held);
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
  const kitObjects=new Map();
  function draw(state, id, dt, aimPoint) {
    flags.forEach((root, i) => { const flag = state.flags?.[i]; root.visible = !!state.options?.flag && !!flag && state.phase === 'playing'; if (flag) root.position.set(flag.x, flag.carrier == null ? 0 : 2, flag.z); });
    bases.forEach((ring, i) => { const flag = state.flags?.[i]; ring.visible = flags[i].visible; if (flag) ring.position.set(flag.homeX, .035, flag.homeZ); });
    setMap(state.mapId, state.variant || 0); environment?.update(elapsed, dt);
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
        const marker = createPaintKit(modelOptions(p)); marker.position.set(.48, .95, .25); avatar.group.add(marker);
        avatar.ring = ring; avatar.marker = marker; avatar.paintColor = p.color; avatar.stains = []; avatar.stainCount = 0; avatar.flinch = 0; avatar.paint = p.paint || 0; avatar.out = p.respawn > 0 || p.eliminated ? 9 : 0;
        avatar.group.rotation.order = 'YXZ'; avatars.set(p.id, avatar);
      }
      // A pepazo makes the pana flinch; the last one bursts paint and topples them.
      if ((p.paint || 0) > avatar.paint) { avatar.flinch = 1; avatar.stagger(.8, Math.atan2(p.impact?.z || 0, p.impact?.x || 1) - Math.atan2(p.ax,p.az)); if (p.id === id) shake = Math.max(shake, .8); }
      avatar.paint = p.paint || 0;
      const down = p.respawn > 0 || p.eliminated;
      if (down && avatar.out === 0) {
        avatar.out = 1e-6; avatar.knockout = createKnockout(avatar, p.impact || {x: -p.ax, z: -p.az}, coverFor(state.mapId, state.variant || 0)); if (p.id === id) shake = 1.2;
        const color = p.stains?.at(-1) || p.color;
        puffs.spawn({ x: avatar.group.position.x, y: 1, z: avatar.group.position.z }, { color, count: 14, spread: 1, size: .7, rise: 2.4, life: .9 });
      }
      if (!down) { avatar.out = 0; avatar.knockout?.reset(); avatar.knockout = null; } else avatar.out += dt;
      syncStains(avatar, p);
      if (avatar.paintColor !== p.color || avatar.kitKey !== JSON.stringify(modelOptions(p))) {
        avatar.marker.removeFromParent(); avatar.marker.userData.dispose();
        avatar.marker = createPaintKit(modelOptions(p)); avatar.marker.position.set(.48, .95, .25); avatar.group.add(avatar.marker); avatar.paintColor = p.color; avatar.kitKey=JSON.stringify(modelOptions(p));
      }
      if(!avatar.vest) {avatar.vest=createPaintVest();avatar.group.add(avatar.vest);}
      avatar.vest.visible=p.kit?.armor==='padded';
      avatar.ring.material.color.set(p.color);
      const falling = down && avatar.out < 2.2;
      avatar.group.visible = p.connected && (!down || falling) && !(first && p.id === id);
      if (Math.hypot(avatar.group.position.x - p.x, avatar.group.position.z - p.z) > 6) avatar.group.position.set(p.x, 0, p.z);
      else avatar.group.position.lerp(new THREE.Vector3(p.x, 0, p.z), 1 - Math.exp(-dt * 20));
      avatar.flinch = Math.max(0, avatar.flinch - dt * 5);
      avatar.group.rotation.set(-avatar.flinch * .35, Math.atan2(p.ax, p.az), 0);
      avatar.group.position.y = 0; avatar.ring.scale.setScalar(p.id === id ? 1.25 : 1); avatar.ring.visible = !down && (p.shield <= 0 || Math.floor(performance.now() / 140) % 2 === 0);
      avatar.marker.visible = !down; avatar.vest.visible = !down && p.kit?.armor === 'padded';
      if (falling && avatar.knockout) { avatar.group.rotation.set(0, Math.atan2(p.ax,p.az), 0); avatar.knockout.update(dt); }
      else avatar.update(dt, { walk: p.walk, run: p.walk });
    }
    for (const [id, avatar] of avatars) if (!state.players.some(p => p.id === id)) { avatar.marker.userData.dispose(); avatar.vest?.userData.dispose(); avatar.ring.removeFromParent(); avatar.ring.material.dispose(); avatar.stains.forEach(blob => blob.removeFromParent()); avatar.dispose(); avatars.delete(id); }
    camera.aspect = aspect;
    if (first) {
      const body = avatars.get(id).group.position;
      lift += ((down ? 3.2 : 0) - lift) * (1 - Math.exp(-dt * 4));
      sway += ((me.walk && !down ? 1 : 0) - sway) * (1 - Math.exp(-dt * 8)); bob += dt * (me.sprint ? 13 : 9) * sway;
      if (state.phase === 'playing' && me.ammo < lastAmmo) kick = 1;
      kick = Math.max(0, kick - dt * 6); lastAmmo = me.ammo;
      // Sprinting widens the view a little.
      sprintFov += ((me.sprint ? 7 : 0) - sprintFov) * (1 - Math.exp(-dt * 6));
      camera.fov = (mobile ? 80 : 72) + sprintFov;
      camera.position.set(body.x, EYE + lift + Math.abs(Math.sin(bob)) * .05 * sway, body.z);
      shake = Math.max(0, shake - dt * 3);
      const jolt = shake * shake * .05;
      camera.rotation.set(pitch - lift * .22 + kick * .03 + (Math.random() - .5) * jolt, yaw + (Math.random() - .5) * jolt, Math.sin(bob) * .008 * sway + (Math.random() - .5) * jolt, 'YXZ');
      // Pull the marker in when the pana stands against cover, so it never pokes through.
      camera.updateMatrixWorld(); camera.getWorldDirection(front); front.y = 0; front.normalize(); frontRay.set(camera.position, front);
      let clearance = 2;
      for (const bounds of cameraBounds) if (frontRay.intersectBox(bounds, hit)) clearance = Math.min(clearance, hit.distanceTo(camera.position));
      holdMarker(me); held.visible = !down;
      held.position.set(.2 + Math.sin(bob) * .012 * sway, -.25 + Math.abs(Math.cos(bob)) * .01 * sway - kick * .01, -.34 + kick * .05 + Math.max(0, .6 - clearance));
      held.rotation.set(kick * .14, Math.PI, 0);
      held.userData.hands?.forEach((hand,i)=>{hand.position.z=(me.shots%2===i ? kick*.13 : 0);});
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
    for (const b of state.balls) {
      let mesh = ballMeshes.get(b.id);
      if (!mesh) {
        mesh = new THREE.Mesh(ballGeo, glow ? new THREE.MeshBasicMaterial({ color: b.color }) : material(b.color)); scene.add(mesh); ballMeshes.set(b.id, mesh);
        // Unlit balls with a halo read as tracers in the dark.
        if (glow) { const trail = new THREE.Sprite(haloMaterial(b.color)); trail.scale.setScalar(1.1); mesh.add(trail); }
      }
      mesh.position.set(b.x, 1.1, b.z); mesh.scale.setScalar(b.rocket ? 3 : 1);
    }
    for (const [id, mesh] of ballMeshes) if (!state.balls.some(b => b.id === id)) { mesh.removeFromParent(); if (mesh.material.isMeshBasicMaterial) mesh.material.dispose(); ballMeshes.delete(id); }
    for (const s of state.splats) { let mesh = splats.get(s.id); if (!mesh) { mesh = new THREE.Mesh(splatGeo, splatMaterial(s.color, s.id, s.pattern)); stick(mesh, s, coverFor(state.mapId, state.variant || 0)); scene.add(mesh); splats.set(s.id, mesh); if (s.life > 8.6) puffs.spawn({ x: s.x, y: mesh.position.y > .5 ? mesh.position.y : 1.1, z: s.z }, { color: s.color, count: 3, spread: .3, size: .28, rise: .8, life: .35 }); } mesh.scale.setScalar(Math.min(1, s.life)*(s.radius || 1)); }
    for (const [id, mesh] of splats) if (!state.splats.some(s => s.id === id)) { mesh.removeFromParent(); splats.delete(id); }
    const projectiles=[...(state.grenades||[]).map(g=>({...g,grenade:true})),...(state.puddles||[])];
    for(const g of projectiles) {
      let o=kitObjects.get(g.id); if(!o) {o=new THREE.Mesh(g.grenade ? new THREE.SphereGeometry(.22,10,8) : new THREE.CircleGeometry(g.radius,32),new THREE.MeshBasicMaterial({color:g.color,transparent:!g.grenade,opacity:g.grenade?1:.45,side:THREE.DoubleSide}));kitObjects.set(g.id,o);scene.add(o);}
      o.position.set(g.x,g.grenade ? .25+Math.abs(Math.sin((1-g.life/g.total)*Math.PI*(g.kind==='chispita'?2:1)))*1.5 : .07,g.z); if(!g.grenade)o.rotation.x=-Math.PI/2;
    }
    for(const [id,o] of kitObjects) if(!projectiles.some(g=>g.id===id)) {o.removeFromParent();o.geometry.dispose();o.material.dispose();kitObjects.delete(id);}
    aim.visible = !lobby && !first && !!aimPoint; if (aimPoint) aim.position.set(aimPoint.x, .07, aimPoint.z);
    puffs.update(dt); elapsed += dt; sky.update(elapsed); renderer.render(scene, camera);
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
    dispose() { unbind(); puffs.clear(); halos.forEach(m => m.dispose()); halo.dispose(); glossy.forEach(m => m.dispose()); stainGeo.dispose(); sky.dispose(); environment?.dispose(); disposeModel(defaultCourt); held?.userData.dispose(); kitObjects.forEach(o=>{o.geometry.dispose();o.material.dispose();}); hitMaterials.forEach(m => m.dispose()); hitTextures.forEach(t => t.dispose()); avatars.forEach(a => { a.marker.userData.dispose(); a.vest?.userData.dispose(); a.ring.removeFromParent(); a.ring.material.dispose(); a.stains.forEach(blob => blob.removeFromParent()); a.dispose(); }); const geometries = new Set([ringGeo, ballGeo, splatGeo]), textures = new Set(); scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material?.map) textures.add(o.material.map); }); geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); aim.material.dispose(); renderer.dispose(); },
  };
}
