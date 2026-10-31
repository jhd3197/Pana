// The numbers behind Pepazo's HUD, with no DOM so Node can test them: who is in
// the race, how many pepas to draw, where a hit came from. combat-hud.js draws them.
import { locKey } from '../../../engine/i18n.js';

export const PEPAS = 12;           // balls in the ammo row; bigger magazines show a fraction of it
export const FLAG_GOAL = 3;        // captures that end a flag round (rules.js)
// The knockout lines rules.js says: the killfeed already shows them, so the bottom pill stays quiet.
export const KILL_LINES = new Set([locKey('{owner} pintó a {victim} · {distance} m'), locKey('Un pana pintó a {victim} · {distance} m')]);

export const clock = seconds => { const s = Math.max(0, Math.ceil(seconds || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// You against the best rival, or your team against the other. `target` is the paint goal (rules TARGET).
export function race(state, id, target) {
  const players = state.players || [], me = players.find(p => p.id === id), n = players.length;
  const order = [...players].sort((a, b) => b.score - a.score || a.hits - b.hits);
  const rank = Math.max(1, order.findIndex(p => p.id === id) + 1);
  const flag = !!state.options?.flag, teams = flag || state.options?.mode === 'teams', goal = flag ? FLAG_GOAL : target;
  if (teams && me) {
    const mine = me.team ? 1 : 0, scores = state.teamScores || [0, 0];
    return { teams, flag, rank, n, goal, me: { team: mine, score: scores[mine] || 0 }, rival: { team: 1 - mine, score: scores[1 - mine] || 0 } };
  }
  const rival = order.find(p => p.id !== id);
  return { teams: false, flag, rank, n, goal, me: { name: me?.name, color: me?.color, score: me?.score || 0 },
    rival: rival ? { name: rival.name, color: rival.color, score: rival.score || 0 } : null };
}

// The ammo row: `on` of `total` balls lit. A last ball never reads as empty.
export function pepas(ammo, magazine, cap = PEPAS) {
  const size = Math.max(1, magazine || 1), total = Math.min(cap, Math.round(size));
  return { total, on: ammo > 0 ? Math.min(total, Math.max(1, Math.ceil(ammo / size * total))) : 0 };
}
// Coral numbers: empty, or a quarter left in a magazine of more than one (a rocket's single shell is not "low").
export const lowAmmo = (ammo, magazine) => ammo <= 0 || (magazine > 1 && ammo <= Math.ceil(magazine * .25));

// Radians clockwise from where you look to the pana that hit you (0 = ahead, +90° = your right).
// x grows right and z toward you, as in the minimap, so atan2(z, x) is a clockwise heading.
export function hitAngle(me, from, forward) {
  if (!me || !from || !forward) return null;
  const dx = from.x - me.x, dz = from.z - me.z; if (!dx && !dz) return null;
  let a = Math.atan2(dz, dx) - Math.atan2(forward.z, forward.x);
  while (a > Math.PI) a -= Math.PI * 2; while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}
