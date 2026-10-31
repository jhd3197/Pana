// The marker you hold in first person: idle breathing, the walking bob, a
// recoil that suits each weapon, the reload (it dips away, wobbles, comes back),
// the raise when you switch, and the lowered, tilted carry while sprinting.
// Pure: it only sets position and rotation on the object it is given.
const RECOIL = {
  pistol: { back: .05, rot: .14, decay: 7, cam: 1 },
  scatter: { back: .13, rot: .32, decay: 4.2, cam: 2 },
  rapid: { back: .03, rot: .08, decay: 11, cam: .5 },
  rocket: { back: .2, rot: .42, decay: 3, cam: 2.8 },
};
export const recoilOf = weapon => RECOIL[weapon] || RECOIL.pistol;
const ease = t => t * t * (3 - 2 * t);

export function createViewmodel() {
  let kick = 0, swap = 0, sprint = 0, flash = 0, lastFired = null, lastWeapon = '', t = 0;
  return {
    // o: { held, weapon, fired, reload, reloadTime, sprint, bob, sway, down, air, push }
    update(dt, o) {
      t += dt; const r = recoilOf(o.weapon), held = o.held;
      if (o.weapon !== lastWeapon) { swap = lastWeapon ? 1 : 0; lastWeapon = o.weapon; kick = 0; lastFired = o.fired; }
      if (lastFired !== null && o.fired > lastFired) { kick = 1; flash = 1; }
      lastFired = o.fired;
      kick = Math.max(0, kick - dt * r.decay); flash = Math.max(0, flash - dt * 18); swap = Math.max(0, swap - dt * 3.2);
      sprint += ((o.sprint && !o.down ? 1 : 0) - sprint) * (1 - Math.exp(-dt * 9));
      const p = o.reload > 0 && o.reloadTime > 0 ? 1 - o.reload / o.reloadTime : -1;
      const dip = p < 0 ? 0 : ease(p < .18 ? p / .18 : p > .82 ? (1 - p) / .18 : 1), wobble = p < 0 ? 0 : Math.sin(p * 36) * dip;
      const calm = 1 - sprint, sway = o.sway || 0, air = o.air || 0;
      const x = .2 + Math.sin(o.bob) * .012 * sway * (1 + sprint) + Math.sin(t * .8) * .003 * calm + sprint * .05 - dip * .05 + wobble * .006;
      const y = -.25 + Math.abs(Math.cos(o.bob)) * .01 * sway * (1 + sprint * 1.4) + Math.sin(t * 1.4) * .004 * calm - kick * r.back * .2 - sprint * .11 - dip * .12 - swap * .3 - air * .04;
      const z = -.34 + kick * r.back + (o.push || 0) + sprint * .03 + dip * .05;
      held.position.set(x, y, z);
      held.rotation.set(kick * r.rot - sprint * .5 - dip * .55 - swap * .9 + Math.sin(o.bob * 2) * .02 * sprint, Math.PI + sprint * .3 - dip * .15, -sprint * .35 + wobble * .06 + Math.sin(t * .8) * .004 * calm);
      held.userData.hands?.forEach((hand, i) => { hand.position.z = lastFired % 2 === i ? kick * r.back * 2.5 : 0; });
      return { flash, kick };
    },
    reset() { kick = swap = sprint = flash = 0; lastFired = null; lastWeapon = ''; },
  };
}
