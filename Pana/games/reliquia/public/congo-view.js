// What a Congo jornada looks and sounds like on this screen: everyone's dugout, the raft
// under each carrito, the Mokele's body and the order you meet it in (heard, then a shape
// in the fog, then its teeth far too close). Boats are looks only, like the diving suits: no
// rule sees them and speed is the walker's own. Loaded when a Congo jornada first shows.
import * as THREE from 'three';
import { mokele, piragua, balsa } from '/engine/models/props/congo.js';
import { floorOf, inRect } from './deck.js';
import { MOKELE, REVEAL, revealStage, teethAmount, headScale, cueFor } from './mokele.js';

// Sitting in the boat you look out from just over the water.
const EYE_DROP = .52, WATER = .13, SEAT = .4, TEETH_REACH = 1.7;
const smooth = (now, next, rate, dt) => now + (next - now) * (1 - Math.exp(-dt * rate));

export function createCongoView({ scene, waves, puffs, emit }) {
  const own = piragua({ seed: 7 }); own.visible = false; scene.add(own);
  const hulls = new Map(), rafts = new Map(), bosses = new Map();
  let drop = 0, roll = 0;
  // Over water: not on the dock, the rope bridge or an island.
  const afloat = (layout, x, z) => { const run = layout.run, f = floorOf(x); return f > 0 && !run.stubs.some(s => s.floor === f && inRect(x, z, s.rect)) && !run.bridges.some(b => b.floor === f && inRect(x, z, b.rect)) && !run.pits.some(p => p.floor === f && inRect(x, z, p.island)); };
  // How this screen meets one Mokele. `a` is the view's record; the cues go out through `emit`.
  function drawBoss(a, e, me, t, dt, scares) {
    const d = me ? Math.hypot(e.x - me.x, e.z - me.z) : 99, on = bosses.get(e.id) || { foot: .5, wake: 1.2, seen: false, teeth: false, x: e.x, z: e.z, speed: 0, rise: 0, ring: 0, teethNow: 0, jaw: 0, stage: 'none' };
    bosses.set(e.id, on);
    const step = dt > 0 ? Math.hypot(e.x - on.x, e.z - on.z) / dt : 0; on.x = e.x; on.z = e.z;
    on.speed = smooth(on.speed, Math.min(1, step / 2.5), 6, dt);
    const emerging = e.mode === 'emerge', fall = e.mode === 'fall' ? Math.min(1, (e.modeT || 0) / MOKELE.fall) : 0;
    on.rise = emerging ? Math.min(1, (e.modeT || 0) / MOKELE.emerge) : smooth(on.rise, 1, 3, dt);
    a.root.position.y = -7.5 * (1 - on.rise) ** 2 - fall * fall * 9;
    const stage = revealStage(d, e.mode); on.stage = stage;
    on.teethNow = smooth(on.teethNow, teethAmount(d, e.mode), 7, dt);
    const windup = e.windup > 0 ? 1 - e.windup / .7 : 0;
    on.jaw = smooth(on.jaw, Math.max(on.teethNow * .9, windup, e.peek ? .5 : 0), 10, dt);
    const shade = 1 - Math.max(0, Math.min(1, (REVEAL.shape - d) / (REVEAL.shape - REVEAL.teeth))) ** 1.4;
    a.model.userData.animate(t, { walk: on.speed, teeth: Math.max(on.teethNow, e.peek ? .6 : 0), jaw: on.jaw, reach: Math.max(2.5, d - TEETH_REACH), windup, stun: e.stun > 0 ? 1 : 0, fall, grow: headScale(on.teethNow, scares), shade });
    a.ring.visible = e.windup > 0; a.ring.position.set(e.attackX, .17, e.attackZ); a.ring.scale.setScalar(2.6);
    // The water it pushes aside, seen as well as heard.
    on.ring -= dt;
    if (on.ring <= 0 && a.root.visible) {
      if (emerging) { on.ring = .35; waves.ring({ x: e.x, y: .16, z: e.z }, { color: 0xc4d4b0, startRadius: 1, maxRadius: 6, life: 1.1 }); puffs.spawn({ x: e.x, y: .3, z: e.z }, { color: 0xc4d4b0, count: 4, spread: 2, size: .5, rise: .8, life: .7 }); }
      else if (on.speed > .2) { on.ring = .55; waves.ring({ x: e.x, y: .16, z: e.z }, { color: 0xa8b89a, startRadius: 1.8, maxRadius: 4.4, life: .9 }); }
      else on.ring = .3;
    }
    if (!me || floorOf(me.x) !== floorOf(e.x) || me.downed) return;
    // Heard: footfalls under the water and the wave it pushes, closer is quicker.
    const cue = cueFor(d, e.mode, scares);
    if (cue.foot) { on.foot -= dt; if (on.foot <= 0) { on.foot = cue.foot; emit({ type: 'mokele', sound: 'footfall', x: e.x, z: e.z, range: REVEAL.hear, shake: d < 16 && scares !== 'apagados' ? .05 + (16 - d) * .008 : 0 }); } }
    if (cue.wake) { on.wake -= dt; if (on.wake <= 0) { on.wake = cue.wake * (.8 + Math.random() * .4); emit({ type: 'mokele', sound: 'wake', x: e.x, z: e.z, range: REVEAL.hear }); } }
    // Seen: one low call when the shape first comes through the fog, again after you lose it.
    if (stage !== 'heard' && stage !== 'none' && !on.seen && !emerging) { on.seen = true; if (scares !== 'apagados') emit({ type: 'mokele', sound: 'bellow', x: e.x, z: e.z, range: REVEAL.hear }); }
    if (d > REVEAL.shape + 8) on.seen = false;
    // And the close-up: a roar and a jolt on the way in, once a chase.
    if (stage === 'teeth' && !on.teeth) { on.teeth = true; if (scares !== 'apagados') emit({ type: 'mokele', sound: 'roar', x: e.x, z: e.z, range: REVEAL.hear, shake: .55 }); }
    if (d > REVEAL.teeth + 5) on.teeth = false;
  }
  // Everyone's boat. `me` sits in the one in front of the camera; others in theirs.
  function update({ state, me, layout, vf, heading, dt, t, avatars, carts }) {
    const on = !!me && vf > 0 && floorOf(me.x) === vf && !me.downed && !me.spectator && afloat(layout, me.x, me.z);
    drop = smooth(drop, on ? EYE_DROP : 0, 5, dt);
    roll = on ? Math.sin(t * 1.15) * .018 + Math.sin(t * 2.3 + 1) * .009 + (me.moving ? Math.sin(t * 5) * .012 : 0) : roll * Math.exp(-dt * 6);
    own.visible = on;
    if (on) {
      // Fixed to your heading and a little ahead of you, so the bow lies at the bottom of the view.
      own.position.set(me.x + Math.sin(heading) * 1.05, WATER + Math.sin(t * 1.4) * .02, me.z + Math.cos(heading) * 1.05);
      own.rotation.set(Math.sin(t * 1.15) * .012, heading, roll * .7); own.userData.paddle(t, me.moving ? 1 : 0);
    }
    for (const p of state.players) {
      const a = avatars.get(p.id); if (!a) continue;
      let hull = hulls.get(p.id);
      if (!hull) { hull = piragua({ seed: p.seat + 2 }); hulls.set(p.id, hull); }
      // A changed look or a new jornada's cart builds a new root: the boat moves over to it.
      if (hull.parent !== a.root) { a.root.add(hull); a.hull = hull; }
      const wet = a.root.visible && !p.downed && afloat(layout, p.x, p.z);
      hull.visible = wet; a.afloat = wet;
      if (wet) { hull.position.y = WATER + Math.sin(t * 1.3 + p.seat) * .025; hull.rotation.y = a.character.group.rotation.y; hull.rotation.z = Math.sin(t * 1.1 + p.seat) * .02; hull.userData.paddle(t, p.moving ? 1 : 0); }
    }
    for (const c of state.carts || []) {
      const a = carts.get(c.id); if (!a) continue;
      let raft = rafts.get(c.id);
      if (!raft) { raft = balsa(); raft.position.y = WATER + .02; rafts.set(c.id, raft); }
      if (raft.parent !== a.root) a.root.add(raft);
      raft.visible = floorOf(c.x) > 0 && afloat(layout, c.x, c.z);
    }
    for (const id of bosses.keys()) if (!state.enemies.some(e => e.id === id)) bosses.delete(id);
  }
  // Back to a dry place: nobody carries a boat in.
  function hide(avatars) {
    drop = 0; roll = 0; own.visible = false;
    for (const [id, hull] of hulls) { hull.visible = false; const a = avatars.get(id); if (a) a.afloat = false; }
    for (const raft of rafts.values()) raft.visible = false;
  }
  return {
    bossModel: seed => mokele({ seed }), drawBoss, update, hide,
    SEAT, bosses,
    get eyeDrop() { return drop; }, get roll() { return roll; }, get ownBoat() { return own; },
    dispose() {
      own.removeFromParent(); own.userData.dispose();
      for (const hull of hulls.values()) { hull.removeFromParent(); hull.userData.dispose(); }
      for (const raft of rafts.values()) { raft.removeFromParent(); raft.userData.dispose(); }
      hulls.clear(); rafts.clear(); bosses.clear();
    },
  };
}
