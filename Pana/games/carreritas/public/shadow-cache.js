// Scenery shadows drawn once, not every frame. The sun's shadow box follows
// the player, so three.js redraws every tree, house and rock into the shadow
// map each frame: up to 3 M triangles on Chuao, nearly half the frame's.
// Here the box snaps to an 8 m grid; the track's still casters render into a
// cached depth map only when the box moves a cell or one of them changes,
// and each frame copies that depth into the real shadow map and draws only
// the moving casters (cars, items, animals) over it. The shadows look the
// same; the box just steps instead of sliding.
import * as THREE from 'three';

const CELL = 8;

export function cacheShadows(renderer, trackGroup) {
  const shadowMap = renderer.shadowMap, render = shadowMap.render, clear = renderer.clear;
  const gl = renderer.getContext(), properties = renderer.properties;
  // Casters that moved once are drawn every frame from then on; one whose
  // visibility keeps flipping (a level-of-detail swap) joins them too.
  const moving = new WeakSet(), flips = new WeakMap();
  let root = null, statics = [], others = [], stamps = [], cache = null, stale = true;
  const center = new THREE.Vector3(NaN, NaN, NaN), snap = new THREE.Vector3();
  const stats = { rebuilds: 0, frames: 0, statics: 0 };

  // What a caster's shadow depends on, as numbers compared frame to frame.
  const STAMP = 23;
  function stamp(o, out, at) {
    let shown = o.visible && o.castShadow, top = o;
    for (let p = o.parent; p; p = p.parent) { shown &&= p.visible; top = p; }
    const geometry = o.geometry, material = o.material;
    out[at] = top === root.parent && shown ? 1 : 0;
    out[at + 1] = geometry.id; out[at + 2] = geometry.attributes.position.version;
    out[at + 3] = geometry.drawRange.count; out[at + 4] = Array.isArray(material) || material.visible ? 1 : 0;
    out[at + 5] = o.instanceMatrix?.version ?? -1; out[at + 6] = o.count ?? -1;
    out.set(o.matrixWorld.elements, at + 7);
  }
  function collect() {
    statics = []; others = [];
    root.traverse(o => {
      if (!(o.isMesh || o.isPoints || o.isLine) || !o.castShadow) return;
      // Skinned and custom-depth casters can deform every frame.
      (o.isSkinnedMesh || o.customDepthMaterial || moving.has(o) ? others : statics).push(o);
    });
    stamps = new Float64Array(statics.length * STAMP);
    statics.forEach((o, i) => stamp(o, stamps, i * STAMP));
    stats.statics = statics.length;
  }
  // A still caster that changed: a move makes it dynamic for good; a shown or
  // hidden one only matters when it is inside the shadow box.
  const now = new Float64Array(STAMP);
  function check(frustum) {
    for (let i = 0; i < statics.length; i++) {
      const o = statics[i], at = i * STAMP;
      stamp(o, now, 0);
      let same = true;
      for (let k = 0; k < STAMP; k++) if (now[k] !== stamps[at + k]) { same = false; break; }
      if (same) continue;
      let moved = false;
      for (let k = 2; k < STAMP; k++) if (k !== 4 && now[k] !== stamps[at + k]) { moved = true; break; }
      const count = (flips.get(o) ?? 0) + 1; flips.set(o, count);
      if (moved || count > 4) moving.add(o);
      if (moved || o.intersectsFrustum(frustum)) stale = true;
      stamps.set(now, at);
    }
  }
  function blit() {
    const read = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, properties.get(cache).__webglFramebuffer);
    gl.blitFramebuffer(0, 0, cache.width, cache.height, 0, 0, cache.width, cache.height, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, read);
  }
  const castFor = (list, on) => { for (const o of list) o.castShadow = on; };

  shadowMap.render = function (lights, scene, camera) {
    const group = trackGroup(), sun = lights[0], shadow = sun?.shadow;
    // A one-off update (shadowMap.needsUpdate) draws the plain way.
    if (!this.enabled || !this.autoUpdate || lights.length !== 1 || !sun.isDirectionalLight
      || group?.parent !== scene || shadow.autoUpdate === false) return render.call(this, lights, scene, camera);
    // Step the box on a grid: moving light and target together keeps the
    // sun's direction, and the cached depth stays valid within a cell.
    snap.copy(sun.target.position).divideScalar(CELL).round().multiplyScalar(CELL);
    sun.position.add(snap).sub(sun.target.position); sun.target.position.copy(snap);
    sun.updateMatrixWorld(); sun.target.updateMatrixWorld();
    if (!snap.equals(center)) { center.copy(snap); stale = true; }
    if (group !== root) { root = group; stale = true; collect(); }
    // Without a shadow map yet (first frame, new size) draw the plain way.
    const real = shadow.map;
    if (!real) { stale = true; return render.call(this, lights, scene, camera); }
    if (!cache || cache.width !== real.width || cache.height !== real.height) {
      cache?.dispose();
      cache = new THREE.WebGLRenderTarget(real.width, real.height);
      cache.depthTexture = new THREE.DepthTexture(real.width, real.height, THREE.UnsignedIntType);
      stale = true;
    }
    shadow.updateMatrices(sun);
    check(shadow.getFrustum(0));
    if (stale) {
      collect();
      castFor(others, false);
      shadow.map = cache;
      try { render.call(this, lights, root, camera); } finally { shadow.map = real; castFor(others, true); }
      stale = false; stats.rebuilds++;
    }
    castFor(statics, false);
    renderer.clear = function (...args) { clear.apply(this, args); blit(); };
    try { render.call(this, lights, scene, camera); } finally { renderer.clear = clear; castFor(statics, true); }
    stats.frames++;
  };
  return {
    stats,
    dispose() { shadowMap.render = render; cache?.dispose(); cache = null; },
  };
}
