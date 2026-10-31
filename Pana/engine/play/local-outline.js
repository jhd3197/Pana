// Marks the local player's own pana: a soft inverted-hull outline that follows the
// animated pose, plus a small bobbing marker above the head for when it is hidden.
import * as THREE from 'three';

const TAG = 'panaLocalOutline';

function eligible(o) {
  if (!o.isMesh || o.isInstancedMesh || o.userData[TAG]) return false;
  const g = o.geometry;
  if (!g?.attributes?.position || !g.attributes.normal || g.drawRange.count === 0) return false;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  return mats.every(m => m && m.visible !== false && !(m.transparent && m.opacity < 1) && m.blending !== THREE.AdditiveBlending);
}

// One shared BackSide material, pushed out along the bind-pose normal before
// skinning runs, so the hull bends with the bones.
function hullMaterial(color, uniform) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, toneMapped: false, fog: false });
  m.onBeforeCompile = shader => {
    shader.uniforms.uThickness = uniform;
    shader.vertexShader = 'uniform float uThickness;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      'vec3 transformed = vec3(position) + normalize(vec3(normal)) * uThickness;');
  };
  m.customProgramCacheKey = () => TAG;
  return m;
}

export function createLocalOutline(characterGroup, { color = '#ffc629', thickness = 0.09 } = {}) {
  const uniform = { value: thickness }, material = hullMaterial(color, uniform), pairs = [];
  const sources = [];
  characterGroup.traverse(o => { if (eligible(o) && o.parent) sources.push(o); });
  for (const src of sources) {
    const hull = src.isSkinnedMesh ? new THREE.SkinnedMesh(src.geometry, material) : new THREE.Mesh(src.geometry, material);
    if (src.isSkinnedMesh) { hull.bindMode = src.bindMode; hull.bind(src.skeleton, src.bindMatrix); }
    hull.position.copy(src.position); hull.quaternion.copy(src.quaternion); hull.scale.copy(src.scale);
    hull.matrixAutoUpdate = src.matrixAutoUpdate;
    if (!src.matrixAutoUpdate) hull.matrix.copy(src.matrix);
    hull.frustumCulled = false; hull.castShadow = hull.receiveShadow = false;
    hull.renderOrder = src.renderOrder - 1; hull.visible = src.visible; hull.userData[TAG] = true;
    src.parent.add(hull); pairs.push([src, hull]);
  }
  let time = 0;
  return {
    update(dt = 0) {
      time += dt;
      uniform.value = thickness * (1 + .12 * Math.sin(time * 2.2));
      for (const [src, hull] of pairs) hull.visible = src.visible;
    },
    // The geometry belongs to the source mesh; only the hull material is ours.
    dispose() { for (const [, hull] of pairs) hull.removeFromParent(); pairs.length = 0; material.dispose(); },
  };
}

export function createLocalMarker({ color = '#ffc629' } = {}) {
  const group = new THREE.Group(), material = new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
  const tip = new THREE.Mesh(new THREE.ConeGeometry(.13, .24, 4), material);
  tip.rotation.x = Math.PI; tip.renderOrder = 999; tip.userData[TAG] = true; group.add(tip);
  let time = 0;
  return {
    group,
    update(dt = 0) { time += dt; tip.position.y = Math.sin(time * 3) * .05; tip.rotation.y = time * 1.5; },
    dispose() { group.removeFromParent(); tip.geometry.dispose(); material.dispose(); },
  };
}
