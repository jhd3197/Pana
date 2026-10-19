// A minigame's scene owns its GPU resources. The runner calls `track(scene)`
// right after create() and `release(scene, keep)` once the minigame is over.
// Objects a minigame removes mid-game (caught fruit, swept cards, fallen
// stones) are remembered, since a traversal at teardown would never reach them.
// `keep` holds geometries, materials and textures the board still draws:
// cached shared materials are fine to free (three.js uploads them again on
// next use), but freeing the board's would cost a hitch on the way back.

export function track(scene) {
  const removed = new Set();
  const { add, remove } = scene;
  scene.add = function (...objects) { for (const o of objects) removed.delete(o); return add.apply(this, objects); };
  scene.remove = function (...objects) { for (const o of objects) removed.add(o); return remove.apply(this, objects); };
  scene.userData.removed = removed;
  return scene;
}

// Every geometry, material and texture reachable from these roots.
export function resources(...roots) {
  const found = new Set();
  const material = (m) => {
    if (!m || found.has(m)) return;
    found.add(m);
    for (const v of Object.values(m)) if (v?.isTexture) found.add(v);
    for (const u of Object.values(m.uniforms || {})) for (const v of [u?.value].flat()) if (v?.isTexture) found.add(v);
  };
  for (const root of roots) {
    if (!root) continue;
    if (root.background?.isTexture) found.add(root.background);
    if (root.environment?.isTexture) found.add(root.environment);
    root.traverse((o) => {
      if (o.geometry) found.add(o.geometry);
      if (Array.isArray(o.material)) o.material.forEach(material);
      else material(o.material);
    });
  }
  return found;
}

export function release(scene, keep = new Set()) {
  const roots = [scene, ...(scene.userData.removed || [])];
  // Models that own more than they show (a pana's spare face textures, an
  // iguana's poses) free it through their own userData.dispose first.
  // Collect first: an owner may detach itself along with things hung on it.
  const owners = [], found = resources(...roots);
  for (const root of roots) root.traverse((o) => { if (o !== scene && typeof o.userData.dispose === 'function') owners.push(o); });
  for (const o of owners) o.userData.dispose();
  for (const r of found) if (!keep.has(r)) r.dispose();
  // shadow maps are render targets owned by each light
  for (const root of roots) root.traverse((o) => o.shadow?.map?.dispose());
  scene.clear();
  scene.userData.removed?.clear();
}
