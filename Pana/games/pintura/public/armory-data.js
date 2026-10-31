// Pure loadout rules, shared by the server, practice, HUD and armory.
// Marker, vest and grenade names are proper names and stay Spanish; generic
// names and blurbs are locKey() and shown with loc() (armory.js).
import { locKey } from '../../../engine/i18n.js';
export const MARKERS = [
 { id:'pistol', name:'La Chispa', blurb:locKey('La confiable. Precisa, pareja y ligera.'), magazine:12, reload:1.3, cadence:.2, mobility:1, spread:0, pellets:1, speed:85, life:.6 }, // i18n-ignore: proper name
 { id:'scatter', name:'El Trueno', blurb:locKey('Tres bolas de cerca. De lejos pierde fuerza.'), magazine:8, reload:1.8, cadence:.75, mobility:.93, spread:.18, pellets:3, speed:85, life:.2 }, // i18n-ignore: proper name
 { id:'rapid', name:'Las Gemelas', blurb:locKey('Alterna las dos marcadoras. Mucha presión; recargar lleva tiempo.'), magazine:18, reload:2.4, cadence:.16, mobility:1, spread:.045, pellets:1, speed:85, life:.44 }, // i18n-ignore: proper name
 { id:'rocket', name:'El Cohetón', blurb:locKey('Un cohete de pintura, un pepazo por rival. Cuatro cargas por vida; no permite correr.'), magazine:1, reserve:3, reload:3.2, cadence:1, mobility:.63, spread:0, pellets:1, speed:18, life:2.4, splash:4.5, heavy:true }, // i18n-ignore: proper name
 // La Lejana: two pepazos a hit, 70 m of reach; aimed through the scope it flies dead straight,
 // from the hip it wanders (`spread`), and scoped you walk at half speed.
 { id:'sniper', name:'La Lejana', blurb:locKey('Francotiradora: dos pepazos por tiro y 70 m de alcance. Clic derecho para la mira; sin ella se desvía.'), magazine:4, reload:2.6, cadence:1.25, mobility:.9, spread:.1, aimSpread:0, scope:3.5, damage:2, pellets:1, speed:140, life:.5 }, // i18n-ignore: proper name
 // La Bazuca: a slow, visible rocket. A direct hit knocks out at once; the splash is tiny.
 { id:'bazooka', name:'La Bazuca', blurb:locKey('Un cohete lento que se ve venir. Si pega directo, fuera de una; casi no salpica. Tres por vida.'), magazine:1, reserve:2, reload:3.8, cadence:1.2, mobility:.7, spread:0, pellets:1, speed:14, life:3, splash:1.4, direct:true, heavy:true }, // i18n-ignore: proper name
];
export const ATTACHMENTS = [
 {id:'barrel',name:locKey('Cañón afinado'),blurb:locKey('Más precisión y alcance; en las marcadoras que no se desvían, la bola o el cohete sale más rápido. −5% movilidad.')},
 {id:'hopper',name:locKey('Tolva grande'),blurb:locKey('Más bolas; recarga más lenta y −5% movilidad. En El Cohetón y La Bazuca: un cohete extra.')},
 {id:'stock',name:locKey('Culata ligera'),blurb:locKey('+5% movilidad, menos control. Los cohetes pierden radio de salpicadura.')},
];
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
// Two attachment slots. A kit stores `attachments` as a fixed [slot 0, slot 1]
// array of id|null so a part stays in the slot the player put it in.
export const ATTACHMENT_SLOTS = 2;
// Which attachments fit which marker. Data, so per-weapon mounts can plug in
// later. La Lejana already carries a wooden stock, and La Bazuca rests on the
// shoulder with no place for one, so neither takes the light stock.
export const ATTACHMENT_RULES = {
 pistol:['barrel','hopper','stock'], scatter:['barrel','hopper','stock'], rapid:['barrel','hopper','stock'],
 rocket:['barrel','hopper','stock'], sniper:['barrel','hopper'], bazooka:['barrel','hopper'],
};
export const canAttach = (weaponId, attachmentId) => !!ATTACHMENT_RULES[weaponId]?.includes(attachmentId);
export function cleanKit(value={}) {
 if (!value || typeof value !== 'object') value={};
 const weapon=pick(MARKERS,value.weapon), raw=Array.isArray(value.attachments)?value.attachments:[];
 // Up to two entries are slot positions; a longer list (old or hostile) is packed.
 const list=raw.length>ATTACHMENT_SLOTS?raw.filter(id=>canAttach(weapon,id)).filter((id,i,all)=>all.indexOf(id)===i):raw;
 const attachments=Array.from({length:ATTACHMENT_SLOTS},(_,i)=>{const id=list[i];return canAttach(weapon,id) && !list.slice(0,i).includes(id) ? id : null;});
 return { weapon, attachments, armor:pick(ARMOR,value.armor), grenade:pick(GRENADES,value.grenade), finish:pick(FINISHES,value.finish), charm:pick(CHARMS,value.charm), pattern:pick(PATTERNS,value.pattern) };
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
 const s={...MARKERS.find(w=>w.id===weapon)}, armor=ARMOR.find(a=>a.id===kit.armor);
 for(const id of kit.attachments.filter(Boolean)) {
  // A marker that already flies straight cannot get tighter: its barrel sends the shot out faster instead.
  if(id==='barrel') { if(s.spread>0) { s.spread*=.65; s.life*=1.12; } else s.speed*=1.12; if(s.aimSpread!=null) s.aimSpread*=.65; s.mobility-=.05; }
  if(id==='hopper') { if(s.reserve!=null) s.reserve++; else s.magazine=Math.ceil(s.magazine*1.4); s.reload*=1.25; s.mobility-=.05; }
  if(id==='stock') { s.mobility+=.05; s.spread=s.spread*1.3+.015; if(s.aimSpread!=null) s.aimSpread+=.008; if(s.splash) s.splash*=.8; }
 }
 s.mobility*=armor.mobility; s.toughness=Math.max(1,(options.toughness||3)+armor.toughness);
 if(options.fastReload) s.reload*=.55/1.3;
 s.damage=s.damage||1; s.sprint=!s.heavy; return s;
}

// A bounded build summary, not a player rank or a damage multiplier. All inputs
// come from the same effective stats used by Arena, including room overrides.
export function kitRating(value={}, options={}) {
 const s=kitStats(value,options), grenade=GRENADES.find(g=>g.id===cleanKit(value).grenade);
 const unit=n=>Math.max(0,Math.min(1,n));
 const sustained=s.magazine*s.pellets/(s.magazine*s.cadence+s.reload);
 const score=.15*unit(s.speed*s.life/60)+.10*unit(1-(s.aimSpread??s.spread)/.3)
  +.20*unit(sustained/6)+.10*unit((s.magazine+(s.reserve||0))/26)
  +.10*unit(1-s.reload/4)+.15*unit(s.mobility/1.15)
  +.15*unit(s.toughness/6)+.025*unit(((s.splash||0)+s.pellets-1+(s.damage-1)*2+(s.direct?3:0))/5)
  +.025*unit(grenade.radius*grenade.damage/(grenade.fuse*4));
 return Math.round(100+700*score);
}
