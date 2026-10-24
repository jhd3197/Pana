// Keep opponent portraits and the 3D fighters on the same wardrobe.
const BOT_LOOKS = ['#2ad1b2', '#ffc629', '#3d7bf2', '#ff8a3d', '#9b5de5', '#6bbf59', '#ff6fae', '#ee3024'];
export function fighterLook(player, index = 0) {
  if (!player?.bot) return player?.avatar || {};
  return { outfitColor: BOT_LOOKS[index % BOT_LOOKS.length], face: 'feliz', fur: ['#cf7d22', '#d4914f', '#b06d3b', '#e0a463'][index % 4], hat: 'none', outfit: ['franela', 'deportivo', 'hoodie'][index % 3] };
}
