import { createKnockout } from './knockout.js';
import { createPaintKit, bakePaintKit, wearPaintVest, createPaintRocket, createPaintGrenade, PAINT_KIT_BORE } from '/engine/models/props/paintball-kit.js';
import { FINISHES, MARKERS, kitStats, grenadeDef, isMelee } from './armory-data.js';
import { createViewmodel, recoilOf } from './viewmodel.js';
import { paintArenaInfo } from '/engine/worlds/arena-layouts.js';
import { createMuelle } from './muelle.js';
import { createNoche } from './noche.js';
import { createTerminal } from './terminal.js';
import { createPlazaProps } from './plaza-props.js';
import { createCtfProps } from './ctf-scene.js';
import { createDomProps } from './domination-scene.js';
import { glowTexture } from '/engine/models/props/glow-paintball.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { bindRenderer, shadowSize, rendererOptions } from '/engine/settings.js';
import { createSky } from '/engine/worlds/sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bake } from '/engine/models/core/static-batch.js';
import { splatTexture, pavingTexture } from '/engine/models/props/paintball.js';
import { rng } from '/engine/random.js';
import { WARM_DAY, PALETTE, BUNTING } from '/engine/worlds/look.js';
import { Puffs } from '/engine/fx.js';
import { createBlastFx } from '/engine/play/blast-fx.js';
import { createRecoil, shakeAt } from '/engine/play/recoil.js';
import { createScope } from '/engine/play/scope.js';
import { traceRay } from '/engine/play/projectile.js';
import { createPose, createSpectateCamera, followPose, overheadPose } from '/engine/play/spectate.js';
import { traceLob, groundAt } from '/engine/play/lob.js';
import { guideRibbon, guideBeads, guideRing } from '/engine/play/aim-guide.js';
import { SIZE, coverFor, boundsFor, grenadeStart, grenadeFlight, TICK, SHOT_HEIGHT, shotCover } from './rules.js';
// The shared courts' factory (engine/worlds/arenas.js) loads on first use: see setMap.
let arenasLoad = null; const loadArenas = () => arenasLoad ??= import('/engine/worlds/arenas.js').catch(error => { arenasLoad = null; throw error; });

// First person: the camera sits at the pana's eyes and the marker is held in view.
const EYE = 1.55, LOOK_UP = .55, LOOK_DOWN = -.7;
// Muzzle flash size per marker (a few have their own), else per class, and how big
// each launcher's explosion is drawn (a grenade's comes from its radius, so the
// shock ring ends near the blast's edge).
const FLASH = { rocket: 1.7, bazooka: 2.2, sniper: 1.5, scatter: 1.3, rapid: .75, blunderbuss: 1.7, minigun: 1.1, slingshot: .35, sprayer: .45 };
const CLASS_FLASH = { pistolas: .9, subfusiles: .8, fusiles: 1, ametralladoras: 1, escopetas: 1.3, francotiradores: 1.4, lanzadores: 1.6, especiales: .5 };
const flashSize = weapon => FLASH[weapon] ?? CLASS_FLASH[MARKERS.find(m => m.id === weapon)?.class] ?? .9;
const BOOM_SIZE = { bazooka: 1.25, rocket: 1, revolver: .7 };
// How big a launcher's round is drawn (the shared ball scaled up): El Tambor's grenades are smaller.
const ROUND_SIZE = { revolver: 4 };
// The overhand throw: the right arm winds up over the head and swings through in THROW_ARM seconds.
const THROW_ARM = .45;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer(rendererOptions({ canvas, antialias: true })); const unbind = bindRenderer(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(WARM_DAY.background); scene.fog = new THREE.Fog(WARM_DAY.background, 90, 190);
  const sky = createSky(WARM_DAY.sky); scene.add(sky.mesh);
  const camera = new THREE.PerspectiveCamera(72, 1, .05, 220), target = new THREE.Vector3(), destination = new THREE.Vector3(); scene.add(camera);
  let lastSmacks = 0, cameraView = 'primera', elapsed = 0, initialized = false, yaw = 0, pitch = 0, previousPhase = 'lobby', wasDown = false, lift = 0, bob = 0, sway = 0, sprintFov = 0, lastFired = 0, aiming = false;
  // The view's own kick, climb and shake (shots, hits, explosions) and the scope's zoom.
  const feel = createRecoil(), scope = createScope({ zoom: 1.2 }), seenBooms = new Set();
  // The fitted Mira's look speed while aiming (kitStats().sens), blended in with the aim.
  let opticSens = 1;
  const hemi = new THREE.HemisphereLight(WARM_DAY.hemi[0], WARM_DAY.hemi[1], 2.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight(WARM_DAY.sun.color, 3.2); sun.position.set(-15, 35, 16); sun.castShadow = true; scene.add(sun.target);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 80 }); sun.shadow.mapSize.setScalar(shadowSize(2048)); sun.shadow.normalBias = .03; scene.add(sun);
  // Maps may bring their own light (the night field) or a longer view (El Puerto); the
  // rest of the warm day fills in whatever a map leaves out.
  const DAY = { background: WARM_DAY.background, fog: [90, 190], far: 220, hemi: [WARM_DAY.hemi[0], WARM_DAY.hemi[1], 2.5], sun: [WARM_DAY.sun.color, 3.2], exposure: 1.05, sky: true, glow: false };
  // At night a headlamp follows the camera and paint glows: balls carry a halo, splats shine.
  const headlamp = new THREE.SpotLight('#fff1d6', 60, 30, .42, .6, 1.3); headlamp.visible = false; headlamp.position.set(0, .1, 0); headlamp.target.position.set(0, -.6, -10); camera.add(headlamp, headlamp.target);
  const halo = glowTexture(), halos = new Map();
  // One streak material per paint colour, shared by every ball in flight (a minigun puts twenty a second up).
  const streaks = new Map(), streakMaterial = color => { if (!streaks.has(color)) streaks.set(color, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .6, depthWrite: false })); return streaks.get(color); };
  const haloMaterial = color => { if (!halos.has(color)) halos.set(color, new THREE.SpriteMaterial({ map: halo, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); return halos.get(color); };
  let glow = false;
  function light(look) {
    scene.background.set(look.background); scene.fog.color.set(look.background); [scene.fog.near, scene.fog.far] = look.fog;
    hemi.color.set(look.hemi[0]); hemi.groundColor.set(look.hemi[1]); hemi.intensity = look.hemi[2];
    sun.color.set(look.sun[0]); sun.intensity = look.sun[1]; renderer.toneMappingExposure = look.exposure;
    sky.mesh.visible = look.sky !== false; glow = !!look.glow; headlamp.visible = glow; camera.far = look.far;
  }
  const defaultCourt = new THREE.Group(); scene.add(defaultCourt);
  let environment = null, mapId = ''; scene.userData.mapId = mapId;
  const materials = new Map(), avatars = new Map(), ballMeshes = new Map(), splats = new Map();
  const material = color => { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .85 })); return materials.get(color); };
  // Hits splat as glossy blobs, four shapes per colour.
  const hitTextures = [11, 12, 13, 14].map(seed=>splatTexture(seed)).concat(splatTexture(11,'stripe'),splatTexture(11,'dots')), hitMaterials = new Map();
  const splatMaterial = (color, id, pattern) => { const index=pattern==='stripe'?4:pattern==='dots'?5:id%4; const key = `${color}:${index}:${glow}`; if (!hitMaterials.has(key)) hitMaterials.set(key, new THREE.MeshStandardMaterial({ color, map: hitTextures[index], transparent: true, alphaTest: .4, roughness: .3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, ...(glow ? { emissive: color, emissiveIntensity: 1.1 } : {}) })); return hitMaterials.get(key); };
  // The court's fence, lines and clutter go into `kit`, baked into one tinted batch below.
  const kit = new THREE.Group();
  const box = (w, h, d, color, x, y, z, parent = kit) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color)); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh; };
  const fence = SIZE + 1, span = fence * 2 - 1;
  box(200, .3, 200, '#dcb985', 0, -.3, 0, defaultCourt);
  const paving = pavingTexture(), court = box(span, .2, span, '#ffffff', 0, -.08, 0, defaultCourt); paving.repeat.multiplyScalar(span / 37);
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
  const cameraBounds = [];
  // Old battles left their mark on the paving (plaza-props.js marks the cover): one
  // vertex-coloured mesh per splat shape, so 48 marks are four draws.
  const splatTextures = [1, 2, 3, 4].map(seed=>splatTexture(seed)), paint = [PALETTE.rojo, PALETTE.azul, PALETTE.amarillo, PALETTE.turquesa, PALETTE.verde];
  const r = rng(77), marks = [[], [], [], []];
  for (let k = 0; k < 48; k++) {
    const size = 1 + r() * 1.8, plane = new THREE.PlaneGeometry(size, size).rotateZ(r() * 6).rotateX(-Math.PI / 2), c = new THREE.Color(paint[k % paint.length]);
    plane.translate((r() - .5) * span, .025 + k * .0004, (r() - .5) * span);
    plane.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: plane.attributes.position.count }, () => [c.r, c.g, c.b]).flat(), 3)); marks[k % 4].push(plane);
  }
  marks.forEach((planes, n) => {
    defaultCourt.add(new THREE.Mesh(mergeGeometries(planes), new THREE.MeshStandardMaterial({ vertexColors: true, map: splatTextures[n], transparent: true, alphaTest: .4, roughness: .3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })));
    planes.forEach(g => g.dispose());
  });
  // Paint buckets and tyre stacks wait on the verge outside the fence, between its lamps and benches.
  for (const [k, [x, z]] of [[-1, -6.75], [1, 2.25], [-1, 15.75], [1, -15.75], [-6.75, 1], [6.75, -1]].map(([x, z]) => [Math.abs(x) === 1 ? x * (fence + 1.6) : x, Math.abs(z) === 1 ? z * (fence + 1.6) : z]).entries()) {
    if (k % 2) {
      for (let t = 0; t < 3; t++) { const tyre = new THREE.Mesh(new THREE.TorusGeometry(.42, .17, 8, 16), material('#2b2b2b')); tyre.rotation.x = Math.PI / 2; tyre.position.set(x, .17 + t * .32, z); tyre.castShadow = true; kit.add(tyre); }
    } else for (let b = 0; b < 3; b++) {
      const color = paint[(k + b) % 3], bucket = new THREE.Mesh(new THREE.CylinderGeometry(.3, .26, .55, 12), material(color)); bucket.position.set(x + (b - 1) * .7, .275, z + (b % 2) * .4); bucket.castShadow = true; kit.add(bucket);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(.31, .31, .06, 12), material('#f4f1ea')); rim.position.set(bucket.position.x, .56, bucket.position.z); kit.add(rim);
    }
  }
  defaultCourt.add(bake(kit, { tint: true })); kit.traverse(o => o.geometry?.dispose());
  // The town round the court (facades, church, street, lights, paving pattern) is
  // plaza-town.js, imported the first time La Plaza stands: see setMap.
  let town = null, townLoad = null;
  const loadTown = () => townLoad ??= import('./plaza-town.js').catch(error => { townLoad = null; throw error; });
  let crates = null, variant = 0;
  // The shared courts (Puerto, Hato, Ruinas) come from engine/worlds/arenas.js, about 28
  // modules El Puerto (the default) never needs: import() when one is picked. setMap
  // returns when the court stands, so prepareRound compiles it behind the loading card.
  let mapReady = Promise.resolve(), disposed = false;
  const stand = built => { environment = built; scene.add(built.group); cameraBounds.push(...built.cameraBounds); light({ ...DAY, ...built.lighting }); initialized = false; };
  function setMap(id, layout = 0) {
    id = paintArenaInfo(id).id; if (mapId === id && variant === layout) return mapReady;
    environment?.dispose(); environment = null; crates?.dispose(); crates = null; mapId = id; variant = layout; scene.userData.mapId = id;
    defaultCourt.visible = id === 'plaza'; cameraBounds.length = 0; mapReady = Promise.resolve();
    if (id === 'plaza') {
      crates = createPlazaProps(coverFor(id, layout)); defaultCourt.add(crates.group); cameraBounds.push(...crates.bounds);
      if (town) cameraBounds.push(...town.bounds);
      else mapReady = loadTown().then(({ createPlazaTown }) => { if (disposed || town) return; town = createPlazaTown({ paving }); defaultCourt.add(town.group); if (mapId === 'plaza') cameraBounds.push(...town.bounds); }).catch(() => {}); // retried on the next pick
    }
    else if (id === 'muelle' || id === 'noche' || id === 'terminal') stand((id === 'muelle' ? createMuelle : id === 'noche' ? createNoche : createTerminal)(layout));
    else mapReady = loadArenas().then(({ createArenaEnvironment }) => { if (!disposed && mapId === id && variant === layout && !environment) stand(createArenaEnvironment(id, { mode: 'paint', size: SIZE, cover: coverFor(id, layout) })); }).catch(() => {}); // a failed fetch retries on the next pick
    light({ ...DAY, ...environment?.lighting });
    initialized = false; return mapReady;
  }
  // Paint bursts: impacts, knockouts. Stains are glossy blobs stuck to a pana's body.
  const puffs = new Puffs(scene), blasts = createBlastFx(scene, puffs), stainGeo = new THREE.SphereGeometry(.12, 10, 8), glossy = new Map();
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
  const ballGeo = new THREE.SphereGeometry(.07, 8, 6), streakGeo = new THREE.CylinderGeometry(.035, .006, 1, 6, 1, true).rotateX(Math.PI / 2), splatGeo = new THREE.PlaneGeometry(1.25, 1.25), ringGeo = new THREE.RingGeometry(.75, .86, 32);
  const aim = new THREE.Mesh(new THREE.RingGeometry(.25, .32, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })); aim.rotation.x = -Math.PI / 2; aim.position.y = .05; scene.add(aim);
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.1), mouse = new THREE.Vector2(), point = new THREE.Vector3();
  const frontRay = new THREE.Ray(), front = new THREE.Vector3(), hit = new THREE.Vector3();
  // Out of the round (game.js's spectator): the killcam, the follow camera and the overhead view.
  // Everything here is reused, so watching allocates nothing per frame.
  const spectatePose = createPose(), spectateRig = createSpectateCamera(), spectateRay = new THREE.Ray(), spectateHit = new THREE.Vector3(), spectateHead = { x: 0, y: 0, z: 0 }, spectateAim = { x: 0, z: 0 };
  let spectator = null;
  // How far the camera may go from (ox, oy, oz) along a unit direction before the court's
  // camera bounds (the same boxes that pull the marker in). A box the head stands inside
  // (a tree's canopy, a stall's awning) does not count, or the camera would sit in the head.
  function clipCamera(ox, oy, oz, dx, dy, dz, max) {
    spectateRay.origin.set(ox, oy, oz); spectateRay.direction.set(dx, dy, dz); let room = max;
    for (const bounds of cameraBounds) if (!bounds.containsPoint(spectateRay.origin) && spectateRay.intersectBox(bounds, spectateHit)) room = Math.min(room, spectateHit.distanceTo(spectateRay.origin));
    return room;
  }
  const playerById = (state, id) => { for (const p of state.players) if (p.id === id) return p; return null; };
  function spectateCamera(state, id, dt, aspect) {
    if (!spectateRig.ready) { camera.getWorldDirection(front); spectateRig.start(camera.position.x, camera.position.y, camera.position.z, camera.position.x + front.x * 10, camera.position.y + front.y * 10, camera.position.z + front.z * 10); }
    const shot = spectator.shot, watched = avatars.get(shot === 'killcam' ? spectator.killer : spectator.target), p = playerById(state, spectator.target);
    if (shot === 'killcam') {
      // Where you fell, turning to whoever got you.
      spectatePose.pos.x = camera.position.x; spectatePose.pos.y = camera.position.y; spectatePose.pos.z = camera.position.z;
      if (watched && spectator.killer !== id) { const at = watched.group.position; spectatePose.look.x = at.x; spectatePose.look.y = at.y + 1.2; spectatePose.look.z = at.z; }
      else { spectatePose.look.x = spectateRig.look.x; spectatePose.look.y = spectateRig.look.y; spectatePose.look.z = spectateRig.look.z; }
    } else if (shot === 'follow' && watched && p) {
      const at = watched.group.position; spectateHead.x = at.x; spectateHead.y = at.y + EYE; spectateHead.z = at.z; spectateAim.x = p.ax; spectateAim.z = p.az;
      followPose(spectatePose, spectateHead, spectateAim, { clip: clipCamera });
    } else overheadPose(spectatePose, boundsFor(state.mapId), camera.fov, aspect, { max: 85 });
    spectateRig.step(dt, spectatePose);
    camera.position.set(spectateRig.pos.x, spectateRig.pos.y, spectateRig.pos.z);
    // Easing between targets can cut a corner: behind a pana the camera never passes cover.
    if (shot === 'follow' && watched && p) {
      const dx = camera.position.x - spectateHead.x, dy = camera.position.y - spectateHead.y, dz = camera.position.z - spectateHead.z, reach = Math.hypot(dx, dy, dz);
      if (reach > 1e-3 && reach < 8) { const room = Math.max(0, clipCamera(spectateHead.x, spectateHead.y, spectateHead.z, dx / reach, dy / reach, dz / reach, reach + .3) - .3); if (room < reach) camera.position.set(spectateHead.x + dx / reach * room, spectateHead.y + dy / reach * room, spectateHead.z + dz / reach * room); }
    }
    camera.lookAt(spectateRig.look.x, spectateRig.look.y, spectateRig.look.z);
    if (held) { held.visible = false; held.userData.flash.visible = false; }
  }
  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false); }
  // The marker held in first person, rebuilt when the pana's paint colour changes.
  const modelOptions = p => ({...p.kit, weapon:p.weapon, color:FINISHES.find(f=>f.id===p.kit?.finish)?.color || p.color});
  let held = null, heldColor = ''; const viewmodel = createViewmodel();
  function holdMarker(p) {
    const key=JSON.stringify(modelOptions(p)); if(heldColor===key) return;
    held?.removeFromParent(); held?.userData.dispose(); held?.userData.flash?.geometry.dispose(); held?.userData.flash?.material.dispose(); heldColor = key;
    // A melee weapon is held bigger (its model is about life size); the small chancla more so.
    held = createPaintKit(modelOptions(p)); held.scale.setScalar(isMelee(p.weapon) ? (p.weapon === 'sandal' ? .6 : .42) : .3); held.traverse(o => { o.castShadow = false; }); camera.add(held);
    // A flash of paint-gas at the muzzle for the first frames after each shot.
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    // On the barrel's axis (the model's bore) just past its muzzle, for every marker.
    flash.position.set(0, held.userData.bore ?? PAINT_KIT_BORE[p.weapon] ?? .2, held.userData.tip + .12); flash.visible = false; held.add(flash); held.userData.flash = flash; viewmodel.reset();
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
  // Capture the flag: stands, flags and the carrier's flag (ctf-scene.js).
  const ctfProps = createCtfProps(scene);
  // Domination: zone rings, walls, pillars and letter boards (domination-scene.js).
  const domProps = createDomProps(scene);
  const kitObjects=new Map(), grenadeMeshes = new Map();
  // A thrown chancla is the pana's own model (baked), spinning end over end along its
  // arc and gliding between 50 ms snapshots. One per thrower, reused throw after throw.
  const thrownMeshes = new Map();
  function drawThrown(state, dt) {
    for (const o of thrownMeshes.values()) o.userData.live = false;
    for (const f of state.thrown || []) {
      const owner = state.players.find(p => p.id === f.owner), options = { ...(owner ? modelOptions(owner) : { color: f.color }), weapon: f.kind }, key = JSON.stringify(options);
      let o = thrownMeshes.get(f.owner);
      if (o && o.userData.key !== key) { o.removeFromParent(); o.userData.dispose(); o = null; }
      if (!o) { o = bakePaintKit(options); o.name = `Thrown ${f.kind}`; o.scale.setScalar(1.6); o.rotation.order = 'YXZ'; o.userData.key = key; o.userData.seen = { id: 0, x: 0, y: 0, z: 0, t: 0 }; o.userData.spin = 0; scene.add(o); thrownMeshes.set(f.owner, o); }
      const seen = o.userData.seen; o.userData.live = true; o.visible = true;
      if (seen.id !== f.id || seen.x !== f.x || seen.y !== f.y || seen.z !== f.z) Object.assign(seen, { id: f.id, x: f.x, y: f.y, z: f.z, t: 0 }); else seen.t += dt;
      const ahead = Math.min(TICK, seen.t);
      o.position.set(f.x + f.vx * ahead, Math.max(.05, f.y + f.vy * ahead - f.gravity / 2 * ahead * ahead) - .3, f.z + f.vz * ahead);
      o.userData.spin += dt * 17; o.rotation.set(o.userData.spin, Math.atan2(f.vx, f.vz), 0);
    }
    for (const o of thrownMeshes.values()) if (!o.userData.live) o.visible = false;
  }
  // Grenades in flight: the paint grenade tumbles, glides between 50 ms snapshots
  // along its arc and blinks its lamp through the last half second of the fuse.
  function drawGrenades(state, dt) {
    const live = state.grenades || [], cover = coverFor(state.mapId, state.variant || 0);
    for (const g of live) {
      let o = grenadeMeshes.get(g.id);
      if (!o) {
        o = createPaintGrenade({ color: g.color }); o.rotation.order = 'YXZ'; o.traverse(m => { m.castShadow = true; });
        o.userData.seen = { x: g.x, y: g.y, z: g.z, t: 0 }; o.userData.spin = 0; scene.add(o); grenadeMeshes.set(g.id, o);
        const thrower = avatars.get(g.owner); if (thrower && (g.t || 0) < .2) thrower.throwing = THROW_ARM;
      }
      const seen = o.userData.seen;
      if (seen.x !== g.x || seen.y !== g.y || seen.z !== g.z) { seen.x = g.x; seen.y = g.y; seen.z = g.z; seen.t = 0; } else seen.t += dt;
      const ahead = g.resting ? 0 : Math.min(TICK, seen.t), speed = Math.hypot(g.vx, g.vz), x = g.x + g.vx * ahead, z = g.z + g.vz * ahead;
      o.position.set(x, Math.max(groundAt(x, z, cover) + .12, g.y + (g.rolling ? 0 : g.vy * ahead - 4.9 * ahead * ahead)), z);
      if (speed > .2) o.rotation.y = Math.atan2(g.vx, g.vz);
      o.userData.spin += dt * (g.resting ? 0 : g.rolling ? speed / .12 : 10 + speed * .5); o.rotation.x = o.userData.spin;
      o.userData.light.emissiveIntensity = g.life < .5 ? (Math.floor(elapsed * 14) % 2 ? 0 : 4) : g.life < 1.2 ? .5 : 0;
    }
    for (const [id, o] of grenadeMeshes) if (!live.some(g => g.id === id)) { o.removeFromParent(); o.userData.dispose(); grenadeMeshes.delete(id); }
  }
  // While G (or the touch button) charges: beads along the arc this throw would
  // fly, its path on the ground and a ring the size of the blast where it would
  // blow. Same start, flight and tick as the server, into reused points.
  const arcBeads = guideBeads('#fff6d8', { count: 48 }), arcPath = guideRibbon('#fff6d8', .1, { segments: 72, opacity: .5 }), arcRing = guideRing('#fff6d8');
  const arcPoints = [], arcResult = {}, arcOptions = { dt: TICK, time: 2, out: arcPoints, result: arcResult, land: true };
  scene.add(arcBeads, arcPath, arcRing); let grenadeAim = null;
  function aimGrenade(state, me) {
    arcBeads.visible = arcPath.visible = arcRing.visible = false;
    if (!grenadeAim || !me || !me.grenadeReady || me.respawn > 0 || me.eliminated || state.phase !== 'playing') return;
    const def = grenadeDef(me.kit?.grenade), cover = coverFor(state.mapId, state.variant || 0);
    arcOptions.time = def.fuse;
    const r = traceLob(grenadeStart(me, grenadeAim, def.id, cover), grenadeFlight(def.id, cover, state.mapId), arcOptions);
    arcBeads.userData.set(arcPoints, r.land >= 0 ? r.land + 1 : r.count);
    arcPath.userData.set(arcPoints, .05, r.count);
    arcRing.userData.set(r.x, groundAt(r.x, r.z, cover) + .06, r.z, def.radius);
  }
  function draw(state, id, dt, aimPoint) {
    ctfProps.draw(state, avatars, dt); domProps.draw(state, dt, camera);
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
        // Third-person markers are batched (bakePaintKit): a few draws each instead of dozens.
        const marker = bakePaintKit(modelOptions(p)); marker.position.set(.48, .95, .25); marker.rotation.x = isMelee(p.weapon) ? .5 : 0; avatar.group.add(marker);
        avatar.ring = ring; avatar.marker = marker; avatar.paintColor = p.color; avatar.stains = []; avatar.stainCount = 0; avatar.flinch = 0; avatar.paint = p.paint || 0; avatar.out = p.respawn > 0 || p.eliminated ? 9 : 0;
        avatar.group.rotation.order = 'YXZ'; avatars.set(p.id, avatar);
      }
      // A pepazo makes the pana flinch; the last one bursts paint and topples them.
      if ((p.paint || 0) > avatar.paint) { avatar.flinch = 1; avatar.stagger(.8, Math.atan2(p.impact?.z || 0, p.impact?.x || 1) - Math.atan2(p.ax,p.az)); if (p.id === id) feel.shake(.8); }
      avatar.paint = p.paint || 0;
      const down = p.respawn > 0 || p.eliminated;
      if (down && avatar.out === 0) {
        avatar.out = 1e-6; avatar.knockout = createKnockout(avatar, p.impact || {x: -p.ax, z: -p.az}, coverFor(state.mapId, state.variant || 0)); if (p.id === id) feel.shake(1.2);
        const color = p.stains?.at(-1) || p.color;
        puffs.spawn({ x: avatar.group.position.x, y: 1, z: avatar.group.position.z }, { color, count: 14, spread: 1, size: .7, rise: 2.4, life: .9 });
      }
      if (!down) { avatar.out = 0; avatar.knockout?.reset(); avatar.knockout = null; } else avatar.out += dt;
      syncStains(avatar, p);
      if (avatar.paintColor !== p.color || avatar.kitKey !== JSON.stringify(modelOptions(p))) {
        avatar.marker.removeFromParent(); avatar.marker.userData.dispose();
        avatar.marker = bakePaintKit(modelOptions(p)); avatar.marker.position.set(.48, .95, .25); avatar.marker.rotation.x = isMelee(p.weapon) ? .5 : 0; avatar.group.add(avatar.marker); avatar.paintColor = p.color; avatar.kitKey=JSON.stringify(modelOptions(p));
      }
      if(!avatar.vest) avatar.vest=wearPaintVest(avatar);
      avatar.vest.visible=p.kit?.armor==='padded';
      avatar.ring.material.color.set(p.color);
      const falling = down && avatar.out < 2.2;
      avatar.group.visible = p.connected && (!down || falling) && !(first && p.id === id);
      const air = p.jumpHeight || 0;
      if (Math.hypot(avatar.group.position.x - p.x, avatar.group.position.z - p.z) > 6) avatar.group.position.set(p.x, air, p.z);
      else avatar.group.position.lerp(new THREE.Vector3(p.x, air, p.z), 1 - Math.exp(-dt * 20));
      avatar.flinch = Math.max(0, avatar.flinch - dt * 5);
      avatar.group.rotation.set(-avatar.flinch * .35, Math.atan2(p.ax, p.az), 0);
      avatar.ring.position.y = .05 - avatar.group.position.y; avatar.ring.scale.setScalar(p.id === id ? 1.25 : 1); avatar.ring.visible = !down && (p.shield <= 0 || Math.floor(performance.now() / 140) % 2 === 0);
      avatar.marker.visible = !down; avatar.vest.visible = !down && p.kit?.armor === 'padded';
      if (falling && avatar.knockout) { avatar.group.rotation.set(0, Math.atan2(p.ax,p.az), 0); avatar.knockout.update(dt); }
      else avatar.update(dt, { walk: p.walk, run: p.walk });
      // A swing or a throw (a new count) swings the right arm like a grenade throw.
      const melee = p.melee || {}, swung = (melee.swings || 0) + (melee.throws || 0);
      if (avatar.swung !== undefined && swung > avatar.swung) avatar.throwing = THROW_ARM;
      avatar.swung = swung; avatar.marker.visible = !down && melee.phase !== 'away';
      if (avatar.throwing > 0) { const k = 1 - avatar.throwing / THROW_ARM; avatar.armR.rotation.x = -3 + 2.5 * (1 - (1 - k) ** 2); avatar.throwing = down ? 0 : avatar.throwing - dt; }
    }
    for (const [id, avatar] of avatars) if (!state.players.some(p => p.id === id)) { avatar.marker.userData.dispose(); avatar.vest?.userData.dispose(); avatar.ring.removeFromParent(); avatar.ring.material.dispose(); avatar.stains.forEach(blob => blob.removeFromParent()); avatar.dispose(); avatars.delete(id); }
    camera.aspect = aspect;
    if (first) {
      const body = avatars.get(id).group.position;
      lift += ((down ? 3.2 : 0) - lift) * (1 - Math.exp(-dt * 4));
      sway += ((me.walk && !down ? 1 : 0) - sway) * (1 - Math.exp(-dt * 8)); bob += dt * (me.sprint ? 13 : 9) * sway;
      // Every shot kicks, even a point-blank one whose ball never reaches a snapshot.
      if (state.phase === 'playing' && me.fired > lastFired) feel.fire(recoilOf(me.weapon));
      lastFired = me.fired; const jolt = feel.update(dt);
      // Sprinting widens the view a little; aiming narrows it (La Lejana's scope a lot).
      const stats = kitStats(me.kit, state.options);
      sprintFov += ((me.sprint ? 7 : 0) - sprintFov) * (1 - Math.exp(-dt * 6));
      scope.setZoom(stats.zoom); opticSens = stats.sens; scope.update(dt, aiming && !down && !me.sprint && !(me.reload > 0) && state.phase === 'playing');
      camera.fov = scope.fov((mobile ? 80 : 72) + sprintFov);
      camera.position.set(body.x, EYE + lift + body.y + Math.abs(Math.sin(bob)) * .05 * sway, body.z);
      camera.rotation.set(pitch - lift * .22 + jolt.pitch, yaw + jolt.yaw, Math.sin(bob) * .008 * sway + jolt.roll, 'YXZ');
      // Pull the marker in when the pana stands against cover, so it never pokes through.
      camera.updateMatrixWorld(); camera.getWorldDirection(front); front.y = 0; front.normalize(); frontRay.set(camera.position, front);
      let clearance = 2;
      for (const bounds of cameraBounds) if (frontRay.intersectBox(bounds, hit)) clearance = Math.min(clearance, hit.distanceTo(camera.position));
      // Through a scope the marker leaves the view; the overlay (game.js) takes its place.
      holdMarker(me); held.visible = !down && !scope.scoped;
      // A thrown chancla has left the hand: nothing is held until it is back.
      if (stats.melee && me.melee?.phase === 'away') held.visible = false;
      // A blow that lands jolts the view a little.
      if ((me.smacks || 0) > lastSmacks && state.phase === 'playing') feel.shake(.45);
      lastSmacks = me.smacks || 0;
      const shot = viewmodel.update(dt, { held, weapon: me.weapon, fired: me.fired || 0, reload: me.reload, reloadTime: stats.reload, sprint: me.sprint, bob, sway, down, air: me.jumpHeight, push: Math.max(0, .6 - clearance), aim: scope.amount,
        melee: stats.melee ? { swings: me.melee?.swings || 0, windup: stats.windup, recovery: stats.recovery } : null });
      const flash = held.userData.flash; flash.visible = held.visible && shot.flash > .05; flash.material.opacity = shot.flash;
      if (shot.shot) flash.rotation.z = Math.random() * Math.PI;
      flash.scale.setScalar(flashSize(me.weapon) * (1.15 - shot.flash * .3) * (.9 + (me.fired % 3) * .1));
      if (spectator?.active) spectateCamera(state, id, dt, aspect); else if (spectateRig.ready) spectateRig.reset();
      camera.clearViewOffset();
    } else {
      if (held) held.visible = false; scope.reset(); if (spectateRig.ready) spectateRig.reset();
      // The overview follows the pana a little; on a long court it follows further.
      const court = boundsFor(state.mapId), reach = court.x > court.z ? .8 : .4;
      destination.set(lobby ? 0 : THREE.MathUtils.clamp((me?.x || 0) * reach, 17 - court.x, court.x - 17), .8, lobby ? -1 : THREE.MathUtils.clamp((me?.z || 0) * .4, 18 - court.z, court.z - 18));
      if (!initialized) { target.copy(destination); initialized = true; } else target.lerp(destination, 1 - Math.exp(-dt * 5));
      camera.fov = mobile ? 64 : 54;
      camera.position.copy(target).add(new THREE.Vector3(lobby ? 18 : 0, lobby ? 34 : mobile ? 38 : 34, lobby ? 48 : mobile ? 40 : 46)); camera.lookAt(target);
      if (lobby && canvas.clientWidth > 760) camera.setViewOffset(canvas.clientWidth, canvas.clientHeight, -170, 0, canvas.clientWidth, canvas.clientHeight); else camera.clearViewOffset();
    }
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    sun.position.set(camera.position.x - 15, 35, camera.position.z + 16); sun.target.position.set(camera.position.x, 0, camera.position.z);
    const flying = new Set();
    for (const b of state.balls) {
      let mesh = ballMeshes.get(b.id); flying.add(b.id);
      if (!mesh && b.kind === 'bazooka') { mesh = createPaintRocket({ color: b.color }); mesh.scale.setScalar(1.8); scene.add(mesh); ballMeshes.set(b.id, mesh); }
      if (!mesh) {
        mesh = new THREE.Mesh(ballGeo, glow ? new THREE.MeshBasicMaterial({ color: b.color }) : material(b.color)); scene.add(mesh); ballMeshes.set(b.id, mesh);
        // Unlit balls with a halo read as tracers in the dark.
        // At 85 m/s a ball jumps 4 m per snapshot: a streak the length of that step joins the dots into one line.
        if (!b.rocket) { const streak = new THREE.Mesh(streakGeo, streakMaterial(b.color)); streak.scale.z = Math.hypot(b.vx, b.vz) * .05; streak.position.z = -streak.scale.z / 2; mesh.add(streak); mesh.userData.streak = streak; }
        if (glow) { const trail = new THREE.Sprite(haloMaterial(b.color)); trail.scale.setScalar(1.1); mesh.add(trail); }
      }
      // Rockets fly between 50 ms snapshots along their velocity, so a slow one glides instead of stepping.
      const seen = mesh.userData.seen;
      if (!seen || seen.x !== b.x || seen.z !== b.z) mesh.userData.seen = { x: b.x, z: b.z, t: 0 }; else seen.t += dt;
      const ahead = b.rocket ? Math.min(.06, mesh.userData.seen.t) : 0;
      mesh.position.set(b.x + b.vx * ahead, SHOT_HEIGHT, b.z + b.vz * ahead); mesh.rotation.y = Math.atan2(b.vx, b.vz);
      if (b.kind !== 'bazooka') mesh.scale.setScalar(b.rocket ? ROUND_SIZE[b.kind] ?? 6.9 : 1);
      if (b.rocket) blasts.trail(b.id, mesh.position.clone().addScaledVector(new THREE.Vector3(b.vx, 0, b.vz).normalize(), -.55), dt);
    }
    blasts.keep(flying);
    for (const [id, mesh] of ballMeshes) if (!flying.has(id)) { mesh.removeFromParent(); mesh.userData.dispose?.(); if (mesh.material?.isMeshBasicMaterial) mesh.material.dispose(); ballMeshes.delete(id); }
    // Explosions: a flash, a fireball, smoke, and a shake for whoever stands close.
    for (const boom of state.booms || []) {
      if (seenBooms.has(boom.id)) continue; seenBooms.add(boom.id);
      const rocket = !!BOOM_SIZE[boom.kind], size = rocket ? BOOM_SIZE[boom.kind] : boom.radius ? boom.radius / 4.6 : .8;
      blasts.boom({ x: boom.x, z: boom.z, size, color: boom.color, ...(rocket ? {} : { y: (boom.y || 0) + .5, ground: (boom.y || 0) + .08 }) });
      if (me && first) feel.shake(shakeAt(Math.hypot(me.x - boom.x, me.z - boom.z), size));
    }
    if (seenBooms.size > 64) for (const n of seenBooms) if (!(state.booms || []).some(b => b.id === n)) seenBooms.delete(n);
    // A blast's splat lies flat where it blew (a crate top too) and covers its radius.
    for (const s of state.splats) { let mesh = splats.get(s.id); if (!mesh) { mesh = new THREE.Mesh(splatGeo, splatMaterial(s.color, s.id, s.pattern)); if (s.blast) { mesh.rotation.set(-Math.PI / 2, 0, s.id * 1.7); mesh.position.set(s.x, (s.y || 0) + .05 + (s.id % 7) * .002, s.z); } else stick(mesh, s, shotCover(coverFor(state.mapId, state.variant || 0))); scene.add(mesh); splats.set(s.id, mesh); if (s.life > 8.6) puffs.spawn({ x: s.x, y: mesh.position.y > .5 ? mesh.position.y : 1.1, z: s.z }, { color: s.color, count: 3, spread: .3, size: .28, rise: .8, life: .35 }); } mesh.scale.setScalar(Math.min(1, s.life) * (s.blast ? s.radius * 2 / 1.25 : s.radius || 1)); }
    for (const [id, mesh] of splats) if (!state.splats.some(s => s.id === id)) { mesh.removeFromParent(); splats.delete(id); }
    // Sticky puddles: a flat translucent pool.
    const puddles=state.puddles||[];
    for(const g of puddles) {
      let o=kitObjects.get(g.id); if(!o) {o=new THREE.Mesh(new THREE.CircleGeometry(g.radius,32),new THREE.MeshBasicMaterial({color:g.color,transparent:true,opacity:.45,side:THREE.DoubleSide}));o.rotation.x=-Math.PI/2;kitObjects.set(g.id,o);scene.add(o);}
      o.position.set(g.x,.07,g.z);
    }
    for(const [id,o] of kitObjects) if(!puddles.some(g=>g.id===id)) {o.removeFromParent();o.geometry.dispose();o.material.dispose();kitObjects.delete(id);}
    drawGrenades(state, dt); drawThrown(state, dt);
    aimGrenade(state, me);
    aim.visible = !lobby && !first && !!aimPoint; if (aimPoint) aim.position.set(aimPoint.x, .07, aimPoint.z);
    blasts.update(dt); puffs.update(dt); elapsed += dt; sky.update(elapsed); renderer.render(scene, camera);
  }
  return { renderer, scene, camera, avatars, draw, setMap,
    // The current court's own meshes (no panas, paint or effects): what the collision debug view measures.
    mapGroup() { return environment?.group || defaultCourt; },
    setView(value) { cameraView = value; initialized = false; },
    // The spectator (engine/play/spectate.js createSpectator) whose shot the first-person camera shows while out, or null.
    setSpectator(value) { spectator = value; },
    get spectating() { return !!spectator?.active && cameraView === 'primera' && spectateRig.ready; },
    get view() { return cameraView; },
    // The first-person weapon (hidden while a thrown chancla is away).
    get held() { return held; },
    get yaw() { return yaw; },
    // The look's pitch: a grenade throw lobs higher when you look up.
    get pitch() { return pitch; },
    // The grenade being charged ({ ax, az, pitch, charge }, as game.js will send it), or null: draws the aim arc.
    aimGrenade(aim) { grenadeAim = aim; },
    // Right mouse, F or the Mira button: held aim, shared by the scope and the server's steadier shot.
    setAim(on) { aiming = !!on; },
    get scope() { return scope; },
    // Look speed now: the zoom's slowdown times the Mira's own `sens`, both eased in with the aim.
    sensitivity() { return scope.sensitivity() * (1 + (opticSens - 1) * scope.amount); },
    // A scoped rifle's tracer (La Lejana, El Zamuro): from the muzzle (your marker in first person) to the first cover or pana it meets.
    tracer(p, state, mine) {
      const reach = kitStats(p.kit, state.options), range = reach.speed * reach.life, cover = coverFor(state.mapId, state.variant || 0);
      const targets = state.players.filter(q => q.id !== p.id && q.connected && !q.respawn && !q.eliminated);
      // The round itself when it is in the snapshot (a hip shot wanders off the aim), else the aim.
      const ball = state.balls.filter(b => b.owner === p.id && b.kind === p.weapon).at(-1), speed = ball ? Math.hypot(ball.vx, ball.vz) : 0;
      const dx = speed ? ball.vx / speed : p.ax, dz = speed ? ball.vz / speed : p.az;
      const length = traceRay(p.x, p.z, dx, dz, range, { boxes: cover, targets, padding: .12, y: SHOT_HEIGHT });
      const from = mine && held?.visible ? held.userData.flash.getWorldPosition(new THREE.Vector3()) : mine ? camera.localToWorld(new THREE.Vector3(.1, -.13, -.35)) : new THREE.Vector3(p.x + p.ax * .7, 1.25, p.z + p.az * .7);
      blasts.tracer(from, new THREE.Vector3(p.x + dx * length, 1.15, p.z + dz * length), '#fff6d8', mine ? .012 : .025);
    },
    // A puff of paint at a marker's muzzle.
  muzzle(p) { puffs.spawn({ x: p.x + p.ax * .6, y: 1.15, z: p.z + p.az * .6 }, { color: p.color, count: 4, spread: .22, size: .22, rise: .3, life: .16 }); },
  look(yawDelta, pitchDelta = 0) { yaw += yawDelta; pitch = THREE.MathUtils.clamp(pitch + pitchDelta, LOOK_DOWN, LOOK_UP); },
    // Where the crosshair points on the court (shots fly level).
    forward() { return { x: -Math.sin(yaw), z: -Math.cos(yaw) }; },
    movement(x, z) { return cameraView === 'primera' ? { x: x * Math.cos(yaw) + z * Math.sin(yaw), z: -x * Math.sin(yaw) + z * Math.cos(yaw) } : { x, z }; },
    point(clientX, clientY) { const rect = canvas.getBoundingClientRect(); mouse.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(mouse, camera); return ray.ray.intersectPlane(plane, point)?.clone(); },
    screen(x, z) { const p = new THREE.Vector3(x, 1.1, z).project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; },
    dispose() { disposed = true; unbind(); ctfProps.dispose(); domProps.dispose(); blasts.dispose(); puffs.clear(); halos.forEach(m => m.dispose()); streaks.forEach(m => m.dispose()); halo.dispose(); glossy.forEach(m => m.dispose()); stainGeo.dispose(); sky.dispose(); environment?.dispose(); town?.dispose(); disposeModel(defaultCourt); held?.userData.dispose(); kitObjects.forEach(o=>{o.geometry.dispose();o.material.dispose();}); grenadeMeshes.forEach(o => o.userData.dispose()); thrownMeshes.forEach(o => o.userData.dispose()); [arcBeads, arcPath, arcRing].forEach(o => o.userData.dispose()); hitMaterials.forEach(m => m.dispose()); hitTextures.forEach(t => t.dispose()); avatars.forEach(a => { a.marker.userData.dispose(); a.vest?.userData.dispose(); a.ring.removeFromParent(); a.ring.material.dispose(); a.stains.forEach(blob => blob.removeFromParent()); a.dispose(); }); const geometries = new Set([ringGeo, ballGeo, streakGeo, splatGeo]), textures = new Set(); scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material?.map) textures.add(o.material.map); }); geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); aim.material.dispose(); renderer.dispose(); },
  };
}
