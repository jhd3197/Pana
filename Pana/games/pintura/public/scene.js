import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { bindRenderer } from '/engine/settings.js';
import { COVER, SIZE } from './rules.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); bindRenderer(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#c4dfd0'); scene.fog = new THREE.Fog('#c4dfd0', 65, 110);
  const camera = new THREE.OrthographicCamera(-30, 30, 22, -22, .1, 150), target = new THREE.Vector3();
  scene.add(new THREE.HemisphereLight('#fff2d6', '#68865c', 2.6));
  const sun = new THREE.DirectionalLight('#fff3da', 3.2); sun.position.set(-15, 35, 16); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 80 }); sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = .05; scene.add(sun);
  const materials = new Map(), avatars = new Map(), ballMeshes = new Map(), splats = new Map();
  const material = color => { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .85 })); return materials.get(color); };
  const box = (w, h, d, color, x, y, z) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color)); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); return mesh; };
  box(100, .3, 100, '#84a56c', 0, -.3, 0); box(37, .2, 37, '#c1b47c', 0, -.08, 0);
  for (let i = -18; i < 18; i += 2) for (const z of [-18, 18]) box(1.1, .02, .13, '#f9ead1', i, .04, z);
  for (const side of [-1, 1]) {
    box(.2, 1.8, 37, '#567868', side * 19, .9, 0); box(38, 1.8, .2, '#567868', 0, .9, side * 19);
    for (let i = -18; i <= 18; i += 4) { box(.22, 3, .22, '#263f3a', side * 19, 1.5, i); box(.22, 3, .22, '#263f3a', i, 1.5, side * 19); }
    for (let i = 0; i < 7; i++) {
      const x = side * (24 + i % 2 * 5), z = -26 + i * 8;
      box(.7, 5, .7, '#735f43', x, 2.5, z);
      const tree = new THREE.Mesh(new THREE.IcosahedronGeometry(3.5, 1), material(i % 2 ? '#659561' : '#42795b')); tree.position.set(x, 6, z); tree.scale.y = 1.3; tree.castShadow = true; scene.add(tree);
    }
  }
  COVER.forEach((o, i) => {
    box(o.w, o.h, o.d, i % 2 ? '#df9162' : '#49a7aa', o.x, o.h / 2, o.z);
    box(o.w + .08, .15, o.d + .08, '#f3dab2', o.x, o.h, o.z);
    for (let j = 0; j < 3; j++) box(o.w + .02, .07, o.d + .02, '#000000', o.x, .5 + j * .55, o.z);
  });
  const ballGeo = new THREE.SphereGeometry(.16, 8, 6), splatGeo = new THREE.CircleGeometry(.48, 9), ringGeo = new THREE.RingGeometry(.75, .86, 32);
  const aim = new THREE.Mesh(new THREE.RingGeometry(.25, .32, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })); aim.rotation.x = -Math.PI / 2; aim.position.y = .05; scene.add(aim);
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.1), mouse = new THREE.Vector2(), point = new THREE.Vector3();
  function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false); }
  function draw(state, id, dt, aimPoint) {
    canvas.style.width = '100vw'; canvas.style.height = '100dvh';
    resize(); const aspect = canvas.clientWidth / canvas.clientHeight, lobby = state.phase === 'lobby';
    const half = lobby ? 27 : aspect < 1 ? 22 : 20;
    camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix();
    const me = state.players.find(p => p.id === id), tx = lobby ? -6 : (me?.x || 0) * (aspect < 1 ? .85 : .22), tz = lobby ? 0 : (me?.z || 0) * .25;
    target.lerp(new THREE.Vector3(tx, 0, tz), 1 - Math.exp(-dt * 5)); camera.position.copy(target).add(new THREE.Vector3(0, 34, 24)); camera.lookAt(target);
    for (const p of state.players) {
      let avatar = avatars.get(p.id);
      if (!avatar) {
        avatar = buildCharacter(p.avatar); avatar.group.position.set(p.x, 0, p.z); scene.add(avatar.group);
        const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: p.color, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .05; avatar.group.add(ring);
        const marker = new THREE.Mesh(new THREE.BoxGeometry(.18, .18, 1.1), material('#344847')); marker.position.set(.5, 1.1, .65); avatar.group.add(marker);
        const hopper = new THREE.Mesh(new THREE.SphereGeometry(.22, 8, 6), material(p.color)); hopper.position.set(.5, 1.4, .5); avatar.group.add(hopper);
        avatar.ring = ring; avatars.set(p.id, avatar);
      }
      avatar.group.visible = p.connected && p.respawn <= 0;
      if (Math.hypot(avatar.group.position.x - p.x, avatar.group.position.z - p.z) > 6) avatar.group.position.set(p.x, 0, p.z);
      else avatar.group.position.lerp(new THREE.Vector3(p.x, 0, p.z), 1 - Math.exp(-dt * 20));
      avatar.group.rotation.y = Math.atan2(p.ax, p.az); avatar.ring.scale.setScalar(p.id === id ? 1.25 : 1); avatar.ring.visible = p.shield <= 0 || Math.floor(performance.now() / 140) % 2 === 0;
      avatar.update(dt, { walk: p.walk, run: p.walk });
    }
    for (const [id, avatar] of avatars) if (!state.players.some(p => p.id === id)) { avatar.dispose(); avatars.delete(id); }
    for (const b of state.balls) { let mesh = ballMeshes.get(b.id); if (!mesh) { mesh = new THREE.Mesh(ballGeo, material(b.color)); scene.add(mesh); ballMeshes.set(b.id, mesh); } mesh.position.set(b.x, 1.1, b.z); }
    for (const [id, mesh] of ballMeshes) if (!state.balls.some(b => b.id === id)) { mesh.removeFromParent(); ballMeshes.delete(id); }
    for (const s of state.splats) { let mesh = splats.get(s.id); if (!mesh) { mesh = new THREE.Mesh(splatGeo, material(s.color)); mesh.rotation.set(-Math.PI / 2, 0, s.id * 1.7); scene.add(mesh); splats.set(s.id, mesh); } mesh.position.set(s.x, .06, s.z); mesh.scale.setScalar(Math.min(1, s.life)); }
    for (const [id, mesh] of splats) if (!state.splats.some(s => s.id === id)) { mesh.removeFromParent(); splats.delete(id); }
    aim.visible = !lobby && !!aimPoint; if (aimPoint) aim.position.set(aimPoint.x, .07, aimPoint.z);
    renderer.render(scene, camera);
  }
  return { renderer, scene, camera, avatars, draw,
    point(clientX, clientY) { const rect = canvas.getBoundingClientRect(); mouse.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1); ray.setFromCamera(mouse, camera); return ray.ray.intersectPlane(plane, point)?.clone(); },
    screen(x, z) { const p = new THREE.Vector3(x, 1.1, z).project(camera), r = canvas.getBoundingClientRect(); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; },
    dispose() { avatars.forEach(a => a.dispose()); scene.traverse(o => o.geometry?.dispose()); materials.forEach(m => m.dispose()); renderer.dispose(); },
  };
}
