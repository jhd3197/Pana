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
import { createPaintMarker } from '/engine/models/props/paintball.js';
import { COVER } from './rules.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); const unbind = bindRenderer(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#c7e1e8'); scene.fog = new THREE.Fog('#c7e1e8', 75, 150);
  const sky = createSky(); scene.add(sky.mesh);
  const camera = new THREE.PerspectiveCamera(54, 1, .1, 180), target = new THREE.Vector3(), destination = new THREE.Vector3();
  let cameraView = 'cerca', elapsed = 0, initialized = false, yaw = 0, previousPhase = 'lobby';
  scene.add(new THREE.HemisphereLight('#fff2d6', '#68865c', 2.6));
  const sun = new THREE.DirectionalLight('#fff3da', 3.2); sun.position.set(-15, 35, 16); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 80 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.normalBias = .03; scene.add(sun);
  const materials = new Map(), avatars = new Map(), ballMeshes = new Map(), splats = new Map();
  const material = color => { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .85 })); return materials.get(color); };
  const box = (w, h, d, color, x, y, z) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color)); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); return mesh; };
  box(170, .3, 170, '#b4b387', 0, -.3, 0); box(37, .2, 37, '#cfb584', 0, -.08, 0);
  for (let i = -18; i < 18; i += 2) for (const z of [-18, 18]) box(1.1, .02, .13, '#f9ead1', i, .04, z);
  for (const side of [-1, 1]) {
    box(.2, .45, 37, '#ad7752', side * 19, .225, 0); box(38, .45, .2, '#ad7752', 0, .225, side * 19);
    for (let i = -18; i <= 18; i += 4) { box(.22, 3, .22, '#263f3a', side * 19, 1.5, i); box(.22, 3, .22, '#263f3a', i, 1.5, side * 19); }
    // Thin net strands leave sight lines to the pueblo and opponents open.
    for (let y = .7; y <= 2.8; y += .45) { box(.025, .02, 37, '#556b57', side * 19, y, 0); box(38, .02, .025, '#556b57', 0, y, side * 19); }
  }
  const scenery = new THREE.Group(), cameraBounds = [];
  function place(model, x, z, angle = 0) { model.position.set(x, 0, z); model.rotation.y = angle; scenery.add(model); cameraBounds.push(new THREE.Box3().setFromObject(model)); }
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
    box(o.w + .01, .24, o.d + .01, i % 2 ? '#dc7950' : '#398f99', o.x, o.h * .7, o.z);
  });
  const surroundings = bake(scenery); scene.add(surroundings);
  const originalGeometry = new Set(); scenery.traverse(o => { if (o.geometry) originalGeometry.add(o.geometry); }); originalGeometry.forEach(g => g.dispose());
  const ballGeo = new THREE.SphereGeometry(.16, 8, 6), splatGeo = new THREE.CircleGeometry(.48, 9), ringGeo = new THREE.RingGeometry(.75, .86, 32);
  const aim = new THREE.Mesh(new THREE.RingGeometry(.25, .32, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })); aim.rotation.x = -Math.PI / 2; aim.position.y = .05; scene.add(aim);
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.1), mouse = new THREE.Vector2(), point = new THREE.Vector3();
  const cameraRay = new THREE.Ray(), cameraDirection = new THREE.Vector3(), obstruction = new THREE.Vector3();
  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false); }
  function draw(state, id, dt, aimPoint) {
    canvas.style.width = '100vw'; canvas.style.height = '100dvh';
    resize(); const aspect = canvas.clientWidth / canvas.clientHeight, lobby = state.phase === 'lobby';
    const me = state.players.find(p => p.id === id), close = cameraView === 'cerca' && !lobby, mobile = aspect < 1;
    if (me && state.phase === 'playing' && previousPhase !== 'playing') { yaw = Math.atan2(me.x, me.z); initialized = false; }
    previousPhase = state.phase;
    destination.set(lobby ? 0 : close ? me?.x || 0 : THREE.MathUtils.clamp((me?.x || 0) * .4, -7, 7), close ? 1 : .8, lobby ? -1 : close ? me?.z || 0 : THREE.MathUtils.clamp((me?.z || 0) * .4, -6, 6));
    if (!initialized) { target.copy(destination); initialized = true; } else target.lerp(destination, 1 - Math.exp(-dt * 5));
    camera.aspect = aspect; camera.fov = mobile ? 64 : close ? 58 : 54;
    camera.position.copy(target).add(new THREE.Vector3(lobby ? 12 : close ? Math.sin(yaw) * 14 : 0, lobby ? 24 : close ? 9 : mobile ? 24 : 22, lobby ? 33 : close ? Math.cos(yaw) * 14 : mobile ? 27 : 31)); camera.lookAt(target);
    if (close) {
      cameraDirection.subVectors(camera.position, target).normalize(); cameraRay.set(target, cameraDirection);
      let distance = camera.position.distanceTo(target);
      for (const bounds of cameraBounds) if (cameraRay.intersectBox(bounds, obstruction)) distance = Math.min(distance, Math.max(2.5, obstruction.distanceTo(target) - .5));
      camera.position.copy(target).addScaledVector(cameraDirection, distance); camera.lookAt(target);
    }
    if (lobby && canvas.clientWidth > 760) camera.setViewOffset(canvas.clientWidth, canvas.clientHeight, -170, 0, canvas.clientWidth, canvas.clientHeight); else camera.clearViewOffset();
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    for (const p of state.players) {
      let avatar = avatars.get(p.id);
      if (!avatar) {
        avatar = buildCharacter(p.avatar); avatar.group.position.set(p.x, 0, p.z); scene.add(avatar.group);
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: p.color, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .05; avatar.group.add(ring);
        const marker = createPaintMarker({ color: p.color }); marker.position.set(.48, .95, .25); avatar.group.add(marker);
        avatar.ring = ring; avatar.marker = marker; avatars.set(p.id, avatar);
      }
      avatar.group.visible = p.connected && p.respawn <= 0;
      if (Math.hypot(avatar.group.position.x - p.x, avatar.group.position.z - p.z) > 6) avatar.group.position.set(p.x, 0, p.z);
      else avatar.group.position.lerp(new THREE.Vector3(p.x, 0, p.z), 1 - Math.exp(-dt * 20));
      avatar.group.rotation.y = Math.atan2(p.ax, p.az); avatar.ring.scale.setScalar(p.id === id ? 1.25 : 1); avatar.ring.visible = p.shield <= 0 || Math.floor(performance.now() / 140) % 2 === 0;
      avatar.update(dt, { walk: p.walk, run: p.walk });
    }
    for (const [id, avatar] of avatars) if (!state.players.some(p => p.id === id)) { avatar.marker.userData.dispose(); avatar.ring.removeFromParent(); avatar.ring.material.dispose(); avatar.dispose(); avatars.delete(id); }
    for (const b of state.balls) { let mesh = ballMeshes.get(b.id); if (!mesh) { mesh = new THREE.Mesh(ballGeo, material(b.color)); scene.add(mesh); ballMeshes.set(b.id, mesh); } mesh.position.set(b.x, 1.1, b.z); }
    for (const [id, mesh] of ballMeshes) if (!state.balls.some(b => b.id === id)) { mesh.removeFromParent(); ballMeshes.delete(id); }
    for (const s of state.splats) { let mesh = splats.get(s.id); if (!mesh) { mesh = new THREE.Mesh(splatGeo, material(s.color)); mesh.rotation.set(-Math.PI / 2, 0, s.id * 1.7); scene.add(mesh); splats.set(s.id, mesh); } mesh.position.set(s.x, .06, s.z); mesh.scale.setScalar(Math.min(1, s.life)); }
    for (const [id, mesh] of splats) if (!state.splats.some(s => s.id === id)) { mesh.removeFromParent(); splats.delete(id); }
    aim.visible = !lobby && !!aimPoint; if (aimPoint) aim.position.set(aimPoint.x, .07, aimPoint.z);
    elapsed += dt; sky.update(elapsed); renderer.render(scene, camera);
  }
  return { renderer, scene, camera, avatars, draw, setView(value) { cameraView = value; }, orbit(delta) { if (cameraView === 'cerca') yaw += delta; },
    movement(x, z) { return cameraView === 'cerca' ? { x: x * Math.cos(yaw) + z * Math.sin(yaw), z: -x * Math.sin(yaw) + z * Math.cos(yaw) } : { x, z }; },
    point(clientX, clientY) { const rect = canvas.getBoundingClientRect(); mouse.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(mouse, camera); return ray.ray.intersectPlane(plane, point)?.clone(); },
    screen(x, z) { const p = new THREE.Vector3(x, 1.1, z).project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; },
    dispose() { unbind(); sky.dispose(); avatars.forEach(a => { a.marker.userData.dispose(); a.ring.removeFromParent(); a.ring.material.dispose(); a.dispose(); }); const geometries = new Set([ringGeo, ballGeo, splatGeo]), textures = new Set(); scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material?.map) textures.add(o.material.map); }); geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); aim.material.dispose(); renderer.dispose(); },
  };
}
