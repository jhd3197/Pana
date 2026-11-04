// Fight proportions: close to the classic pana. The head is a little under the
// shared character's .58, the largest where two helmets clear each other at the
// body gap; arms a touch longer and gloves big enough to read a punch on TV.
export const HEAD_SIZE = .5, ARM_LENGTH = 1.05, ARM_GUARD = 1.03, GLOVE_SIZE = 1.2;
// A punch's arm length to reach a rival `gap` metres away: the glove stops at
// their guard, whether they stand at the body gap or at the end of the reach.
export const punchLength = (gap) => Math.max(ARM_GUARD, Math.min(2.1, (gap - .65) / .52));
// Keep opponent portraits and the 3D fighters on the same wardrobe.
const BOT_LOOKS = ['#2ad1b2', '#ffc629', '#3d7bf2', '#ff8a3d', '#9b5de5', '#6bbf59', '#ff6fae', '#ee3024'];
export function fighterLook(player, index = 0) {
  if (!player?.bot) return player?.avatar || {};
  return { outfitColor: BOT_LOOKS[index % BOT_LOOKS.length], face: 'feliz', fur: ['#cf7d22', '#d4914f', '#b06d3b', '#e0a463'][index % 4], hat: 'none', outfit: ['franela', 'deportivo', 'hoodie'][index % 3] };
}
