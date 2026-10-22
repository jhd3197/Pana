import { createLayout } from '/engine/worlds/coastal/galipan-layout.js';
import { createWorld, GALIPAN_SCALE } from '/engine/worlds/coastal/galipan-world.js';
import { coastalTrack } from './coastal-track.js';

const scale = GALIPAN_SCALE;
// Night on the mountain: the moon lights the road from the north-west and
// Caracas glows below. Fog stays far so the city reads from the mirador.
export default coastalTrack('galipan', createLayout(), createWorld, {
  scale,
  palette: { skySeed: 53, cloudCover: .12, horizon: 0x1c2450, skyTop: 0x070c26, daylight: .12,
    sunDisc: false,
    hemiSky: 0x7088d8, hemiGround: 0x2a2838, hemiInt: .9, sun: 0xb0c4ff,
    sunInt: .95, ground: 0x2c5a30, track: 0x8c8a84, dune: 0, fog: [320, 3400] },
  previewBounds: [[-440 * scale, 60, -440 * scale], [440 * scale, 260, 440 * scale]],
});
