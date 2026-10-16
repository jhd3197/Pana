import { TRACK_DEFINITIONS } from '/g/derrape/track-definitions.js';
import { STATIONS } from '/g/cocina/rules.js';

export const MAPS = [
  { id: 'reliquia', name: 'Reliquia · La mina del sol', category: 'Mapas', source: '/g/reliquia/scene.js', dependencies: ['/g/reliquia/layout.js','/engine/models/props/reliquia.js','/engine/models/props/jungle.js'], factory: 'createExpeditionWorld', usedBy: ['Reliquia'], game: '/g/reliquia/', description: 'Mina con puente colgante, dos ruedas cooperativas, patio de momias y cámara de la reliquia.',
    async build() { const { Box3, Vector3, Scene } = await import('three'); const { createExpeditionWorld } = await import('/g/reliquia/scene.js'); const model = createExpeditionWorld(); return { ...model, update: (t, dt) => model.update(t, {}, dt) }; },
  },
  { id: 'galope', name: 'Galope · La vuelta del estero', category: 'Mapas', source: '/g/galope/scene.js', dependencies: ['/g/galope/course.js','/g/galope/landscape.js'], factory: 'createCourse', usedBy: ['Galope'], game: '/g/galope/', description: 'Circuito de 482 m entre el hato, una laguna con isla y un caño sinuoso: caneyes, curiara, chinchorros y morichales.',
    async build() { const { Box3, Vector3, Scene } = await import('three'); const {createCourse}=await import('/g/galope/scene.js');return {...createCourse(),bounds:new Box3(new Vector3(-140,0,-112),new Vector3(145,20,105))}; },
  },
  { id: 'plaza', name: 'Plaza Pana', category: 'Mapas', source: '/engine/plaza.js', factory: 'createPlazaEnvironment', usedBy: ['Escondidas', 'Cocina', 'Derrape'], game: '/g/escondidas/',
    async build() { const { Box3, Vector3, Scene } = await import('three'); const { createPlazaEnvironment } = await import('/engine/plaza.js'); return { ...createPlazaEnvironment(), bounds: new Box3(new Vector3(-28, 0, -24), new Vector3(28, 15, 28)) }; },
  },
  { id: 'cocina', name: 'Cocina de la plaza', category: 'Mapas', source: '/g/cocina/scene.js', factory: 'createKitchenScene', usedBy: ['Cocina'], game: '/g/cocina/',
    async build() { const { Box3, Vector3, Scene } = await import('three');
      const { createKitchenScene } = await import('/g/cocina/scene.js'); const model = createKitchenScene({ labelsRoot: null });
      const lights = []; model.scene.traverse(o => { if (o.isLight || o.userData.isSky) lights.push(o); }); lights.forEach(o => { o.removeFromParent();if(o.userData.isSky){o.geometry.dispose();o.material.dispose();} });
      const state = { phase: 'lobby', stations: STATIONS.map(s => ({ id: s.id, item: null, fire: 0, progress: 0 })) };
      return { group: model.scene, bounds: new Box3(new Vector3(-28, 0, -24), new Vector3(28, 15, 28)), update: t => model.update(t, state, null, null, false), dispose: () => model.dispose() };
    },
  },
  { id: 'isla', name: 'Isla Bululú', category: 'Mapas', source: '/g/bululu/board.js', factory: 'createBoard', dependencies:['/engine/island-environment.js','/engine/island-terrain.js','/engine/models/fauna/aquatic/reef-fish.js','/engine/models/fauna/aquatic/reef-fish-school.js','/engine/placement/reef-schools.js'], usedBy: ['Bululú'], game: '/g/bululu/', description: 'Tablero completo con sus caminos, pueblo, vegetación, mar y peces. El circuito de carreras tiene su propia geografía costera.',
    async build() { const { Box3, Vector3, Scene } = await import('three');
      const {createBoard}=await import('/g/bululu/board.js'),group=new Scene(),board=createBoard(group);
      const lights=[];group.traverse(o=>{if(o.isLight)lights.push(o);});lights.forEach(o=>o.removeFromParent());
      return {group,groundAt:board.groundAt,bounds:new Box3(new Vector3(-155,-4,-145),new Vector3(170,70,145)),update:(t,dt)=>board.update(t,dt)};
    },
  },
  ...TRACK_DEFINITIONS.map(track => ({ id: `track-${track.id}`, name: `Circuito · ${track.name}`, category: 'Mapas', source: `/g/derrape/tracks/${track.id}.js`, dependencies: ['/g/derrape/track-runtime.js'], factory: 'makeTrack(definition).build', usedBy: ['Derrape'], description: track.blurb, game: `/g/derrape/?track=${track.id}`,
    async build() { const { Box3, Vector3, Scene } = await import('three'); const [{ makeTrack }, { default: definition }] = await Promise.all([import('/g/derrape/track-runtime.js'), import(`/g/derrape/tracks/${track.id}.js`)]); const model = makeTrack(definition); return { group: model.build(), groundAt:model.terrainAt, route:model, bounds: definition.previewBounds ? new Box3(new Vector3(...definition.previewBounds[0]), new Vector3(...definition.previewBounds[1])) : new Box3(new Vector3(-model.bounds.x - 20, 0, -model.bounds.z - 20), new Vector3(model.bounds.x + 20, 35, model.bounds.z + 20)), update: (t, dt) => model.animated.forEach(o => o.userData.tick?.(t, dt)) }; },
  })),];
