// Capis a Pintazos' arsenal (pure, no Three.js): five weapons from Pepazo's
// shared arsenal (engine/play/paint-arsenal.js) that fly, hurt and dig in
// clearly different ways. rules.js fires and lands them, bot.js searches
// shots with the same flight, scene.js and hud.js draw them.
//
//   flight  'shell'  arcs (ballistic.js stepFlight) and bursts on contact
//           'bounce' bounces off the ground and capis (ballistic.js stepBounce)
//                    and bursts when its fuse runs out
//           'drill'  arcs, then bores a tunnel along its path on contact
//   speed   muzzle speed at full charge; `floor` is the share it keeps at no
//           charge (La Lejana barely needs one)
//   wind    share of the wind's push (FLIGHT.windForce × wind × this)
//   crater  radius of the round crater (`terrain-mask.js` carve); `tunnel`
//           { length, radius } for the drill (carveLine)
//   paint   paint on a direct hit; it falls off to `min` of it at the edge of
//           reach (crater + a capi's radius), lob.js `falloff`
//   ammo    shots per team per match; Infinity never runs out (La Piñita, so
//           a match can always go on)
import { PAINT_WEAPONS, PAINT_GRENADES } from '../../../engine/play/paint-arsenal.js';
import { locKey } from '../../../engine/i18n.js';

export const WEAPONS = Object.freeze([
  { id: 'bazooka', name: PAINT_WEAPONS.bazooka, model: 'bazooka', ammo: 3, flight: 'shell', speed: 30, floor: 0, gravity: 18, wind: 1,
    crater: 3.5, stain: 5.2, paint: 50, min: .25, knock: 13, drips: true,
    blurb: locKey('Cohete con mucho viento: cráter grande y pintura para todos.') },
  { id: 'grenade', name: PAINT_GRENADES.pinita, model: 'grenade', ammo: Infinity, flight: 'bounce', speed: 36, floor: 0, gravity: 18, wind: .35,
    fuse: 3, restitution: .3, friction: .55, crater: 2.9, stain: 4.1, paint: 45, min: .3, inner: .3, knock: 10,
    blurb: locKey('Rebota y explota a los 3 segundos: métela detrás de una loma o en un hueco.') },
  { id: 'sniper', name: PAINT_WEAPONS.sniper, model: 'sniper', ammo: 2, flight: 'shell', speed: 62, floor: .7, gravity: 2.5, wind: 0,
    crater: .6, stain: 1.4, paint: 62, min: .2, knock: 7, direct: true,
    blurb: locKey('Casi en línea recta y sin viento: duele mucho, pero hay que acertarle al capi.') },
  { id: 'drill', name: PAINT_WEAPONS.minigun, model: 'minigun', ammo: 3, flight: 'drill', speed: 32, floor: 0, gravity: 18, wind: .5,
    tunnel: { length: 9, radius: 1.05 }, crater: 1.05, stain: 1.6, paint: 8, min: 1, knock: 4,
    blurb: locKey('Taladra un túnel largo donde pega: abre caminos y tumba al rival.') },
  { id: 'scatter', name: PAINT_WEAPONS.scatter, model: 'scatter', ammo: 3, flight: 'shell', speed: 28, floor: 0, gravity: 18, wind: .6,
    pellets: 5, spread: .1, crater: 1.4, stain: 2.2, paint: 20, min: .35, knock: 6,
    blurb: locKey('Cinco perdigones en abanico: cráteres pequeños, ideal para capis juntos.') },
]);
export const WEAPON_IDS = WEAPONS.map(w => w.id);
// The weapon every capi starts with, and the one it falls back to when its
// team runs out: La Piñita never runs out.
export const FIRST_WEAPON = 'bazooka', BASIC_WEAPON = 'grenade';
export const weaponOf = id => WEAPONS.find(w => w.id === id) || WEAPONS[0];
// How far a blast of `w` reaches a capi's centre (`radius` is a capi's body).
export const reachOf = (w, radius) => w.crater + radius;
// Muzzle speed of `w` at charge `power` (0..1).
export const speedOf = (w, power) => w.speed * (w.floor + (1 - w.floor) * power);
// The launch angles of `w` fired at `angle`: one, or a fan for El Trueno.
export const anglesOf = (w, angle) => w.pellets ? Array.from({ length: w.pellets }, (_, i) => angle + (i - (w.pellets - 1) / 2) * w.spread) : [angle];
// A team's starting ammo: every limited weapon's count.
export const startingAmmo = () => Object.fromEntries(WEAPONS.filter(w => Number.isFinite(w.ammo)).map(w => [w.id, w.ammo]));
