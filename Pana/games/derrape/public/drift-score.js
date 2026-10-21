// Drift style scoring: an additive flavour layer, never a punishment and
// never the thing that decides a race (docs/knowledge/derrape-driving.md).
// Pure math over the drift state stepCar leaves on a car (c.drift, c.driftLvl,
// c.vf, c.vr), like rules.js: no Three.js, no DOM. game.js feeds every
// locally stepped car, so bots score too; only the local player's banked
// points reach the stats pipe. drift-combo.js owns the HUD meter.
//
// Points per drift second:
//   BASE_RATE × speed factor × level factor × angle factor × chain
// speed  vf / SPEED_REF, capped at SPEED_CAP (a turbo run scores, not explodes)
// level  LEVEL_FACTOR[c.driftLvl]: blue/orange/purple charge worth more
// angle  the larger of the slip |vr| / max(|vf|, 1) (full at ANGLE_FULL) and
//        the drift's turn rate |latAcc / vf| (full at TURN_FULL rad/s): the
//        drive model swings the tail visually and bleeds vr fast, so a real
//        drifted bend shows up as turning. A held button on a straight
//        (no slip, no turn) scores nothing, like the charge rule
// chain  ×1 for a lone drift; a drift starting within CHAIN_WINDOW seconds of
//        the last one's end raises it, up to CHAIN_MAX
//
// Points gather in a pending pot while the chain is live. The pot banks into
// the race total when the chain window expires or a crash kills the drift
// (button still held, or spinning: the wall threw it away, drive.js).
// Release and crash bank alike — nobody ever loses points they already slid
// for; a crash only ends the chain early. Tuned so a decent three-lap race
// (≈20 s of real drifting at orange charge) lands in the low thousands.
import { statCount } from '/engine/stats.js';

export const SCORE = {
  BASE_RATE: 40,                 // points/s at reference speed, level 1, full angle
  SPEED_REF: 25,                 // m/s giving a speed factor of 1 (tops are 35–39)
  SPEED_CAP: 2,                  // boost speeds still count, just bounded
  LEVEL_FACTOR: [0.5, 1, 1.6, 2.4],   // by driftLvl 0..3: every real drift scores
  ANGLE_FULL: 0.6,               // |vr|/|vf| ratio that counts as fully sideways
  TURN_FULL: 0.8,                // rad/s of drifted turning that counts as full angle
  CHAIN_WINDOW: 3,               // s after a drift ends to link the next one
  CHAIN_MAX: 5,                  // multiplier cap
};

export function createDriftScoring({ count = statCount } = {}) {
  const { BASE_RATE, SPEED_REF, SPEED_CAP, LEVEL_FACTOR, ANGLE_FULL, TURN_FULL, CHAIN_WINDOW, CHAIN_MAX } = SCORE;
  const cars = new Map();
  const state = (c) => {
    let s = cars.get(c);
    if (!s) {
      s = { pending: 0, chain: 1, chainT: 0, drifting: false, total: 0, bestChain: 1, bankSeq: 0, lastBank: 0 };
      cars.set(c, s);
    }
    return s;
  };
  // Move the pending pot into the race total. Only the local player's points
  // leave the game: bots and split-screen player 2 score for the results
  // screen but never touch the stats pipe.
  const bank = (c, s) => {
    const banked = Math.round(s.pending);
    s.pending = 0; s.chain = 1; s.chainT = 0;
    if (banked <= 0) return;
    s.total += banked; s.bankSeq++; s.lastBank = banked;
    if (c.isPlayer) count('derrape.drift-points', banked);
  };
  return {
    // One physics step of one car, right after stepCar.
    step(c, dt) {
      const s = state(c);
      if (c.drift) {
        if (!s.drifting) {
          // A drift inside the window raises the chain; otherwise it starts at ×1.
          if (s.chainT > 0) s.chain = Math.min(CHAIN_MAX, s.chain + 1);
          s.bestChain = Math.max(s.bestChain, s.chain);
          s.chainT = 0;
        }
        const speed = Math.min(SPEED_CAP, Math.max(0, c.vf) / SPEED_REF);
        const level = LEVEL_FACTOR[Math.min(c.driftLvl || 0, LEVEL_FACTOR.length - 1)];
        const speedAbs = Math.max(Math.abs(c.vf), 1);
        const slip = Math.abs(c.vr || 0) / speedAbs / ANGLE_FULL;
        const turning = Math.abs(c.latAcc || 0) / speedAbs / TURN_FULL;
        const angle = Math.min(1, Math.max(slip, turning));
        s.pending += BASE_RATE * speed * level * angle * s.chain * dt;
      } else if (s.drifting) {
        // The drift just ended. A clean release (button let go) opens the
        // chain window; a wall or a spin (button still held, or spinning)
        // banks on the spot — points are never lost, only the chain ends.
        if (c.driftHeld || c.spin > 0) bank(c, s);
        else s.chainT = CHAIN_WINDOW;
      } else if (s.chainT > 0) {
        s.chainT -= dt;
        if (s.chainT <= 0) bank(c, s);
      }
      s.drifting = !!c.drift;
    },
    // Race over: bank whatever chain is still live so nothing dangles.
    finish(c) { const s = cars.get(c); if (s) bank(c, s); },
    // Race total, counting the live chain: the results screen reads this.
    totalOf(c) { const s = cars.get(c); return s ? Math.round(s.total + s.pending) : 0; },
    bestChainOf(c) { const s = cars.get(c); return s ? s.bestChain : 1; },
    // What the HUD shows for one car: live pot, multiplier, and a bank
    // counter the meter watches to flash the flourish.
    live(c) {
      const s = state(c);
      return { points: Math.floor(s.pending), chain: s.chain, active: s.drifting || s.chainT > 0, bankSeq: s.bankSeq, lastBank: s.lastBank };
    },
    // A new race starts every car over.
    reset() { cars.clear(); },
  };
}
