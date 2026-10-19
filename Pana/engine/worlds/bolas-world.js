import * as THREE from 'three';
import { criollasCourt, criollaBall } from '../models/props/criollas.js';
import { buildCharacter } from '../models/characters/pana/avatar-model.js';
import { createPlazaProp, streetLamp } from '../models/props/plaza.js';
import { createArenaSlot } from './arenas.js';
import { createSky } from './sky.js';
import { guideRibbon, trimPath, pathLength } from '../play/aim-guide.js';
import { COURT, TEAM_COLORS, landing, distance } from '../play/bolas-criollas.js';
import { WARM_DAY, BUNTING } from './look.js';
import { shadowSize } from '/engine/settings.js';

// Papel picado over the court: two poles, a sagging cord and cloth flags that
// sway with absolute time (one live mesh, no per-flag objects).
function bunting(z, colors) {
  const group = new THREE.Group(); group.name = 'Papel picado';
  const wood = new THREE.MeshStandardMaterial({ color: '#8b5e3c', roughness: .9 });
  for (const x of [-7.6, 7.6]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 7.2, 8), wood); pole.position.set(x, 3.6, z); pole.castShadow = true; group.add(pole);
  }
  const sag = x => 7 - Math.cos(x / 7.6 * Math.PI / 2) * .55;
  const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, i) => new THREE.Vector3(-7.6 + i * 15.2 / 12, sag(-7.6 + i * 15.2 / 12), z))), 24, .018, 4), wood);
  group.add(cord);
  const positions = [], base = [], weights = [], color = [], index = [];
  for (let i = 0, x = -7.1; x < 7.2; x += .7, i++) {
    const c = new THREE.Color(colors[i % colors.length]), o = positions.length / 3;
    for (const [dx, dy] of [[-.26, 0], [.26, 0], [0, -.55]]) { positions.push(x + dx, sag(x + dx) + dy, z); weights.push(-dy / .55); color.push(c.r, c.g, c.b); }
    index.push(o, o + 1, o + 2);
  }
  base.push(...positions);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 3)); geometry.setIndex(index); geometry.computeVertexNormals();
  const flags = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, side: THREE.DoubleSide }));
  flags.frustumCulled = false; group.add(flags);
  group.userData.tick = t => {
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, base[i * 3 + 2] + weights[i] * (.18 + Math.sin(t * 1.9 - base[i * 3] * .45) * .2));
    p.needsUpdate = true;
  };
  return group;
}

// Court-side dressing from the brand board: chalk scoreboard on posts,
// planters at the corners, the team cooler and a crate of spare bolas.
function dressing() {
  const group = new THREE.Group(); group.name = 'Court dressing';
  const place = (object, x, z, angle = 0) => { object.position.set(x, 0, z); object.rotation.y = angle; group.add(object); return object; };
  for (const [x, z] of [[-7.6, -13.6], [7.6, -13.6], [-7.6, 13.9], [7.6, 13.9]]) place(createPlazaProp('planter'), x, z);
  for (const [x, z] of [[-7.9, -9.2], [7.9, 6.2], [-7.9, 7.4]]) place(streetLamp(), x, z);
  place(createPlazaProp('cooler'), -8.1, -1.1, .4);
  place(createPlazaProp('cooler', { color: 0x2ba972 }), 8.1, -.6, -.3);
  const crate = place(createPlazaProp('crate'), 2.2, 12.9, .15); crate.scale.setScalar(.7);
  for (const [i, x] of [-.28, 0, .28].entries()) {
    const ball = criollaBall({ color: TEAM_COLORS[i % 2], radius: .16 }); ball.position.set(x, .62, 0); crate.add(ball);
  }
  return group;
}

export function createBolasWorld({ aspect = 16 / 9, individual = false, venue = 'plaza' } = {}) {
  // Warm late-morning light: golden sun, soft blue fill, a creamy horizon.
  const scene = new THREE.Scene(); scene.background = new THREE.Color(WARM_DAY.background);
  scene.fog = new THREE.Fog(WARM_DAY.background, 70, 190);
  const sky = createSky({ ...WARM_DAY.sky, skySeed: 32 }); scene.add(sky.mesh);
  scene.add(new THREE.HemisphereLight(...WARM_DAY.hemi));
  const sun = new THREE.DirectionalLight(WARM_DAY.sun.color, WARM_DAY.sun.intensity); sun.position.set(-18, 28, 12); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
  sun.shadow.mapSize.setScalar(shadowSize(2048)); sun.shadow.bias = -.0005; sun.shadow.normalBias = .03; scene.add(sun);
  const venueSlot = createArenaSlot(scene, { mode: 'court' }); venueSlot.setMap(venue);
  const court = criollasCourt({ width: COURT.halfWidth * 2, length: COURT.halfLength * 2 }); scene.add(court);
  const flags = [bunting(-1, BUNTING), bunting(-9, [...BUNTING].reverse())];
  scene.add(dressing(), ...flags);
  // The chalkboard scoreboard stands on two posts behind the far end.
  const signCanvas = document.createElement('canvas'); signCanvas.width = 1024; signCanvas.height = 256;
  const signTex = new THREE.CanvasTexture(signCanvas); signTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Group(); board.name = 'Pizarra'; board.position.set(0, 0, -14.4); scene.add(board);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.8), new THREE.MeshStandardMaterial({ map: signTex, roughness: .9 }));
  sign.position.y = 2.25; board.add(sign);
  const frameWood = new THREE.MeshStandardMaterial({ color: '#8b5e3c', roughness: .85 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.2, .14), frameWood); frame.position.set(0, 2.25, -.09); frame.castShadow = true; board.add(frame);
  for (const x of [-3.4, 3.4]) { const post = new THREE.Mesh(new THREE.BoxGeometry(.22, 3.4, .22), frameWood); post.position.set(x, 1.7, -.12); post.castShadow = true; board.add(post); }
  let signText = '';
  function caption(text = 'BOLAS CRIOLLAS', sub = 'ARRIMA CON TUS PANAS') {
    const key = text + sub; if (key === signText) return; signText = key;
    const c = signCanvas.getContext('2d'); c.fillStyle = '#245a43'; c.fillRect(0, 0, 1024, 256);
    c.strokeStyle = 'rgba(255, 248, 225, .25)'; c.lineWidth = 3; c.strokeRect(14, 14, 996, 228);
    c.textAlign = 'center'; c.fillStyle = '#fff6dc'; c.font = '68px "Luckiest Guy", sans-serif'; c.fillText(text, 512, 118, 950);
    c.fillStyle = '#ffc83d'; c.font = 'bold 33px Nunito, sans-serif'; c.fillText(sub, 512, 196, 950); signTex.needsUpdate = true;
  }
  caption();
  const camera = new THREE.PerspectiveCamera(42, aspect, .1, 500);
  // The legacy wide framing (Bululú, and the 'cancha' view): the whole court in shot.
  function framing(nextAspect, overhead, out) {
    const wide = nextAspect > 1.65;
    const direction = new THREE.Vector3(overhead ? .03 : wide ? 1 : .34, overhead ? 1.5 : .95, wide && !overhead ? .25 : 1).normalize();
    let dist = 22; const probe = camera.clone(); probe.aspect = nextAspect; probe.clearViewOffset(); probe.updateProjectionMatrix();
    for (let n = 0; n < 50; n++) {
      probe.position.copy(direction).multiplyScalar(dist); probe.lookAt(0, 0, 0); probe.updateMatrixWorld();
      const fits = [-7.5, 7.5].every(x => [-13.8, 13.8].every(z => [0, 3.5].every(y => {
        const p = new THREE.Vector3(x, y, z).project(probe); return Math.abs(p.x) < .94 && Math.abs(p.y) < .93;
      })));
      if (fits) break; dist *= 1.055;
    }
    out.pos.copy(probe.position); out.look.set(0, 0, 0); out.up.set(0, 1, 0);
  }
  const pose = { pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }, want = { pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) };
  let posed = false;
  function apply() { camera.position.copy(pose.pos); camera.up.copy(pose.up); camera.lookAt(pose.look); camera.updateMatrixWorld(); }
  function fit(nextAspect = camera.aspect, overhead = false) {
    camera.aspect = nextAspect; camera.clearViewOffset(); camera.updateProjectionMatrix();
    framing(nextAspect, overhead, want); pose.pos.copy(want.pos); pose.look.copy(want.look); pose.up.copy(want.up); posed = true; apply();
  }
  fit();
  // Bolas Criollas' own cameras. 'calce': behind and above the thrower, looking
  // down the court (follows the rolling ball a little). 'arriba': straight
  // down, long axis across a wide screen. 'cancha': the classic wide framing.
  function view(mode, { aspect: nextAspect = camera.aspect, dt = 0, originX = 0, focus = null, lift = 0, width = 1, height = 1 } = {}) {
    camera.aspect = nextAspect;
    if (lift) camera.setViewOffset(width, height, 0, lift, width, height); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    const portrait = nextAspect < 1;
    if (mode === 'calce') {
      // Over the thrower's right shoulder, so the pana stays in the corner of the shot.
      const back = portrait ? 9.6 : 7.4, up = portrait ? 8.4 : 4.9;
      want.pos.set(originX * .6 + (portrait ? .8 : 1.9), up, COURT.launchZ + back); want.up.set(0, 1, 0);
      want.look.set(focus ? focus.x * .35 : 0, 0, focus ? Math.min(COURT.launchZ - 6, focus.z) * .5 - 2.5 : -3);
    } else if (mode === 'arriba') {
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), across = !portrait;
      // Long axis across the screen when it is wider than tall.
      const along = COURT.halfLength + 1.6, side = COURT.halfWidth + 2.6;
      const h = across ? Math.max(side / tan, along / (tan * nextAspect)) : Math.max(along / tan, side / (tan * nextAspect));
      want.pos.set(0, h * 1.04, 0); want.look.set(0, 0, 0); want.up.set(across ? -1 : 0, 0, across ? 0 : -1);
    } else framing(nextAspect, false, want);
    // Cords seen from straight above would read as lines across the court.
    flags.forEach(f => { f.visible = mode !== 'arriba'; });
    if (!posed || !dt) { pose.pos.copy(want.pos); pose.look.copy(want.look); pose.up.copy(want.up); posed = true; }
    else { const k = 1 - Math.exp(-dt * 3.2); pose.pos.lerp(want.pos, k); pose.look.lerp(want.look, k); pose.up.lerp(want.up, k).normalize(); }
    apply();
  }
  const actors = [], ballMeshes = new Map(), guides = [];
  const marker = new THREE.Mesh(new THREE.RingGeometry(.42, .49, 48), new THREE.MeshBasicMaterial({ color: '#ffdc61', side: THREE.DoubleSide, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2; scene.add(marker);
  const measureLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: '#fff6d6', dashSize: .16, gapSize: .1 })); scene.add(measureLine);
  // Fácil also previews where struck balls come to rest: a ring per ball.
  const restMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, transparent: true, opacity: .85, depthWrite: false });
  const rests = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(.2, .27, 32), restMaterial); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return m; });
  function makeGuide(color) {
    const line = guideRibbon(color, .12, { opacity: .95, segments: 24 });
    const ring = new THREE.Mesh(new THREE.RingGeometry(.33, .41, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, transparent: true, opacity: .95, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; scene.add(line, ring); return { line, ring };
  }
  let clock = 0, lastPitch = null, lastBallCount = 0;
  const NORMAL = { reach: 1, ghost: true, after: 0 };
  function draw(pitch, players, { dt = 0, turn = -1, shots = [], winners = [], caption: title, subtitle, guide = NORMAL, preview = null } = {}) {
    clock += dt; sky.update(clock); venueSlot.update(clock, dt); flags.forEach(f => f.userData.tick(clock));
    if (title) caption(title, subtitle);
    while (actors.length < players.length) { actors.push({ key: null, pana: null, throwTime: 0 }); guides.push(makeGuide(players[actors.length - 1].color || TEAM_COLORS[(actors.length - 1) % 2])); }
    rests.forEach(r => { r.visible = false; });
    players.forEach((p, i) => {
      const a = actors[i], key = JSON.stringify(p.avatar);
      if (key !== a.key) {
        a.held?.userData.dispose(); a.pana?.dispose(); a.pana = buildCharacter(p.avatar); a.key = key; scene.add(a.pana.group);
        a.held = criollaBall({ color: individual ? p.color : TEAM_COLORS[i % 2], stripe: i >= 2 });
        a.held.position.set(-.6, .95, .32); a.pana.group.add(a.held);
      }
      const onCalce = turn === i;
      const x = individual ? (i - (players.length - 1) / 2) * Math.min(2.1, 6.3 / Math.max(1, players.length - 1)) : onCalce ? -.65 : (i % 2 ? 1 : -1) * 6.8;
      const z = individual ? 11.3 : onCalce ? 11.25 : 7.2 - Math.floor(i / 2) * 3;
      a.pana.group.position.set(x, winners.includes(i) ? Math.abs(Math.sin(clock * 6)) * .28 : 0, z);
      a.pana.group.rotation.y = individual || onCalce ? Math.PI : i % 2 ? -1.2 : 1.2;
      a.pana.update(dt, { walk: 0, open: winners.includes(i) }); a.throwTime = Math.max(0, a.throwTime - dt);
      if (a.throwTime) a.pana.armR.rotation.x = -Math.sin(a.throwTime / .65 * Math.PI) * 1.8;
      if (winners.includes(i)) a.pana.armL.rotation.x = a.pana.armR.rotation.x = -2.4;
      const shot = shots[i], g = guides[i]; g.line.visible = g.ring.visible = false;
      a.held.visible = !!shot || onCalce;
      if (shot) {
        // The difficulty decides how much of the throw the guide gives away.
        const fromX = shot.originX || 0, to = landing(shot, fromX), from = { x: fromX, z: COURT.launchZ };
        const full = guide.after >= 1 && preview, path = full && preview.path?.length > 1 ? [from, ...preview.path] : [from, to];
        const reach = guide.reach >= 1 ? pathLength(path) : Math.max(1.2, pathLength([from, to]) * guide.reach);
        g.line.userData.set(trimPath(path, reach), .045);
        g.ring.visible = guide.ghost && guide.reach >= 1; g.ring.position.set(to.x, .05, to.z);
        if (full) { const end = path.at(-1); g.ring.position.set(end.x, .05, end.z);
          preview.moved?.slice(0, rests.length).forEach((b, n) => { rests[n].visible = !b.out; rests[n].position.set(b.x, .05, b.z); }); }
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
    actors.forEach(a => a.pana?.dispose()); venueSlot.dispose();
    const geometries = new Set(), materials = new Set(), textures = new Set();
    scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of [o.material].flat().filter(Boolean)) { materials.add(m); for (const v of Object.values(m)) if (v?.isTexture) textures.add(v); } });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
  }
  return { scene, camera, draw, fit, view, point, dispose, actors, caption, setVenue: id => venueSlot.setMap(id), get venue() { return scene.userData.mapId; } };
}
