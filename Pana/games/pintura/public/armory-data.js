// Pure loadout rules, shared by the server, practice, HUD and armory.
// Marker, vest and grenade names are proper names and stay Spanish; generic
// names and blurbs are locKey() and shown with loc() (armory.js).
import { locKey } from '../../../engine/i18n.js';
export const MARKERS = [
 { id:'pistol', name:'La Chispa', blurb:locKey('La confiable. Precisa, pareja y ligera.'), magazine:12, reload:1.3, cadence:.25, mobility:1, spread:0, pellets:1, speed:34, life:1.5 }, // i18n-ignore: proper name
 { id:'scatter', name:'El Trueno', blurb:locKey('Tres bolas de cerca. De lejos pierde fuerza.'), magazine:8, reload:1.8, cadence:.75, mobility:.93, spread:.18, pellets:3, speed:34, life:.5 }, // i18n-ignore: proper name
 { id:'rapid', name:'Las Gemelas', blurb:locKey('Alterna las dos marcadoras. Mucha presión; recargar lleva tiempo.'), magazine:18, reload:2.4, cadence:.16, mobility:1, spread:.045, pellets:1, speed:34, life:1.1 }, // i18n-ignore: proper name
 { id:'rocket', name:'El Cohetón', blurb:locKey('Un cohete de pintura, un pepazo por rival. Cuatro cargas por vida; no permite correr.'), magazine:1, reserve:3, reload:3.2, cadence:1, mobility:.63, spread:0, pellets:1, speed:18, life:2.4, splash:4.5 }, // i18n-ignore: proper name
];
export const ATTACHMENTS = [
 {id:'barrel',name:locKey('Cañón afinado'),blurb:locKey('Más precisión y alcance. −5% movilidad.')},
 {id:'hopper',name:locKey('Tolva grande'),blurb:locKey('Más bolas; recarga más lenta y −5% movilidad. En El Cohetón: un cohete extra.')},
 {id:'stock',name:locKey('Culata ligera'),blurb:locKey('+5% movilidad, menos control. El Cohetón pierde radio de salpicadura.')},
];
export const ARMOR = [
 {id:'shirt',name:'La Franela',blurb:locKey('Aguante y movilidad normales.'),mobility:1,toughness:0}, // i18n-ignore: proper name
 {id:'padded',name:'El Acolchado',blurb:locKey('+1 pepazo de aguante, −10% movilidad.'),mobility:.9,toughness:1}, // i18n-ignore: proper name
 {id:'wind',name:'El Cortaviento',blurb:locKey('+8% movilidad, −1 pepazo de aguante.'),mobility:1.08,toughness:-1}, // i18n-ignore: proper name
];
export const GRENADES = [
 {id:'pinita',name:'La Piñita',blurb:locKey('Explosión de pintura: un pepazo por rival.'),radius:3.8,fuse:1.1}, // i18n-ignore: proper name
 {id:'pegajosa',name:'La Pegajosa',blurb:locKey('Salpica menos y deja un charco que frena rivales.'),radius:2.2,fuse:1.1}, // i18n-ignore: proper name
 {id:'chispita',name:'La Chispita',blurb:locKey('Rebota una vez antes de explotar.'),radius:3.3,fuse:1.6}, // i18n-ignore: proper name
];
export const FINISHES = [{id:'factory',name:locKey('De fábrica'),color:null},{id:'caribe',name:'Caribe',color:'#29c5cd'},{id:'mango',name:'Mango',color:'#f28b42'},{id:'uva',name:'Uva',color:'#8d85df'}];
export const CHARMS = [{id:'none',name:locKey('Sin llavero')},{id:'mango',name:'Manguito'},{id:'ball',name:locKey('Bola de pintura')}];
export const PATTERNS = [{id:'splat',name:locKey('Salpicadura')},{id:'stripe',name:locKey('Rayas')},{id:'dots',name:locKey('Puntos')}];
const pick = (list,id) => list.some(x=>x.id===id) ? id : list[0].id;
export function cleanKit(value={}) {
 if (!value || typeof value !== 'object') value={};
 return { weapon:pick(MARKERS,value.weapon), attachments:[...new Set((Array.isArray(value.attachments)?value.attachments:[]).filter(id=>ATTACHMENTS.some(a=>a.id===id)))].slice(0,2), armor:pick(ARMOR,value.armor), grenade:pick(GRENADES,value.grenade), finish:pick(FINISHES,value.finish), charm:pick(CHARMS,value.charm), pattern:pick(PATTERNS,value.pattern) };
}
export function kitStats(value={}, options={}) {
 const kit=cleanKit(value), weapon=options.weapons==='pistol'?'pistol':kit.weapon;
 const s={...MARKERS.find(w=>w.id===weapon)}, armor=ARMOR.find(a=>a.id===kit.armor);
 for(const id of kit.attachments) {
  if(id==='barrel') { s.spread*=.65; s.life*=1.12; s.mobility-=.05; }
  if(id==='hopper') { if(weapon==='rocket') s.reserve++; else s.magazine=Math.ceil(s.magazine*1.4); s.reload*=1.25; s.mobility-=.05; }
  if(id==='stock') { s.mobility+=.05; s.spread=s.spread*1.3+.015; if(s.splash) s.splash*=.8; }
 }
 s.mobility*=armor.mobility; s.toughness=Math.max(1,(options.toughness||3)+armor.toughness);
 if(options.fastReload) s.reload*=.55/1.3;
 s.sprint=weapon!=='rocket'; return s;
}

// A bounded build summary, not a player rank or a damage multiplier. All inputs
// come from the same effective stats used by Arena, including room overrides.
export function kitRating(value={}, options={}) {
 const s=kitStats(value,options), grenade=GRENADES.find(g=>g.id===cleanKit(value).grenade);
 const unit=n=>Math.max(0,Math.min(1,n));
 const sustained=s.magazine*s.pellets/(s.magazine*s.cadence+s.reload);
 const score=.15*unit(s.speed*s.life/60)+.10*unit(1-s.spread/.3)
  +.20*unit(sustained/6)+.10*unit((s.magazine+(s.reserve||0))/26)
  +.10*unit(1-s.reload/4)+.15*unit(s.mobility/1.15)
  +.15*unit(s.toughness/6)+.025*unit(((s.splash||0)+s.pellets-1)/5)
  +.025*unit(grenade.radius/(grenade.fuse*4));
 return Math.round(100+700*score);
}
