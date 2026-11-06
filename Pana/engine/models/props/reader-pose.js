// El Lector's body language as plain numbers (no Three.js, Node-tested);
// blind-librarian.js copies them onto its pivots every frame.
//
// It is blind, so everything it does is listening. Idle it stands hunched
// with the head cocked, then the head snaps to a new tilt and keeps drifting,
// the long fingers flexing slowly. When it hears something it stops dead:
// the body locks, the head turns toward the sound and tilts hard to that
// side, one hand lifts with the fingers spread (the tell, `listen`). Walking
// it glides with the arms out in front, feeling the air; homing in (`hunt`)
// it drops lower and reaches. Winding up, both arms rise with the fingers
// hooked. Every Lector rolls its own rhythm from its seed.
//
// update(t, { mode, moving, winding, look, scares }) returns the same pose
// object every call (no allocation). `mode` is the enemy's ('prowl',
// 'listen', 'hunt', 'search'); `look` the yaw from the body toward the sound;
// `scares` the Sustos setting: suaves and apagados tame the twitches.
import { rng, clamp, lerp, smoothstep } from '../../random.js';

const TAU = Math.PI * 2;
const toward = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-rate * dt));
const TAME = { normal: 1, suaves: .55, apagados: .3 };
// An arm from hanging to feeling the air, reaching, then raised.
const armRx = (hang, feel, reach, up, move, hunt, raise) => lerp(lerp(lerp(hang, feel, move), reach, hunt), up, raise);

export function createReaderPose({ seed = 1 } = {}) {
  const R = rng(Math.imul((seed | 0) + 3, 2654435761) >>> 0);
  const between = (a, b) => a + R() * (b - a);
  const hunch = between(.55, .68), tilt0 = (R() < .5 ? -1 : 1) * between(.22, .36), pace = between(5.2, 6.4), ph = between(0, TAU);
  const pose = {
    hipsY: 0, hipsRz: 0, spineRx: hunch, spineRz: 0, neckRx: .35, headRx: -.4, headRy: 0, headRz: tilt0,
    lArmRx: -.3, lArmRz: .08, lElbow: -.4, lHandRx: .1, lCurl: .3, rArmRx: -.3, rArmRz: -.08, rElbow: -.4, rHandRx: .1, rCurl: .3,
    robeRx: 0, robeRz: 0, lFootRx: 0, rFootRx: 0, chainRx: 0,
  };
  let last = null, move = 0, hunt = 0, wind = 0, windT = 0, hear = 0, gait = between(0, TAU), side = 1;
  let twitchIn = between(.8, 2.6), snapT = 1, fromZ = 0, toZ = 0, fromY = 0, toY = 0, drift = 0, flex = between(0, TAU);

  function update(t, { mode = 'prowl', moving = false, winding = false, look = 0, scares = 'normal' } = {}) {
    const dt = last == null || !Number.isFinite(t) ? 0 : clamp(t - last, 0, .1);
    if (Number.isFinite(t)) last = t; else t = last ?? 0;
    const tame = TAME[scares] ?? 1, lookY = clamp(Number.isFinite(look) ? look : 0, -1.1, 1.1), listening = mode === 'listen' && !winding;
    // The tell is fast: it locks up within a tenth of a second.
    hear = toward(hear, listening ? 1 : 0, listening ? 12 : 3, dt);
    move = toward(move, moving && !winding && !listening ? 1 : 0, moving ? 5 : 3, dt);
    hunt = toward(hunt, mode === 'hunt' && moving ? 1 : 0, 3, dt);
    wind = toward(wind, winding ? 1 : 0, winding ? 14 : 8, dt);
    windT = winding ? windT + dt : 0;
    if (listening && Math.abs(lookY) > .05) side = Math.sign(lookY);

    // Idle twitches: the head snaps to a new tilt, then drifts on.
    twitchIn -= dt * (1 - hear);
    if (twitchIn <= 0) { fromZ = toZ + drift; fromY = toY; drift = 0; toZ = (R() - .5) * .7 * tame; toY = (R() - .5) * .9 * tame; snapT = 0; twitchIn = between(1.4, 4.2) / Math.max(.35, tame ** .7); }
    snapT += dt; const snap = smoothstep(snapT / .1);
    drift = clamp(drift + dt * .04 * tame * (1 - hear), -.25, .25);
    const offZ = lerp(fromZ, toZ, snap) + drift, offY = lerp(fromY, toY, snap);
    const breath = Math.sin(t * 1.1 + ph) * .015 * (1 - hear);

    gait += dt * pace * (1 + hunt * .6) * move;
    const s = Math.sin(gait), glide = Math.abs(s);
    flex += dt * (1.3 + move * 2) * (1 - hear * .9);
    const tremble = Math.sin(t * 31 + ph) * Math.sin(t * 13 + ph) * .06 * tame * (1 - hear);

    const idle = 1 - Math.max(move, wind, hear);
    const raise = smoothstep(clamp(windT / .45));
    pose.hipsY = -.02 * glide * move - .06 * hunt - .03 * wind + breath * .5;
    pose.hipsRz = s * .05 * move;
    pose.spineRx = hunch + .08 * hunt + .04 * move - .1 * hear - .2 * raise + breath;
    pose.spineRz = -s * .04 * move + side * .06 * hear;
    pose.neckRx = .35 + .1 * hunt - .1 * hear;
    // Face level-ish whatever the hunch; lifted toward the sound when listening.
    const level = -(pose.spineRx + pose.neckRx) + .05;
    pose.headRx = level + .05 * idle - .12 * hear + .1 * hunt - .2 * raise;
    pose.headRy = (offY * .4) * idle + lookY * hear + lookY * .3 * move;
    pose.headRz = (tilt0 + offZ) * (1 - hear) + side * .72 * hear + Math.sin(gait * .5) * .05 * move;
    // Arms: hanging long, out front feeling the air, reaching low, raised.
    const hang = -pose.spineRx + .2, feel = -.75 - pose.spineRx * .5 + Math.sin(t * 1.4 + ph) * .05, reach = -1.15 - pose.spineRx * .4 + s * .06, up = -1.85 - pose.spineRx;
    pose.lArmRx = armRx(hang, feel + s * .08, reach + .1, up, move, hunt, raise);
    pose.rArmRx = armRx(hang, feel - s * .08, reach - .1, up, move, hunt, raise);
    // The tell: the hand on the sound's side lifts, the fingers spread.
    pose[side > 0 ? 'rArmRx' : 'lArmRx'] -= .55 * hear;
    pose.lArmRz = .08 + .12 * raise + .1 * hear * (side < 0 ? 1 : 0);
    pose.rArmRz = -.08 - .12 * raise - .1 * hear * (side > 0 ? 1 : 0);
    pose.lElbow = -.4 + .2 * move - .3 * raise; pose.rElbow = -.4 + .2 * move - .3 * raise;
    pose.lHandRx = .1 + tremble - .3 * raise; pose.rHandRx = .1 - tremble - .3 * raise;
    const curl = .3 + Math.sin(flex) * .15 * tame;
    pose.lCurl = lerp(lerp(curl, .05, hear), .8, raise); pose.rCurl = lerp(lerp(curl + .05, .05, hear), .8, raise);
    // The robe sways with the glide; the feet barely lift.
    pose.robeRx = .08 * move + .05 * hunt + Math.sin(t * 1.7 + ph) * .02;
    pose.robeRz = s * .04 * move + Math.sin(t * 1.2 + ph) * .015;
    pose.lFootRx = s * .35 * move; pose.rFootRx = -s * .35 * move;
    pose.chainRx = -pose.spineRx * .2 + Math.sin(gait * 2) * .12 * move + Math.sin(t * 2 + ph) * .03;
    return pose;
  }
  return { pose, update };
}
