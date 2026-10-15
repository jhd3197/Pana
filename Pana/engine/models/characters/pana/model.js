// Reference sculpt prototype. +Z is forward; feet sit at y=0.
// Body, face and pivot identities survive wardrobe changes.
import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { surface, signedPower, mesh, ellipsoid, curve, patch } from '/engine/models/characters/pana/geometry.js';
import { createWardrobe } from '/engine/models/characters/pana/outfits.js';
import { createGlasses } from '/engine/models/characters/pana/glasses.js';
import { createMouth } from '/engine/models/characters/pana/mouth.js';
import { gameDetail, segments, withDetail } from '/engine/models/characters/pana/detail.js';

export const REFERENCE_PALETTE = Object.freeze({ fur: '#cf7d22', muzzle: '#874018', paw: '#643215', shirt: '#ee3024' });

function grainTexture() {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  let seed = 71623;
  for (let i = 0; i < size * size; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const n = 115 + (seed >>> 26);
    pixels.set([n, n, n, 255], i * 4);
  }
  const t = new THREE.DataTexture(pixels, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(7, 7); t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true; return t;
}

function headDimensions(y) {
  const u = signedPower(THREE.MathUtils.clamp(y / 0.8, -1, 1), 1 / 0.9);
  const ring = Math.sqrt(Math.max(0, 1 - u * u)) ** 0.85;
  return { width: 0.94 * (1 - 0.17 * u) * ring, depth: 0.74 * ring, z: 0.04 - 0.06 * u };
}

function headFront(x, y) {
  const { width, depth, z } = headDimensions(y);
  const circle = Math.max(0, 1 - (Math.abs(x) / Math.max(0.001, width)) ** (2 / 0.88));
  return z + depth * circle ** (0.88 / 2) + jawDepth(y) * circle ** 0.45;
}

const jawDepth = y => 0.15 * Math.exp(-(((y + 0.49) / 0.36) ** 2));

// A recessed smile cut into the front surface, with a shaped dark lining.
function mouthInset(x, y) {
  const q = (x / 0.405) ** 2 + ((y + 0.465) / 0.265) ** 2;
  return 0.085 * (1 - THREE.MathUtils.smoothstep(q, 0.5, 1));
}

function nostrilDistance(x, y, sign) {
  const angle = sign * 0.48, dx = x - sign * 0.188, dy = y - 0.145;
  return ((Math.cos(angle) * dx + Math.sin(angle) * dy) / 0.061) ** 2
    + ((-Math.sin(angle) * dx + Math.cos(angle) * dy) / 0.038) ** 2;
}
function nostrilInset(x, y) {
  return 0.036 * (1 - THREE.MathUtils.smoothstep(Math.min(nostrilDistance(x, y, -1), nostrilDistance(x, y, 1)), 0.25, 1.7));
}
function muzzleFront(x, y) {
  const h = signedPower(THREE.MathUtils.clamp((y + 0.045) / 0.405, -1, 1), 1 / 0.83);
  const rr = Math.sqrt(1 - h * h) ** 0.79;
  return 0.775 + 0.335 * rr * Math.max(0, 1 - (Math.abs(x) / (0.405 * rr)) ** (2 / 0.84)) ** (0.8 / 2);
}

function sculptBody(parent, root, legs, material) {
  // Smoothly union the belly and thighs, then skin the result to the same leg
  // pivots as the paws. This avoids visible ball joints through bare fur.
  const resolution = gameDetail() ? 32 : 48, half = resolution / 2, extent = 1.12;
  const mc = new MarchingCubes(resolution, material, false, false, 20000);
  mc.isolation = 0;
  const ellipsoidDistance = (x, y, z, rx, ry, rz) => {
    const k0 = Math.hypot(x / rx, y / ry, z / rz);
    const k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
    return k0 * (k0 - 1) / Math.max(0.00001, k1);
  };
  const smoothMin = (a, b, k) => {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  };
  for (let z = 0; z < resolution; z++) for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
    const px = (x - half) / half * extent, py = (y - half) / half * extent + 1, pz = (z - half) / half * extent;
    const taper = 1 - 0.14 * (py - 1.13) / 0.72;
    let d = ellipsoidDistance(px / taper, py - 1.13, pz + 0.015, 0.77, 0.72, 0.54);
    for (const sign of [-1, 1]) d = smoothMin(d, ellipsoidDistance(px - sign * 0.46, py - 0.44, pz, 0.305, 0.39, 0.34), 0.20);
    mc.field[z * resolution * resolution + y * resolution + x] = -d;
  }
  mc.update();
  const count = mc.geometry.drawRange.count, g = new THREE.BufferGeometry();
  const positions = mc.geometry.attributes.position.array.slice(0, count * 3);
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(mc.geometry.attributes.normal.array.slice(0, count * 3), 3));
  const p = g.attributes.position, weights = [], indices = [], uvs = [];
  for (let i = 0; i < count; i++) {
    const x = p.getX(i) * extent, y = p.getY(i) * extent + 1, z = p.getZ(i) * extent;
    p.setXYZ(i, x, y, z);
    const weight = 1 - THREE.MathUtils.smoothstep(y, 0.44, 0.93);
    weights.push(1 - weight, weight, 0, 0); indices.push(0, x > 0 ? 1 : 2, 0, 0);
    uvs.push(Math.atan2(z, x) / (Math.PI * 2) + 0.5, y / 2);
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const sculpt = new THREE.SkinnedMesh(g, material); sculpt.name = 'Continuous belly and legs';
  sculpt.castShadow = sculpt.receiveShadow = true; sculpt.frustumCulled = false;
  parent.add(sculpt); parent.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([root, ...legs]); sculpt.bind(skeleton);
  mc.geometry.dispose(); return skeleton;
}

export function buildSoftCharacter(options = {}) {
  return withDetail(options.quality || 'studio', () => sculptCharacter(options));
}

function sculptCharacter({ color, furColor = REFERENCE_PALETTE.fur, outfit = 'shirt', headwear, headwearColor, wristbands, glasses = 'none', expression = 'natural', scale = 1 } = {}) {
  const geometries = new Set(), materials = new Set(), texture = grainTexture();
  function material(name, baseColor, options = {}) {
    const m = new THREE.MeshPhysicalMaterial({ color: baseColor, roughness: 0.84,
      sheen: 0.16, sheenRoughness: 0.8, sheenColor: '#f5c487', ...options });
    m.name = name; materials.add(m); return m;
  }
  const fur = material('Golden short coat', furColor, { bumpMap: texture, bumpScale: 0.009 });
  const muzzleMat = material('Warm cocoa muzzle', REFERENCE_PALETTE.muzzle, { bumpMap: texture, bumpScale: 0.005 });
  const pawMat = material('Dark paws', REFERENCE_PALETTE.paw, { bumpMap: texture, bumpScale: 0.005 });
  const crease = material('Soft creases', '#6a3215');
  const nostrilMat = material('Recessed nostrils', '#321906', { roughness: 1, sheen: 0 });
  const eyeMat = material('Glossy black eyes', '#171511', { roughness: 0.28, clearcoat: 0.15, sheen: 0 });
  const glint = new THREE.MeshBasicMaterial({ color: '#fffdf1' }); materials.add(glint);
  const group = new THREE.Group(); group.name = 'Pana · capybara reference'; group.scale.setScalar(scale);
  const body = new THREE.Group(); body.name = 'body'; group.add(body);

  const hip = new THREE.Bone(); hip.name = 'hip'; body.add(hip);
  ellipsoid(body, 'Neck', fur, [0, 1.84, 0], [0.41, 0.36, 0.35]);

  const legs = [], arms = [], eyes = [];
  for (const sign of [1, -1]) {
    const leg = new THREE.Bone(); leg.name = sign === 1 ? 'legL' : 'legR';
    leg.position.set(sign * 0.47, 0.63, 0); hip.add(leg); legs.push(leg);
    ellipsoid(leg, 'Paw', pawMat, [0, -0.46, 0.13], [0.32, 0.175, 0.39], 0.78, 40);
    for (const dx of [-0.105, 0.105]) curve(leg, 'Toe crease', [-0.36, -0.40, -0.46, -0.51, -0.55].map(y => {
      const r = Math.max(0, 1 - (Math.abs(dx) / 0.32) ** (2 / 0.78) - (Math.abs(y + 0.46) / 0.175) ** (2 / 0.78));
      return [dx, y, 0.13 + 0.39 * r ** (0.78 / 2)];
    }), 0.004, crease, false, 20);

    const arm = new THREE.Bone(); arm.name = sign === 1 ? 'armL' : 'armR';
    arm.position.set(sign * 0.60, 1.70, 0); arm.rotation.z = sign * 0.40;
    body.add(arm); arms.push(arm);
    // Continuous arm with a vertex-color blend into the brown mitten.
    const armGeo = surface((u, v) => {
      const t = v * Math.PI, a = u * Math.PI * 2, h = Math.cos(t);
      const r = Math.sin(t) ** 0.68;
      return [-Math.cos(a) * 0.215 * r, -0.43 + h * 0.57, Math.sin(a) * 0.23 * r + 0.025];
    }, 40, 36);
    const colors = [], p = armGeo.attributes.position;
    const f = new THREE.Color(furColor), brown = new THREE.Color(REFERENCE_PALETTE.paw);
    for (let i = 0; i < p.count; i++) {
      const boundary = -0.70 + Math.sin(p.getX(i) * 16) * 0.015;
      const mix = 1 - THREE.MathUtils.smoothstep(p.getY(i), boundary - 0.035, boundary + 0.035);
      colors.push(...f.clone().lerp(brown, mix).toArray());
    }
    armGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const armMat = material('Fur into paws', '#ffffff', { vertexColors: true, bumpMap: texture, bumpScale: 0.006 });
    const armSurface = mesh(arm, 'Arm and mitten', armGeo, armMat);
    // The upper 16 latitude bands live beneath any short sleeve. The wardrobe
    // omits this covered surface so it cannot poke through deforming cloth.
    armSurface.userData.coveredIndexCount = 16 * 40 * 6;
    for (const dx of [-0.07, 0.07]) curve(arm, 'Finger crease', [-0.84, -0.88, -0.92, -0.955].map(y => {
      const ring = Math.sqrt(1 - ((y + 0.43) / 0.57) ** 2) ** 0.68;
      const z = 0.025 + 0.23 * ring * Math.sqrt(Math.max(0, 1 - (dx / (0.215 * ring)) ** 2));
      return [dx, y, z];
    }), 0.004, crease, false, 16);
  }

  const skeleton = sculptBody(body, hip, legs, fur);

  const neck = new THREE.Group(); neck.name = 'neck'; neck.position.set(0, 1.96, 0); body.add(neck);
  const head = new THREE.Group(); head.name = 'head'; head.position.y = 0.64; neck.add(head);
  const skull = surface((u, v) => {
    const theta = v * Math.PI, phi = u * Math.PI * 2;
    const y = signedPower(Math.cos(theta), 0.9) * 0.8;
    const d = headDimensions(y);
    const x = -signedPower(Math.cos(phi), 0.88) * d.width;
    let z = signedPower(Math.sin(phi), 0.88) * d.depth + d.z;
    if (Math.sin(phi) > 0) z += jawDepth(y) * Math.sin(phi) ** 0.9 - mouthInset(x, y);
    return [x, y, z];
  }, segments(96), segments(72));
  const skullMesh = mesh(head, 'Sculpted head', skull, fur);

  // Ear profile turns inward to form a cup; the dark interior is recessed.
  for (const sign of [1, -1]) {
    const ear = new THREE.Group(); ear.name = 'Cupped ear';
    ear.position.set(sign * 0.72, 0.64, -0.12); ear.rotation.z = -sign * 0.29;
    head.add(ear);
    const earProfile = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.125, 0), new THREE.Vector3(0.65, -0.12, 0),
      new THREE.Vector3(0.94, -0.055, 0), new THREE.Vector3(1, 0.02, 0),
      new THREE.Vector3(0.85, 0.108, 0), new THREE.Vector3(0.65, 0.103, 0),
      new THREE.Vector3(0.40, 0.025, 0), new THREE.Vector3(0, -0.025, 0),
    ]);
    const earGeo = surface((u, v) => {
      const a = u * Math.PI * 2, profile = earProfile.getPoint(v);
      return [-Math.cos(a) * 0.224 * profile.x, Math.sin(a) * 0.284 * profile.x, profile.y];
    }, segments(48), segments(40));
    const earColors = [], p = earGeo.attributes.position;
    const outer = new THREE.Color(REFERENCE_PALETTE.muzzle), inner = new THREE.Color('#713513');
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i) / 0.224, p.getY(i) / 0.284);
      const front = i >= p.count * 0.57;
      earColors.push(...inner.clone().lerp(outer, front ? THREE.MathUtils.smoothstep(r, 0.25, 0.82) : 1).toArray());
    }
    earGeo.setAttribute('color', new THREE.Float32BufferAttribute(earColors, 3));
    const earMat = material('Shaded ear cup', '#ffffff', { vertexColors: true, side: THREE.DoubleSide });
    mesh(ear, 'Ear cup', earGeo, earMat);
  }

  const mouth = createMouth({ head, skull: skullMesh, headFront, mouthInset, material });
  mouth.setExpression(expression, { immediate: true });

  // One broad snout with an upper bridge and two subtle lower lobes.
  const muzzle = surface((u, v) => {
    const t = v * Math.PI, a = u * Math.PI * 2;
    const yy = signedPower(Math.cos(t), 0.83), rr = Math.sin(t) ** 0.79;
    const x = -signedPower(Math.cos(a), 0.84) * 0.405 * rr;
    let y = -0.045 + yy * 0.405;
    let z = 0.775 + signedPower(Math.sin(a), 0.8) * 0.335 * rr;
    if (yy < 0) y += 0.04 * Math.exp(-((x / 0.078) ** 2)) * (-yy) ** 3;
    if (Math.sin(a) > 0) z -= nostrilInset(x, y);
    return [x, y, z];
  }, segments(96), segments(80));
  mesh(head, 'Broad cocoa muzzle', muzzle, muzzleMat);
  for (const sign of [-1, 1]) {
    const hole = new THREE.Shape();
    hole.absellipse(sign * 0.188, 0.145, 0.061, 0.038, 0, Math.PI * 2, false, sign * 0.48);
    patch(head, 'Inset nostril', hole, nostrilMat, (x, y) => muzzleFront(x, y) - nostrilInset(x, y) + 0.006, 20);
  }
  curve(head, 'Muzzle cleft', [[0, -0.04, 1.112], [0, -0.16, 1.109], [0, -0.28, 1.081], [0, -0.395, 0.98]], 0.006, crease, false, 32);

  for (const sign of [1, -1]) {
    const eye = new THREE.Group(); eye.name = sign === 1 ? 'eyeL' : 'eyeR';
    const x = sign * 0.612, y = 0.235;
    eye.position.set(x, y, headFront(x, y));
    eye.rotation.y = sign * 0.47; eye.rotation.z = sign * 0.15;
    ellipsoid(eye, 'Eye', eyeMat, [0, 0, 0.008], [0.09, 0.145, 0.036], 1, 40);
    ellipsoid(eye, 'Catchlight', glint, [-0.021, 0.063, 0.042], [0.021, 0.029, 0.007], 1, 24);
    eye.scale.y = mouth.eyeScale;
    head.add(eye); eyes.push(eye);
  }

  const carry = new THREE.Group(); carry.name = 'carry'; carry.position.set(0, 1.30, 0.98); body.add(carry);
  const wardrobe = createWardrobe({ body, head, arms, material, texture, fur, headDimensions });
  wardrobe.setOutfit(outfit); wardrobe.setColor(color ?? wardrobe.color);
  // A construction color also coordinates the preset hat unless overridden.
  if (color) wardrobe.setHeadwearColor(color);
  if (headwear !== undefined) wardrobe.setHeadwear(headwear);
  if (headwearColor !== undefined) wardrobe.setHeadwearColor(headwearColor);
  if (wristbands !== undefined) wardrobe.setWristbands(wristbands);
  const eyewear = createGlasses({ head, material, headFront }); eyewear.setStyle(glasses);
  const gather = () => group.traverse(o => { if (o.geometry) geometries.add(o.geometry); });
  gather();
  let age = 0, phase = 0, nextBlink = 2.8, blink = 1, disposed = false;
  const state = { pose: 'idle' };
  const baseShoulders = arms.map(a => a.position.clone());

  return {
    group, body, neck, head, arms, legs, eyes, carry, armL: arms[0], armR: arms[1], wardrobe, eyewear, mouth, state,
    setOutfit(value) { wardrobe.setOutfit(value); gather(); },
    setGarment(value) { wardrobe.setGarment(value); },
    setHeadwear(value) { wardrobe.setHeadwear(value); },
    setHeadwearColor(value) { wardrobe.setHeadwearColor(value); },
    setWristbands(value) { wardrobe.setWristbands(value); },
    setColor(value) { wardrobe.setColor(value); },
    setGlasses(value) { eyewear.setStyle(value); },
    setExpression(value, options) {
      mouth.setExpression(value, options);
      eyes.forEach(e => { e.scale.y = Math.min(1, blink) * mouth.eyeScale; });
      head.rotation.x = mouth.nod;
    },
    setPose(value) { if (['idle', 'wave', 'walk', 'run', 'carry'].includes(value)) state.pose = value; },
    resetPose() {
      // Reset must also settle the rig when reduced motion keeps updates paused.
      state.pose = 'idle'; age = 0; phase = 0; nextBlink = 2.8; blink = 1;
      body.position.set(0, 0, 0); body.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0);
      legs.forEach(leg => leg.rotation.set(0, 0, 0));
      arms.forEach((arm, i) => { arm.rotation.set(-0.04, 0, i ? -0.4 : 0.4); arm.position.copy(baseShoulders[i]); });
      eyes.forEach(eye => { eye.scale.y = mouth.eyeScale; });
      wardrobe.update();
    },
    update(dt, input = {}) {
      if (disposed) return;
      dt = THREE.MathUtils.clamp(Number(dt) || 0, 0, 0.1); age += dt;
      const pose = input.pose || state.pose;
      mouth.update(dt, pose, input.open);
      const walking = pose === 'walk' || pose === 'run' || !!input.walk;
      const running = pose === 'run' || !!input.run;
      const holding = pose === 'carry' || !!input.carry;
      const stride = walking ? (running ? 0.7 : 0.44) : 0;
      phase += dt * (running ? 13 : 8);
      const damping = 1 - Math.exp(-dt * 12);
      body.position.y = walking ? Math.abs(Math.sin(phase)) * (running ? 0.085 : 0.035) : Math.sin(age * 2) * 0.009;
      body.rotation.z = walking ? Math.sin(phase) * 0.035 : 0;
      body.rotation.x = running && walking ? 0.07 : 0;
      head.rotation.y = (input.look || 0) * 0.14;
      head.rotation.x = mouth.nod;
      head.rotation.z = pose === 'wave' ? -0.045 : Math.sin(age * 1.4) * 0.012;
      if (!input.manualBody) legs.forEach((leg, i) => { leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, Math.sin(phase + i * Math.PI) * stride, damping); });
      if (!input.manualArms) arms.forEach((arm, i) => {
        const sign = i ? -1 : 1, waving = pose === 'wave' && i === 1;
        const rx = holding ? -1.24 : walking ? -Math.sin(phase + i * Math.PI) * stride : -0.04;
        const rz = waving ? -2.35 + Math.sin(age * 8) * 0.20 : sign * (holding ? 0.14 : 0.40);
        arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x, rx, damping);
        arm.rotation.z = THREE.MathUtils.lerp(arm.rotation.z, rz, damping);
        arm.position.copy(baseShoulders[i]);
        arm.position.x += sign * (walking ? (running ? 0.075 : 0.04) : 0);
      });
      wardrobe.update();
      nextBlink -= dt;
      if (nextBlink < 0) { blink = Math.max(0.06, Math.abs(nextBlink + 0.085) / 0.085); if (nextBlink < -0.17) { nextBlink = 3.1; blink = 1; } }
      else blink = 1;
      eyes.forEach(e => { e.scale.y = Math.min(1, blink) * mouth.eyeScale; });
    },
    dispose() {
      if (disposed) return; disposed = true;
      gather(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); texture.dispose(); skeleton.dispose(); wardrobe.dispose();
      group.removeFromParent();
    },
  };
}
