import * as THREE from 'three';
// Factories own geometry, but many cache materials. Give this arena its own
// materials so disposing or changing rounds cannot invalidate another scene.
export function createAssetPlacement() {
  const materials = new Map();
  return (parent, model, {at=[0,0,0], scale=1, yaw=0, id=model.name}={}) => {
    const own = material => {
      if (!materials.has(material)) {
        const copy=material.clone();
        copy.onBeforeCompile=material.onBeforeCompile;
        copy.customProgramCacheKey=material.customProgramCacheKey;
        materials.set(material,copy);
      }
      return materials.get(material);
    };
    model.traverse(node=>{
      if(node.material)node.material=Array.isArray(node.material)?node.material.map(own):own(node.material);
    });
    model.position.fromArray(at);model.rotation.y=yaw;model.scale.multiplyScalar(scale);
    model.userData.assetId=id;parent.add(model);return model;
  };
}

// Math the arenas share. Their own seeded stream and value noise (not
// engine/random.js's), so each arena's scenery stays exactly as built.
export const PI = Math.PI, TAU = PI * 2, V3 = (x, y, z) => new THREE.Vector3(x, y, z), col = c => new THREE.Color(c);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function stageRandom(seed) {
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  return { rand, rr: (a, b) => a + rand() * (b - a), pick: a => a[(rand() * a.length) | 0] };
}
export const ih = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
export const noise2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(ih(xi, yi), ih(xi + 1, yi), u), lerp(ih(xi, yi + 1), ih(xi + 1, yi + 1), u), v); };
export const fbm = (x, y, o = 4) => { let s = 0, a = 0.5, f = 1; for (let k = 0; k < o; k++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; } return s / (1 - Math.pow(0.5, o)); };
