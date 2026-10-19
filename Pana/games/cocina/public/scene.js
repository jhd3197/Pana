import { createArenaEnvironment } from '/engine/worlds/arenas.js';
import * as THREE from 'three';
import { createPlazaEnvironment, createPlaza } from '/engine/worlds/plaza.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { bake } from '/engine/models/core/static-batch.js';
import { M, box, mesh, tube } from '/engine/models/core/primitives.js';
import { crate, planter, cooler, barrel } from '/engine/models/props/plaza.js';
import { food, kitchenStation, kitchenSign, corn, cheese, sink } from '/engine/models/props/kitchen.js';
import { STATIONS, PREP_TIME, BURN_TIME, recipe } from './rules.js';

const foodCache = new Map();
export function mealModel(id, stage = 'cooked', plated = true) {
  const key = `${id}:${stage}:${plated}`;
  if (!foodCache.has(key)) foodCache.set(key, bake(food(id, { stage, plated })));
  return foodCache.get(key).clone();
}
export function createKitchenScene({ labelsRoot = document.getElementById('station-labels') } = {}) {
  const plaza = createPlaza({ environment: false }), { scene } = plaza, set = new THREE.Group();
  const market = createPlazaEnvironment({ cooking: true }), beach = createArenaEnvironment('puerto', { mode: 'court', props: [] });
  scene.add(market.group, beach.group); beach.group.visible = false;
  set.add(box(25, 0.15, 19, M('#b97c53'), -0.5, 0, 4));
  const colors = ['#c68259', '#ca8d61', '#c17d55', '#d19366', '#d69b6b'];
  for (let z = -5; z < 13; z += 1.5) for (let x = -12; x < 12; x += 1.5) set.add(box(1.47, 0.07, 1.47, M(colors[Math.abs(Math.round(x * 4 + z * 7)) % colors.length]), x, 0.1, z));
  for (const def of STATIONS) { const o = kitchenStation(def); o.position.set(def.x, 0.15, def.z); set.add(o); }
  const washing = sink(); washing.position.set(12.7, 0, 7); washing.rotation.y = -0.3; set.add(washing);
  for (const [x, z, type] of [[-14, -3, 'crate'], [-14, 5, 'planter'], [-13, 10, 'crate'], [13, 10, 'planter'], [11, -6, 'cooler'], [-11, -7, 'barrel'], [13, 2, 'crate'], [14, -3, 'planter']]) {
    const o = ({ crate, planter, cooler, barrel })[type](); o.position.set(x, 0, z); set.add(o);
  }
  // Open pantry / refrigerator, with visible vegetables, milk and cheese.
  const fridge = new THREE.Group();
  fridge.add(box(2.3, 3.7, 1.5, M('#87a8b7'), 0, 1.85, 0));
  fridge.add(box(1.95, 3.35, 0.05, M('#d6e4df'), 0, 1.86, 0.79));
  for (const y of [0.5, 1.5, 2.5, 3.55]) fridge.add(box(2.1, 0.1, 0.65, M('#d6e4df'), 0, y, 1.05));
  for (const x of [-1.1, 1.1]) fridge.add(box(0.13, 3.65, 0.7, M('#87a8b7'), x, 1.85, 1.05));
  for (const x of [-0.6, 0, 0.6]) {
    const tomato = mesh(new THREE.IcosahedronGeometry(0.26, 2), M('#db5035'), x, 2.83, 1.07); fridge.add(tomato);
    const c = cheese(); c.position.set(x, 1.56, 1.1); c.scale.setScalar(0.7); fridge.add(c);
    fridge.add(box(0.35, 0.7, 0.35, M('#e8eae2'), x, 0.9, 1.05)); fridge.add(box(0.36, 0.15, 0.36, M('#4c879f'), x, 1.15, 1.05));
  }
  fridge.position.set(12.2, 0, -4.5); fridge.rotation.y = -0.4; set.add(fridge);
  const banner = kitchenSign('LA AREPA NOS UNE', 7, '#ae5139'); banner.position.set(-6, 3.6, -6.2); set.add(banner);
  for (const x of [-9.5, -2.5]) set.add(tube([x, 0, -6.25], [x, 4.15, -6.25], 0.09, M('#795339')));
  for (let i = 0; i < 3; i++) { const c = corn(); c.position.set(-14 + i * 0.25, 1.4, -3); c.rotation.z = 0.4 + i * 0.3; set.add(c); }
  // Small working-kitchen details stay on counters, outside the walking lanes.
  for (const [x, z] of [[-10.1, 2.4], [-4.1, 2.4], [5.6, 9.5]]) {
    for (const [i, color] of ['#d85237', '#e9b62e'].entries()) {
      set.add(mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.45, 9), M(color), x + i * 0.33, 1.72, z));
      set.add(mesh(new THREE.ConeGeometry(0.07, 0.25, 8), M(color), x + i * 0.33, 2.05, z));
    }
  }
  for (const [x, z] of [[-13.3, -0.8], [-12.9, 9]]) {
    const sack = mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.2, 7), M('#f2dbaf'), x, 0.6, z); set.add(sack);
    const flour = kitchenSign('HARINA', 0.8, '#b49363'); flour.position.set(x, 0.8, z + 0.49); set.add(flour);
  }
  const chalk = kitchenSign('MÁS PANAS · MÁS SABOR', 4, '#344e50'); chalk.position.set(10, 1.5, 11.6); chalk.rotation.y = -0.3; set.add(chalk);
  scene.add(bake(set));
  // Lobby-only cooks show the new shared rig and dishes before the turn opens.
  const demo = new THREE.Group(), demoChefs = [];
  for (const [i, [x, z, dish, color]] of [[5, -0.7, 'cachapa', '#3d7bf2'], [-3, 5.2, 'arepa', '#3aaa71'], [3, 7, 'empanada', '#ffc629']].entries()) {
    const chef = buildCharacter({ fur: i === 1 ? '#c47f42' : '#e0a463', outfitColor: color, glasses: i === 2 ? 'sol' : 'none', face: i === 1 ? 'lengua' : 'ojazos' }, { chef: true });
    chef.group.position.set(x, 0.16, z); chef.group.scale.setScalar(1.2); chef.group.rotation.y = 0.35 + i * 0.4;
    const meal = mealModel(dish); meal.scale.setScalar(0.8); chef.carry.add(meal); demo.add(chef.group); demoChefs.push(chef);
  }
  scene.add(demo);
  const stations = new Map();
  for (const def of STATIONS) {
    const holder = new THREE.Group(); holder.position.set(def.x, def.type === 'stove' ? 1.9 : 1.7, def.z); scene.add(holder);
    const effects = new THREE.Group(); effects.position.set(def.x, 1.8, def.z); scene.add(effects);
    const steam = new THREE.Group(); steam.position.set(def.x, 2, def.z); scene.add(steam);
    if (def.type === 'stove') for (let i = 0; i < 10; i++) {
      const f = mesh(new THREE.IcosahedronGeometry(0.21 + i % 3 * 0.07, 1), M(i < 5 ? '#ffb634' : '#ff6830', { emissive: i < 5 ? '#ff9f19' : '#e23b11', emissiveIntensity: 0.7 }), Math.sin(i * 2.4) * 0.6, 0.4, Math.cos(i * 2.4) * 0.5); effects.add(f);
    }
    if (def.type === 'stove') for (let i = 0; i < 7; i++) {
      const puff = mesh(new THREE.IcosahedronGeometry(0.19, 1), new THREE.MeshBasicMaterial({ color: '#fff8e9', transparent: true, opacity: 0.4, depthWrite: false }));
      puff.castShadow = false; steam.add(puff);
    }
    const tag = document.createElement('div'); tag.className = 'station-tag hidden'; labelsRoot?.append(tag);
    stations.set(def.id, { def, holder, effects, steam, tag, itemKey: '', progress: 0 });
  }
  const ring = mesh(new THREE.RingGeometry(0.9, 1.04, 40), new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0.85, depthWrite: false })); ring.rotation.x = -Math.PI / 2; scene.add(ring);
  const target = new THREE.Vector3();
  return {
    scene, ring,
    dispose() { beach.dispose(); stations.forEach(v => v.tag.remove()); demoChefs.forEach(chef => { chef.carry.clear(); chef.dispose(); }); },
    update(t, state, camera, nearest, showLabels) {
      plaza.update(t); const atBeach = state.kitchen === 'playa'; market.group.visible = !atBeach; beach.group.visible = atBeach; (atBeach ? beach : market).update?.(t);
      demo.visible = state.phase === 'lobby';
      if (demo.visible) demoChefs.forEach((chef, i) => { chef.update(1 / 60, { carry: true }); chef.neck.rotation.z = Math.sin(t * 1.8 + i * 2) * 0.1; });
      for (const data of state.stations) {
        const v = stations.get(data.id), { def } = v, key = data.item ? `${data.item.recipe}:${data.item.stage}` : '';
        if (key !== v.itemKey) { v.holder.clear(); if (data.item) v.holder.add(mealModel(data.item.recipe, data.item.stage, def.type !== 'stove')); v.itemKey = key; }
        v.effects.visible = data.fire > 0;
        v.effects.children.forEach((m, i) => { m.scale.set(1, 1.5 + Math.sin(t * 13 + i) * 0.8, 1); m.position.y = 0.4 + Math.sin(t * 6 + i) * 0.2; });
        v.steam.visible = !!data.item;
        v.steam.children.forEach((m, i) => {
          const age = (t * 0.6 + i / 7) % 1;
          m.position.set(Math.sin(i * 2.4) * (0.25 + age * 0.5), age * (data.fire ? 3.7 : 2), Math.cos(i * 2.4) * 0.3);
          m.scale.setScalar((0.6 + age * 2.5) * (data.fire ? 1.8 : 1)); m.material.color.set(data.fire ? '#49424b' : '#fff8e9'); m.material.opacity = (1 - age) * (data.fire ? 0.8 : 0.42);
        });
        let label = '', progress = 0, ready = false;
        if (data.fire) label = '¡FUEGO! · E × 2';
        else if (data.item && (def.type === 'prep' || def.type === 'stove')) {
          const max = def.type === 'prep' ? PREP_TIME : recipe(data.item.recipe).cook;
          ready = data.progress >= max; progress = Math.min(1, data.progress / max);
          label = ready ? def.type === 'stove' ? `¡Listo! ${Math.ceil(max + (state.options?.fire === 'fast' ? 5 : BURN_TIME) - data.progress)}s` : '¡Preparado!' : def.type === 'stove' ? 'Cocinando…' : 'Preparando…';
        } else if (nearest?.id === def.id) label = def.label;
        else if (def.type === 'supply') label = def.label;
        if (showLabels && label) {
          v.tag.className = `station-tag${data.fire ? ' fire' : ready ? ' ready' : ''}`;
          v.tag.innerHTML = `${label}${progress ? `<div class="meter"><i style="width:${progress * 100}%"></i></div>` : ''}`;
          target.set(def.x, data.fire ? 3.4 : 2.25, def.z).project(camera);
          v.tag.style.left = `${(target.x * 0.5 + 0.5) * innerWidth}px`; v.tag.style.top = `${(-target.y * 0.5 + 0.5) * innerHeight}px`;
        } else v.tag.classList.add('hidden');
      }
    },
  };
}
