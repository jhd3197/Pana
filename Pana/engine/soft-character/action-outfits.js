import * as THREE from 'three';
import { curve, ellipsoid, mesh, ovalRing, patch, surface, signedPower } from './geometry.js';

// Sample each finished garment once. Pockets, buttons and emblems then follow
// its actual cloth surface, including subdivision, rather than a guessed sphere.
function clothFront(geometry) {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const proxy = new THREE.Mesh(geometry, material), ray = new THREE.Raycaster();
  const nx = 32, ny = 40, minX = -0.65, minY = 1.01, width = 1.3, height = 0.8, depths = [];
  geometry.computeBoundingSphere(); geometry.computeBoundingBox(); proxy.updateMatrixWorld(true);
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    ray.set(new THREE.Vector3(minX + i / nx * width, minY + j / ny * height, 2), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObject(proxy, false).find(h => h.point.z > 0);
    depths.push(hit ? hit.point.z : 0.31);
  }
  material.dispose();
  return (x, y) => {
    const gx = THREE.MathUtils.clamp((x - minX) / width * nx, 0, nx - 0.00001);
    const gy = THREE.MathUtils.clamp((y - minY) / height * ny, 0, ny - 0.00001);
    const i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j;
    const at = (a, b) => depths[b * (nx + 1) + a];
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(i, j), at(i + 1, j), u), THREE.MathUtils.lerp(at(i, j + 1), at(i + 1, j + 1), u), v) + 0.012;
  };
}

function crown(parent, material, centerY, depthAt, size = 0.19) {
  const shape = new THREE.Shape();
  const points = [[-0.8, -0.55], [-1, 0.55], [-0.45, 0.15], [0, 0.85], [0.45, 0.15], [1, 0.55], [0.8, -0.55]];
  points.forEach(([x, y], i) => shape[i ? 'lineTo' : 'moveTo'](x * size, centerY + y * size)); shape.closePath();
  patch(parent, 'Pana crown emblem', shape, material, depthAt, 12);
}

function floralTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
  function recolor(color) {
    ctx.fillStyle = color; ctx.fillRect(0, 0, 512, 512);
    for (let row = -1; row <= 3; row++) for (let col = -1; col <= 3; col++) {
      const x = col * 170 + (row % 2 ? 82 : 0) + 32, y = row * 170 + 42;
      const angle = row * 0.82 + col * 1.24;
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
      ctx.fillStyle = '#fff8e9';
      for (let petal = 0; petal < 5; petal++) {
        ctx.rotate(Math.PI * 2 / 5); ctx.beginPath(); ctx.ellipse(0, -23, 18, 26, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    texture.needsUpdate = true;
  }
  return { texture, recolor };
}

function capShape(u, v) {
  const a = u * Math.PI * 2, front = Math.exp(-((Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2)) / 0.43) ** 2));
  const t = v * (Math.PI / 2 - 0.39 * front), r = Math.sin(t);
  return [-Math.cos(a) * 0.79 * r, 0.47 + Math.cos(t) * 0.56, Math.sin(a) * 0.66 * r - 0.035];
}

function backwardCap(head, cloth, cream, seam) {
  const cap = new THREE.Group(); cap.name = 'outfit:backward-cap'; head.add(cap);
  const columns = 96, rows = 40, geometry = surface(capShape, columns, rows);
  const panels = [[], []], original = geometry.index.array;
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = (col + 0.5) / columns * Math.PI * 2;
    const stripe = Math.abs(a - Math.PI / 2) < 0.32 || Math.abs(a - Math.PI * 1.5) < 0.32;
    const start = (row * columns + col) * 6;
    for (let k = 0; k < 6; k++) panels[stripe ? 1 : 0].push(original[start + k]);
  }
  // Two contiguous index groups keep the panel colors to two draw calls.
  geometry.setIndex([...panels[0], ...panels[1]]);
  geometry.addGroup(0, panels[0].length, 0); geometry.addGroup(panels[0].length, panels[1].length, 1);
  mesh(cap, 'Paneled cap crown', geometry, [cloth, cream]);
  const brim = ellipsoid(cap, 'Backward cap bill', cloth, [0, 0.45, -0.64], [0.64, 0.038, 0.55], 0.78, 48);
  brim.rotation.x = -0.08;
  curve(cap, 'Cap lower binding', Array.from({ length: 96 }, (_, i) => capShape(i / 96, 1)), 0.014, seam, true, 120);
  curve(cap, 'Adjustable cap strap', [[-0.32, 0.49, 0.58], [-0.16, 0.49, 0.627], [0, 0.49, 0.64], [0.16, 0.49, 0.627], [0.32, 0.49, 0.58]], 0.027, cloth, false, 40);
  for (const x of [-0.16, -0.08, 0, 0.08, 0.16]) ellipsoid(cap, 'Cap strap eyelet', seam, [x, 0.49, 0.668 - x * x * 0.5], [0.008, 0.009, 0.003], 1, 12);
  for (const u of [0, 0.2, 0.3, 0.5, 0.7, 0.8]) curve(cap, 'Cap panel seam', Array.from({ length: 24 }, (_, i) => {
    const p = capShape(u, i / 23); p[1] += 0.003; return p;
  }), 0.005, seam, false, 32);
  ellipsoid(cap, 'Cap top button', cloth, [0, 1.04, -0.035], [0.063, 0.024, 0.06], 1, 24);
  return cap;
}

export function createActionDetails({ head, arms, material, texture, tops, headDimensions }) {
  const cream = material('Warm ivory fabric', '#fff8e9', { roughness: 0.9, sheenColor: '#ffffff' });
  const gold = material('Golden crown embroidery', '#f7ba19', { roughness: 0.8 });
  const blue = material('Hood cotton', '#3479cb', { roughness: 0.92, bumpMap: texture, bumpScale: 0.003, side: THREE.DoubleSide });
  const seam = material('Hood seams', '#2864a8', { roughness: 0.95 });
  const capCloth = material('Cap cotton', '#3479cb', { roughness: 0.92, bumpMap: texture, bumpScale: 0.003, side: THREE.DoubleSide });
  const capSeam = material('Cap seams', '#2864a8', { roughness: 0.95 });
  const bandCloth = material('Sports headband', '#ee3024', { roughness: 0.94, bumpMap: texture, bumpScale: 0.004, side: THREE.DoubleSide });
  const wristCloth = material('Sports wristbands', '#ee3024', { roughness: 0.94, bumpMap: texture, bumpScale: 0.004, side: THREE.DoubleSide });
  const lapel = material('Tropical folded collar', '#3479cb', { roughness: 0.92, bumpMap: texture, bumpScale: 0.003, side: THREE.DoubleSide });

  const hood = tops.hoodie.group, hoodFront = clothFront(tops.hoodie.garment.geometry);
  mesh(hood, 'Lowered hood', surface((u, v) => {
    const a = u * Math.PI * 2, r = Math.cos(v * Math.PI / 2), back = (Math.cos(a) + 1) / 2;
    return [-Math.sin(a) * 0.50 * r, (1.94 - 0.16 * back) * (1 - v) + 1.40 * v, (-0.30 - Math.cos(a) * 0.30) * r - 0.58 * (1 - r)];
  }, 64, 32), blue);
  curve(hood, 'Hood rolled opening', Array.from({ length: 64 }, (_, i) => {
    const a = i / 64 * Math.PI * 2; return [-Math.sin(a) * 0.50, 1.94 - 0.08 * (Math.cos(a) + 1), -0.30 - Math.cos(a) * 0.30];
  }), 0.031, blue, true, 80);
  const pocket = new THREE.Shape();
  pocket.moveTo(-0.25, 1.37); pocket.quadraticCurveTo(0, 1.34, 0.25, 1.37);
  pocket.lineTo(0.37, 1.12); pocket.quadraticCurveTo(0, 1.06, -0.37, 1.12); pocket.closePath();
  const pocketDepth = (x, y) => hoodFront(x, y) + 0.018;
  patch(hood, 'Kangaroo pocket', pocket, blue, pocketDepth, 18);
  curve(hood, 'Pocket binding', pocket.getPoints(24).slice(0, -1).map(p => [p.x, p.y, pocketDepth(p.x, p.y) + 0.002]), 0.007, seam, true, 80);
  for (const sign of [-1, 1]) {
    curve(hood, 'Cream drawstring', [[sign * 0.23, 1.72, 0.40], [sign * 0.24, 1.61, 0.49], [sign * 0.22, 1.48, hoodFront(sign * 0.22, 1.48) + 0.026]], 0.012, cream, false, 32);
    ellipsoid(hood, 'Drawstring tip', cream, [sign * 0.22, 1.465, hoodFront(sign * 0.22, 1.48) + 0.027], [0.016, 0.035, 0.016], 0.8, 20);
  }
  crown(hood, cream, 1.47, (x, y) => hoodFront(x, y) + 0.005, 0.145);
  const cap = backwardCap(head, capCloth, cream, capSeam);

  const tropical = tops.tropical.group, tropicalFront = clothFront(tops.tropical.garment.geometry);
  const flowers = floralTexture(); tops.tropical.cloth.map = flowers.texture; tops.tropical.cloth.needsUpdate = true;
  for (const sign of [-1, 1]) {
    const collar = new THREE.Shape();
    collar.moveTo(sign * 0.32, 1.72); collar.lineTo(sign * 0.08, 1.60);
    collar.quadraticCurveTo(sign * 0.13, 1.53, sign * 0.26, 1.44);
    collar.lineTo(sign * 0.42, 1.62); collar.closePath();
    // Top collar corners rise out of the neckline, then fold onto the chest.
    const collarDepth = (x, y) => tropicalFront(x, Math.min(y, 1.62)) + 0.025 - Math.max(0, y - 1.62) * 0.95;
    patch(tropical, 'Folded resort collar', collar, lapel, collarDepth, 18);
    curve(tropical, 'Collar edge stitch', collar.getPoints(20).slice(0, -1).map(p => [p.x, p.y, collarDepth(p.x, p.y) + 0.003]), 0.005, tops.tropical.trim, true, 64);
  }
  curve(tropical, 'Button placket', [1.07, 1.20, 1.35, 1.48].map(y => [0, y, tropicalFront(0, y) + 0.006]), 0.011, lapel, false, 40);
  for (const y of [1.14, 1.32, 1.49]) ellipsoid(tropical, 'Ivory shirt button', cream, [0, y, tropicalFront(0, y) + 0.019], [0.023, 0.023, 0.009], 1, 20);

  const sports = new THREE.Group(); sports.name = 'outfit:sports-headband'; head.add(sports);
  const headPoint = (a, y, ease = 0.018) => {
    const d = headDimensions(y);
    return [-signedPower(Math.cos(a), 0.88) * (d.width + ease), y, signedPower(Math.sin(a), 0.88) * (d.depth + ease) + d.z];
  };
  mesh(sports, 'Sports headband', surface((u, v) => headPoint(u * Math.PI * 2, 0.54 - v * 0.13), 96, 12), bandCloth);
  for (const y of [0.435, 0.515]) curve(sports, 'Headband ivory piping', Array.from({ length: 96 }, (_, i) => headPoint(i / 96 * Math.PI * 2, y, 0.021)), 0.008, cream, true, 112);
  const wrists = arms.map(arm => {
    const band = new THREE.Group(); band.name = 'outfit:sports-wristband'; arm.add(band);
    for (const long of [false, true]) {
      const fit = new THREE.Group(); fit.name = long ? 'Long sleeve wrist fit' : 'Bare wrist fit'; band.add(fit);
      const top = long ? -0.77 : -0.62, height = long ? 0.09 : 0.12;
      const radius = y => Math.sqrt(1 - ((y + 0.43) / 0.57) ** 2) ** 0.68;
      mesh(fit, 'Wrist sweatband', surface((u, v) => {
        const a = u * Math.PI * 2, y = top - v * height, r = radius(y);
        return [-Math.cos(a) * (0.215 * r + 0.013), y, Math.sin(a) * (0.23 * r + 0.013) + 0.025];
      }, 48, 12), wristCloth);
      const y = top - height / 2, r = radius(y);
      ovalRing(fit, 'Wristband white stripe', cream, 0.215 * r + 0.015, 0.23 * r + 0.015, y, 0.006, 0.025);
    }
    return band;
  });
  const sportFront = clothFront(tops.sport.garment.geometry);
  crown(tops.sport.group, gold, 1.40, (x, y) => sportFront(x, y) + 0.005, 0.20);
  ovalRing(tops.sport.group, 'Jersey double hem', tops.sport.trim, 0.794, 0.58, 1.066, 0.010, -0.01);

  return {
    cap, sports, wrists,
    setHeadwear(id) { cap.visible = id === 'cap'; sports.visible = id === 'band'; },
    setWristbands(value, longSleeves = false) {
      wrists.forEach(w => {
        w.visible = value;
        w.getObjectByName('Long sleeve wrist fit').visible = longSleeves;
        w.getObjectByName('Bare wrist fit').visible = !longSleeves;
      });
    },
    setHeadwearColor(id, value) {
      if (id === 'cap') { capCloth.color.set(value); capSeam.color.set(value).multiplyScalar(0.75); }
      if (id === 'band') bandCloth.color.set(value);
    },
    setWristColor(value) { wristCloth.color.set(value); },
    setColor(id, value) {
      if (id === 'hoodie') { blue.color.set(value); seam.color.set(value).multiplyScalar(0.75); }
      if (id === 'tropical') { tops.tropical.cloth.color.set('#ffffff'); flowers.recolor(value); lapel.color.set(value).multiplyScalar(0.95); }
    },
    dispose() { flowers.texture.dispose(); },
  };
}
