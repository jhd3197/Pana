// The gaunt mummy's body language as plain numbers, with no Three.js, so a
// Node test can drive it. reliquia.js mummy({ gaunt: true }) copies these
// onto its pivots every frame.
//
// Idle it stands nearly still, then twitches: the head snaps to a new angle
// and keeps tilting slowly, a shoulder jerks, the fingers tremble; now and
// then everything stops dead for a moment. Chasing, it lurches on an uneven
// stride (one leg drags, some steps hitch), torso low, one arm reaching and
// the other dragging, the head locked on you. Winding up, both arms rise in
// jerks and the jaw drops. In a farol's beam it freezes mid-pose and only the
// head follows you. Every mummy rolls its own rhythm from its seed.
//
// update(t, { moving, winding, frozen, look, lit, scares }) returns the same
// pose object every call (no allocation). `look` is the yaw from the body to
// the watcher; `lit` is the enemy's light ('beam' | 'glow' | 'dark'); `scares`
// is the Sustos setting: suaves and apagados tame the twitches, and only
// normales lets the eyes gutter out (eye) and the body sink into the dark
// (shade) between lights.
import { rng, clamp, lerp, smoothstep } from '../../random.js';

const TAU = Math.PI * 2;
const toward = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-rate * dt));
// How hard the twitches hit, by Sustos.
const TAME = { normal: 1, suaves: .55, apagados: .3 };

export function createGauntPose({ seed = 1 } = {}) {
  const R = rng(Math.imul((seed | 0) + 1, 2654435761) >>> 0);
  const between = (a, b) => a + R() * (b - a);
  // Who this one is: its resting head tilt, which arm reaches, its pace.
  const lean = between(.24, .36), tilt0 = (R() < .5 ? -1 : 1) * between(.14, .3), pace = between(7.2, 8.8);
  const ph = between(0, TAU), ph2 = between(0, TAU);
  let reach = R() < .5 ? -1 : 1;
  const pose = {
    hipsY: 0, hipsRx: 0, hipsRz: 0, spineRx: lean, spineRz: 0, neckRx: .5, headRx: -.6, headRy: 0, headRz: tilt0, jawRx: .06,
    lArmRx: -.2, lArmRz: .06, lElbow: -.12, lHandRx: .2, lHandRz: 0, rArmRx: -.2, rArmRz: -.06, rElbow: -.12, rHandRx: .2, rHandRz: 0,
    lLegRx: 0, rLegRx: 0, tatterRx: 0, tatterRz: 0, trailRx: -.2, eye: 1, shade: 1,
  };
  let last = null, move = 0, wind = 0, windT = 0, gait = between(0, TAU), stride = 1, strideN = 0;
  // A twitch: the head and a shoulder snap from where they were to a new set.
  let twitchIn = between(.6, 2.5), snapT = 1, still = 0, burst = 0, shrug = 0, shrugSide = 1, drift = 0, driftDir = 1;
  const from = { y: 0, z: 0, x: 0 }, to = { y: 0, z: 0, x: 0 }, off = { y: 0, z: 0, x: 0 };
  let blinkIn = between(2, 6), blink = 0, blinkTwice = false;

  const mix = (a, b, w) => lerp(lerp(a, b, move), w, wind);

  function twitch(tame, idle) {
    from.y = off.y; from.z = off.z + drift; from.x = off.x; drift = 0; driftDir = R() < .5 ? -1 : 1;
    to.y = (R() - .5) * 1.1 * tame; to.z = (R() - .5) * .9 * tame; to.x = (R() - .5) * .45 * tame;
    snapT = 0; burst = between(.3, .9); shrug = between(.2, .45) * tame; shrugSide = R() < .5 ? -1 : 1;
    // Sometimes the twitch is followed by nothing at all: a dead stop.
    if (idle && R() < .3) still = between(1.1, 2.6);
    twitchIn = (idle ? between(1.1, 3.8) : between(2.2, 5.5)) / Math.max(.35, tame ** .7);
  }

  function update(t, { moving = false, winding = false, frozen = false, look = 0, lit = 'dark', scares = 'normal' } = {}) {
    const dt = last == null || !Number.isFinite(t) ? 0 : clamp(t - last, 0, .1);
    if (Number.isFinite(t)) last = t; else t = last ?? 0;
    const tame = TAME[scares] ?? 1, lookY = clamp(Number.isFinite(look) ? look : 0, -1.2, 1.2);
    // Caught in the beam: hold the pose exactly; only the head turns to you.
    if (frozen) {
      pose.headRy = toward(pose.headRy, lookY, 1.1, dt); pose.eye = 1; pose.shade = 1; blink = 0;
      return pose;
    }
    move = toward(move, moving && !winding ? 1 : 0, moving ? 4 : 2.5, dt);
    wind = toward(wind, winding ? 1 : 0, winding ? 14 : 9, dt);
    windT = winding ? windT + dt : 0;
    const idle = 1 - Math.max(move, wind);

    // Twitches and dead stops.
    twitchIn -= dt; if (twitchIn <= 0) twitch(tame, idle > .5);
    snapT += dt; still = Math.max(0, still - dt); burst = Math.max(0, burst - dt); shrug = toward(shrug, 0, 5, dt);
    const snap = smoothstep(snapT / .09), alive = still > 0 ? 0 : 1;
    off.y = lerp(from.y, to.y, snap); off.x = lerp(from.x, to.x, snap); off.z = lerp(from.z, to.z, snap);
    // After a snap the head keeps going, slowly, the way a neck should not.
    drift = clamp(drift + dt * .05 * driftDir * alive * tame, -.35, .35);
    const sway = Math.sin(t * .7 + ph) * .012 * alive;
    const tremble = (burst > 0 ? Math.sin(t * 43 + ph) * Math.sin(t * 17.3 + ph2) * .45 : Math.sin(t * 9 + ph) * .05 * alive) * tame;

    // The stride: uneven, one leg dragging, every few steps a hitch.
    const before = Math.floor(gait / TAU);
    gait += dt * pace * stride * move;
    if (Math.floor(gait / TAU) !== before) {
      strideN++; stride = R() < .22 ? between(.35, .55) : between(.8, 1.3);
      if (R() < .12) reach = -reach;
    }
    const s = Math.sin(gait), lurch = Math.abs(s) ** 5;

    // Idle → chasing → winding, field by field (mix).
    const raise = smoothstep(Math.floor(clamp(windT / .5) * 5) / 5 + Math.sin(windT * 60) * .03);
    pose.hipsY = mix(sway * .5, -.05 - lurch * .07, -.08);
    pose.hipsRx = mix(0, lurch * .06, -.05);
    pose.hipsRz = mix(sway, s * .13, 0);
    pose.spineRx = mix(lean + sway * .5, lean + .2 + lurch * .12, lean - .12 * raise);
    pose.spineRz = mix(sway * .6 + shrug * shrugSide * .2, -s * .08, 0);
    pose.neckRx = mix(.5, .62, .35);
    // The face stays on you: undo the lean, then add the twitch.
    const level = -(pose.spineRx + pose.neckRx) + .12;
    pose.headRx = mix(level + .1 + off.x + sway, level + .05 + lurch * .1, level - .35 * raise);
    pose.headRy = mix(off.y + lookY * .5, lookY + off.y * .15, lookY);
    pose.headRz = mix(tilt0 + off.z + drift, tilt0 * .6 + off.z * .3, tilt0 * .4 + Math.sin(t * 50) * .04 * raise * tame);
    pose.jawRx = mix(.06 + alive * Math.max(0, Math.sin(t * .4 + ph)) * .05, .12 + lurch * .08, .08 + .45 * raise);
    // Arms: hanging (the lean cancelled), reaching or dragging, then raised.
    const hang = -pose.spineRx + .06, reachL = reach < 0, up = -2.5 + Math.sin(windT * 47) * .06 * tame;
    const reachArm = -1.25 - pose.spineRx + Math.sin(t * 1.3 + ph) * .08 + lurch * .14, dragArm = hang + .3 + s * .1;
    pose.lArmRx = mix(hang - (shrugSide < 0 ? shrug * .6 : 0), reachL ? reachArm : dragArm, lerp(hang, up, raise));
    pose.rArmRx = mix(hang - (shrugSide > 0 ? shrug * .6 : 0), reachL ? dragArm : reachArm, lerp(hang, up - .1, raise));
    pose.lArmRz = mix(.06 + (shrugSide < 0 ? shrug * .3 : 0), .1, .22 * raise);
    pose.rArmRz = mix(-.06 - (shrugSide > 0 ? shrug * .3 : 0), -.1, -.22 * raise);
    pose.lElbow = mix(-.12, reachL ? -.2 : -.04, -.35 * raise);
    pose.rElbow = mix(-.12, reachL ? -.04 : -.2, -.35 * raise);
    pose.lHandRx = mix(.2 + tremble, reachL ? -.1 + tremble : .3, -.3 + tremble * .5);
    pose.rHandRx = mix(.2 - tremble, reachL ? .3 : -.1 - tremble, -.3 - tremble * .5);
    pose.lHandRz = tremble * .5; pose.rHandRz = -tremble * .5;
    // Legs: one long step and one dragged behind.
    pose.lLegRx = mix(0, s * .5, .12);
    pose.rLegRx = mix(0, -Math.sin(gait - .5) * .26 + .14, -.12);
    // Rags: they hang, sway a little, and trail behind a lurch.
    pose.tatterRx = Math.sin(t * 1.9 + ph) * .06 + move * (.3 + Math.sin(gait * 2) * .1) + wind * .1;
    pose.tatterRz = Math.sin(t * 1.3 + ph2) * .05 + pose.hipsRz * .6;
    // The long bandage off the back hangs from the shoulders whatever the lean.
    pose.trailRx = -pose.spineRx - pose.hipsRx + .12 + move * .3 + Math.sin(t * 2.4 + ph) * .06;

    // The eyes: steady in any light; in the dark, on normales only, they
    // gutter out for a moment and the body sinks into the dark with them.
    if (lit === 'dark' && scares === 'normal') {
      blinkIn -= dt;
      if (blinkIn <= 0 && blink <= 0) { blink = between(.07, .22); blinkTwice = R() < .3; blinkIn = between(2.5, 7.5); }
      if (blink > 0) { blink -= dt; if (blink <= 0 && blinkTwice) { blinkTwice = false; blink = -.09; } }
      else if (blink < 0) { blink += dt; if (blink >= 0) blink = between(.05, .12); }
    } else blink = 0;
    const out = blink > 0;
    pose.eye = out ? .04 : .82 + .18 * Math.sin(t * 1.7 + ph);
    pose.shade = toward(pose.shade, out ? .55 : 1, out ? 30 : 6, dt);
    return pose;
  }
  return { pose, update, get strides() { return strideN; } };
}
