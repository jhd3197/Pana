// Personal-best ghost recording: the local player's poses (packPose output)
// sampled at POSE_HZ during a race, split into laps, with the fastest lap per
// track kept in localStorage for ghost-car.js to replay. Pure data work — no
// Three.js, no DOM — so tests/ghost.test.js drives it in node.
import { POSE_HZ, packPose } from './online-rules.js';

export const ghostKey = (trackId) => `derrape:ghost:${trackId}`;

// One stored ghost is a lap's worth of 15-number poses at 20 Hz (~2 KB/s).
const MAX_POSES = 20 * 60 * 6;   // a lap longer than six minutes is not worth keeping
const MIN_LAP_S = 3;             // shorter "laps" are glitches, not records

const safeStorage = () => { try { return localStorage; } catch { return null; } };

// The stored best lap for a track: { lap: seconds, poses: [[tMs, ...pose]] },
// pose stamps relative to the lap start. Anything malformed reads as absent.
export function loadGhost(trackId, storage = safeStorage()) {
  try {
    const ghost = JSON.parse(storage?.getItem(ghostKey(trackId)) || 'null');
    if (!Number.isFinite(ghost?.lap) || !Array.isArray(ghost.poses) || ghost.poses.length < 2) return null;
    if (!ghost.poses.every(p => Array.isArray(p) && p.length === 16)) return null;
    return ghost;
  } catch { return null; }
}

export function createGhostRecorder({ storage = safeStorage(), hz = POSE_HZ } = {}) {
  const sampleMs = 1000 / hz;
  let track = null;       // track id being recorded; null while idle
  let stream = [];        // [[tMs, ...pose]] since the start line, absolute stamps
  let bounds = [];        // lap end times (race clock seconds), in order
  let nextDue = 0;        // next stamp (ms) a sample is taken at
  let seenLap = null;     // c.lap of the previous step, to catch the line
  let closed = false;     // the car finished: the last bound is the final lap

  // A restart or a walk to the garage mid-race: nothing is kept.
  function discard() { track = null; stream = []; bounds = []; closed = false; seenLap = null; }

  return {
    // A race starts recording; any previous take is dropped.
    begin(trackId) {
      track = trackId; stream = []; bounds = []; nextDue = 0; seenLap = null; closed = false;
    },
    get recording() { return !!track; },
    get samples() { return stream.length; },
    // One physics step of the local car; clock is the race clock in seconds.
    step(clock, c) {
      if (!track || closed) return;
      if (seenLap != null && c.lap > seenLap) bounds.push(clock);   // the line: a lap closed
      seenLap = c.lap;
      const now = clock * 1000;
      while (nextDue <= now && stream.length < MAX_POSES) {
        stream.push([Math.round(nextDue), ...packPose(c)]);
        nextDue += sampleMs;
      }
      if (c.done) closed = true;
    },
    // Race over: keep the fastest lap if it beats the stored one. Quota or
    // private-mode failures drop the ghost quietly. Returns what happened.
    finish() {
      if (!track) return null;
      const taken = { track, stream, bounds };
      discard();
      let best = null;
      for (let i = 0; i < taken.bounds.length; i++) {
        const start = i ? taken.bounds[i - 1] : 0, lap = taken.bounds[i] - start;
        if (lap < MIN_LAP_S || !Number.isFinite(lap)) continue;
        const from = Math.round(start * 1000), to = Math.round(taken.bounds[i] * 1000);
        const poses = taken.stream.filter(p => p[0] >= from && p[0] <= to)
          .map(p => [p[0] - from, ...p.slice(1)]);
        if (poses.length < 2) continue;
        const entry = { lap: Math.round(lap * 1000) / 1000, poses };
        if (!best || entry.lap < best.lap) best = entry;
      }
      if (!best) return { saved: false, lap: null, best: loadGhost(taken.track, storage)?.lap ?? null };
      const stored = loadGhost(taken.track, storage);
      if (stored && stored.lap <= best.lap) return { saved: false, lap: best.lap, best: stored.lap };
      try {
        storage?.setItem(ghostKey(taken.track), JSON.stringify(best));
        return { saved: !!storage, lap: best.lap, best: best.lap };
      } catch { return { saved: false, lap: best.lap, best: best.lap }; }
    },
    discard,
  };
}
