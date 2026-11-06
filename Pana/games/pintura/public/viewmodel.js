// The marker you hold in first person. Breathing, the bob, the sprint carry, the
// raise and melee swings are the engine's (engine/play/viewmodel.js); this adds a
// recoil that suits each weapon, the reload (it dips away, wobbles, comes back) and
// the raise to the eye while aiming. Pure: it only sets position and rotation on
// the object it is given. The kick itself is the engine's shared recoil.
import { createRecoil } from '../../../engine/play/recoil.js';
import { applyHeld, createHeldMotion, ease, swingPose } from '../../../engine/play/viewmodel.js';
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

// How a marker moves with the body; a melee weapon uses the engine's MELEE_CARRY.
const MARKER_CARRY = { bobX: .012, bobY: .01, bobSprintX: 1, bobSprintY: 1.4, idleX: .003, idleY: .004, idleRz: .004, sprint: [.05, -.11, .03, -.5, .3, -.35], rock: .02, air: .04, swapY: .3, swapRx: .9 };

export function createViewmodel() {
  let flash = 0, lastFired = null;
  const recoil = createRecoil(), motion = createHeldMotion(), pose = [0, 0, 0, 0, 0, 0], carry = {};
  return {
    // o: { held, weapon, fired, reload, reloadTime, sprint, bob, sway, down, air, push, aim,
    //      melee: { swings, windup, recovery } for a melee weapon }
    update(dt, o) {
      const r = recoilOf(o.weapon), held = o.held;
      if (motion.equip(o.weapon, o.melee?.swings ?? null)) { recoil.reset(); lastFired = o.fired; }
      motion.step(dt, { sprint: o.sprint, down: o.down });
      if (o.melee) {
        const since = motion.swing(dt, o.melee);
        swingPose(since, o.melee.windup, o.melee.recovery, pose);
        applyHeld(held, pose, motion.carry(carry, { bob: o.bob, sway: o.sway || 0, air: o.air || 0, push: o.push || 0 }));
        return { flash: 0, kick: 0, shot: false, swing: since };
      }
      const shot = lastFired !== null && o.fired > lastFired;
      if (shot) { recoil.fire(r); flash = 1; }
      lastFired = o.fired;
      const { kick } = recoil.update(dt, { decay: r.decay }); flash = Math.max(0, flash - dt * 18);
      const p = o.reload > 0 && o.reloadTime > 0 ? 1 - o.reload / o.reloadTime : -1;
      const dip = p < 0 ? 0 : ease(p < .18 ? p / .18 : p > .82 ? (1 - p) / .18 : 1), wobble = p < 0 ? 0 : Math.sin(p * 36) * dip;
      // Aiming brings the sight line to the middle of the view and steadies the sway.
      // A side-mounted Mira (`sightX`) slides the marker over so its sight line, not the barrel, centres.
      const aim = ease(Math.min(1, Math.max(0, o.aim || 0))), sight = (held.userData.sight ?? .3) * (held.scale?.x || .3), side = (held.userData.sightX || 0) * (held.scale?.x || .3);
      const c = motion.carry(carry, { bob: o.bob, sway: (o.sway || 0) * (1 - aim * .7), air: o.air || 0, push: o.push || 0, calm: (1 - motion.sprint) * (1 - aim * .8) }, MARKER_CARRY);
      const x = .2 * (1 - aim) + side * aim + c.x - dip * .05 + wobble * .006;
      const y = -.25 + (.25 - sight - .02) * aim + c.y - kick * r.back * .2 - dip * .12;
      const z = -.34 + aim * .06 + kick * r.back + c.z + dip * .05;
      held.position.set(x, y, z);
      held.rotation.set(kick * r.rot * (1 - aim * .5) + c.rx - dip * .55, Math.PI + c.ry - dip * .15, c.rz + wobble * .06);
      // La Licuadora's barrels and the revolvers' cylinders turn as they fire.
      if (held.userData.spin && shot) held.userData.spin.rotation.z += o.weapon === 'minigun' ? .9 : Math.PI / 3;
      held.userData.hands?.forEach((hand, i) => { hand.position.z = lastFired % 2 === i ? kick * r.back * 2.5 : 0; });
      return { flash, kick, shot };
    },
    reset() { recoil.reset(); motion.reset(); flash = 0; lastFired = null; },
  };
}
