// Who may flip the table, and how often (engine/fx/table-flip.js draws it). A
// flip is an emote: nothing here reads or writes a game's rules beyond asking
// whose turn it is. No DOM and no Three.js, so a server room can import it.
export const FLIP_SECONDS = 2;
export const FLIP_SLAM = 1.85;   // when the table lands back, for the sound
export const FLIP_COOLDOWN = 5;

export const canFlip = (state, id) => state?.phase === 'playing' && id != null && state.players?.[state.turn]?.id === id;

// One cooldown per sender.
export function createFlipGate(cooldown = FLIP_COOLDOWN, now = Date.now) {
  const last = new Map();
  const ready = who => !last.has(who) || now() - last.get(who) >= cooldown * 1000;
  return { ready, allow(who) { if (!ready(who)) return false; last.set(who, now()); return true; } };
}
