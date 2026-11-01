import * as THREE from 'three';

// A one-draw stand-in for an animated, rigid-jointed model (the studio pana
// with whatever it carries) when it is far from the camera. Every mesh visible
// under `root` at build time is merged into one SkinnedMesh: each vertex is
// weighted fully to its nearest ancestor in `pivots` (body, head, arms, legs,
// a held prop...), so the low-detail copy follows the same animation the full
// model gets, with one shared vertex-coloured material. Skinned and morphed
// parts are frozen in their current pose and ride their parent pivot.
// `cell` (in root units) welds vertices closer than that into one (vertex
// clustering), so the far copy also has fewer triangles; 0 keeps them all.
//
//   const lod = createRigLod(root, { pivots: [avatar.body, avatar.head, ...avatar.arms, ...avatar.legs], cell: .03 });
//   lod.setFar(chooseFar(lod.far, distance, { far: 55, near: 47 }));   // lod-band.js
//
// setFar swaps which copy the camera draws (the full meshes go to no layer, so
// code that toggles their `visible` keeps working); it costs nothing per frame
// while the choice stays. A pivot that is hidden (or inside a hidden group)
// collapses its part of the far copy. Meshes hidden at build time (a dizzy
// effect, an open mouth's teeth) are left out of it and not drawn while far,
// so a far model is always one draw; list in `keep` what must still show.
// Build it before tinting materials per frame: the colours are baked; tint
// `lod.material` (color, emissive) for the far copy instead. Rebuild it after
// changing the model's outfit.
const skip = mt => !mt || mt.visible === false || (mt.transparent && mt.opacity < .6) || !mt.color;
const SPAN = 2048, HALF = 1024;

export function createRigLod(root, { pivots = [], cell = 0, roughness = .8, keep = [] } = {}) {
  root.updateMatrixWorld(true);
  const bones = [root, ...pivots.filter(p => p && p !== root)];
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const toRoot = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3();
  const v = new THREE.Vector3(), n = new THREE.Vector3(), tint = new THREE.Color();
  const position = [], normal = [], color = [], bone = [], sources = [], hidden = [];
  const shown = o => { for (; o && o !== root; o = o.parent) if (!o.visible) return false; return true; };
  const kept = o => { for (; o && o !== root; o = o.parent) if (keep.includes(o)) return true; return false; };
  let shadows = false;

  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || kept(o)) return;
    const g = o.geometry, at = g.attributes, materials = [o.material].flat();
    if (!shown(o)) { hidden.push(o); return; }
    if (!at.position || materials.every(skip)) return;
    let p = o.parent, pivot = 0;
    for (; p; p = p.parent) { const i = bones.indexOf(p); if (i >= 0) { pivot = i; break; } }
    sources.push(o); shadows ||= o.castShadow;
    toRoot.multiplyMatrices(rootInverse, o.matrixWorld); normalMatrix.getNormalMatrix(toRoot);
    const posed = o.isSkinnedMesh || g.morphAttributes.position?.length;
    const index = g.index, total = index ? index.count : at.position.count;
    const start = g.drawRange.start, end = Math.min(total, start + g.drawRange.count);
    const groups = Array.isArray(o.material) && g.groups.length ? g.groups : [{ start: 0, count: Infinity, materialIndex: 0 }];
    // This mesh's triangles in root space, before welding.
    const mp = [], mn = [], mc = [];
    for (const group of groups) {
      const mt = materials[group.materialIndex] ?? materials[0];
      if (skip(mt)) continue;
      const from = Math.max(start, group.start), to = Math.min(end, group.start + group.count);
      for (let k = from; k + 2 < to; k += 3) {
        for (let j = 0; j < 3; j++) {
          const i = index ? index.getX(k + j) : k + j;
          if (posed) o.getVertexPosition(i, v); else v.fromBufferAttribute(at.position, i);
          v.applyMatrix4(toRoot); mp.push(v.x, v.y, v.z);
          if (at.normal) n.fromBufferAttribute(at.normal, i).applyMatrix3(normalMatrix).normalize(); else n.set(0, 1, 0);
          mn.push(n.x, n.y, n.z);
          tint.copy(mt.color);
          if (mt.vertexColors && at.color) { tint.r *= at.color.getX(i); tint.g *= at.color.getY(i); tint.b *= at.color.getZ(i); }
          mc.push(tint.r, tint.g, tint.b);
        }
      }
    }
    weld(mp, mn, mc, cell, pivot);
  });

  // Vertex clustering per mesh, so a shirt never welds onto the fur under it.
  function weld(mp, mn, mc, size, pivot) {
    const count = mp.length / 3;
    if (!(size > 0)) { push(mp, mn, mc, null, pivot); return; }
    const clusters = new Map(), id = new Int32Array(count), sums = [];
    for (let i = 0; i < count; i++) {
      const x = Math.floor(mp[i * 3] / size) + HALF, y = Math.floor(mp[i * 3 + 1] / size) + HALF, z = Math.floor(mp[i * 3 + 2] / size) + HALF;
      const key = (x * SPAN + y) * SPAN + z;
      let c = clusters.get(key);
      if (c === undefined) { c = sums.length / 4; clusters.set(key, c); sums.push(0, 0, 0, 0); }
      id[i] = c; sums[c * 4] += mp[i * 3]; sums[c * 4 + 1] += mp[i * 3 + 1]; sums[c * 4 + 2] += mp[i * 3 + 2]; sums[c * 4 + 3]++;
    }
    for (let i = 0; i < count; i++) { const c = id[i] * 4; mp[i * 3] = sums[c] / sums[c + 3]; mp[i * 3 + 1] = sums[c + 1] / sums[c + 3]; mp[i * 3 + 2] = sums[c + 2] / sums[c + 3]; }
    push(mp, mn, mc, id, pivot);
  }
  function push(mp, mn, mc, id, pivot) {
    for (let t = 0; t < mp.length / 9; t++) {
      const a = t * 3;
      // A triangle whose corners welded together has no area left: drop it.
      if (id && (id[a] === id[a + 1] || id[a + 1] === id[a + 2] || id[a] === id[a + 2])) continue;
      for (let j = a * 3; j < a * 3 + 9; j++) { position.push(mp[j]); normal.push(mn[j]); color.push(mc[j]); }
      bone.push(pivot, 0, 0, 0, pivot, 0, 0, 0, pivot, 0, 0, 0);
    }
  }

  const geometry = new THREE.BufferGeometry(), vertices = position.length / 3;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(bone, 4));
  const weight = new Float32Array(vertices * 4); for (let i = 0; i < weight.length; i += 4) weight[i] = 1;
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(weight, 4));
  geometry.computeBoundingSphere();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0 });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = 'Far copy'; mesh.visible = false; mesh.castShadow = shadows;
  root.add(mesh);
  const skeleton = new THREE.Skeleton(bones); mesh.bind(skeleton);
  // Joints swing parts (an arm with a launcher) outside the build pose's bounds.
  mesh.boundingSphere = geometry.boundingSphere.clone(); mesh.boundingSphere.radius *= 1.6;
  const update = skeleton.update.bind(skeleton);
  skeleton.update = () => {
    update();
    for (let i = 1; i < bones.length; i++) if (!shown(bones[i])) skeleton.boneMatrices.fill(0, i * 16, i * 16 + 16);
  };
  const swapped = [...sources, ...hidden], masks = swapped.map(o => o.layers.mask);
  let far = false;
  return {
    mesh, material, triangles: vertices / 3, sources: sources.length,
    get far() { return far; },
    setFar(on) {
      on = !!on; if (on === far) return; far = on; mesh.visible = on;
      swapped.forEach((o, i) => { o.layers.mask = on ? 0 : masks[i]; });
    },
    dispose() {
      this.setFar(false); mesh.removeFromParent(); geometry.dispose(); material.dispose(); skeleton.dispose();
    },
  };
}
