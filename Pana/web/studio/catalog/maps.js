import { TRACKS, makeTrack } from '/g/derrape/tracks.js';
import { STATIONS } from '/g/cocina/rules.js';
import { Box3, Vector3, Scene } from 'three';
export const MAPS = [
  { id: 'plaza', name: 'Plaza Pana', category: 'Mapas', source: '/engine/plaza.js', factory: 'createPlazaEnvironment', usedBy: ['Escondidas', 'Cocina', 'Derrape'], game: '/g/escondidas/',
    async build() { const { createPlazaEnvironment } = await import('/engine/plaza.js'); return { ...createPlazaEnvironment(), bounds: new Box3(new Vector3(-28, 0, -24), new Vector3(28, 15, 28)) }; },
  },
  { id: 'cocina', name: 'Cocina de la plaza', category: 'Mapas', source: '/g/cocina/scene.js', factory: 'createKitchenScene', usedBy: ['Cocina'], game: '/g/cocina/',
    async build() {
      const { createKitchenScene } = await import('/g/cocina/scene.js'); const model = createKitchenScene({ labelsRoot: null });
      const lights = []; model.scene.traverse(o => { if (o.isLight) lights.push(o); }); lights.forEach(o => o.removeFromParent());
      const state = { phase: 'lobby', stations: STATIONS.map(s => ({ id: s.id, item: null, fire: 0, progress: 0 })) };
      return { group: model.scene, bounds: new Box3(new Vector3(-28, 0, -24), new Vector3(28, 15, 28)), update: t => model.update(t, state, null, null, false), dispose: () => model.dispose() };
    },
  },
  { id: 'isla', name: 'Isla Bululú', category: 'Mapas', source: '/g/bululu/board.js', factory: 'createBoard', dependencies:['/engine/island-environment.js','/engine/island-terrain.js','/engine/reef-fish.js'], usedBy: ['Bululú'], game: '/g/bululu/', description: 'Tablero completo con sus caminos, pueblo, vegetación, mar y peces. El circuito de carreras tiene su propia geografía costera.',
    async build() {
      const {createBoard}=await import('/g/bululu/board.js'),group=new Scene(),board=createBoard(group);
      const lights=[];group.traverse(o=>{if(o.isLight)lights.push(o);});lights.forEach(o=>o.removeFromParent());
      return {group,groundAt:board.groundAt,bounds:new Box3(new Vector3(-155,-4,-145),new Vector3(170,70,145)),update:(t,dt)=>board.update(t,dt)};
    },
  },
  ...TRACKS.map(track => ({ id: `track-${track.id}`, name: `Circuito · ${track.name}`, category: 'Mapas', source: `/g/derrape/tracks/${track.id}.js`, dependencies: ['/g/derrape/tracks.js'], factory: 'makeTrack(definition).build', usedBy: ['Derrape'], description: track.blurb, game: `/g/derrape/?track=${track.id}`,
    async build() { const model = makeTrack(track); return { group: model.build(), groundAt:model.terrainAt, route:model, bounds: track.previewBounds ? new Box3(new Vector3(...track.previewBounds[0]), new Vector3(...track.previewBounds[1])) : new Box3(new Vector3(-model.bounds.x - 20, 0, -model.bounds.z - 20), new Vector3(model.bounds.x + 20, 35, model.bounds.z + 20)), update: (t, dt) => model.animated.forEach(o => o.userData.tick?.(t, dt)) }; },
  })),];
