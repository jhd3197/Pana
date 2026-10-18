// Model metadata only: no Three.js, construction or game imports.
const mine = (id, name, factory, description, tags, previewOptions = null, source = '/engine/models/props/mine.js') => ({
  id, name, category: 'Mina', source, factory, usedBy: ['Pana Studio'], previewOptions, description,
  tags: ['mina', ...tags], pack: 'mine',
});

export default [
  mine('gold-miner', 'Minero', 'miner', 'Minero con casco y lámpara; poses de caminar, picar, sentarse, empujar y descansar.', ['personaje', 'animado'], { seed: 3, pose: 'dig' }, '/engine/models/props/mine-miner.js'),
  mine('mine-cart', 'Vagoneta minera', 'mineCart', 'Vagoneta de hierro sobre ruedas, cargada de roca y pepitas de oro.', ['vagoneta', 'oro', 'rieles'], { seed: 41, load: 'gold' }),
  mine('mine-track', 'Vía minera con caballetes', 'mineTrack', 'Rieles sobre durmientes que levantan caballetes arriostrados donde el terreno se hunde.', ['rieles', 'puente', 'caballete'], { groundHeight: 0 }),
  mine('gold-vein', 'Veta de oro', 'goldVein', 'Cristales de oro brotando de una pared de roca, con destellos.', ['oro', 'cristales', 'roca'], { seed: 21 }),
  mine('ore-pile', 'Montón de mineral', 'orePile', 'Montículo de roca con pepitas de oro mezcladas.', ['oro', 'roca', 'mineral'], { seed: 22 }),
  mine('mine-crate', 'Caja minera', 'mineCrate', 'Caja de tablas con refuerzos en los cantos.', ['caja', 'madera'], { seed: 11 }),
  mine('tnt-crate', 'Caja de dinamita', 'mineCrate', 'Caja roja de explosivos con etiqueta crema.', ['caja', 'dinamita', 'peligro'], { seed: 12, tnt: true }),
  mine('mine-barrel', 'Barril minero', 'mineBarrel', 'Barril de madera con aros de hierro y una pepita encima.', ['barril', 'madera'], { gold: true }),
  mine('mine-lantern', 'Farol de mina', 'mineLantern', 'Farol de hierro encendido para colgar de una viga.', ['farol', 'luz'], { light: false }),
  mine('mine-lantern-post', 'Poste con farol', 'mineLanternPost', 'Poste de madera con brazo y farol colgante.', ['farol', 'luz', 'poste'], { light: false }),
  mine('bulb-wire', 'Guirnalda de bombillos', 'bulbWire', 'Cable colgante entre dos postes con bombillos encendidos.', ['luz', 'bombillos', 'cable'], { span: 10 }),
  mine('mine-ladder', 'Escalera de mano', 'mineLadder', 'Escalera de madera inclinada para bajar a los bancos.', ['escalera', 'madera'], { height: 4 }),
  mine('mine-stairs', 'Escalera de tablas', 'mineStairs', 'Tramo de escalones de madera con pasamanos.', ['escalera', 'madera'], { steps: 7 }),
  mine('mine-pickaxe', 'Pico', 'minePickaxe', 'Pico de hierro con mango de madera, apoyado en el suelo.', ['herramienta', 'pico']),
  mine('mine-shovel', 'Pala', 'mineShovel', 'Pala de mina con hoja de hierro.', ['herramienta', 'pala']),
  mine('mine-wheelbarrow', 'Carretilla minera', 'mineWheelbarrow', 'Carretilla de hierro con una carga de piedras y oro.', ['carretilla', 'herramienta'], { seed: 31 }),
  mine('mine-portal', 'Boca de mina', 'minePortal', 'Entrada de túnel con marcos de madera, letrero, farol, herramientas y dinamita.', ['túnel', 'entrada', 'letrero'], { seed: 51, name: 'MINA 1' }),
  mine('mine-support', 'Marco de entibado', 'mineSupport', 'Marco de troncos que apuntala la galería, con farol.', ['madera', 'túnel', 'soporte'], { width: 2.8 }),
  mine('mine-scaffold', 'Andamio de veta', 'mineScaffold', 'Andamio de dos pisos con escaleras frente a una pared con vetas de oro.', ['andamio', 'oro', 'madera'], { seed: 61 }),
  mine('miner-shack', 'Caseta de mineros', 'minerShack', 'Caseta de tablas con techo de zinc, ventana encendida, barril y caja.', ['caseta', 'campamento', 'zinc'], { seed: 71 }),
  mine('assay-table', 'Mesa de pesaje de oro', 'assayTable', 'Mesa con balanza dorada y pepitas sueltas.', ['oro', 'mesa', 'balanza'], { seed: 81 }),
  mine('water-wheel', 'Rueda hidráulica', 'waterWheel', 'Rueda de paletas que gira sobre su eje, para un río o canal.', ['rueda', 'agua', 'animado'], { radius: 3 }),
  mine('stamp-mill', 'Molino de pisones', 'stampMill', 'Estructura de madera con tolva, árbol de levas y cinco pisones que golpean.', ['molino', 'máquina', 'animado'], { seed: 91 }),
  mine('lift-tower', 'Torre de ascensor minero', 'liftTower', 'Castillete arriostrado con polea; la jaula sube y baja con un minero.', ['ascensor', 'torre', 'animado'], { height: 14 }),
];
