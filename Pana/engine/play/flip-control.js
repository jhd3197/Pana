// The "Voltear la mesa" button: your turn only, a short cooldown, and the same
// flip on every screen. It sends a cosmetic message beside the game (room.emote)
// and never room.action, so no state, turn or rule can change.
//
//   const flip = createFlipControl({ button, room, sound, canUse: () => ownTurn() && !menu.isOpen,
//     play: (seat, seed) => world?.flip(seat, seed), say: (seat, text) => world?.say(seat, text, 2) });
//   flip.sync();     // whenever the turn changes
//   flip.trigger();  // the keyboard's F
import { loc } from '../i18n.js';
import { canFlip, createFlipGate, FLIP_COOLDOWN, FLIP_SLAM } from './flip-rules.js';

export function createFlipControl({ button, room, canUse, play, say = () => {}, sound, random = Math.random, now = Date.now, later = setTimeout }) {
  const mine = createFlipGate(FLIP_COOLDOWN, now), others = createFlipGate(FLIP_COOLDOWN - 1, now);
  let timer;
  const sync = () => { button.disabled = !canUse() || !mine.ready('me'); };
  const noise = () => {
    sound?.tone(120, 0, .16, 'triangle', .18); sound?.tone(310, .03, .08, 'square', .05);
    sound?.tone(85, FLIP_SLAM, .24, 'triangle', .24); sound?.tone(190, FLIP_SLAM, .07, 'square', .07);
  };
  function trigger() {
    if (!canUse() || !mine.allow('me')) return false;
    const seed = Math.floor(random() * 2 ** 32);
    sound?.unlock(); noise(); play(room.seat, seed); room.emote({ name: 'flip', seed });
    sync(); timer = later(sync, FLIP_COOLDOWN * 1000 + 50);
    return true;
  }
  // Someone else's flip, checked here too: a stray message only ever costs a look.
  room.onEmote = (id, data) => {
    if (data?.name !== 'flip' || !canFlip(room.state, id) || !others.allow(id)) return false;
    const seat = room.state.players.findIndex(p => p.id === id);
    noise(); play(seat, data.seed >>> 0); say(seat, loc('¡{name} volteó la mesa!', { name: room.state.players[seat].name }));
    return true;
  };
  button.onclick = () => { trigger(); button.blur?.(); };
  sync();
  return { sync, trigger, dispose() { clearTimeout(timer); room.onEmote = null; } };
}
