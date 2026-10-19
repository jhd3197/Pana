import * as THREE from 'three';
import { createArenaSlot } from '/engine/arenas.js';
import { createPlazaProp } from '/engine/models/props/plaza.js';
import { bake } from '/engine/models/core/static-batch.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { huntLayout, mapData, SPREAD } from './layout.js';

// Landmarks stay mounted between rounds. Only the shuffled props are rebuilt.
export function createHuntEnvironment(scene) {
  // Every map plays 1.5× larger: the plaza model scales whole, arenas spread.
  const arena = createArenaSlot(scene, { mode: 'hunt', props: [], plazaScale: SPREAD, size: 18 * SPREAD, cover: id => mapData(id).cover });
  let key, props;
  return {
    setMap(id = 'plaza', seed = 1) {
      const next = `${id}:${seed}`; if (next === key) return;
      const layout = huntLayout(id, seed), source = new THREE.Group();
      for (const p of layout.props) {
        const object = createPlazaProp(p.type); object.position.set(p.x, 0, p.z); object.rotation.y = p.h; source.add(object);
      }
      const batch = bake(source), geometries = new Set(), materials = new Map();
      source.traverse(o => { if (o.geometry) geometries.add(o.geometry); }); geometries.forEach(g => g.dispose());
      batch.traverse(o => { if (o.material) {
        const own = m => { if (!materials.has(m)) materials.set(m, m.clone()); return materials.get(m); };
        o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
      } });
      if (props) disposeModel(props);
      props = batch; props.name = 'Objetos de la ronda';
      props.userData.placements = layout.props.map(p => ({ ...p }));
      arena.setMap(id); scene.add(props); scene.userData.layoutSeed = seed; key = next;
    },
    get props() { return props; },
    update(t, dt) { arena.update(t, dt); },
    dispose() { arena.dispose(); if (props) disposeModel(props); props = null; key = null; },
  };
}
