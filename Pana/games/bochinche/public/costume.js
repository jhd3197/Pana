// A pana's costume over a saved avatar: their fur and face, the outfit and trajes from panas.js.
import { avatarToWardrobe, wardrobeToAvatar } from '/engine/avatar.js';
import { costumeLook } from './panas.js';

// Seat colours: the plate, the ring under the fighter and the bot's fur stay stable.
export const SEAT_COLORS = ['#ffc629', '#2ad1b2', '#fa7467', '#a798e8', '#77b8ff', '#f5a552'];
const BOT_FURS = ['#cf7d22', '#d4914f', '#c47f42', '#e0a463', '#b06d3b', '#9a6038'];

export function costumeAvatar(avatar, pana, traje = 0) {
  const own = avatarToWardrobe(avatar ?? {});
  return wardrobeToAvatar(costumeLook(pana, traje, { fur: own.fur, face: own.face }));
}
export const playerCostume = (p, slot) => costumeAvatar(p.bot ? { fur: BOT_FURS[slot % BOT_FURS.length] } : p.avatar, p.pana, p.traje);
