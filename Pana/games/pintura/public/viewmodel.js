// The marker you hold in first person: idle breathing, the walking bob, a
// recoil that suits each weapon, the reload (it dips away, wobbles, comes back),
// the raise when you switch, the lowered, tilted carry while sprinting, and the
// raise to the eye while aiming. Pure: it only sets position and rotation on the
// object it is given. The kick itself is the engine's shared recoil.
import { createRecoil } from '../../../engine/play/recoil.js';
import { MARKERS } from './armory-data.js';

// back/rot: how far the marker jumps; decay: how fast it settles; cam: how far the
// view climbs; shake: how much the view trembles per shot.
const RECOIL = {
  pistol: { back: .05, rot: .14, decay: 7, cam: 1, shake: .15 },
  scatter: { back: .13, rot: .32, decay: 4.2, cam: 2, shake: .45 },
  rapid: { back: .03, rot: .08, decay: 11, cam: .5, shake: .08 },
  rocket: { back: .2, rot: .42, decay: 3, cam: 2.8, shake: .6 },
  sniper: { back: .22, rot: .38, decay: 3.2, cam: 3.6, shake: .55 },
  bazooka: { back: .28, rot: .5, decay: 2.4, cam: 4, shake: .8 },
  blunderbuss: { back: .17, rot: .42, decay: 3.6, cam: 2.6, shake: .6 },
  minigun: { back: .015, rot: .03, decay: 14, cam: .25, shake: .1 },
  sprayer: { back: .005, rot: .01, decay: 14, cam: .05, shake: .02 },
  slingshot: { back: .02, rot: .06, decay: 8, cam: .2, shake: .03 },
  sixshooter: { back: .09, rot: .3, decay: 5, cam: 1.6, shake: .25 },
};
// Markers without their own row kick like their class.
const CLASS_RECOIL = {
  subfusiles: { back: .03, rot: .07, decay: 11, cam: .45, shake: .08 },
  fusiles: { back: .05, rot: .12, decay: 8, cam: .8, shake: .12 },
  ametralladoras: { back: .04, rot: .09, decay: 9, cam: .6, shake: .14 },
  francotiradores: { back: .15, rot: .28, decay: 4, cam: 2.4, shake: .4 },
  lanzadores: { back: .14, rot: .34, decay: 3.4, cam: 2, shake: .45 },
};
export const recoilOf = weapon => RECOIL[weapon] || CLASS_RECOIL[MARKERS.find(m => m.id === weapon)?.class] || RECOIL.pistol;
const ease = t => t * t * (3 - 2 * t);

export function createViewmodel() {
  let swap = 0, sprint = 0, flash = 0, lastFired = null, lastWeapon = '', t = 0;
  const recoil = createRecoil();
  return {
    // o: { held, weapon, fired, reload, reloadTime, sprint, bob, sway, down, air, push, aim }
    update(dt, o) {
      t += dt; const r = recoilOf(o.weapon), held = o.held;
      if (o.weapon !== lastWeapon) { swap = lastWeapon ? 1 : 0; lastWeapon = o.weapon; recoil.reset(); lastFired = o.fired; }
      const shot = lastFired !== null && o.fired > lastFired;
      if (shot) { recoil.fire(r); flash = 1; }
      lastFired = o.fired;
      const { kick } = recoil.update(dt, { decay: r.decay }); flash = Math.max(0, flash - dt * 18); swap = Math.max(0, swap - dt * 3.2);
      sprint += ((o.sprint && !o.down ? 1 : 0) - sprint) * (1 - Math.exp(-dt * 9));
      const p = o.reload > 0 && o.reloadTime > 0 ? 1 - o.reload / o.reloadTime : -1;
      const dip = p < 0 ? 0 : ease(p < .18 ? p / .18 : p > .82 ? (1 - p) / .18 : 1), wobble = p < 0 ? 0 : Math.sin(p * 36) * dip;
      // Aiming brings the sight line to the middle of the view and steadies the sway.
      // A side-mounted Mira (`sightX`) slides the marker over so its sight line, not the barrel, centres.
      const aim = ease(Math.min(1, Math.max(0, o.aim || 0))), sight = (held.userData.sight ?? .3) * (held.scale?.x || .3), side = (held.userData.sightX || 0) * (held.scale?.x || .3);
      const calm = (1 - sprint) * (1 - aim * .8), sway = (o.sway || 0) * (1 - aim * .7), air = o.air || 0;
      const x = .2 * (1 - aim) + side * aim + Math.sin(o.bob) * .012 * sway * (1 + sprint) + Math.sin(t * .8) * .003 * calm + sprint * .05 - dip * .05 + wobble * .006;
      const y = -.25 + (.25 - sight - .02) * aim + Math.abs(Math.cos(o.bob)) * .01 * sway * (1 + sprint * 1.4) + Math.sin(t * 1.4) * .004 * calm - kick * r.back * .2 - sprint * .11 - dip * .12 - swap * .3 - air * .04;
      const z = -.34 + aim * .06 + kick * r.back + (o.push || 0) + sprint * .03 + dip * .05;
      held.position.set(x, y, z);
      held.rotation.set(kick * r.rot * (1 - aim * .5) - sprint * .5 - dip * .55 - swap * .9 + Math.sin(o.bob * 2) * .02 * sprint, Math.PI + sprint * .3 - dip * .15, -sprint * .35 + wobble * .06 + Math.sin(t * .8) * .004 * calm);
      // La Licuadora's barrels and the revolvers' cylinders turn as they fire.
      if (held.userData.spin && shot) held.userData.spin.rotation.z += o.weapon === 'minigun' ? .9 : Math.PI / 3;
      held.userData.hands?.forEach((hand, i) => { hand.position.z = lastFired % 2 === i ? kick * r.back * 2.5 : 0; });
      return { flash, kick, shot };
    },
    reset() { recoil.reset(); swap = sprint = flash = 0; lastFired = null; lastWeapon = ''; },
  };
}
