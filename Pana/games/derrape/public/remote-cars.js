// Other panas' cars in an online race. Each owner sends its cars' poses at
// POSE_HZ, stamped with the room clock; here they wait in a short buffer and
// play back a little in the past (an adaptive 100–450 ms), so packets that
// bunch up or arrive late still give smooth motion. Item effects come the same
// way (onNetFx). Your own car is never in this path: you drive it locally.
import { sound } from '/engine/fx.js';
import { pick } from '/engine/random.js';
import { POSE_HZ, FLAG, DRIFT_SHIFT, packPose } from './online-rules.js';
import { wrapAngle } from './rules.js';
import { RESCUE_GHOST_TIME } from './recovery-rules.js';
import { RESCUE_TIME } from './course-rules.js';

// link(): the online race link (null offline); popPart and lines are game.js's.
export function createRemoteCars({ race, link, popPart, lines: LINES }) {
  function sendPoses() {
      const net = link();
    if (!race.netRace || !['go', 'end'].includes(race.state)) return;
    const now = performance.now();
    if (now - race.poseAt < 1000 / POSE_HZ) return;
    race.poseAt = now;
    const stamp = Math.round(net.now());
    net.poses(race.cars.filter(c => !c.remote && !c.dns && !c.retired).map(c => [c.netId, stamp, ...packPose(c)]));
  }

  function resumePose(c, p) {
    if (!p) return;
    [c.x, c.y, c.z, c.h, c.pitch, c.roll, c.vf, c.steer] = p;
    c.vx = Math.sin(c.h) * c.vf; c.vz = Math.cos(c.h) * c.vf;
    c.lap = p[11]; c.prog = p[12]; c.coins = p[14];
    c.phaseT = RESCUE_GHOST_TIME;
  }

  function applyRemote(c, dt) {
      const net = link();
    const buf = c.buf;
    if (!buf.length) { c.vx = c.vz = 0; return; }   // still on its grid slot
    const at = net.now() - c.delay;
    while (buf.length > 2 && buf[1].t <= at) buf.shift();
    const a = buf[0], b = buf[1] || a;
    const k = b === a ? 0 : Math.max(0, Math.min(1, (at - a.t) / (b.t - a.t)));
    // Past the newest pose (a late packet), coast briefly along its heading.
    const ahead = buf.length < 2 || at > b.t ? Math.min(0.25, (at - b.t) / 1000) : 0;
    const P = a.p, Q = b.p;
    const lerp = (i) => P[i] + (Q[i] - P[i]) * k, turn = (i) => P[i] + wrapAngle(Q[i] - P[i]) * k;
    const h0 = c.h, vf0 = c.vf;
    c.x = lerp(0); c.y = lerp(1); c.z = lerp(2); c.h = turn(3); c.pitch = turn(4); c.roll = turn(5);
    c.vf = lerp(6); c.steer = lerp(7); c.spin = lerp(8); c.boost = Q[9];
    const f = Q[10];
    c.onGround = !!(f & FLAG.ground);
    c.dizzy = f & FLAG.dizzy ? 1 : 0;
    c.scream = f & FLAG.open ? 0.2 : 0;
    c.full = !!(f & FLAG.full);
    c.drift = f & FLAG.drift ? (f & FLAG.driftRight ? -1 : 1) : 0;
    c.driftLvl = (f >> DRIFT_SHIFT) & 3;
    c.shield = f & FLAG.shield ? 1 : 0;
    c.phaseRemote = !!(f & FLAG.phase);
    c.phaseT = 0;
    if (f & FLAG.done) c.done = true;
    c.lap = Q[11]; c.prog = Q[12]; c.coins = Q[14];
    // Parts that fell off on the owner's screen fall off here too.
    for (let n = Q[13] - c.lost; n > 0; n--) popPart(c, 10);
    c.lost = Math.max(c.lost, Q[13]);
    c.vx = Math.sin(c.h) * c.vf; c.vz = Math.cos(c.h) * c.vf;
    if (ahead > 0 && c.onGround) { c.x += c.vx * ahead; c.z += c.vz * ahead; }
    c.latAcc = wrapAngle(c.h - h0) / dt * c.vf;
    c.longAcc = (c.vf - vf0) / dt;
  }

  const racerById = (id) => race.cars.find(c => c.netId === id);

  function onNetPose(id, stamp, pose) {
    const c = race.netRace && racerById(id);
    if (c?.resuming && !c.remote) { resumePose(c, pose); c.resuming = false; }
    if (!c?.remote) return;
    const last = c.buf.at(-1);
    if (last && stamp <= last.t) return;   // stale or duplicate
    if (last) c.gap = c.gap * 0.8 + Math.min(1000, stamp - last.t) * 0.2;
    c.delay = Math.max(100, Math.min(450, c.gap * 1.6 + 40));
    c.buf.push({ t: stamp, p: pose });
    if (c.buf.length > 24) c.buf.shift();
  }

  function onNetFx(id, kind, d) {
    const c = race.netRace && racerById(id);
    if (!c || !race.items || !d) return;
    if (kind === 'throw') race.items.remoteThrow(c, d);
    else if (kind === 'peel') race.items.remotePeel(c, d);
    else if (kind === 'hit') race.items.remoteHit(c, d);
    else if (kind === 'slip') race.items.remoteSlip(d);
    else if (kind === 'cloud') race.items.remoteCloud(d);
    else if (kind === 'rescue' && c.remote) { c.rescueT = RESCUE_TIME; c.bubble.say(pick(LINES.rescue), 1.3); }
    else if (kind === 'honk' && c.honkT <= 0) {
      c.honkT = sound.horn(c.def.horn);
      c.bubble.say(LINES.honk[c.def.horn], c.honkT + 0.2);
      c.heave.v += 5;
    } else if (kind === 'say') c.bubble.say(String(d.text ?? '').slice(0, 40), Math.min(3, Number(d.time) || 1.2));
  }

  return { sendPoses, resumePose, applyRemote, onNetPose, onNetFx, racerById };
}
