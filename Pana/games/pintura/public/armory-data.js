// Pure loadout rules, shared by the server, practice, HUD and armory.
// Marker, vest and grenade names are proper names and stay Spanish; generic
// names and blurbs are locKey() and shown with loc() (armory.js).
import { locKey } from '../../../engine/i18n.js';
import { PAINT_WEAPONS, PAINT_MELEE, PAINT_CLASSES, PAINT_MOUNTS, PAINT_OPTICS, PAINT_SOLIDS, PAINT_CAMO_IDS, classOf } from '../../../engine/play/paint-arsenal.js';
import { meleeDef } from '../../../engine/play/melee.js';
import { rangeDamage } from '../../../engine/play/weapon-falloff.js';
// The simulation step (rules.js TICK). A marker fires on a tick, so its real
// interval is its `cadence` rounded up to whole ticks: see shotInterval.
const STEP = .05;
// One marker: its model's name (paint-arsenal.js) and class come from the kit.
const marker = (id, blurb, stats) => ({ id, name: PAINT_WEAPONS[id], class: classOf(id).id, blurb, pellets: 1, ...stats });
// Eighteen markers in PAINT_WEAPONS order (number keys 1–9 follow it). The
// BALANCING section of docs/knowledge/pintura.md explains every number;
// tests/balance.test.js holds them inside each class's envelope.
// `damage` under 1 soaks: the pepazo lands once a pana has soaked a whole one.
export const MARKERS = [
 marker('pistol', locKey('La confiable. Precisa, pareja y ligera.'), { magazine:12, reload:1.3, cadence:.2, mobility:1, spread:0, speed:85, life:.6 }),
 marker('scatter', locKey('Tres bolas de cerca. De lejos pierde fuerza.'), { magazine:8, reload:1.8, cadence:.75, mobility:.93, spread:.18, pellets:3, speed:85, life:.2 }),
 marker('rapid', locKey('Alterna las dos marcadoras. Mucha presión; recargar lleva tiempo.'), { magazine:18, reload:2.4, cadence:.16, mobility:1, spread:.045, speed:85, life:.44 }),
 marker('rocket', locKey('Un cohete de pintura, un pepazo por rival. Cuatro cargas por vida; no permite correr.'), { magazine:1, reserve:3, reload:3.2, cadence:1, mobility:.63, spread:0, speed:18, life:2.4, splash:4.5, heavy:true }),
 // La Lejana: 70 m of reach; aimed through the scope it flies dead straight, from the hip it
 // wanders (`spread`), and scoped you walk at half speed. A head hit (any camera) knocks
 // out at once (`headshot`); a body hit paints 3 pepazos up to 10 m, fading to 1 at 50 m
 // (`falloff`, see rangedDamage). `damage` is the mid-range 2 the armory's pace sums use.
 marker('sniper', locKey('Francotiradora: a la cabeza saca de una; al cuerpo pega más de cerca que de lejos. 70 m de alcance. Clic derecho para la mira; sin ella se desvía.'), { magazine:4, reload:2.6, cadence:1.25, mobility:.9, spread:.1, aimSpread:0, scope:3.5, damage:2, falloff:{ near:10, far:50, close:3, min:1 }, headshot:true, speed:140, life:.5 }),
 // La Bazuca: a slow, visible rocket. A direct hit knocks out at once; the splash is tiny.
 marker('bazooka', locKey('Un cohete lento que se ve venir. Si pega directo, fuera de una; casi no salpica. Tres por vida.'), { magazine:1, reserve:2, reload:3.8, cadence:1.2, mobility:.7, spread:0, speed:14, life:3, splash:1.4, direct:true, heavy:true }),
 // La Metra: the close-range hose. Ten balls a second that wander and die at 29 m.
 marker('smg', locKey('Diez bolas por segundo de cerca. Se desvía y no llega lejos.'), { magazine:30, reload:2.4, cadence:.1, mobility:1, spread:.09, speed:80, life:.36 }),
 // La Licuadora: the most balls of all, half a pepazo each; heavy, slow to reload, no sprint.
 marker('minigun', locKey('Veinte bolas por segundo de medio pepazo. Pesada, sin correr y con recarga larga.'), { magazine:90, reload:4.4, cadence:.05, mobility:.68, spread:.13, damage:.5, speed:75, life:.41, heavy:true }),
 // La China: two stones paint one pepazo, but the pouch holds forty and refills in a blink.
 marker('slingshot', locKey('Medio pepazo por piedra, pero casi nunca se acaba. Recta, ligera y rápida de recargar.'), { magazine:40, reload:.8, cadence:.35, mobility:1.1, spread:0, damage:.5, speed:60, life:.7 }),
 // El Tambor: six paint grenades that burst on landing; mid range, splash, no sprint.
 marker('revolver', locKey('Seis granadas de pintura seguidas que revientan al caer. Alcance medio; no permite correr.'), { magazine:6, reserve:6, reload:3.4, cadence:.55, mobility:.8, spread:.02, speed:24, life:1.3, splash:2.2, heavy:true }),
 // La Corneta: five pellets in a wide cone, 12 m, three shots and a slow reload.
 marker('blunderbuss', locKey('Cinco bolas en abanico: de cerca no perdona, a 12 m ya no llega. Tres tiros.'), { magazine:3, reload:2.2, cadence:1, mobility:.92, spread:.28, pellets:5, speed:70, life:.17 }),
 // La Fumigadora: a stream of droplets, a fifth of a pepazo each, slow and short.
 marker('sprayer', locKey('Un chorro de pintura: cada gota es un quinto de pepazo. Corto, lento y casi sin fin.'), { magazine:120, reload:3, cadence:.05, mobility:.95, spread:.05, damage:.2, speed:32, life:.38 }),
 // El Llanero: six heavy rounds, two pepazos each, at mid range.
 marker('sixshooter', locKey('Seis tiros de dos pepazos cada uno. Lento entre tiro y tiro; recarga larga.'), { magazine:6, reload:2.2, cadence:.4, mobility:1, spread:.012, damage:2, speed:95, life:.55 }),
 // La Pulga: the lightest marker; fast but short and loose.
 marker('pdw', locKey('La más ligera. Rápida y de recarga corta, pero corta de alcance.'), { magazine:22, reload:1.5, cadence:.12, mobility:1.08, spread:.06, speed:78, life:.33 }),
 // La Parrandera: the all-rounder, steady at mid range.
 marker('carbine', locKey('Para todo: cadencia buena, precisa y 48 m de alcance.'), { magazine:24, reload:2, cadence:.15, mobility:.96, spread:.03, speed:95, life:.5 }),
 // El Tuqueque: slower than La Parrandera, tighter and further.
 marker('bullpup', locKey('Más lenta que La Parrandera, pero más recta y llega a 61 m.'), { magazine:20, reload:2.4, cadence:.18, mobility:.94, spread:.022, speed:105, life:.58 }),
 // El Zamuro: a scoped marksman marker, one pepazo a shot but quick for a rifle.
 marker('marksman', locKey('Tirador con mira de 2,2×: un pepazo por tiro, más rápido que La Lejana.'), { magazine:8, reload:2.3, cadence:.45, mobility:.92, spread:.06, aimSpread:.006, scope:2.2, speed:120, life:.52 }),
 // La Culebrona: belt-fed; long magazine, steady at 45 m, slow to move and reload.
 marker('lmg', locKey('Cincuenta bolas de cinta, estable a 45 m. Pesada para moverse y recargar.'), { magazine:50, reload:3.6, cadence:.12, mobility:.8, spread:.05, speed:90, life:.5 }),
];
// Los del pescozón: six close-range weapons on engine/play/melee.js (one person per
// swing, no ammo). reach in metres, arc the cone's half-angle, windup/recovery in
// seconds, damage in pepazos (a big stack: see "Melee" in docs/knowledge/pintura.md),
// knockback in metres, stun in seconds slowed, mobility like a marker's.
// La Chancleta alone is `throwable`: it flies, hits and comes back to the hand.
const melee = (id, blurb, stats) => ({ id, name: PAINT_MELEE[id], class: 'melee', blurb, melee: true, pellets: 1, knockback: 0, stun: 0, ...stats });
export const MELEE = [
 melee('bat', locKey('Largo y contundente: tres pepazos por batazo y cuatro si pega con la punta.'), { reach:2.4, arc:.55, windup:.25, recovery:.5, damage:3, knockback:.8, mobility:1.08, sweetSpot:{ from:.75, bonus:1 } }),
 melee('sandal', locKey('Corta y certera: tres pepazos de cerca. Clic derecho o V la lanza en arco; vuelve a tu mano a los 2,5 s.'), { reach:1.8, arc:.6, windup:.15, recovery:.55, damage:3, knockback:.4, mobility:1.12,
  throwable:{ speed:20, lift:.15, gravity:9.8, radius:.3, damage:3, life:2.5, recall:2.5, returns:'recall' } }),
 melee('roller', locKey('Barre ancho: dos pepazos a quien tengas delante, aunque esté de lado.'), { reach:2.2, arc:1, windup:.2, recovery:.4, damage:2, knockback:.5, mobility:1.06 }),
 melee('brush', locKey('La más rápida: un pepazo por brochazo, tres brochazos por segundo.'), { reach:1.8, arc:.7, windup:.1, recovery:.2, damage:1, knockback:.2, mobility:1.15 }),
 melee('bucket', locKey('Lento y pesado, el que más lejos llega: tres pepazos y un empujón; con la punta, cuatro.'), { reach:2.6, arc:.6, windup:.35, recovery:.75, damage:3, knockback:1.6, mobility:1, sweetSpot:{ from:.7, bonus:1 } }),
 melee('maraca', locKey('Un pepazo que aturde: el rival queda lento un segundo.'), { reach:2, arc:.75, windup:.1, recovery:.3, damage:1, knockback:.2, stun:1, mobility:1.12 }),
];
// Every weapon a kit can hold: the markers, then the melee set.
export const WEAPONS = [...MARKERS, ...MELEE];
export const weaponOf = id => WEAPONS.find(w => w.id === id) || null;
export const isMelee = id => MELEE.some(m => m.id === id);
// The classes that hold markers, in PAINT_CLASSES order (granadas and melee have none).
export const CLASSES = PAINT_CLASSES.filter(c => c.weapons.some(id => MARKERS.some(m => m.id === id)));
// The armory's class chips: the marker classes, then Los del pescozón.
export const MELEE_CLASS = PAINT_CLASSES.find(c => c.id === 'melee');
export const ARMORY_CLASSES = [...CLASSES, MELEE_CLASS];
// Every weapon in class order, melee last: the order Z/X (and [ ]) cycle through mid-round.
export const WEAPON_CYCLE = ARMORY_CLASSES.flatMap(c => c.weapons.filter(id => WEAPONS.some(m => m.id === id)));
// A kit carries two weapons: Arma 1 (hand 0) takes any weapon; Arma 2 (hand 1) is the
// sidearm, a pistol (Las de bolsillo) or a melee weapon (Los del pescozón), and starts
// as La Chancleta. Finish, camo, charm and splash stay shared by both.
export const SECONDARY_CLASSES = ARMORY_CLASSES.filter(c => c.id === 'pistolas' || c.id === 'melee');
export const SECONDARY = SECONDARY_CLASSES.flatMap(c => c.weapons.filter(id => WEAPONS.some(m => m.id === id)));
export const DEFAULT_SECONDARY = 'sandal';
export const classesFor = hand => hand === 1 ? SECONDARY_CLASSES : ARMORY_CLASSES;
export const allowedIn = (hand, id) => hand === 1 ? SECONDARY.includes(id) : WEAPONS.some(m => m.id === id);
// The next (step 1) or previous (step -1) weapon in WEAPON_CYCLE that `hand` may hold, wrapping round.
export const cycleWeapon = (id, step = 1, hand = 0) => { const list = WEAPON_CYCLE.filter(w => allowedIn(hand, w)), n = list.length, i = list.indexOf(id); return list[((i < 0 ? 0 : i + step) % n + n) % n]; };
// Seconds between shots as the simulation fires them: the cadence rounded up to whole ticks.
export function shotInterval(cadence) { let left = cadence, ticks = 0; do { left = Math.max(0, left - STEP); ticks++; } while (left > 0); return ticks * STEP; }
// Pepazos a body hit paints after flying `distance` metres. A marker with `falloff`
// ({ near, far, close, min }, engine/play/weapon-falloff.js) paints `close` up to `near`
// metres, then fewer down to `min` at `far` and beyond; any other marker its `damage`.
export const rangedDamage = (s, distance) => rangeDamage(s.falloff, distance, s.damage || 1);
// Pepazos a second with every ball landing; a direct rocket counts as a knockout (3).
export const dpsOf = s => (s.direct ? 3 : (s.damage ?? 1) * s.pellets) / (s.melee ? meleeInterval(s) : shotInterval(s.cadence));
// Seconds between two melee swings as the simulation runs them: windup and recovery in whole ticks.
const ticks = seconds => Math.max(1, Math.ceil(seconds / STEP - 1e-6)) * STEP;
export const meleeInterval = s => ticks(s.windup) + ticks(s.recovery);
// How far a throwable melee weapon flies from a level look before it lands (metres), for the armory.
export function throwRange(t, hand = 1.45) { const vy = Math.sin(t.lift) * t.speed, time = (vy + Math.sqrt(vy * vy + 2 * t.gravity * hand)) / t.gravity; return Math.min(time, t.life) * Math.cos(t.lift) * t.speed; }
// The gunsmith's slots: fixed and typed. A marker has a Mira, a Cañón, a Tolva and
// a Culata; a melee weapon a Puño, a Cabeza and a Pomo. Each slot holds one of its
// own PARTS or nothing. Shown in this order; a Mira's stats still go on last.
export const SLOTS = [
 {id:'optic',name:locKey('Mira'),icon:'kitOptic',swap:true},
 {id:'barrel',name:locKey('Cañón'),icon:'kitBarrel'},
 {id:'hopper',name:locKey('Tolva'),icon:'kitHopper'},
 {id:'stock',name:locKey('Culata'),icon:'kitStock'},
 {id:'grip',melee:true,name:locKey('Puño'),icon:'kitGrip'},
 {id:'head',melee:true,name:locKey('Cabeza'),icon:'kitDrip'},
 {id:'pommel',melee:true,name:locKey('Pomo'),icon:'kitStrap'},
];
export const slotOf = id => SLOTS.find(s => s.id === id) || null;
// Every option, one row each: a new Mira or hopper size is one more row here (and
// the markers that take it in FITS). `part` is the model piece that shows it
// (paintball-kit.js PAINT_PART_LABELS), `look` how the model draws it.
// Stats: `mul` multiplies, then `add` adds (a stat the weapon lacks stays absent);
// `when` swaps in another effect for the weapons WHEN names. A Mira's `aim`: zoom
// while aiming (a scoped marker multiplies its own scope by `scopeBoost` instead),
// aimSpread as a share of the hip spread, sens the look speed while aiming,
// hipSpread a tighter hip fire. Numbers and reasons: docs/knowledge/pintura.md.
const mira = (id, name, aim) => ({ id, slot:'optic', name, icon:id==='scope'?'kitScope':'kitOptic', part:'optic', look:{ opticKind:id }, add:{ mobility:-.02 }, aim });
export const PARTS = [
 mira('dot', locKey('Punto rojo'), { zoom:1.35, aimSpread:.75, sens:.9 }),
 mira('holo', locKey('Holográfica'), { zoom:1.5, aimSpread:.7, sens:.85 }),
 mira('laser', locKey('Láser'), { zoom:1.1, aimSpread:.8, sens:1, hipSpread:.85 }),
 mira('scope', locKey('Telescópica'), { zoom:2.4, aimSpread:.5, sens:.75, scopeBoost:1.3 }),
 mira('pin', locKey('De pines'), { zoom:1.2, aimSpread:.6, sens:.95 }),
 // A marker that already flies straight cannot get tighter: its barrel sends the shot out faster.
 { id:'barrel', slot:'barrel', name:locKey('Cañón afinado'), icon:'kitBarrel', part:'barrel', mul:{ spread:.65, life:1.12, aimSpread:.65 }, add:{ mobility:-.05 },
  when:{ straight:{ mul:{ speed:1.12, aimSpread:.65 }, add:{ mobility:-.05 } } } },
 { id:'minihopper', slot:'hopper', name:locKey('Tolva chica'), icon:'kitHopper', part:'hopper', look:{ hopperScale:.72 }, mul:{ magazine:.7, reload:.8 }, add:{ mobility:.03 } },
 // A launcher with spare rounds takes one more round instead of a bigger load.
 { id:'hopper', slot:'hopper', name:locKey('Tolva grande'), icon:'kitHopper', part:'hopper', mul:{ magazine:1.4, reload:1.25 }, add:{ mobility:-.05 },
  when:{ reserve:{ mul:{ reload:1.25 }, add:{ reserve:1, mobility:-.05 } } } },
 { id:'stock', slot:'stock', name:locKey('Culata ligera'), icon:'kitStock', part:'stock', mul:{ spread:1.3, splash:.8 }, add:{ mobility:.05, spread:.015, aimSpread:.008 } },
 // Melee: on the grip, the head and the pommel of every melee model, one tradeoff each.
 { id:'tape', slot:'grip', name:locKey('Cinta de agarre'), icon:'kitGrip', part:'tape', mul:{ windup:.8, recovery:.8, reach:.85 } },
 { id:'drip', slot:'head', name:locKey('Goteo de pintura'), icon:'kitDrip', part:'drip', mul:{ recovery:1.25 }, add:{ damage:1 } },
 { id:'strap', slot:'pommel', name:locKey('Correa'), icon:'kitStrap', part:'strap', mul:{ recovery:.85 }, add:{ mobility:-.04 },
  when:{ throwable:{ mul:{ 'throwable.recall':.6 }, add:{ mobility:-.04 } } } },
];
const PARTS_BY_ID = Object.fromEntries(PARTS.map(p => [p.id, p]));
export const partOf = id => typeof id === 'string' && Object.hasOwn(PARTS_BY_ID, id) ? PARTS_BY_ID[id] : null;
// Which weapons a `when` effect is for.
const WHEN = { straight: s => !s.melee && !(s.spread > 0), reserve: s => s.reserve != null, throwable: s => !!s.throwable };
// Each Mira kind's aim tuning, by kind (the HUD's title, the balance tests).
export const OPTICS = Object.fromEntries(PARTS.filter(p => p.aim).map(p => [p.id, { name:p.name, ...p.aim }]));
// The Mira a marker's model comes with (PAINT_OPTICS): its stock option, always allowed.
export const opticOf = weaponId => PAINT_OPTICS[weaponId] || null;
// What each marker's slots take. `optic`: Miras besides its stock one; small markers
// carry small sights, the long ones a scope. `hopper`: small markers the small one,
// launchers and La Corneta's three shots only the big one. A slot left out takes every part of
// that slot its model has a mount for (PAINT_MOUNTS).
const BOTH = ['minihopper', 'hopper'], BIG = ['hopper'], SMALL = ['minihopper'];
const FITS = {
 pistol:{ optic:['laser'], hopper:SMALL }, rapid:{ optic:['dot'], hopper:SMALL }, sixshooter:{ optic:['laser'], hopper:SMALL },
 smg:{ optic:['dot', 'laser'], hopper:BOTH }, pdw:{ optic:['holo', 'laser'], hopper:BOTH },
 carbine:{ optic:['dot', 'scope'], hopper:BOTH }, bullpup:{ optic:['dot', 'scope'], hopper:BOTH },
 minigun:{ optic:['holo'], hopper:BOTH }, lmg:{ optic:['holo', 'scope'], hopper:BOTH },
 scatter:{ optic:['dot'], hopper:BOTH }, blunderbuss:{ optic:['dot', 'holo'], hopper:BIG },
 sniper:{ optic:[], hopper:BOTH }, marksman:{ optic:['holo', 'scope'], hopper:BOTH },
 rocket:{ optic:['dot'], hopper:BIG }, bazooka:{ optic:['dot'], hopper:BIG }, revolver:{ optic:['dot'], hopper:BIG },
 slingshot:{ optic:[], hopper:BOTH }, sprayer:{ optic:['holo', 'laser'], hopper:BOTH },
};
// Equipo: the pana's class, one row each (adding a class is one more row). Every
// number is read by the simulation from the validated kit (rules.js), never from
// the client: `mobility` multiplies the walk, `toughness` adds pepazos to the
// room's aguante, `regen` speeds the paint wearing off, `stepNoise` scales how far
// and how loud rivals hear the steps (sounds.js), `markerScale` the dot rivals see
// on their minimap and how close they must be to see it, `grenades` the ones
// carried, `grenadeRecharge` the seconds to get one back. `vest` draws the padded
// vest. Each class pays for what it gets: docs/knowledge/pintura.md, "Clases".
export const ARMOR = [
 {id:'base',name:locKey('Balanceado'),icon:'kitVest',mobility:1,toughness:0,regen:1,stepNoise:1,markerScale:1,grenades:1,grenadeRecharge:30},
 {id:'rapido',name:locKey('Rápido'),icon:'kitBolt',mobility:1.08,toughness:-1,regen:1,stepNoise:1.15,markerScale:1,grenades:1,grenadeRecharge:30},
 {id:'tanque',name:locKey('Tanque'),icon:'kitShield',mobility:.9,toughness:1,regen:1,stepNoise:1.25,markerScale:1.2,grenades:1,grenadeRecharge:30,vest:true},
 {id:'regenera',name:locKey('Regenera'),icon:'kitRegen',mobility:.97,toughness:0,regen:1.8,stepNoise:1,markerScale:1,grenades:1,grenadeRecharge:40},
 {id:'sigiloso',name:locKey('Sigiloso'),icon:'kitStep',mobility:.96,toughness:0,regen:.75,stepNoise:.4,markerScale:.55,grenades:1,grenadeRecharge:30},
 {id:'granadero',name:locKey('Granadero'),icon:'kitGrenade',mobility:.95,toughness:0,regen:.9,stepNoise:1,markerScale:1,grenades:2,grenadeRecharge:18},
];
// Kits saved before classes named a vest: each becomes the class nearest to it.
export const LEGACY_ARMOR = { shirt:'base', padded:'tanque', wind:'rapido' };
export const armorOf = id => ARMOR.find(a => a.id === (typeof id === 'string' && Object.hasOwn(LEGACY_ARMOR, id) ? LEGACY_ARMOR[id] : id)) || ARMOR[0];
// Thrown grenades (rules.js throwGrenade, engine/play/lob.js). `speed` is the launch
// speed at no charge and full charge (m/s): from a level look that carries about
// 12 m and 28 m before the first bounce. The fuse starts on release. `damage` is
// the pepazos inside 40% of `radius`; it falls to a third at the edge (never
// under one). `restitution`/`friction`/`roll` shape the bounces; `sticky` stops dead.
export const GRENADES = [
 {id:'pinita',name:'La Piñita',blurb:locKey('Explosión de pintura: dos pepazos en el centro, uno en el borde.'),radius:4.5,fuse:2.4,damage:2,speed:[11,18],restitution:.38,friction:.62,roll:3}, // i18n-ignore: proper name
 {id:'pegajosa',name:'La Pegajosa',blurb:locKey('Se pega donde cae, salpica menos y deja un charco que frena rivales.'),radius:2.8,fuse:2.2,damage:1,speed:[11,18],sticky:true,puddle:3.3}, // i18n-ignore: proper name
 {id:'chispita',name:'La Chispita',blurb:locKey('Rebota y rebota: llega más lejos y su mecha dura más.'),radius:3.6,fuse:2.8,damage:2,speed:[11,18],restitution:.6,friction:.72,roll:3.2}, // i18n-ignore: proper name
];
export const grenadeDef = id => GRENADES.find(g=>g.id===id) || GRENADES[0];
export const FINISHES = [{id:'factory',name:locKey('De fábrica'),color:null},{id:'caribe',name:'Caribe',color:'#29c5cd'},{id:'mango',name:'Mango',color:'#f28b42'},{id:'uva',name:'Uva',color:'#8d85df'}];
export const CHARMS = [{id:'none',name:locKey('Sin llavero')},{id:'mango',name:'Manguito'},{id:'ball',name:locKey('Bola de pintura')}];
export const PATTERNS = [{id:'splat',name:locKey('Salpicadura')},{id:'stripe',name:locKey('Rayas')},{id:'dots',name:locKey('Puntos')}];
const pick = (list,id) => list.some(x=>x.id===id) ? id : list[0].id;
// Camuflajes: a kit names one camo id or none (null: the factory body). The catalog with
// names and unlock rules is camos.js (loaded with the armory's camo tab); the rules only
// need the ids. The solid ones are everyone's from the start; the rest a player must own
// (pana.sh says which, signed: server/src/camo-trust.js), so selectKit checks them.
export const CAMO_IDS = PAINT_CAMO_IDS;
export const START_CAMOS = Object.freeze(Object.keys(PAINT_SOLIDS));
// What an unowned pick falls back to.
export const FALLBACK_CAMO = START_CAMOS[0];
const cleanCamo = id => typeof id === 'string' && CAMO_IDS.includes(id) ? id : null;
// Whether a player owning `owned` (a Set or array of ids, or nothing) may wear `camo`.
export const ownsCamo = (camo, owned) => camo == null || START_CAMOS.includes(camo) || (owned instanceof Set ? owned.has(camo) : Array.isArray(owned) && owned.includes(camo));
// Which slots each weapon has and the parts each takes: { slot: [part ids] }, the
// stock Mira first. Only slots its model has a mount for (PAINT_MOUNTS).
export const SLOT_RULES = Object.fromEntries(WEAPONS.map(w => {
 const mounts = PAINT_MOUNTS[w.id] || [], fit = FITS[w.id] || {}, rules = {};
 for (const slot of SLOTS) {
  const parts = PARTS.filter(p => p.slot === slot.id && mounts.includes(p.part)).map(p => p.id);
  const allowed = slot.id === 'optic' ? [opticOf(w.id), ...(fit.optic || [])].filter((id, i, all) => parts.includes(id) && all.indexOf(id) === i)
   : fit[slot.id] ? parts.filter(id => fit[slot.id].includes(id)) : parts;
  if (allowed.length) rules[slot.id] = allowed;
 }
 return [w.id, rules];
}));
// The slots a weapon shows, in SLOTS order.
export const slotsFor = weaponId => SLOTS.filter(s => SLOT_RULES[weaponId]?.[s.id]);
export const canFit = (weaponId, slot, partId) => !!SLOT_RULES[weaponId]?.[slot]?.includes(partId);
// Kits saved before typed slots list part ids (`attachments`: up to three, any slot,
// null gaps). Each lands in its part's slot; the old generic Mira is the stock one.
const legacySlot = (weapon, id) => id === 'optic' ? ['optic', opticOf(weapon)] : partOf(id) ? [partOf(id).slot, id] : null;
function cleanSlots(weapon, value) {
 const rules = SLOT_RULES[weapon], slots = Object.fromEntries(Object.keys(rules).map(slot => [slot, null])), raw = value.slots;
 if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
  for (const slot of Object.keys(slots)) { const id = Object.hasOwn(raw, slot) ? raw[slot] : null; if (typeof id === 'string' && rules[slot].includes(id)) slots[slot] = id; }
 } else if (Array.isArray(value.attachments)) {
  for (const old of value.attachments.slice(0, 8)) { const at = legacySlot(weapon, old); if (at && slots[at[0]] === null && rules[at[0]].includes(at[1])) slots[at[0]] = at[1]; }
 }
 return slots;
}
// A kit's `slots` has every slot its weapon has: a part id or null; `weapon2` and
// `slots2` are Arma 2's. Kits saved before Arma 2 get La Chancleta.
export function cleanKit(value={}) {
 if (!value || typeof value !== 'object' || Array.isArray(value)) value={};
 const weapon=pick(WEAPONS,value.weapon), weapon2=SECONDARY.includes(value.weapon2)?value.weapon2:DEFAULT_SECONDARY;
 return { weapon, slots:cleanSlots(weapon,value), weapon2, slots2:cleanSlots(weapon2,{slots:value.slots2}), armor:armorOf(value.armor).id, grenade:pick(GRENADES,value.grenade), finish:pick(FINISHES,value.finish), charm:pick(CHARMS,value.charm), pattern:pick(PATTERNS,value.pattern), camo:cleanCamo(value.camo) };
}
// One gun of a kit as a one-gun kit: Arma 2 (hand 1) moves into `weapon` and `slots`.
export const gunOf = (kit, hand = 0) => { const k = cleanKit(kit); return hand === 1 ? { ...k, weapon: k.weapon2, slots: k.slots2 } : k; };
const withGun = (kit, hand, weapon, slots) => cleanKit(hand === 1 ? { ...kit, weapon2: weapon, slots2: slots } : { ...kit, weapon, slots });
// The part ids fitted to a gun, in SLOTS order.
export const partsOf = (kit, hand = 0) => { const slots = gunOf(kit, hand).slots; return SLOTS.map(s => slots[s.id]).filter(Boolean); };
// Puts part `id` (or null to clear) in `slot` of a gun. Returns a new clean kit,
// unchanged when the weapon has no such slot or the part does not fit it.
export function setPart(kit, slot, id, hand = 0) {
 const clean=cleanKit(kit), gun=gunOf(clean,hand); if(!Object.hasOwn(gun.slots,slot) || (id!=null && !canFit(gun.weapon,slot,id))) return clean;
 return withGun(clean,hand,gun.weapon,{...gun.slots,[slot]:id??null});
}
// A new weapon keeps the parts it takes. A Mira it cannot take becomes its stock
// one; any other part that does not fit leaves the kit and is listed in `dropped`.
// Arma 2 refuses anything but a sidearm (the kit comes back unchanged).
export function changeWeapon(kit, weaponId, hand = 0) {
 const before=cleanKit(kit), gun=gunOf(before,hand);
 if(hand===1 && !SECONDARY.includes(weaponId)) return { kit:before, dropped:[] };
 const weapon=pick(WEAPONS,weaponId), rules=SLOT_RULES[weapon], slots={}, dropped=[];
 for (const slot of Object.keys(rules)) {
  const id=gun.slots[slot]; slots[slot]=!id?null:rules[slot].includes(id)?id:slotOf(slot).swap?rules[slot][0]:null;
  if(id && !slots[slot]) dropped.push(id);
 }
 for (const [slot,id] of Object.entries(gun.slots)) if(id && !rules[slot]) dropped.push(id);
 return { kit:withGun(before,hand,weapon,slots), dropped };
}
// What the model draws for a gun (paintball-kit.js createPaintKit options): the
// pieces fitted and how (`opticKind`, `hopperScale`).
export function kitModel(kit, hand = 0) {
 const look={ attachments:[], opticKind:null, hopperScale:1 };
 for (const id of partsOf(kit, hand)) { const p=PARTS_BY_ID[id]; look.attachments.push(p.part); Object.assign(look,p.look); }
 return look;
}
// One part's effect on stats `s` (its `when` effect for the weapons that names).
const pathOf = (s, key) => { const at = key.split('.'), last = at.pop(); return [at.reduce((o, k) => o?.[k], s), last]; };
function applyPart(s, part) {
 const variant = Object.keys(part.when || {}).find(k => WHEN[k](s)), e = variant ? part.when[variant] : part;
 for (const [key, n] of Object.entries(e.mul || {})) { const [o, k] = pathOf(s, key); if (o && o[k] != null) o[k] *= n; }
 for (const [key, n] of Object.entries(e.add || {})) { const [o, k] = pathOf(s, key); if (o && o[k] != null) o[k] += n; }
 // Whole balls and rounds, rounded up (float noise trimmed first).
 for (const k of ['magazine', 'reserve']) if (s[k]) s[k] = Math.ceil(Math.round(s[k] * 1e6) / 1e6);
 if (part.aim) {
  const a = part.aim; s.optic = part.id; s.sens = a.sens;
  if (a.hipSpread) s.spread *= a.hipSpread;
  s.aimSpread = (s.aimSpread ?? s.spread) * a.aimSpread;
  s.zoom = s.scope ? s.scope * (a.scopeBoost || 1) : a.zoom;
 }
}
// The numbers of one gun (hand 0 Arma 1, hand 1 Arma 2); pistol-only rooms make both La Chispa.
export function kitStats(value={}, options={}, hand=0) {
 let kit=gunOf(value,hand===1?1:0); if(options?.weapons==='pistol' && kit.weapon!=='pistol') kit=changeWeapon(kit,'pistol').kit;
 const s={...weaponOf(kit.weapon)}, armor=armorOf(kit.armor), parts=partsOf(kit).map(partOf);
 s.zoom=s.scope||1.2; s.sens=1; s.optic=null;
 if(s.melee) return meleeStats(s,parts,armor,options);
 // The Mira goes on last, so it steadies whatever spread the other parts left.
 for(const part of [...parts.filter(p=>!p.aim),...parts.filter(p=>p.aim)]) applyPart(s,part);
 wear(s,armor,options);
 if(options.fastReload) s.reload*=.55/1.3;
 s.damage=s.damage||1; s.sprint=!s.heavy;
 // Aiming (right mouse, F, LT, Mira) only does anything with a scope or a Mira.
 s.aims=s.aimSpread!=null; return s;
}

// The class on top of a weapon's numbers: its walk, aguante (the room's plus the
// class's, never under one), paint wear, steps, minimap dot and grenades.
function wear(s,c,options) {
 s.mobility*=c.mobility; s.toughness=Math.max(1,(options?.toughness||3)+c.toughness);
 Object.assign(s,{armor:c.id,regen:c.regen,stepNoise:c.stepNoise,markerScale:c.markerScale,grenades:c.grenades,grenadeRecharge:c.grenadeRecharge});
}
// A melee weapon's numbers with its parts and armor: no ammo, no reload, never aims.
// `cadence` is the swing interval, so whatever reads a marker's pace reads this too.
function meleeStats(s,parts,armor,options) {
 if(s.throwable) s.throwable={...s.throwable}; if(s.sweetSpot) s.sweetSpot={...s.sweetSpot};
 for(const part of parts) applyPart(s,part);
 // The thrown chancla paints what a strike paints, drips included.
 if(s.throwable) s.throwable.damage=s.damage;
 wear(s,armor,options);
 return Object.assign(s,{cadence:s.windup+s.recovery,magazine:0,reload:0,speed:0,life:0,spread:0,sprint:true,aims:false});
}
// The engine definition (engine/play/melee.js) behind a melee kit's stats.
export const meleeOf = s => meleeDef(s);
// A bounded build summary, not a player rank or a damage multiplier. All inputs
// come from the same effective stats used by Arena, including room overrides.
export function kitRating(value={}, options={}) {
 const s=kitStats(value,options), grenade=GRENADES.find(g=>g.id===cleanKit(value).grenade);
 const unit=n=>Math.max(0,Math.min(1,n));
 const lob=.025*unit(grenade.radius*grenade.damage/(grenade.fuse*4));
 // The class beyond its walk and aguante: faster healing, quieter steps, a smaller dot, more grenades (0 for Balanceado).
 const gear=.03*unit((s.regen-1)+(1-s.stepNoise)*.6+(1-s.markerScale)*.6+(s.grenades-1)*.5+(30/s.grenadeRecharge-1)*.3);
 const top=n=>Math.min(800,Math.round(n));
 // Melee: reach (or the throw) for range, the cone for precision, pepazos a second, swing pace.
 if(s.melee) return top(100+700*(.15*unit((s.throwable?throwRange(s.throwable):s.reach)/60)+.10*unit(s.arc/1.2)+.20*unit(dpsOf(s)/6)+.05
  +.10*unit(1-meleeInterval(s)/1.5)+.15*unit(s.mobility/1.15)+.15*unit(s.toughness/6)+.025*unit((s.knockback+s.stun)/2)+lob+gear));
 const sustained=s.magazine*s.pellets*s.damage/(s.magazine*s.cadence+s.reload);
 const score=.15*unit(s.speed*s.life/60)+.10*unit(1-(s.aimSpread??s.spread)/.3)
  +.20*unit(sustained/6)+.10*unit((s.magazine+(s.reserve||0))/26)
  +.10*unit(1-s.reload/4)+.15*unit(s.mobility/1.15)
  +.15*unit(s.toughness/6)+.025*unit(((s.splash||0)+s.pellets-1+(s.damage-1)*2+(s.direct?3:0))/5)
  +lob+gear;
 return top(100+700*score);
}
