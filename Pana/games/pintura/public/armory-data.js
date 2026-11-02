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
// The next (step 1) or previous (step -1) weapon in WEAPON_CYCLE, wrapping round.
export const cycleWeapon = (id, step = 1) => { const n = WEAPON_CYCLE.length, i = WEAPON_CYCLE.indexOf(id); return WEAPON_CYCLE[((i < 0 ? 0 : i + step) % n + n) % n]; };
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
export const ATTACHMENTS = [
 {id:'barrel',name:locKey('Cañón afinado'),blurb:locKey('Más precisión y alcance; en las marcadoras que no se desvían, la bola o el cohete sale más rápido. −5% movilidad.')},
 {id:'hopper',name:locKey('Tolva grande'),blurb:locKey('Más bolas; recarga más lenta y −5% movilidad. En El Cohetón y La Bazuca: un cohete extra.')},
 {id:'stock',name:locKey('Culata ligera'),blurb:locKey('+5% movilidad, menos control. Los cohetes pierden radio de salpicadura.')},
 {id:'optic',name:locKey('Mira'),blurb:locKey('Apuntas con clic derecho: acerca la vista y endereza el tiro. Cada marcadora trae su mira. −2% movilidad.')},
 // Melee parts, on the grip, the head and the pommel of every melee model: one tradeoff each.
 {id:'tape',melee:true,name:locKey('Cinta de agarre'),blurb:locKey('Golpeas 20% más rápido; llegas 15% menos lejos.')},
 {id:'drip',melee:true,name:locKey('Goteo de pintura'),blurb:locKey('+1 pepazo por golpe; te recuperas 25% más lento.')},
 {id:'strap',melee:true,name:locKey('Correa'),blurb:locKey('La chancla lanzada vuelve 40% antes; las demás se recuperan 15% más rápido. −4% movilidad.')},
];
// Each Mira kind's aim tuning (the kind comes with the marker: PAINT_OPTICS).
// zoom: magnification while aiming (a scoped marker multiplies its own scope by
// `scopeBoost` instead); aimSpread: the aimed spread as a share of the hip spread;
// sens: look speed while aiming, on top of the zoom's own slowdown; hipSpread:
// the laser also tightens hip fire. Numbers and reasons: docs/knowledge/pintura.md.
export const OPTICS = {
 dot:{name:locKey('Punto rojo'),zoom:1.35,aimSpread:.75,sens:.9},
 holo:{name:locKey('Holográfica'),zoom:1.5,aimSpread:.7,sens:.85},
 laser:{name:locKey('Láser'),zoom:1.1,aimSpread:.8,sens:1,hipSpread:.85},
 scope:{name:locKey('Mira telescópica'),zoom:2.4,aimSpread:.5,sens:.75,scopeBoost:1.3},
 pin:{name:locKey('Mira de pines'),zoom:1.2,aimSpread:.6,sens:.95},
};
// The Mira kind a marker takes.
export const opticOf = weaponId => PAINT_OPTICS[weaponId] || null;
export const ARMOR = [
 {id:'shirt',name:'La Franela',blurb:locKey('Aguante y movilidad normales.'),mobility:1,toughness:0}, // i18n-ignore: proper name
 {id:'padded',name:'El Acolchado',blurb:locKey('+1 pepazo de aguante, −10% movilidad.'),mobility:.9,toughness:1}, // i18n-ignore: proper name
 {id:'wind',name:'El Cortaviento',blurb:locKey('+8% movilidad, −1 pepazo de aguante.'),mobility:1.08,toughness:-1}, // i18n-ignore: proper name
];
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
// Three attachment slots. A kit stores `attachments` as a fixed [slot 0, slot 1,
// slot 2] array of id|null so a part stays in the slot the player put it in. Every
// marker's mounts (muzzle, feed, stock, rail) are separate places on the model, so
// any three parts fit together; the fourth stays in the box.
export const ATTACHMENT_SLOTS = 3;
// Which attachments fit which marker: the mounts its model has (paint-arsenal.js).
export const ATTACHMENT_RULES = Object.fromEntries(WEAPONS.map(m=>[m.id,ATTACHMENTS.map(a=>a.id).filter(id=>PAINT_MOUNTS[m.id]?.includes(id))]));
export const canAttach = (weaponId, attachmentId) => !!ATTACHMENT_RULES[weaponId]?.includes(attachmentId);
export function cleanKit(value={}) {
 if (!value || typeof value !== 'object') value={};
 const weapon=pick(WEAPONS,value.weapon), raw=Array.isArray(value.attachments)?value.attachments:[];
 // Up to ATTACHMENT_SLOTS entries are slot positions; a longer list (old or hostile) is packed.
 const list=raw.length>ATTACHMENT_SLOTS?raw.filter(id=>canAttach(weapon,id)).filter((id,i,all)=>all.indexOf(id)===i):raw;
 const attachments=Array.from({length:ATTACHMENT_SLOTS},(_,i)=>{const id=list[i];return canAttach(weapon,id) && !list.slice(0,i).includes(id) ? id : null;});
 return { weapon, attachments, armor:pick(ARMOR,value.armor), grenade:pick(GRENADES,value.grenade), finish:pick(FINISHES,value.finish), charm:pick(CHARMS,value.charm), pattern:pick(PATTERNS,value.pattern), camo:cleanCamo(value.camo) };
}
// The attachment in each slot, always ATTACHMENT_SLOTS long.
export const slotsOf = kit => cleanKit(kit).attachments;
// Puts `id` (or null to clear) in slot `index`; the same part in the other slot moves here.
// Returns a new clean kit, or the kit unchanged when the part does not fit the marker.
export function setSlot(kit, index, id) {
 const clean=cleanKit(kit); if(!(index>=0 && index<ATTACHMENT_SLOTS) || (id!=null && !canAttach(clean.weapon,id))) return clean;
 const attachments=clean.attachments.map((a,i)=>i===index?(id??null):a===id?null:a);
 return cleanKit({...clean,attachments});
}
// A new marker keeps the parts that fit it; `dropped` lists the ones it cannot take.
export function changeWeapon(kit, weaponId) {
 const before=cleanKit(kit), after=cleanKit({...before,weapon:weaponId});
 return { kit:after, dropped:before.attachments.filter((id,i)=>id && after.attachments[i]!==id) };
}
export function kitStats(value={}, options={}) {
 const kit=cleanKit(value), weapon=options.weapons==='pistol'?'pistol':kit.weapon;
 const s={...weaponOf(weapon)}, armor=ARMOR.find(a=>a.id===kit.armor), parts=kit.attachments.filter(id=>id && canAttach(weapon,id));
 s.zoom=s.scope||1.2; s.sens=1; s.optic=null;
 if(s.melee) return meleeStats(s,parts,armor,options);
 for(const id of parts) {
  // A marker that already flies straight cannot get tighter: its barrel sends the shot out faster instead.
  if(id==='barrel') { if(s.spread>0) { s.spread*=.65; s.life*=1.12; } else s.speed*=1.12; if(s.aimSpread!=null) s.aimSpread*=.65; s.mobility-=.05; }
  if(id==='hopper') { if(s.reserve!=null) s.reserve++; else s.magazine=Math.ceil(s.magazine*1.4); s.reload*=1.25; s.mobility-=.05; }
  if(id==='stock') { s.mobility+=.05; s.spread=s.spread*1.3+.015; if(s.aimSpread!=null) s.aimSpread+=.008; if(s.splash) s.splash*=.8; }
 }
 // The Mira goes on last, so it steadies whatever spread the other parts left.
 if(parts.includes('optic')) {
  const kind=opticOf(weapon), o=OPTICS[kind];
  s.optic=kind; s.sens=o.sens; s.mobility-=.02;
  if(o.hipSpread) s.spread*=o.hipSpread;
  s.aimSpread=(s.aimSpread??s.spread)*o.aimSpread;
  s.zoom=s.scope ? s.scope*(o.scopeBoost||1) : o.zoom;
 }
 s.mobility*=armor.mobility; s.toughness=Math.max(1,(options.toughness||3)+armor.toughness);
 if(options.fastReload) s.reload*=.55/1.3;
 s.damage=s.damage||1; s.sprint=!s.heavy;
 // Aiming (right mouse, F, LT, Mira) only does anything with a scope or a Mira.
 s.aims=s.aimSpread!=null; return s;
}

// A melee weapon's numbers with its parts and armor: no ammo, no reload, never aims.
// `cadence` is the swing interval, so whatever reads a marker's pace reads this too.
function meleeStats(s,parts,armor,options) {
 if(s.throwable) s.throwable={...s.throwable}; if(s.sweetSpot) s.sweetSpot={...s.sweetSpot};
 for(const id of parts) {
  if(id==='tape') { s.windup*=.8; s.recovery*=.8; s.reach*=.85; }
  if(id==='drip') { s.damage+=1; s.recovery*=1.25; }
  if(id==='strap') { if(s.throwable) s.throwable.recall*=.6; else s.recovery*=.85; s.mobility-=.04; }
 }
 // The thrown chancla paints what a strike paints, drips included.
 if(s.throwable) s.throwable.damage=s.damage;
 s.mobility*=armor.mobility; s.toughness=Math.max(1,(options.toughness||3)+armor.toughness);
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
 // Melee: reach (or the throw) for range, the cone for precision, pepazos a second, swing pace.
 if(s.melee) return Math.round(100+700*(.15*unit((s.throwable?throwRange(s.throwable):s.reach)/60)+.10*unit(s.arc/1.2)+.20*unit(dpsOf(s)/6)+.05
  +.10*unit(1-meleeInterval(s)/1.5)+.15*unit(s.mobility/1.15)+.15*unit(s.toughness/6)+.025*unit((s.knockback+s.stun)/2)+lob));
 const sustained=s.magazine*s.pellets*s.damage/(s.magazine*s.cadence+s.reload);
 const score=.15*unit(s.speed*s.life/60)+.10*unit(1-(s.aimSpread??s.spread)/.3)
  +.20*unit(sustained/6)+.10*unit((s.magazine+(s.reserve||0))/26)
  +.10*unit(1-s.reload/4)+.15*unit(s.mobility/1.15)
  +.15*unit(s.toughness/6)+.025*unit(((s.splash||0)+s.pellets-1+(s.damage-1)*2+(s.direct?3:0))/5)
  +.025*unit(grenade.radius*grenade.damage/(grenade.fuse*4));
 return Math.round(100+700*score);
}
