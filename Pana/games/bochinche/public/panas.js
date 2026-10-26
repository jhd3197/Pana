// The thirteen panas from Prueba de golpes: a costume over the player's own
// pana, three trajes and one poder on the neutral special (K). Pure data, so
// rules, the room and the scene share it. Names are locKey() source.
import { locKey } from '../../../engine/i18n.js';

// look: wardrobe pieces from the editor. paint: the colour keys a traje recolours.
// poder: move fields over the neutral special; frames are 60 Hz combat frames.
export const PANAS = [
  { id: 'trueno', key: '1', who: 'El Trueno', poder: locKey('Rayo'), fx: locKey('Electrizado'), color: '#ffc629', // i18n-ignore: a character name
    desc: locKey('Su martillo lo deja blanco y electrizado.'), trajes: ['#ffc629', '#c9d4e6', '#2f5fc4'],
    look: { top: 'shirt', back: 'capa', print: 'rayo', face: 'smile', extras: { bigote: true }, colors: { 'top:shirt:main': '#26355e', 'back:capa:accent': '#c0181e', 'extras:bigote:main': '#e8a040' } },
    paint: ['back:capa:main', 'print:rayo:main'], props: ['helmet', 'hammer'],
    poder: { damage: 14, angle: 72, startup: 18, recovery: 28, radius: 65, offset: { x: 100, y: 20 } } },
  { id: 'boxeador', key: '2', who: 'El Boxeador', poder: locKey('Candela'), fx: locKey('Tostado'), color: '#ff6b2b', // i18n-ignore: a character name
    desc: locKey('Guantes en llamas: lo deja tostado.'), trajes: ['#ff6b2b', '#e8323c', '#f3e9d7'],
    look: { hat: 'cinta', top: 'sport', print: 'numero', face: 'smile' },
    paint: ['hat:cinta:main', 'top:sport:main', 'print:numero:main'], props: ['gloves'],
    poder: { damage: 12, angle: 34, startup: 12, active: 8, recovery: 24, radius: 52, offset: { x: 60, y: 8 }, movement: { x: 520, y: 0 }, multiHit: 2 } },
  { id: 'raspadero', key: '3', who: 'El Raspadero', poder: locKey('Hielo'), fx: locKey('Congelado'), color: '#4fc8f0', // i18n-ignore: a character name
    desc: locKey('Le tira su raspado y lo congela en un bloque.'), trajes: ['#4fc8f0', '#ff5fa2', '#f3e9d7'],
    look: { hat: 'pesca', top: 'tropical', neck: 'bandana', face: 'laugh', colors: { 'hat:pesca:main': '#f3e9d7', 'neck:bandana:main': '#3d7bf2' } },
    paint: ['top:tropical:main'], props: ['cup'],
    poder: { damage: 10, angle: 18, startup: 20, recovery: 30, radius: 26, statusEffect: 'freeze', statusFrames: 38,
      projectile: { kind: 'raspado', speed: 430, gravity: 260, lifetimeFrames: 70, radius: 26, absorbable: true } } },
  { id: 'pelotero', key: '4', who: 'El Pelotero', poder: locKey('Jonrón'), fx: locKey('Jonrón'), color: '#8b4fe0', // i18n-ignore: a character name
    desc: locKey('Canta su batazo y lo saca del mapa.'), trajes: ['#8b4fe0', '#e8323c', '#2f5fc4'],
    look: { hat: 'gorra', top: 'sport', print: 'numero', face: 'smile' },
    paint: ['hat:gorra:main', 'top:sport:main', 'print:numero:main'], props: ['bat', 'mitt'],
    poder: { damage: 24, angle: 40, startup: 30, active: 4, recovery: 40, radius: 72, offset: { x: 70, y: 10 }, baseKnockback: 62, knockbackGrowth: 1.1, hitstop: 10, hitstun: 28 } },
  { id: 'llanero', key: '5', who: 'El Llanero', poder: locKey('Lazo'), fx: locKey('Enlazado'), color: '#b5773b', // i18n-ignore: a character name
    desc: locKey('Lo enlaza, le da vueltas y lo suelta.'), trajes: ['#b5773b', '#3d3d48', '#e8c46a'],
    look: { hat: 'llanero', top: 'shirt', neck: 'bandana', face: 'smile', extras: { bigote: true }, colors: { 'top:shirt:main': '#efe3c8', 'neck:bandana:main': '#c0262d', 'extras:bigote:main': '#3a2414' } },
    paint: ['hat:llanero:main'], props: ['coil'],
    // A long reach that throws the pana over the Llanero's shoulder.
    poder: { damage: 13, angle: 135, startup: 16, active: 7, recovery: 30, radius: 42, offset: { x: 150, y: 12 },
      hitboxes: [{ offset: { x: 40, y: 12 }, endOffset: { x: 165, y: 12 }, radius: 42, activeStart: 0, activeEnd: 6 }] } },
  { id: 'arepero', key: '6', who: 'El Arepero', poder: locKey('Arepazo'), fx: locKey('Aplastado'), color: '#ffd06b', // i18n-ignore: a character name
    desc: locKey('Voltea una arepa gigante y lo aplasta.'), trajes: ['#e0263a', '#ffd06b', '#2bb37a'],
    look: { hat: 'chef', top: 'chef', face: 'laugh', extras: { mejillas: true }, colors: { 'hat:chef:main': '#f6f6f2' } },
    paint: ['top:chef:main'], props: ['budare'],
    // Grounded panas get pressed into the floor; airborne ones are spiked.
    poder: { damage: 16, angle: 290, startup: 22, active: 5, recovery: 30, radius: 88, offset: { x: 70, y: 30 }, statusEffect: 'bury', statusFrames: 50 } },
  { id: 'tamborero', key: '7', who: 'El Tamborero', poder: locKey('Tambor'), fx: locKey('Al ritmo'), color: '#3aa84a', // i18n-ignore: a character name
    desc: locKey('Toca tres golpes y el cuarto lo bota.'), trajes: ['#3aa84a', '#e8323c', '#ffc629'],
    look: { hat: 'cinta', top: 'shirt', print: 'tricolor', neck: 'collar', face: 'laugh', colors: { 'top:shirt:main': '#f6f6f2' } },
    paint: ['hat:cinta:main'], props: ['drum'],
    poder: { damage: 12, angle: 68, startup: 10, active: 28, recovery: 20, radius: 70, offset: { x: 60, y: 10 }, multiHit: 4 } },
  { id: 'guacamayo', key: '8', who: 'El Guacamayo', poder: locKey('Ventarrón'), fx: locKey('Remolino'), color: '#3d7bf2', // i18n-ignore: a character name
    desc: locKey('Bate las alas y lo lleva un remolino.'), trajes: ['#3d7bf2', '#e8323c', '#2bb37a'],
    look: { back: 'alas', glasses: 'piloto', top: 'shirt', neck: 'bandana', face: 'smile', colors: { 'neck:bandana:main': '#ffc629' } },
    paint: ['top:shirt:main'], props: ['crest'],
    poder: { damage: 11, angle: 58, startup: 16, recovery: 26, radius: 40,
      projectile: { kind: 'gust', speed: 520, gravity: 0, lifetimeFrames: 48, radius: 40, absorbable: false } } },
  { id: 'manguangua', key: '9', who: 'El Manguangua', poder: locKey('Cafecito'), fx: locKey('Dormido'), color: '#6b4226', // i18n-ignore: a character name
    desc: locKey('Si dejas la puerta abierta, aparece y pide su cafecito.'), trajes: ['#4a4560', '#6b4226', '#c9d4e6'],
    look: { hat: 'lana', top: 'hoodie', face: 'smile', extras: { pecas: true }, colors: { 'hat:lana:main': '#3a3550' } },
    paint: ['top:hoodie:main'], props: ['tacita'],
    poder: { damage: 10, angle: 38, startup: 24, active: 6, recovery: 30, radius: 70, offset: { x: 90, y: 10 }, statusEffect: 'sleep', statusFrames: 70 } },
  { id: 'silbon', key: '0', who: 'El Silbón', poder: locKey('Silbido'), fx: locKey('Asustado'), color: '#22305a', // i18n-ignore: a character name
    desc: locKey('Si lo oyes cerca, está lejos. Viene por tus huesos.'), trajes: ['#3a3448', '#22305a', '#6b2a12'],
    look: { hat: 'llanero', top: 'shirt', face: 'natural', colors: { 'hat:llanero:main': '#2a2430' } },
    paint: ['top:shirt:main'], props: ['sack'],
    // He crosses the stage in one stride and hits whoever he passes.
    poder: { damage: 12, angle: 42, startup: 20, active: 10, recovery: 28, radius: 56, offset: { x: 50, y: 10 }, movement: { x: 940, y: 0 } } },
  { id: 'poseidon', key: 'Q', who: 'Poseidón', poder: locKey('Maremoto'), fx: locKey('Arrastrado'), color: '#1f8fd0', // i18n-ignore: a character name
    desc: locKey('Clava el tridente y una ola gigante lo arrastra.'), trajes: ['#1a8a9a', '#1f8fd0', '#2ad1b2'],
    look: { hat: 'corona', top: 'base', back: 'capa', face: 'smile', extras: { bigote: true }, colors: { 'hat:corona:main': '#1a6a9a', 'back:capa:accent': '#ffc629', 'extras:bigote:main': '#f2f2f2' } },
    paint: ['back:capa:main'], props: ['trident'],
    poder: { damage: 14, angle: 48, startup: 22, active: 16, recovery: 30, radius: 70, offset: { x: 140, y: 22 },
      hitboxes: [{ offset: { x: 40, y: 22 }, endOffset: { x: 240, y: 22 }, radius: 70, activeStart: 0, activeEnd: 15 }] } },
  { id: 'minotauro', key: 'W', who: 'El Minotauro', poder: locKey('Embestida'), fx: locKey('Volando'), color: '#c0282f', // i18n-ignore: a character name
    desc: locKey('Resopla, escarba y lo bota de un cabezazo.'), trajes: ['#c0282f', '#3d3d48', '#f3e9d7'],
    // Shirtless with a gold chain: his trajes tint his horns and ring.
    look: { top: 'base', neck: 'cadena', face: 'natural' },
    paint: [], props: ['horns', 'nosering'],
    poder: { damage: 15, angle: 52, startup: 24, active: 14, recovery: 26, radius: 58, offset: { x: 55, y: 10 }, movement: { x: 860, y: 0 }, baseKnockback: 50 } },
  { id: 'medusa', key: 'E', who: 'La Medusa', poder: locKey('Mirada'), fx: locKey('Piedra'), color: '#3fae4a', // i18n-ignore: a character name
    desc: locKey('Se quita los lentes y lo vuelve piedra.'), trajes: ['#2a7a4a', '#8b4fe0', '#ff5fa2'],
    look: { glasses: 'sun', top: 'shirt', neck: 'collar', face: 'smile' },
    paint: ['top:shirt:main'], props: ['snakes'],
    // Only a pana looking at her turns to stone.
    poder: { damage: 13, angle: 40, startup: 20, active: 6, recovery: 30, radius: 72, offset: { x: 140, y: 30 }, statusEffect: 'stone', statusFrames: 60, requiresFacingTarget: true } },
];
export const PANA_IDS = PANAS.map(p => p.id);
export const panaById = id => PANAS.find(p => p.id === id) ?? PANAS[0];
// Composite combat fighter: the style's move set with this pana's poder.
export const fighterId = (style, pana) => `${style}:${panaById(pana).id}`;
export const panaOfFighter = id => panaById(String(id ?? '').split(':')[1]);

// The costume worn over the player's own pana: their fur and face, this outfit.
export function costumeLook(pana, traje = 0, own = {}) {
  const p = panaById(pana), color = p.trajes[traje] ?? p.trajes[0];
  const colors = { ...(p.look.colors ?? {}) };
  for (const key of p.paint) colors[key] = color;
  return { ...p.look, fur: own.fur, face: own.face ?? p.look.face, extras: { ...(p.look.extras ?? {}) }, colors };
}

// Honest card stats read back from the poder itself, on a 1–5 scale.
export function poderStats(pana) {
  const m = panaById(pana).poder, steps = (v, lo, hi) => Math.max(1, Math.min(5, Math.round(1 + 4 * (v - lo) / (hi - lo))));
  const reach = m.projectile ? 5 : (m.hitboxes?.[0]?.endOffset?.x ?? m.offset?.x ?? 60) + (m.movement?.x ?? 0) / 8;
  return [
    [locKey('Daño'), steps(m.damage, 10, 24)],
    [locKey('Rapidez'), steps(32 - m.startup, 2, 22)],
    [locKey('Alcance'), m.projectile ? 5 : steps(reach, 60, 240)],
    [locKey('Empuje'), steps((m.baseKnockback ?? 45) + m.damage, 55, 86)],
  ];
}
