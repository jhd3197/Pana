import * as THREE from 'three';
import { curve, ellipsoid, fingerprint, mesh, ovalRing, patch, readFit, surface, writeFit } from '/engine/models/characters/pana/geometry.js';
import { gameDetail } from '/engine/models/characters/pana/detail.js';

// Avatar colors do not change torso geometry. Reuse the expensive depth sample
// per tessellation profile; each character still owns its meshes and skeleton.
const depthGrids = new Map(), depthKeys = new Map();
// The neck strap's fit (rays around the torso) is likewise the same for every
// pana of a profile; with it kept, the ray proxies are built only on a miss.
const strapFits = new Map();

// The apron follows the belly rather than sitting on a flat plane in front of it.
function apronDepth(x, y) {
  const taper = 1 - 0.14 * (y - 1.13) / 0.72;
  const q = (x / (0.77 * taper)) ** 2 + ((y - 1.13) / 0.72) ** 2;
  const ease = 0.025 + 0.055 * (1 - THREE.MathUtils.smoothstep(y, 0.76, 1.18));
  return -0.015 + 0.54 * Math.sqrt(Math.max(0.025, 1 - q)) + ease;
}

// A fingerprint of the surfaces the depth grid is cast on (and where they sit).
const fitKey = (profile, proxies) => 'depth|' + profile + '|' + proxies.map(p => fingerprint(p.geometry.attributes.position.array) + '@' + fingerprint(p.matrixWorld.elements)).join('|');

// Fit once against the actual fuller torso. A small depth grid is reused by
// the apron, pocket and stitches, so no raycasting is needed during animation.
function fitBody(body, foundation) {
  let material = null, fitGeometry = null, proxies = null;
  const proxiesOnce = () => {
    if (proxies) return proxies;
    material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    fitGeometry = foundation.createFitGeometry();
    return proxies = [foundation.garment, body.getObjectByName('Continuous belly and legs'), body.getObjectByName('Neck')].map(source => {
      const proxy = new THREE.Mesh(source === foundation.garment ? fitGeometry : source.geometry, material);
      proxy.position.copy(source.position); proxy.quaternion.copy(source.quaternion);
      proxy.updateMatrixWorld(true); return proxy;
    });
  };
  const profile = gameDetail() ? 'game' : 'studio';
  const ray = new THREE.Raycaster(), nx = 30, ny = 36, minX = -0.74, minY = 0.69, width = 1.48, height = 1.35, depths = depthGrids.get(profile) || [];
  if (!depths.length) {
    // Between pages the grid is kept against a fingerprint of the surfaces it is cast on.
    const key = fitKey(profile, proxiesOnce()); depthKeys.set(profile, key); const saved = readFit(key, (nx + 1) * (ny + 1));
    if (saved) depths.push(...saved);
    else {
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
        const x = minX + i / nx * width, y = minY + j / ny * height;
        ray.set(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1));
        const hit = ray.intersectObjects(proxiesOnce(), false).find(h => h.point.z > 0);
        depths.push(hit ? hit.point.z : apronDepth(x, y) - 0.025);
      }
      writeFit(key, depths);
    }
  }
  depthGrids.set(profile, depths);
  let level = null;
  return {
    profile, key: depthKeys.get(profile) || '',
    front(x, y) {
      const gx = THREE.MathUtils.clamp((x - minX) / width * nx, 0, nx - 0.00001);
      const gy = THREE.MathUtils.clamp((y - minY) / height * ny, 0, ny - 0.00001);
      const i = Math.floor(gx), j = Math.floor(gy), u = gx - i, v = gy - j;
      const at = (a, b) => depths[THREE.MathUtils.clamp(b, 0, ny) * (nx + 1) + THREE.MathUtils.clamp(a, 0, nx)];
      const cubic = (a, b, c, d, t) => b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
      const row = b => cubic(at(i - 1, b), at(i, b), at(i + 1, b), at(i + 2, b), u);
      return cubic(row(j - 1), row(j), row(j + 1), row(j + 2), v);
    },
    around(x, y, z) {
      const direction = new THREE.Vector3(x, 0, z).normalize();
      ray.set(new THREE.Vector3(direction.x * 2, y, direction.z * 2), direction.clone().negate());
      level ??= levelIndex(proxiesOnce());
      const hit = level(ray.ray);
      return hit ? hit.addScaledVector(direction, 0.019) : new THREE.Vector3(x, y, z);
    },
    dispose() { material?.dispose(); fitGeometry?.dispose(); },
  };
}

// around() casts only level rays, hundreds per outfit: testing every proxy
// triangle made the apron fit most of a pana's build. Triangles are binned
// once by world height; each ray tests its slab in the proxy's own space, as
// Mesh.raycast does, so hits match Raycaster's exactly (nearest, first wins).
const SLAB = 0.02;
function levelIndex(proxies) {
  const slabs = new Map(), P = new THREE.Vector3(), Q = new THREE.Vector3(), R = new THREE.Vector3();
  proxies.forEach((proxy, k) => {
    const pos = proxy.geometry.attributes.position, idx = proxy.geometry.index, count = idx ? idx.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
      P.fromBufferAttribute(pos, a).applyMatrix4(proxy.matrixWorld); Q.fromBufferAttribute(pos, b).applyMatrix4(proxy.matrixWorld); R.fromBufferAttribute(pos, c).applyMatrix4(proxy.matrixWorld);
      for (let j = Math.floor(Math.min(P.y, Q.y, R.y) / SLAB); j <= Math.floor(Math.max(P.y, Q.y, R.y) / SLAB); j++) {
        if (!slabs.has(j)) slabs.set(j, []); slabs.get(j).push([k, a, b, c]);
      }
    }
  });
  const inverse = proxies.map(p => p.matrixWorld.clone().invert()), local = new THREE.Ray(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), hit = new THREE.Vector3();
  return ray => {
    let best = null, nearest = Infinity;
    for (const [k, a, b, c] of slabs.get(Math.floor(ray.origin.y / SLAB)) ?? []) {
      const proxy = proxies[k], pos = proxy.geometry.attributes.position;
      local.copy(ray).applyMatrix4(inverse[k]);
      A.fromBufferAttribute(pos, a); B.fromBufferAttribute(pos, b); C.fromBufferAttribute(pos, c);
      if (!local.intersectTriangle(A, B, C, proxy.material.side === THREE.FrontSide, hit)) continue;
      const point = hit.clone().applyMatrix4(proxy.matrixWorld), distance = ray.origin.distanceTo(point);
      if (distance < nearest) { nearest = distance; best = point; }
    }
    return best;
  };
}

function ribbon(parent, name, points, width, material) {
  const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const positions = [], indices = [], uvs = [], steps = 80;
  for (let i = 0; i <= steps; i++) {
    const p = path.getPoint(i / steps), tangent = path.getTangent(i / steps);
    const normal = new THREE.Vector3(p.x, 0.08, p.z).normalize();
    const across = new THREE.Vector3().crossVectors(tangent, normal).normalize().multiplyScalar(width / 2);
    positions.push(...p.clone().sub(across).toArray(), ...p.clone().add(across).toArray());
    uvs.push(0, i / steps, 1, i / steps);
    if (i < steps) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices); g.computeVertexNormals();
  return mesh(parent, name, g, material);
}

function chefBadge(parent, name, material, x, y, size, depthAt) {
  const shape = new THREE.Shape();
  const point = (px, py) => [x + px * size, y + py * size];
  const bezier = (...p) => shape.bezierCurveTo(...point(p[0], p[1]), ...point(p[2], p[3]), ...point(p[4], p[5]));
  shape.moveTo(...point(-0.48, -0.5)); shape.lineTo(...point(0.48, -0.5));
  shape.lineTo(...point(0.49, 0.05));
  bezier(1.1, 0.04, 1.02, 0.75, 0.51, 0.65);
  bezier(0.44, 1.17, -0.44, 1.17, -0.51, 0.65);
  bezier(-1.02, 0.75, -1.1, 0.04, -0.49, 0.05);
  shape.closePath();
  return patch(parent, name, shape, material, depthAt, 12);
}

export function createChefOutfit({ body, head, material, texture, foundation }) {
  const fit = fitBody(body, foundation);
  const depthAt = (x, y) => Math.max(apronDepth(x, y), fit.front(x, y) + 0.024);
  const apron = new THREE.Group(); apron.name = 'outfit:chef-apron'; body.add(apron);
  const hat = new THREE.Group(); hat.name = 'outfit:chef-hat'; head.add(hat);
  const cloth = material('Apron cotton', '#ee3024', { roughness: 0.94, sheen: 0.22, bumpMap: texture, bumpScale: 0.003, side: THREE.DoubleSide });
  const trim = material('Apron seams', '#d92e23', { roughness: 0.94 });
  const white = material('Chef hat cotton', '#fff8e9', { roughness: 0.92, sheen: 0.24, sheenColor: '#ffffff', bumpMap: texture, bumpScale: 0.002, side: THREE.DoubleSide });
  const whiteTrim = material('Chef hat binding', '#f2e8d6', { roughness: 0.94 });
  const emblem = material('Chef hat emblem', '#ee3024', { roughness: 0.94 });

  const outline = new THREE.Shape();
  outline.moveTo(-0.30, 1.62); outline.quadraticCurveTo(0, 1.59, 0.30, 1.62);
  outline.bezierCurveTo(0.31, 1.37, 0.46, 1.29, 0.64, 1.24);
  outline.bezierCurveTo(0.68, 1.13, 0.70, 0.92, 0.65, 0.78);
  outline.bezierCurveTo(0.42, 0.69, -0.42, 0.69, -0.65, 0.78);
  outline.bezierCurveTo(-0.70, 0.92, -0.68, 1.13, -0.64, 1.24);
  outline.bezierCurveTo(-0.46, 1.29, -0.31, 1.37, -0.30, 1.62);
  outline.closePath();
  patch(apron, 'Curved apron', outline, cloth, depthAt, 20);
  curve(apron, 'Apron edge binding', outline.getPoints(32).slice(0, -1).map(p => [p.x, p.y, depthAt(p.x, p.y) + 0.003]), 0.009, trim, true, 160);

  const neckStrap = ribbon(apron, 'Neck strap', [
    [-0.258, 1.60, 0.35], [-0.285, 1.78, 0.34], [-0.32, 1.94, 0.26],
    [-0.43, 1.96, -0.01], [-0.31, 1.94, -0.29], [0, 1.93, -0.37],
    [0.31, 1.94, -0.29], [0.43, 1.96, -0.01], [0.32, 1.94, 0.26],
    [0.285, 1.78, 0.34], [0.258, 1.60, 0.35],
  ], 0.105, cloth);
  const strapPositions = neckStrap.geometry.attributes.position, strapKey = `${fit.profile}|${fingerprint(strapPositions.array)}`;
  if (!strapFits.has(strapKey)) {
    // The strap's rays are also kept between pages; around() would build the level index.
    const fitKeyName = 'strap|' + strapKey + '|' + fit.key, saved = readFit(fitKeyName, strapPositions.array.length);
    if (saved) strapFits.set(strapKey, saved);
    else {
      for (let i = 0; i < strapPositions.count; i++) {
        const x = strapPositions.getX(i), y = strapPositions.getY(i), z = strapPositions.getZ(i);
        const p = z > 0.2 ? new THREE.Vector3(x, y, fit.front(x, y) + 0.016) : fit.around(x, y, z);
        strapPositions.setXYZ(i, p.x, p.y, p.z);
      }
      strapFits.set(strapKey, strapPositions.array.slice());
      writeFit(fitKeyName, strapPositions.array);
    }
  }
  strapPositions.array.set(strapFits.get(strapKey));
  neckStrap.geometry.computeVertexNormals();
  mesh(apron, 'Waist strap', surface((u, v) => {
    const a = u * Math.PI * 2, y = 1.17 + (0.5 - v) * 0.09;
    const x = -Math.cos(a) * 0.800;
    let z = Math.sin(a) * 0.586 - 0.015;
    if (z > 0) z = Math.min(z, depthAt(x, y) - 0.012);
    return [x, y, z];
  }, 80, 6), cloth);
  for (const sign of [-1, 1]) {
    const loop = ellipsoid(apron, 'Apron bow loop', cloth, [sign * 0.14, 1.17, -0.62], [0.16, 0.075, 0.045], 0.8, 24);
    loop.rotation.z = sign * 0.25;
    ribbon(apron, 'Apron tie end', [[sign * 0.03, 1.16, -0.625], [sign * 0.09, 1.04, -0.62], [sign * 0.17, 0.91, -0.56]], 0.075, cloth);
  }
  ellipsoid(apron, 'Apron bow knot', trim, [0, 1.17, -0.64], [0.065, 0.07, 0.04], 0.75, 24);

  const pocket = new THREE.Shape();
  pocket.moveTo(-0.29, 1.20); pocket.quadraticCurveTo(0, 1.17, 0.29, 1.20);
  pocket.lineTo(0.28, 0.97); pocket.bezierCurveTo(0.25, 0.86, -0.25, 0.86, -0.28, 0.97); pocket.closePath();
  const pocketDepth = (x, y) => depthAt(x, y) + 0.018 + 0.015 * Math.max(0, 1 - (x / 0.3) ** 2);
  patch(apron, 'Apron pocket', pocket, cloth, pocketDepth, 16);
  curve(apron, 'Pocket stitched edge', pocket.getPoints(24).slice(0, -1).map(p => [p.x, p.y, pocketDepth(p.x, p.y) + 0.004]), 0.006, trim, true, 96);
  chefBadge(apron, 'Pocket chef emblem', white, 0, 1.035, 0.105, (x, y) => pocketDepth(x, y) + 0.006);

  // A continuous lobed crown keeps the soft puff silhouette without sphere seams.
  mesh(hat, 'Toque band', surface((u, v) => {
    const a = u * Math.PI * 2, flare = 1 + 0.045 * (1 - v);
    return [-Math.cos(a) * 0.61 * flare, 1.02 - v * 0.36, Math.sin(a) * 0.46 * flare - 0.025];
  }, 80, 20), white);
  ovalRing(hat, 'Toque lower seam', whiteTrim, 0.611, 0.461, 0.662, 0.011, -0.025);
  mesh(hat, 'Soft toque crown', surface((u, v) => {
    const a = u * Math.PI * 2, t = v * Math.PI, r = Math.sin(t) ** 0.72;
    const lobes = 1 + 0.105 * Math.cos(a * 7 + 0.5) * Math.sin(t) ** 0.7;
    return [-Math.cos(a) * 0.76 * r * lobes, 1.10 + Math.cos(t) * 0.31 + 0.025 * Math.cos(a * 7 + 0.5) * r, Math.sin(a) * 0.58 * r * lobes - 0.025];
  }, 112, 48), white);
  chefBadge(hat, 'Toque colored emblem', emblem, 0, 0.823, 0.10, (x, y) => {
    const flare = 1 + 0.045 * (y - 0.66) / 0.36;
    return -0.025 + 0.46 * flare * Math.sqrt(1 - (x / (0.61 * flare)) ** 2) + 0.005;
  });

  fit.dispose();
  // These shallow cloth layers sit very close together. Lighting supplies
  // their shape without self-shadow artifacts from the thin ribbons/pocket.
  apron.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return {
    apron, hat,
    setApronVisible(value) { apron.visible = value; },
    setHatVisible(value) { hat.visible = value; },
    setHatColor(value) { emblem.color.set(value); },
    setColor(value) { cloth.color.set(value); trim.color.set(value).multiplyScalar(0.86); cloth.sheenColor.set(value).lerp(new THREE.Color('#ffffff'), 0.3); },
  };
}
