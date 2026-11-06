// A rock that breaks as a hold fills, on any mesh you already have. Glowing cracks
// grow across it, each hit throws chips, sparks and dust and jolts it, and at the end
// it splits into chunks that fly out. It only draws: feed it a progress your game
// already shares and every client sees the same breaking. Numbers live in
// engine/fx/rock-crack-sim.js (CRACK_TUNING); docs/SHARED-ENGINE.md, "Rock cracks".
//
//   const crack = createRockCrack({ rock: pile, seed: 4, quality: 'media', onEvent, dust });
//   crack.setProgress(held / total, { viewer: me });   // hits come from the thresholds it crosses
//   crack.update(dt);
//   crack.break();                                     // when it goes; dispose() once crack.done
import * as THREE from 'three';
import { CRACK_TUNING, crackGlow, crackPaths, crackQuality, crackReveal, createDebris, createShake, hitsCrossed, stagesCrossed, stepPulse } from './rock-crack-sim.js';

const CRACK_VERTEX = /* glsl */`
  attribute float aAt, aAcross;
  varying float vAt, vAcross;
  #include <fog_pars_vertex>
  void main() {
    vAt = aAt; vAcross = aAcross;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const CRACK_FRAGMENT = /* glsl */`
  uniform float uReveal, uGlow; uniform vec3 uColor, uHot;
  varying float vAt, vAcross;
  #include <fog_pars_fragment>
  void main() {
    if (vAt > uReveal) discard;
    float fog = 1.0;
    #ifdef USE_FOG
    #ifndef FOG_EXP2
    fog = 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    #endif
    float across = abs(vAcross), tip = 1.0 - smoothstep(0.0, 0.14, uReveal - vAt);
    // A dark split in the stone with the heat showing down its middle, hottest where it is still running.
    float core = 1.0 - smoothstep(0.0, 0.5, across), burn = core * min(1.0, uGlow * 1.3);
    vec3 c = mix(vec3(0.025, 0.016, 0.012), mix(uColor, uHot, min(1.0, tip + uGlow * 0.3 * core)) * (0.75 + uGlow * 0.55), burn);
    float a = (1.0 - smoothstep(0.72, 1.0, across)) * fog;
    gl_FragColor = vec4(c * a, a);
  }`;

const chipGeometry = new THREE.DodecahedronGeometry(1, 0);
const scratch = new THREE.Object3D(), va = new THREE.Vector3(), vb = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3();

// Lays the cracks on the rock's real surface: a ray in from outside per point, one
// ribbon of quads per stretch. Runs once, the first time the rock starts to break.
function buildRibbons(rock, paths, frame, width, faces, faceWidth) {
  rock.updateWorldMatrix(true, true);
  const ray = new THREE.Raycaster(), box = new THREE.Box3().setFromObject(rock), middle = box.getCenter(new THREE.Vector3()), half = box.getSize(new THREE.Vector3()).multiplyScalar(.5), jump = Math.max(half.x, half.y, half.z) * .55;
  const position = [], at = [], across = [], index = [], tips = [], normal = new THREE.Matrix3();
  for (const path of paths) {
    const stations = [];
    for (const p of path.points) {
      if (faces?.length) {
        // Straight onto the nearest face seen, spread across its width: rays that
        // converge on the middle would leave a wide face bare.
        let f = faces[0], score = -2;
        for (const q of faces) { const d = Math.cos(q) * p.x + Math.sin(q) * p.z; if (d > score) { score = d; f = q; } }
        const nx = Math.cos(f), nz = Math.sin(f), across = (-nz * p.x + nx * p.z) * faceWidth * 1.8, far = Math.max(half.x, half.z) * 1.6;
        vb.set(middle.x + nx * far - nz * across, middle.y + p.y * half.y * .95, middle.z + nz * far + nx * across);
        va.set(-nx, -p.y * .12, -nz).normalize();
      } else {
        // In from outside, nearly level: a steep ray would put every crack high on the rock.
        vb.set(middle.x + p.x * half.x * 1.6, middle.y + p.y * half.y * .9, middle.z + p.z * half.z * 1.6);
        va.set(-p.x * half.x, -p.y * half.y * .3, -p.z * half.z).normalize();
      }
      ray.set(vb, va);
      const hit = ray.intersectObject(rock, true)[0];
      if (!hit) { stations.push(null); continue; }
      normal.getNormalMatrix(hit.object.matrixWorld);
      const n = hit.face.normal.clone().applyMatrix3(normal).normalize();
      stations.push({ point: frame.worldToLocal(hit.point.clone()), normal: n, at: p.at });
    }
    tips.push(stations.filter(Boolean));
    for (let k = 1; k < stations.length; k++) {
      const a = stations[k - 1], b = stations[k];
      if (!a || !b || a.point.distanceTo(b.point) > jump) continue;
      const t = (k - 1) / (stations.length - 1), w0 = width * (1 - t * .75) * (path.branch ? .65 : 1), w1 = width * (1 - k / (stations.length - 1) * .75) * (path.branch ? .65 : 1), base = position.length / 3;
      side.subVectors(b.point, a.point).normalize();
      up.copy(a.normal).add(b.normal).normalize();
      va.crossVectors(up, side).normalize();
      const put = (s, w, sign) => { position.push(s.point.x + va.x * w * sign + up.x * .012, s.point.y + va.y * w * sign + up.y * .012, s.point.z + va.z * w * sign + up.z * .012); at.push(s.at); across.push(sign); };
      put(a, w0, -1); put(a, w0, 1); put(b, w1, -1); put(b, w1, 1);
      index.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('aAt', new THREE.Float32BufferAttribute(at, 1));
  g.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  return { geometry: g, stations: tips };
}

// `rock`: an Object3D already in the scene. It moves into `group` so it can shake.
// `onEvent({ type, x, y, z, strength })` with type 'hit' | 'crunch' | 'break', in the
// rock's parent's coordinates; `dust(x, y, z, strength)` asks for a puff of your own;
// `motion` 0..1 scales the shake (0 for reduced motion); `color` tints the cracks;
// `faces` the azimuths it is seen from, when not from all round, and `faceWidth` how
// wide those faces are, in metres (a tunnel's width).
export function createRockCrack({ rock, faces = null, faceWidth = 2, seed = 1, quality = 'media', motion = 1, color = 0xff8a2a, ground = 0, chipColor = 0x6a6052, onEvent = null, dust = null } = {}) {
  let level = crackQuality(quality), progress = 0, seen = false, pulse = 0, broken = false, ribbons = null;
  const group = new THREE.Group(); group.name = 'rock-crack';
  group.position.copy(rock.position); rock.parent?.add(group); rock.position.set(0, 0, 0);
  const frame = new THREE.Group(); group.add(frame); frame.add(rock);
  const paths = crackPaths({ seed, faces });
  const uniforms = { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uReveal: { value: 0 }, uGlow: { value: 0 }, uColor: { value: new THREE.Color().setHex(color, THREE.LinearSRGBColorSpace) }, uHot: { value: new THREE.Color().setHex(0xffe6a8, THREE.LinearSRGBColorSpace) } };
  const crackMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: CRACK_VERTEX, fragmentShader: CRACK_FRAGMENT, fog: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  let crackMesh = null;

  // Chips and chunks: one instanced mesh, one pool. Sparks: one Points, one pool. Neither draws while empty.
  const { chips: chipRule, sparks: sparkRule, chunks: chunkRule } = CRACK_TUNING;
  const most = table => Math.max(...Object.values(table));
  const pieces = createDebris({ cap: most(chipRule.cap) + most(chunkRule.count), seed, ground: ground - group.position.y }), sparks = createDebris({ cap: most(sparkRule.cap), seed: seed + 1, bounces: false, gravity: 5 });
  const chipMaterial = new THREE.MeshStandardMaterial({ color: chipColor, roughness: 1, flatShading: true });
  const chipMesh = new THREE.InstancedMesh(chipGeometry, chipMaterial, pieces.max); chipMesh.frustumCulled = false; chipMesh.count = 0; chipMesh.visible = false; group.add(chipMesh);
  const sparkPositions = new Float32Array(sparks.max * 3), sparkColors = new Float32Array(sparks.max * 3);
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3).setUsage(THREE.DynamicDrawUsage));
  sparkGeometry.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3).setUsage(THREE.DynamicDrawUsage));
  const sparkMaterial = new THREE.PointsMaterial({ size: .07, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const sparkMesh = new THREE.Points(sparkGeometry, sparkMaterial); sparkMesh.frustumCulled = false; sparkMesh.visible = false; group.add(sparkMesh);
  const shake = createShake({ motion });

  function setQuality(next) {
    level = crackQuality(next);
    pieces.setCap(chipRule.cap[level] + chunkRule.count[level]); sparks.setCap(sparkRule.cap[level]);
    return level;
  }
  setQuality(level);

  function prepare() {
    if (ribbons) return;
    ribbons = buildRibbons(rock, paths, frame, CRACK_TUNING.cracks.width, faces, faceWidth);
    crackMesh = new THREE.Mesh(ribbons.geometry, crackMaterial); crackMesh.renderOrder = 2; frame.add(crackMesh);
  }
  // The running tip of the crack best turned toward `viewer`: where a blow shows.
  const STRIKE = { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0 };
  function strikePoint(viewer) {
    prepare();
    let best = null, score = -Infinity;
    const reveal = uniforms.uReveal.value, x0 = group.position.x, z0 = group.position.z;
    for (const stations of ribbons.stations) {
      if (!stations.length) continue;
      // The last point this crack has reached, or its start if it has not begun.
      let s = stations[0]; for (const q of stations) if (q.at <= reveal) s = q;
      const dx = viewer ? viewer.x - (s.point.x + x0) : 0, dz = viewer ? viewer.z - (s.point.z + z0) : 0, d = Math.hypot(dx, dz) || 1;
      const facing = viewer ? (s.normal.x * dx + s.normal.z * dz) / d - d * .02 : s.at;
      if (facing > score) { score = facing; best = s; }
    }
    if (best) { STRIKE.x = best.point.x; STRIKE.y = best.point.y; STRIKE.z = best.point.z; STRIKE.nx = best.normal.x; STRIKE.ny = best.normal.y; STRIKE.nz = best.normal.z; }
    return STRIKE;
  }
  const say = (type, x, y, z, strength) => onEvent?.({ type, x: x + group.position.x, y: y + group.position.y, z: z + group.position.z, strength });
  // A blow lands: chips, sparks, dust, a jolt and a brighter crack. Without a point it
  // lands on the crack showing most to `viewer`. Local to this client's screen.
  function hit(point = null, normal = null, { viewer = null, strength = CRACK_TUNING.shake.hit, type = 'hit' } = {}) {
    if (broken) return;
    const s = point ? { x: point.x - group.position.x, y: point.y - group.position.y, z: point.z - group.position.z, nx: normal?.x ?? 0, ny: normal?.y ?? 1, nz: normal?.z ?? 0 } : strikePoint(viewer);
    const scale = type === 'hit' ? 1 : 1.5;
    pieces.spawn(s.x, s.y, s.z, s.nx, s.ny, s.nz, Math.round(chipRule.perHit[level] * scale), chipRule);
    sparks.spawn(s.x, s.y, s.z, s.nx, s.ny, s.nz, Math.round(sparkRule.perHit[level] * scale), { ...sparkRule, spread: 1, up: .3 });
    pulse = Math.min(1, pulse + strength); shake.kick(strength);
    dust?.(s.x + group.position.x, s.y + group.position.y, s.z + group.position.z, strength);
    say(type, s.x, s.y, s.z, strength);
  }
  function breakRock({ silent = false } = {}) {
    if (broken) return false;
    broken = true; rock.visible = false; if (crackMesh) crackMesh.visible = false;
    if (silent) return true;
    const box = new THREE.Box3().setFromObject(rock), middle = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()); group.worldToLocal(middle);
    // Out toward whoever can see it: along the faces when it has them, else all round.
    const count = chunkRule.count[level];
    for (let i = 0; i < count; i++) {
      const a = faces?.length ? faces[i % faces.length] + ((i * 2.399963) % 1 - .5) * .8 : i / count * Math.PI * 2, nx = Math.cos(a), nz = Math.sin(a);
      const across = faces?.length ? ((i * 1.618) % 1 - .5) * faceWidth * 1.4 : 0, reach = faces?.length ? Math.max(size.x, size.z) * .22 : Math.max(size.x, size.z) * .3;
      pieces.spawn(middle.x + nx * reach - nz * across, middle.y * (.3 + (i % 4) * .28), middle.z + nz * reach + nx * across, nx, .45, nz, 1, { ...chunkRule, spread: .3 });
    }
    sparks.spawn(middle.x, middle.y, middle.z, 0, 1, 0, sparkRule.cap[level], { ...sparkRule, spread: 1.6, up: .2 });
    dust?.(middle.x + group.position.x, middle.y * .4 + group.position.y, middle.z + group.position.z, 2);
    say('break', middle.x, middle.y, middle.z, 1);
    return true;
  }
  return {
    group, hit, setQuality,
    break: breakRock,
    get progress() { return progress; },
    get reveal() { return uniforms.uReveal.value; },
    get glow() { return uniforms.uGlow.value; },
    get broken() { return broken; },
    // Broken and nothing left flying: safe to dispose.
    get done() { return broken && pieces.alive === 0 && sparks.alive === 0; },
    get flying() { return pieces.alive + sparks.alive; },
    set motion(v) { shake.motion = v; },
    // Follow the shared progress. The first call only takes it in, so someone walking
    // up to a half-dug rock gets its cracks without a burst. `silent`: too far to bother.
    setProgress(p, { viewer = null, silent = false } = {}) {
      const next = Math.min(1, Math.max(0, p));
      if (!seen) { seen = true; progress = next; if (next > 0) prepare(); return; }
      const from = progress; progress = next;
      if (next > 0) prepare();
      if (broken || silent || !(next > from)) return;
      const crunch = stagesCrossed(from, next);
      if (crunch) hit(null, null, { viewer, strength: CRACK_TUNING.shake.stage, type: 'crunch' });
      else if (hitsCrossed(from, next)) hit(null, null, { viewer });
    },
    update(dt) {
      pulse = stepPulse(pulse, dt);
      uniforms.uReveal.value = crackReveal(progress); uniforms.uGlow.value = crackGlow(progress, pulse);
      const s = shake.step(dt); frame.position.set(s.x, s.y, s.z); frame.rotation.set(s.rx, 0, s.rz);
      if (pieces.alive > 0) {
        pieces.step(dt);
        let n = 0;
        for (let i = 0; i < pieces.cap; i++) {
          if (pieces.life[i] <= 0) continue;
          scratch.position.set(pieces.x[i], pieces.y[i], pieces.z[i]); scratch.rotation.set(pieces.spin[i], pieces.spin[i] * .7, i); scratch.scale.setScalar(pieces.drawnSize(i)); scratch.updateMatrix();
          chipMesh.setMatrixAt(n++, scratch.matrix);
        }
        chipMesh.count = n; chipMesh.instanceMatrix.needsUpdate = true;
      }
      chipMesh.visible = pieces.alive > 0;
      if (sparks.alive > 0) {
        sparks.step(dt);
        for (let i = 0; i < sparks.max; i++) {
          const k = sparks.life[i] > 0 ? sparks.life[i] / sparks.span[i] : 0;
          sparkPositions[i * 3] = sparks.x[i]; sparkPositions[i * 3 + 1] = k ? sparks.y[i] : -1e4; sparkPositions[i * 3 + 2] = sparks.z[i];
          sparkColors[i * 3] = k * 1.4; sparkColors[i * 3 + 1] = k * k * .9; sparkColors[i * 3 + 2] = k * k * k * .3;
        }
        sparkGeometry.attributes.position.needsUpdate = sparkGeometry.attributes.color.needsUpdate = true;
      }
      sparkMesh.visible = sparks.alive > 0;
    },
    dispose() {
      ribbons?.geometry.dispose(); crackMaterial.dispose(); chipMaterial.dispose(); chipMesh.dispose(); sparkGeometry.dispose(); sparkMaterial.dispose();
      rock.removeFromParent(); group.removeFromParent();
    },
  };
}
