// A guest's own character, moved by its own input right away instead of a
// round trip later. LiveRoom drives it when a room passes `predict`:
//
//   super(options, { predict: { body: (state, id) => state.players.find(p => p.id === id),
//                               step: (body, input, dt, state) => stepCook(body, input, dt) } });
//   room.predicted   // the body to draw for yourself (null on the host and offline)
//
// Every guest tick sends a numbered input and steps the prediction with it.
// The host echoes, per guest, the last number it applied. Each snapshot then
// restarts the prediction from the host's body and replays the inputs the host
// had not seen yet, so the guest stays ahead by exactly its own latency and
// the host stays the authority. step() must be the same pure function the
// host's simulation uses for that body, and must only touch the body; `state`
// is the latest snapshot, for whatever the world decides (an open gate).

// slice: the host's fixed step (LiveRoom's STEP), so both integrate the same way.
export function createPrediction({ body, step, slice = 0.05 }) {
  let pending = [], current = null, world = null;
  const advance = (target, input, dt) => {
    for (let left = dt; left > 1e-6; left -= slice) step(target, input, Math.min(slice, left), world);
  };
  return {
    get body() { return current; },
    // This guest's input number `seq`, held for dt seconds.
    input(seq, input, dt) {
      if (!current) return;
      pending.push({ seq, input, dt });
      if (pending.length > 120) pending.shift();   // ~6 s unacknowledged: the host is gone
      advance(current, input, dt);
    },
    // A snapshot from the host, which had applied this guest's inputs up to `ack`.
    snapshot(state, id, ack) {
      const authority = body(state, id);
      world = state;
      if (!authority) { current = null; pending = []; return; }
      if (Number.isSafeInteger(ack)) pending = pending.filter(p => p.seq > ack);
      current = structuredClone(authority);
      for (const p of pending) advance(current, p.input, p.dt);
    },
    reset() { current = null; pending = []; world = null; },
  };
}
