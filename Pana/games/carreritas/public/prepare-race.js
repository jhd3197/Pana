// Prepare GPU resources behind the loading cover, yielding between uploads.
// Keep this race-local: the garage must not load or warm an entire circuit.
import * as THREE from 'three';
import { prepareImpostors } from '/engine/models/core/impostor.js';
const prepared = new WeakMap();

export async function prepareRace(renderer, scene, cameras, step) {
  cameras = [].concat(cameras); const camera = cameras[0];
  if (!prepared.has(renderer)) prepared.set(renderer, new WeakMap());
  const warmed = prepared.get(renderer);
  // Bake impostor atlases (distant trees, rival panas) first so they upload like any texture.
  prepareImpostors(renderer);
  const textures = new Set(), objects = [];
  scene.updateMatrixWorld(true);
  const frusta = cameras.map(view => {
    view.updateMatrixWorld(true);
    return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(view.projectionMatrix, view.matrixWorldInverse));
  });
  const shadows = [], shadowLights = [];
  if (renderer.shadowMap.enabled) scene.traverseVisible(o => {
    if (o.isDirectionalLight && o.castShadow) { o.shadow.updateMatrices(o); shadows.push(o.shadow.getFrustum().clone()); shadowLights.push(o.shadow); }
  });
  const intersects = (f, o) => o.isSprite ? f.intersectsSprite(o) : f.intersectsObject(o);
  const needed = o => !o.frustumCulled || frusta.some(f => intersects(f, o)) || (o.castShadow && shadows.some(f => intersects(f, o)));
  const take = value => {
    if (Array.isArray(value)) value.forEach(take);
    else if (value?.isTexture && !value.isRenderTargetTexture && value.image) textures.add(value);
  };
  scene.traverseVisible(object => {
    if (!object.material) return;
    objects.push(object);
    if (!needed(object)) return;
    for (const material of [].concat(object.material)) {
      Object.values(material).forEach(take);
      Object.values(material.uniforms || {}).forEach(uniform => take(uniform.value));
    }
  });
  if (!await step('Preparando las texturas…', 0.82)) return false;
  await Promise.allSettled([...textures].filter(t => t.image instanceof HTMLImageElement).map(t => t.image.decode()));
  if (!await step('Subiendo las texturas…', 0.82)) return false;
  let uploaded = 0, uploadStart = performance.now();
  for (const texture of textures) {
    // An unavailable image keeps Three's fallback rather than blocking entry.
    if (!(texture.image instanceof HTMLImageElement) || texture.image.naturalWidth) renderer.initTexture(texture);
    uploaded++;
    if (performance.now() - uploadStart >= 6) {
      if (!await step(`Preparando las texturas… ${uploaded}/${textures.size}`, 0.82 + 0.04 * uploaded / textures.size)) return false;
      uploadStart = performance.now();
    }
  }
  if (!await step('Preparando los gráficos…', 0.87)) return false;
  await renderer.compileAsync(scene, camera);
  // Warm both starting views and their shadow casters. Compiling every shader
  // above is cheap compared with uploading an entire distant forest up front.
  // Layer masks let a parent mesh's children warm independently, without making
  // hidden wardrobe/gameplay objects visible.
  const signature = o => [o.geometry?.id, renderer.shadowMap.enabled, ...[].concat(o.material).map(m => `${m.id}:${m.version}`)].join('|');
  const pending = objects.filter(o => needed(o) && warmed.get(o) !== signature(o));
  const batch = 48, scissor = new THREE.Vector4();
  for (let start = 0; start < pending.length; start += batch) {
    if (!await step('Preparando el paisaje…', 0.89 + 0.09 * start / pending.length)) return false;
    const slice = new Set(pending.slice(start, start + batch));
    const state = objects.map(o => [o.layers.mask, o.frustumCulled]);
    const scissorTest = renderer.getScissorTest(); renderer.getScissor(scissor);
    const shadowUpdate = renderer.shadowMap.needsUpdate, lightUpdates = shadowLights.map(s => s.needsUpdate);
    try {
      objects.forEach((o, i) => {
        o.layers.mask = slice.has(o) ? state[i][0] : 0;
        o.frustumCulled = false;
      });
      // The cover hides these partial draws; one pixel avoids shading the whole
      // screen while retaining the real canvas shader/output configuration.
      renderer.setScissor(0, 0, 1, 1); renderer.setScissorTest(true);
      renderer.shadowMap.needsUpdate = true; shadowLights.forEach(s => { s.needsUpdate = true; });
      renderer.render(scene, camera);
      slice.forEach(o => warmed.set(o, signature(o)));
    } finally {
      objects.forEach((o, i) => { [o.layers.mask, o.frustumCulled] = state[i]; });
      renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
      renderer.shadowMap.needsUpdate = shadowUpdate; shadowLights.forEach((s, i) => { s.needsUpdate = lightUpdates[i]; });
    }
    // All scene/renderer state is restored BEFORE yielding: cancellation can
    // dispose racers or start another load at the next step.
  }
  if (!await step('Todo listo. ¡A correr!', 0.99)) return false;
  renderer.shadowMap.needsUpdate = true;
  shadowLights.forEach(s => { s.needsUpdate = true; });
  renderer.render(scene, camera);
  return true;
}
