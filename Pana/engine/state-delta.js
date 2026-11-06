// State deltas: what changed between two JSON snapshots, and putting it back.
// A host that publishes its whole state every tick sends only the changes;
// the guest rebuilds the full state from the one before. Lossless for any
// JSON value (no functions, no undefined inside arrays).
//
//   const d = diffState(previous, next);     // undefined when nothing changed
//   const again = patchState(previous, d);   // deep-equal to next
//
// patchState never changes `previous`, but the result shares the parts that
// did not change with it (and with `d`): clone it before anyone mutates it.
//
// Objects diff key by key ({ $del: [...] } lists removed keys). Arrays whose
// items are all objects with a unique `id` (players, enemies, items) diff per
// item: { $ids: [order], $set: { id: diff or whole item } }. Any other array
// that changed is sent whole.
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const keyed = a => Array.isArray(a) && a.every(v => isObject(v) && (typeof v.id === 'number' || typeof v.id === 'string')) && new Set(a.map(v => v.id)).size === a.length;
const KEYED = '$ids';

function equal(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!equal(a[i], b[i])) return false; return true; }
  const ka = Object.keys(a); if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (!(k in b) || !equal(a[k], b[k])) return false;
  return true;
}

// A wrapper marks a whole value so a patch never mistakes it for a diff.
const whole = v => (isObject(v) || Array.isArray(v)) ? { $v: v } : v;

export function diffState(prev, next) {
  if (equal(prev, next)) return undefined;
  if (isObject(prev) && isObject(next)) {
    const out = {}, gone = [];
    for (const k of Object.keys(next)) { const d = k in prev ? diffState(prev[k], next[k]) : whole(next[k]); if (d !== undefined) out[k] = d; }
    for (const k of Object.keys(prev)) if (!(k in next)) gone.push(k);
    if (gone.length) out.$del = gone;
    return out;
  }
  if (keyed(prev) && keyed(next) && next.length) {
    const before = new Map(prev.map(v => [v.id, v])), set = {};
    for (const item of next) { const old = before.get(item.id), d = old ? diffState(old, item) : { $v: item }; if (d !== undefined) set[item.id] = d; }
    const ids = next.map(v => v.id), same = ids.length === prev.length && ids.every((id, i) => prev[i].id === id);
    return { [KEYED]: same ? 1 : ids, $set: set };
  }
  return whole(next);
}

export function patchState(prev, d) {
  if (d === undefined) return prev;
  if (!isObject(d)) return d;                          // a primitive replaced
  if ('$v' in d) return d.$v;                          // a whole object or array
  if (KEYED in d) {
    const before = new Map((Array.isArray(prev) ? prev : []).map(v => [v.id, v]));
    const ids = d[KEYED] === 1 ? prev.map(v => v.id) : d[KEYED];
    return ids.map(id => { const change = d.$set[id]; return change === undefined ? before.get(id) : patchState(before.get(id), change); });
  }
  const out = isObject(prev) ? { ...prev } : {};
  for (const k of d.$del || []) delete out[k];
  for (const [k, v] of Object.entries(d)) if (k !== '$del') out[k] = patchState(out[k], v);
  return out;
}

// The wire on both ends of a room that publishes snapshots (engine/live-room.js
// subclasses). The host's encode(state) returns the message fields: a whole
// state now and then (`keyframe` publishes apart, or after reset()), else a
// delta against the previous one. The guest's decode(from, message) returns
// the full state, or null when it has no base for that delta yet (it joined
// late, or the host changed): ask for a keyframe and wait for it.
export function createDeltaSender({ keyframe = 40 } = {}) {
  let last = null, seq = 0, since = 0;
  return {
    encode(state) {
      const copy = structuredClone(state), base = seq;
      seq++;
      if (!last || ++since >= keyframe) { last = copy; since = 0; return { state: copy, seq }; }
      const delta = diffState(last, copy); last = copy;
      return { delta: delta ?? null, base, seq };
    },
    reset() { last = null; },
  };
}
export function createDeltaReceiver() {
  let from = null, seq = -1, wire = null;
  return {
    decode(sender, message) {
      if (message.state !== undefined) { from = sender; seq = message.seq ?? -1; wire = message.state; return structuredClone(wire); }
      if (sender !== from || message.base !== seq || wire === null) return null;
      if (message.delta !== null) wire = patchState(wire, message.delta);
      seq = message.seq; return structuredClone(wire);
    },
    reset() { from = null; seq = -1; wire = null; },
  };
}
