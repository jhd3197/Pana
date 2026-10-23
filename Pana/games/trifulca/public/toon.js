// Ink-outline pilot: inverted-hull outlines — a BackSide copy of each mesh,
// pushed out along its normals — for trifulca's props. SkinnedMesh bodies are
// skipped: a hull would need to share the skeleton, not worth it for the
// pilot. Every hull shares ONE material (a hull adds a draw call, never a
// program) and reuses the source geometry, so model disposal is unchanged.
// ?ink=0 turns the pilot off.
import * as THREE from 'three';

export const inkOn = new URLSearchParams(location.search).get('ink') !== '0';
let shared = null;

function material(color, thickness) {
  if (!shared) {
    shared = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    shared.name = 'ink-outline';
    shared.onBeforeCompile = (shader) => {
      shader.uniforms.inkThickness = { value: thickness };
      // MeshBasicMaterial has no beginnormal_vertex, so displace along the
      // always-declared `normal` attribute (object space, before skinning).
      shader.vertexShader = 'uniform float inkThickness;\n' + shader.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed += normal * inkThickness;');
    };
  }
  return shared;
}

// Adds a hull child to every regular mesh under object3D. `only` selects which
// meshes get inked (dense sets like the tent's truss stay clean).
export function inkOutlines(object3D, { color = 0x1a1210, thickness = 0.012, only = null } = {}) {
  if (!inkOn) return object3D;
  const mat = material(color, thickness);
  const meshes = [];
  object3D.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && !o.userData.inkHull && (!only || only(o))) meshes.push(o); });
  for (const mesh of meshes) {
    const hull = new THREE.Mesh(mesh.geometry, mat);
    hull.name = 'ink'; hull.userData.inkHull = true;
    mesh.add(hull);
  }
  return object3D;
}
