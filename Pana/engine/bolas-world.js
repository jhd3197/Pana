import * as THREE from 'three';
import { criollasCourt, criollaBall } from './models/props/criollas.js';
import { buildCharacter } from './models/characters/pana/avatar-model.js';
import { palm } from './models/vegetation/palm.js';
import { createSky } from './sky.js';
import { COURT, TEAM_COLORS, landing, distance } from './bolas-criollas.js';

export function createBolasWorld({ aspect = 16 / 9, individual = false } = {}) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#d8e4ca');
  scene.fog = new THREE.Fog('#d8e4ca', 65, 180);
  const sky = createSky({ skyTop: '#78bbdf', horizon: '#f9e4b8', skySeed: 32, cloudCover: .33 }); scene.add(sky.mesh);
  scene.add(new THREE.HemisphereLight('#fff5d9', '#71814f', 2));
  const sun = new THREE.DirectionalLight('#fff1d1', 2.6); sun.position.set(-18, 28, 10); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 80 });
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -.0005; scene.add(sun);
  const court = criollasCourt({ width: COURT.halfWidth * 2, length: COURT.halfLength * 2 }); scene.add(court);
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: '#78995a', roughness: 1 }));
  lawn.rotation.x = -Math.PI / 2; lawn.position.y = -.3; lawn.receiveShadow = true; scene.add(lawn);
  for (let i = 0; i < 7; i++) {
    const p = palm({ h: 5 + i % 3, seed: i + 101 });
    p.position.set((i % 2 ? -1 : 1) * (14 + i * 2), -.3, -14 - i * 4); scene.add(p);
  }
  // Low, rounded hills leave the court legible against a warm horizon.
  for (let i = 0; i < 7; i++) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshStandardMaterial({ color: i % 2 ? '#719976' : '#87aa82', roughness: 1 }));
    hill.position.set((i - 3) * 22, -1, -65 - i % 2 * 12); hill.scale.set(23, 11 + i % 3 * 4, 19); scene.add(hill);
  }
  const signCanvas = document.createElement('canvas'); signCanvas.width = 1024; signCanvas.height = 256;
  const signTex = new THREE.CanvasTexture(signCanvas); signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshStandardMaterial({ map: signTex, roughness: .9, side: THREE.DoubleSide }));
  sign.position.set(0, 2, -13.4); scene.add(sign);
  let signText = '';
  function caption(text = 'BOLAS CRIOLLAS', sub = 'ARRIMA CON TUS PANAS') {
    const key = text + sub; if (key === signText) return; signText = key;
    const c = signCanvas.getContext('2d'); c.fillStyle = '#214b40'; c.fillRect(0, 0, 1024, 256);
    c.strokeStyle = '#d8ba78'; c.lineWidth = 5; c.strokeRect(12, 12, 1000, 232);
    c.textAlign = 'center'; c.fillStyle = '#fff0cb'; c.font = '64px "Luckiest Guy", sans-serif'; c.fillText(text, 512, 116, 950);
    c.fillStyle = '#eacb7f'; c.font = 'bold 31px Nunito, sans-serif'; c.fillText(sub, 512, 191, 950); signTex.needsUpdate = true;
  }
  caption();
  const camera = new THREE.PerspectiveCamera(42, aspect, .1, 500);
  function fit(nextAspect = camera.aspect, overhead = false) {
    camera.aspect = nextAspect; camera.updateProjectionMatrix();
    const wide = nextAspect > 1.65;
    const direction = new THREE.Vector3(overhead ? .03 : wide ? 1 : .34, overhead ? 1.5 : .95, wide && !overhead ? .25 : 1).normalize();
    let dist = 22;
    for (let n = 0; n < 50; n++) {
      camera.position.copy(direction).multiplyScalar(dist); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
      const fits = [-7.5, 7.5].every(x => [-13.8, 13.8].every(z => [0, 3.5].every(y => {
        const p = new THREE.Vector3(x, y, z).project(camera); return Math.abs(p.x) < .94 && Math.abs(p.y) < .93;
      })));
      if (fits) break; dist *= 1.055;
    }
  }
  fit();
  const actors = [], ballMeshes = new Map(), guides = [];
  const marker = new THREE.Mesh(new THREE.RingGeometry(.42, .49, 48), new THREE.MeshBasicMaterial({ color: '#ffdc61', side: THREE.DoubleSide, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2; scene.add(marker);
  const measureLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: '#fff6d6', dashSize: .16, gapSize: .1 })); scene.add(measureLine);
  function makeGuide(color) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color, dashSize: .22, gapSize: .16, transparent: true, opacity: .75 }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(.33, .38, 40), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: .9 }));
    ring.rotation.x = -Math.PI / 2; scene.add(line, ring); return { line, ring };
  }
  let clock = 0, lastPitch = null, lastBallCount = 0;
  function draw(pitch, players, { dt = 0, turn = -1, shots = [], winners = [], caption: title, subtitle } = {}) {
    clock += dt; sky.update(clock);
    if (title) caption(title, subtitle);
    while (actors.length < players.length) { actors.push({ key: null, pana: null, throwTime: 0 }); guides.push(makeGuide(players[actors.length - 1].color || TEAM_COLORS[(actors.length - 1) % 2])); }
    players.forEach((p, i) => {
      const a = actors[i], key = JSON.stringify(p.avatar);
      if (key !== a.key) {
        a.held?.userData.dispose(); a.pana?.dispose(); a.pana = buildCharacter(p.avatar); a.key = key; scene.add(a.pana.group);
        a.held = criollaBall({ color: individual ? p.color : TEAM_COLORS[i % 2], stripe: i >= 2 });
        a.held.position.set(-.6, .95, .32); a.pana.group.add(a.held);
      }
      const onCalce = turn === i;
      const x = individual ? (i - 1.5) * 2.1 : onCalce ? -.65 : (i % 2 ? 1 : -1) * 6.8;
      const z = individual ? 11.3 : onCalce ? 11.25 : 7.2 - Math.floor(i / 2) * 3;
      a.pana.group.position.set(x, winners.includes(i) ? Math.abs(Math.sin(clock * 6)) * .28 : 0, z);
      a.pana.group.rotation.y = individual || onCalce ? Math.PI : i % 2 ? -1.2 : 1.2;
      a.pana.update(dt, { walk: 0, open: winners.includes(i) }); a.throwTime = Math.max(0, a.throwTime - dt);
      if (a.throwTime) a.pana.armR.rotation.x = -Math.sin(a.throwTime / .65 * Math.PI) * 1.8;
      if (winners.includes(i)) a.pana.armL.rotation.x = a.pana.armR.rotation.x = -2.4;
      const shot = shots[i], guide = guides[i]; guide.line.visible = guide.ring.visible = !!shot;
      a.held.visible = !!shot || onCalce;
      if (shot) {
        const fromX = shot.originX || 0, to = landing(shot, fromX);
        const points = guide.line.geometry.attributes.position;
        points.setXYZ(0, fromX, .05, COURT.launchZ); points.setXYZ(1, to.x, .05, to.z); points.needsUpdate = true;
        guide.line.geometry.computeBoundingSphere(); guide.line.computeLineDistances(); guide.ring.position.set(to.x, .04, to.z);
      }
    });
    // IDs restart each hand; clear old rolling orientations at that boundary.
    if (pitch.nextId < lastBallCount || (pitch.balls.length === 1 && lastPitch !== pitch && lastBallCount > 1)) {
      for (const mesh of ballMeshes.values()) { mesh.removeFromParent(); mesh.userData.dispose(); } ballMeshes.clear();
    }
    for (const b of pitch.balls) {
      let mesh = ballMeshes.get(b.id);
      if (!mesh) {
        mesh = criollaBall({ color: b.owner < 0 ? '#ffe5a0' : individual ? players[b.owner].color : TEAM_COLORS[b.owner % 2], radius: b.radius, stripe: b.owner >= 2 });
        mesh.position.set(b.x, b.radius, b.z); ballMeshes.set(b.id, mesh); scene.add(mesh);
        if (b.owner >= 0) actors[b.owner].throwTime = .65;
      }
      mesh.visible = !b.out;
      mesh.rotation.x += (b.z - mesh.position.z) / b.radius; mesh.rotation.z -= (b.x - mesh.position.x) / b.radius;
      mesh.position.set(b.x, b.radius, b.z);
    }
    lastBallCount = pitch.nextId; lastPitch = pitch;
    const m = pitch.balls[0]; marker.visible = !m.out; marker.position.set(m.x, .035, m.z);
    marker.scale.setScalar(1 + Math.sin(clock * 3) * .07);
    const nearest = pitch.balls.filter(b => b.owner >= 0 && !b.out).sort((a, b) => distance(pitch, a) - distance(pitch, b))[0];
    measureLine.visible = !!nearest && !m.out;
    if (nearest) {
      const p = measureLine.geometry.attributes.position; p.setXYZ(0, m.x, .03, m.z); p.setXYZ(1, nearest.x, .03, nearest.z);
      p.needsUpdate = true; measureLine.geometry.computeBoundingSphere(); measureLine.computeLineDistances();
    }
  }
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function point(x, y, rect) { ray.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2), camera); return ray.ray.intersectPlane(plane, new THREE.Vector3()); }
  function dispose() {
    actors.forEach(a => a.pana?.dispose());
    const geometries = new Set(), materials = new Set(), textures = new Set();
    scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of [o.material].flat().filter(Boolean)) { materials.add(m); for (const v of Object.values(m)) if (v?.isTexture) textures.add(v); } });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
  }
  return { scene, camera, draw, fit, point, dispose, actors, caption };
}
