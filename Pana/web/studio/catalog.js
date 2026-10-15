// Agent-editable catalog. Import existing definitions/factories; never copy a model.
import { PLAZA_PROPS } from '/engine/plaza-catalog.js';
import { TRACKS, makeTrack } from '/g/derrape/tracks.js';
import { CARS } from '/g/derrape/cars.js';
import { RECIPES, STATIONS } from '/g/cocina/rules.js';
import { DEFAULT_AVATAR } from '/engine/avatar.js';
import { Box3, Vector3, Scene } from 'three';

const shared = ['Bululú', 'Derrape', 'Escondidas', 'Cocina'];
const object = (id, name, category, source, factory, usedBy, options) => ({
  id, name, category, source, factory, usedBy, previewOptions: options ?? null,
  async build() { const module = await import(source), group = module[factory](options), frame=group.userData.previewBounds; return { group, bounds:frame&&new Box3(new Vector3(...frame[0]),new Vector3(...frame[1])), update: group.userData.tick && ((t, dt) => group.userData.tick(t, dt)) }; },
});
const character = (id, name, options = {}) => ({ id, name, category: 'Personajes', source: '/engine/character.js', factory: 'buildCharacter', usedBy: shared, previewOptions: options,
  async build() { const { buildCharacter } = await import('/engine/character.js'); const model = buildCharacter(DEFAULT_AVATAR, { quality: 'studio', ...options }); return { group: model.group, update: (t, dt) => model.update(dt), dispose: () => model.dispose() }; },
});
export const ASSETS = [
  ...[
    ['llanero-horse','Caballo llanero','llaneroHorse','Caballo de hato con crin, lucero, medias claras y animación de pastoreo.',{seed:7,coat:'bay'}],
    ['yard-chicken','Gallina de patio','yardChicken','Gallina de corral con cresta, alas plegadas y animación de picoteo.',{seed:7,coat:'red'}],
    ['hato-cow','Vaca del hato','hatoCow','Vaca de manchas castañas, pezuñas partidas, cuernos y cola animada. Reemplaza la vaca antigua de Los Llanos.',{seed:7,coat:'pinto'}],
  ].map(([id,name,factory,description,options])=>({...object(id,name,'Fauna','/engine/farm-animals.js',factory,['Pana Studio','Derrape'],options),description,tags:['animal','hato','llanos','animado'],dependencies:['/engine/vendor/procedural-animals/core/sdf/sdf.js','/engine/vendor/procedural-animals/core/sdf/mesher.js','/engine/vendor/procedural-animals/core/math/vec.js']})),
  ...[['reef-fish','Pez de arrecife','reefFish'],['reef-fish-school','Cardumen costero','reefFishSchool']].map(([id,name,factory])=>({...object(id,name,'Fauna','/engine/reef-fish.js',factory,['Bululú','Derrape'],{seed:7}),description:'Fauna marina de Pana: peces con aletas y cola animadas en las aguas de ambas islas.',tags:['pez','agua','isla','animado']})),
  // Llanos 041–050: grounded ranch buildings, working machinery and scenery.
  ...[
    ['041','ranch-house','Casa de hato llanero','llaneroRanchHouse','Casa encalada con tejas, porche, persianas y un chinchorro tejido.'],
    ['042','corral-gate','Portón de corral','corralGate','Dos hojas de madera con bisagras; ancho y apertura ajustables.'],
    ['043','hay-bale','Paca de heno','hayBale','Rollo de paja con fibras en espiral y dos amarres.'],
    ['044','water-windmill','Molino de agua','waterWindmill','Torre de celosía, rotor de dieciséis aspas y bomba animada.'],
    ['045','horse-stable','Caballeriza','horseStable','Tres puestos con divisiones de madera, cama de paja y entrada abierta.'],
    ['046','feeding-trough','Comedero de ganado','feedingTrough','Artesa abierta de madera con patas y forraje.'],
    ['047','ranch-fence','Cerca de hato','ranchFence','Tres travesaños, postes y refuerzos; longitud ajustable.'],
    ['048','old-tractor','Tractor viejo','oldTractor','Tractor rojo gastado con motor, escape, ruedas estriadas y enganche.'],
    ['049','mud-puddle','Módulo de charco de barro','mudPuddle','Agua marrón con ondas suaves, orilla irregular y huellas.'],
    ['050','ranch-water-tower','Torre de agua del hato','ranchWaterTower','Tanque acanalado sobre estructura de madera con escalera y tubería.'],
  ].map(([number,id,name,factory,description])=>({...object(id,name,'Llanos','/engine/ranch-props.js',factory,['Derrape']),description,tags:[number,'llanos','hato','ranch']})),
  // Desert 061–070: eroded sandstone, abandoned roadside props and dry flora.
  ...[
    ['061','giant-cactus','Cardón gigante','giantCactus','Cardón maduro con brazos, costillas, flores y un retoño basal.'],
    ['062','sand-dune','Módulo de duna','sandDune','Cresta asimétrica y ondulaciones de arena con bordes a nivel del suelo.'],
    ['063','desert-rock-arch','Arco de roca del desierto','desertRockArch','Arco erosionado de estratos cálidos con paso abierto y ancho ajustable.'],
    ['064','abandoned-gas-station','Gasolinera abandonada','abandonedGasStation','Marquesina oxidada, surtidores con mangueras y local clausurado.'],
    ['065','rusted-pickup','Camioneta oxidada','rustedPickup','Cabina con interior visible y cajón abierto de madera gastada.'],
    ['066','roadside-tire-pile','Pila de cauchos','roadsideTirePile','Cauchos huecos apilados y uno recostado, con bandas de rodadura.'],
    ['067','canyon-spire','Aguja de roca del cañón','canyonSpire','Columna irregular con estratos y bloques erosionados al pie.'],
    ['068','broken-wagon','Carreta de madera rota','brokenWagon','Tablas faltantes, rueda con radios rotos y varas de tiro.'],
    ['069','desert-warning-sign','Señal de peligro del desierto','desertWarningSign','Advertencia de cañón sobre poste de madera envejecida.'],
    ['070','desert-well','Pozo viejo del desierto','desertWell','Brocal hueco de piedra, torno con cuerda, balde y pequeño tejado.'],
  ].map(([number,id,name,factory,description])=>({...object(id,name,'Desierto','/engine/desert-props.js',factory,['Derrape']),description,tags:[number,'desierto','cañón','desert']})),
  ...[
    ['hot-spring-pool','Poza termal','hotSpringPool','Agua mineral, borde de travertino, ondas y vapor.'],
    ['steam-vent','Fumarola','steamVent','Respiradero de roca con una columna de vapor animada.'],
    ['mineral-terraces','Terrazas minerales','mineralTerraces','Tres pozas escalonadas con pequeños reboses.'],
    ['thermal-bathhouse','Casa de las termas','thermalBathhouse','Refugio de aguas termales con porche y tejado de barro.'],
    ['thermal-lookout','Mirador de Chi Chi','thermalLookout','Plataforma de madera con escalera y barandas.'],
  ].map(([id,name,factory,description])=>({...object(id,name,'Termales','/engine/thermal-props.js',factory,['Derrape']),description,dependencies:['/engine/thermal-steam.js','/engine/water-details.js','/engine/architecture-kit.js'],tags:['Chi Chi','aguas termales','montaña']})),
  character('pana', 'Pana original'),
  character('pana-chef', 'Pana cocinero', { chef: true }),
  character('pana-driver', 'Pana conductor', { seated: true }),
  ...[['shirt', 'Franela'], ['chef', 'Delantal y gorro'], ['hoodie', 'Suéter y gorra'], ['tropical', 'Camisa tropical'], ['sport', 'Conjunto deportivo']].map(([outfit, name]) => ({
    id: `outfit-${outfit}`, name, category: 'Vestuario', source: '/engine/soft-character/model.js', factory: 'buildSoftCharacter', usedBy: shared, tags: ['outfits.js'],
    async build() { const { buildSoftCharacter } = await import('/engine/soft-character/model.js'); const model = buildSoftCharacter({ outfit }); return { group: model.group, update: (t, dt) => model.update(dt), dispose: () => model.dispose() }; },
  })),
  ...PLAZA_PROPS.map(p => ({ ...object(p.id, p.label, 'Objetos', '/engine/plaza-props.js', p.id, ['Escondidas', 'Cocina', 'Derrape']), dimensions: [p.width, p.height, p.depth] })),
  object('market-stall', 'Puesto de mercado', 'Objetos', '/engine/plaza-props.js', 'marketStall', ['Escondidas', 'Derrape']),
  object('street-lamp', 'Farol de plaza', 'Objetos', '/engine/plaza-props.js', 'streetLamp', ['Escondidas', 'Cocina', 'Derrape']),
  object('house', 'Casa del pueblo', 'Objetos', '/engine/plaza.js', 'house', ['Escondidas', 'Cocina', 'Derrape']),
  object('mango', 'Mango', 'Objetos', '/engine/props.js', 'makeMango', ['Bululú', 'Derrape']),
  object('gold-mango', 'Mango dorado', 'Objetos', '/engine/props.js', 'makeMango', ['Bululú', 'Derrape'], { gold: true }),
  ...[['palm', 'Palmera'], ['mangoTree', 'Árbol de mango'], ['ceiba', 'Ceiba'], ['pine', 'Pino'], ['banana', 'Mata de cambur'], ['bush', 'Arbusto'], ['casita', 'Casita de isla']].map(([factory, name]) => object(factory, name, factory === 'casita' ? 'Objetos' : 'Vegetación', '/engine/flora.js', factory, ['palm','mangoTree','bush'].includes(factory)?shared:['pine','casita'].includes(factory)?['Bululú']:['Bululú','Derrape'], { seed: 7 })),
  ...[
    ['araguaney','Araguaney','Copa de flores amarillas y tronco ramificado.',['árbol','flores','pueblo']],
    ['bamboo','Bambú','Grupo de tallos con nudos y ramas de hojas finas.',['selva','tallos']],
    ['fern','Helecho','Frondas arqueadas y brotes enrollados para el suelo del bosque.',['selva','sotobosque']],
    ['monstera','Monstera','Hojas grandes con cortes y perforaciones.',['selva','hojas']],
    ['heliconia','Heliconia','Flores rojas con puntas doradas entre hojas tropicales.',['selva','flores']],
    ['cactus','Cardón','Cactus de brazos curvos, costillas y una pequeña flor.',['desierto','cactus']],
    ['mangrove','Mangle','Raíces arqueadas y copa extendida para costas y lagunas.',['árbol','costa','raíces']],
    ['papaya','Lechosa','Tronco esbelto, hojas recortadas y un racimo de frutas.',['árbol','papaya','fruta','huerto']],
    ['agave','Agave','Roseta de hojas carnosas azuladas con bordes claros.',['seco','jardín','suculenta']],
    ['waterLily','Nenúfar','Hojas flotantes y flores rosadas para estanques.',['agua','flores','laguna']],
    ['hibiscus','Cayena','Arbusto de hojas verdes y grandes flores rojas.',['flores','hibisco','jardín']],
    ['reeds','Juncos','Tallos altos, hojas arqueadas y espigas para las orillas.',['agua','laguna','enea']],
    ['jungleGiant','Árbol gigante de la selva','Tronco con raíces tabulares, copa en pisos, lianas y bromelias.',['selva','árbol','lianas']],
    ['tropicalBush','Arbusto tropical grande','Hojas anchas, crotos variegados y espigas rojas de jengibre.',['selva','arbusto','flores']],
    ['frailejon','Frailejón','Roseta plateada, hojas secas y tallos de flores amarillas.',['051','páramo','montaña','flores']],
    ['mountainPine','Pino de montaña','Ramas abiertas en pisos y follaje verde oscuro.',['057','páramo','montaña','árbol']],
  ].map(([factory,name,description,tags])=>({...object(factory,name,'Vegetación','/engine/flora.js',factory,['hibiscus','papaya'].includes(factory)?['Bululú','Derrape']:['Derrape'],{seed:7}),description,tags})),
  // Pueblo 011–020: new standalone buildings and street furniture.
  ...[
    ['011', 'colonial-house', 'Casa colonial colorida', 'colonialHouse', 'Fachada turquesa, puerta de arco, rejas, persianas y techo de tejas.', ['casa','colonial']],
    ['012', 'corner-bodega', 'Bodega de esquina', 'cornerBodega', 'Toldos a dos calles, estantes surtidos y cajas de mangos.', ['tienda','bodega']],
    ['013', 'colonial-church', 'Iglesia colonial pequeña', 'colonialChurch', 'Muros encalados, rosetón y campanario abierto con campana.', ['iglesia','campana']],
    ['014', 'bus-stop-shelter', 'Parada de autobús', 'busStopShelter', 'Marquesina, asientos y panel de ruta con paradas.', ['parada','autobús']],
    ['015', 'street-food-kiosk', 'Puesto de arepas', 'streetFoodKiosk', 'Plancha con arepas, salsas y mostrador bajo un toldo a rayas.', ['comida','kiosco','arepas']],
    ['016', 'plaza-clock-tower', 'Torre del reloj', 'plazaClockTower', 'Reloj de cuatro caras con agujas y segundero animados.', ['plaza','reloj','torre']],
    ['017', 'basketball-hoop', 'Aro de baloncesto', 'basketballHoop', 'Tablero, aro a 3,05 m y red tejida abierta.', ['cancha','baloncesto']],
    ['018', 'rooftop-water-tank', 'Tanque de agua de azotea', 'rooftopWaterTank', 'Tanque estriado con soporte, escalera, tubería y válvula.', ['tanque','agua','azotea']],
    ['019', 'streetlight-pole', 'Farol de calle', 'streetlightPole', 'Poste curvado con brazo ornamental y lámpara cálida.', ['farol','calle','luz']],
    ['020', 'park-bench', 'Banco de parque', 'parkBench', 'Listones de madera, patas de hierro y apoyabrazos curvos.', ['banco','parque']],
  ].map(([number,id,name,factory,description,tags])=>({...object(id,name,'Pueblo','/engine/pueblo-props.js',factory,['plazaClockTower','parkBench','streetlightPole'].includes(factory)?['Escondidas','Cocina','Derrape']:factory==='streetFoodKiosk'?['Cocina','Derrape']:['Derrape']),description,tags:[number,'pueblo',...tags]})),
  // Páramo 051–060: the two plants remain under Vegetación.
  ...[
    ['052', 'mountain-cabin', 'Cabaña de montaña', 'mountainCabin', 'Refugio de madera y piedra con porche, chimenea y techo de tejas.', ['cabaña','refugio']],
    ['053', 'cable-car-station', 'Estación de teleférico', 'cableCarStation', 'Andén abierto, boletería, poleas y una cabina en movimiento.', ['teleférico','estación']],
    ['054', 'rocky-cliff', 'Módulo de acantilado rocoso', 'rockyCliff', 'Estratos de roca y extremos compatibles para unir módulos.', ['acantilado','roca','módulo']],
    ['055', 'mountain-guardrail', 'Defensa vial de montaña', 'mountainGuardrail', 'Barrera de acero ondulado con pernos y reflectores.', ['carretera','defensa','barrera']],
    ['056', 'stone-lookout', 'Mirador de piedra', 'stoneLookout', 'Terraza con escalinata, barandas y binoculares de observación.', ['mirador','plataforma']],
    ['058', 'mountain-tent', 'Carpa de montaña', 'mountainTent', 'Carpa abierta con vientos, estacas y dos colchonetas.', ['campamento','carpa']],
    ['059', 'mountain-suspension-bridge', 'Puente colgante de montaña', 'mountainSuspensionBridge', 'Tablero de madera, torres de acero, cables y accesos de piedra.', ['puente','cables']],
    ['060', 'mountain-signpost', 'Señal de senderos', 'mountainSignpost', 'Flechas de madera hacia el mirador, la laguna y el refugio.', ['sendero','señal']],
  ].map(([number,id,name,factory,description,tags])=>({...object(id,name,'Páramo','/engine/mountain-props.js',factory,['mountainGuardrail','mountainSuspensionBridge'].includes(factory)?['Pana Studio']:['Derrape']),description,tags:[number,'páramo','montaña',...tags]})),
  // Pana signature landmarks shared by every game.
  ...[
    ['capybara-statue', 'Estatua gigante de capibara', '/engine/landmarks.js', 'capybaraStatue', 'El pana original en bronce, saludando sobre un pedestal.', ['estatua', 'capibara', 'monumento']],
    ['golden-mango-statue', 'Estatua del mango de oro', '/engine/landmarks.js', 'goldenMangoStatue', 'Un mango dorado gigante sobre un pedestal octogonal.', ['estatua', 'mango', 'monumento']],
    ['plaza-fountain', 'Fuente de Plaza Pana', '/engine/plaza.js', 'plazaFountain', 'Capibara coronado, mosaicos turquesa y chorros con ondas animadas.', ['fuente', 'agua', 'plaza']],
    ['welcome-arch', 'Arco de bienvenida Pana', '/engine/landmarks.js', 'welcomeArch', 'Arco de entrada con letrero PANA, faroles y banderines.', ['arco', 'entrada', 'letrero']],
    ['capybara-topiary', 'Topiaria de capibara', '/engine/landmarks.js', 'capybaraTopiary', 'Seto podado con forma de capibara en una jardinera.', ['jardín', 'capibara', 'seto']],
    ['pana-flagpole', 'Asta con bandera Pana', '/engine/landmarks.js', 'panaFlagpole', 'Bandera Pana ondeando sobre una base de mármol.', ['bandera', 'asta']],
    ['trophy-monument', 'Monumento de la Copa Pana', '/engine/landmarks.js', 'trophyMonument', 'Copa dorada gigante con un capibara en la tapa.', ['trofeo', 'copa', 'monumento']],
    ['capybara-fountain', 'Fuente de los capibaras', '/engine/landmarks.js', 'capybaraFountain', 'Capibara de piedra con su pajarito y dos crías que echan agua.', ['fuente', 'agua', 'capibara']],
    ['souvenir-kiosk', 'Kiosco de recuerdos Pana', '/engine/landmarks.js', 'souvenirKiosk', 'Puesto con peluches de capibara, mangos, postales y banderines.', ['tienda', 'kiosco', 'recuerdos']],
  ].map(([id, name, source, factory, description, tags]) => ({ ...object(id, name, 'Emblemas', source, factory, source.includes('plaza')||factory==='capybaraTopiary' ? ['Escondidas', 'Cocina', 'Derrape'] : ['trophyMonument','souvenirKiosk'].includes(factory)?['Derrape']:['Pana Studio']), description, tags: ['pana', ...tags] })),
  // Jungle ruins and traversal obstacles.
  ...[
    ['temple-entrance', 'Entrada del templo de piedra', 'templeEntrance', 'Pasaje abierto, piedra erosionada, máscara de jade y enredaderas.', ['templo', 'ruinas', 'entrada']],
    ['rope-bridge', 'Puente colgante de cuerdas', 'ropeBridge', 'Tablas sobre cuerdas entre dos salientes de piedra.', ['puente', 'cuerdas', 'obstáculo']],
    ['waterfall-rocks', 'Cascada entre rocas', 'waterfallRocks', 'Acantilado en herradura con cascada animada y poza.', ['agua', 'cascada', 'rocas']],
    ['vine-arch', 'Arco de piedra con enredaderas', 'vineArch', 'Arco de dovelas cubierto de musgo y lianas.', ['arco', 'ruinas', 'lianas']],
    ['bamboo-bridge', 'Puente de bambú', 'bambooBridge', 'Tablero de cañas amarradas sobre caballetes, con rampas.', ['puente', 'bambú', 'obstáculo']],
    ['stone-totem', 'Tótem de piedra antiguo', 'stoneTotem', 'Tres rostros tallados (jaguar, búho y capibara) bajo un penacho.', ['tótem', 'ruinas', 'capibara']],
    ['hollow-log', 'Tronco hueco', 'hollowLog', 'Tronco caído y hueco con hongos, musgo y bordes rotos.', ['tronco', 'obstáculo', 'túnel']],
  ].map(([id, name, factory, description, tags]) => ({ ...object(id, name, 'Selva', '/engine/jungle-props.js', factory, ['stoneTotem','hollowLog','vineArch'].includes(factory)?['Derrape']:['Pana Studio']), description, tags: ['selva', ...tags] })),
  ...[['beachShade', 'Sombrilla de playa'], ['beachHut', 'Rancho de playa'], ['driftwood', 'Tronco de playa']].map(([factory, name]) => object(factory, name, 'Objetos', '/engine/beach-props.js', factory, ['Bululú', 'Derrape'])),
  ...[
    ['fishing-boat','Peñero de pesca','fishingBoat','Casco abierto, bancos de madera, remos, motor fuera de borda y cabo de proa.',true],
    ['coastal-lighthouse','Faro costero','coastalLighthouse','Torre pintada, balcón circular, linterna abierta y techo cónico.',false],
    ['lifeguard-tower','Torre de salvavidas','lifeguardTower','Puesto elevado con escalinata, asiento, techo coral y aro de rescate.',true],
    ['beach-volleyball','Cancha de voleibol de playa','beachVolleyball','Campo de arena delimitado, red abierta con caída y pelota.',false],
    ['beach-shower','Ducha de playa','beachShower','Tarima de madera, tubería curva, rociador y válvula.',true],
    ['rescue-ring-stand','Puesto de salvavidas','rescueRingStand','Aro con bandas, cuerda de rescate y señal sobre un poste.',true],
    ['fishing-net-rack','Secadero de redes','fishingNetRack','Red tejida colgada entre postes, flotadores y cabo enrollado.',true],
    ['fish-crates','Cajas de pesca','fishCrates','Cajas de listones apiladas con peces plateados.',true],
    ['channel-buoy','Boya de canal','channelBuoy','Marcador costero que cabecea suavemente sobre el agua.',true],
    ['beach-crab','Cangrejo de playa','beachCrab','Caparazón coral, ocho patas, ojos elevados y dos pinzas animadas.',true],
  ].map(([id,name,factory,description,board])=>({...object(id,name,id==='beach-crab'?'Fauna':'Costa','/engine/coastal-props.js',factory,board?['Bululú','Derrape']:['Derrape']),description,tags:['costa','playa','puerto','Bululú'],dependencies:['/engine/architecture-kit.js','/engine/rural-kit.js']})),
  ...RECIPES.map(r => ({ ...object(`food-${r.id}`, r.name, 'Objetos', '/engine/kitchen-props.js', 'food', ['Cocina'], r.id), tags: ['comida', 'cocina'] })),
  object('corn', 'Mazorca', 'Objetos', '/engine/kitchen-props.js', 'corn', ['Cocina']),
  object('cheese', 'Queso', 'Objetos', '/engine/kitchen-props.js', 'cheese', ['Cocina']),
  object('sink', 'Fregadero', 'Objetos', '/engine/kitchen-props.js', 'sink', ['Cocina']),
  ...STATIONS.filter((s, i, all) => all.findIndex(a => a.type === s.type) === i).map(s => object(`station-${s.type}`, `Estación · ${s.label}`, 'Objetos', '/engine/kitchen-props.js', 'kitchenStation', ['Cocina'], s)),
  ...CARS.map(car => ({ id: `car-${car.id}`, name: car.name, category: 'Vehículos', source: '/g/derrape/cars.js', factory: `CARS.find(c => c.id === '${car.id}').build`, usedBy: ['Derrape'], description: car.blurb,
    async build() { const model = car.build(DEFAULT_AVATAR); return { group: model.root, update: (t, dt) => model.driver.update(dt), dispose: () => model.driver.dispose() }; },
  })),
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
  })),
];
export const CATEGORIES = ['Todos', 'Personajes', 'Vestuario', 'Objetos', 'Fauna', 'Emblemas', 'Pueblo', 'Selva', 'Llanos', 'Páramo', 'Desierto', 'Termales', 'Costa', 'Vegetación', 'Vehículos', 'Mapas'];
export function sourcePath(url) {
  return url.startsWith('/engine/') ? `Pana${url}` : url.replace(/^\/g\/([^/]+)\//, 'Pana/games/$1/public/');
}
export function assetContext(asset) {
  return `Pana Studio — ${asset.name}\nID: ${asset.id}\nCategoría: ${asset.category}\nFuente: ${sourcePath(asset.source)}\nConstructor: ${asset.factory}\nUsado en: ${asset.usedBy.join(', ')}\n\nLee Pana/AGENTS.md y docs/knowledge/pana-studio.md. Modifica la fuente compartida sin duplicar el modelo. Conserva escala, origen y contratos de los consumidores. Registra variantes en Pana/web/studio/catalog.js y verifica la vista previa y los juegos afectados.`;
}
