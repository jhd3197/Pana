import { createLayout } from './tovar-layout.js';
import { createWorld } from './tovar-world.js';
import { coastalTrack } from './coastal-track.js';

// The mountain road opens up 1.3x so the forest hairpins stay above a 15 m radius.
const scale = 1.3;
export default coastalTrack('tovar', createLayout(), (group, layout, roadDistance) => createWorld(group, layout, roadDistance, scale), {
  scale,
  previewBounds: [[-300, 40, -400], [430, 140, 270]],
  // A cool, bright mountain day: grey-white haze that closes in sooner than the coast.
  palette: { skySeed: 18, cloudCover: .72, horizon: 0xd8e2e6, skyTop: 0x6f9fd0,
    hemiSky: 0xeef3f8, hemiGround: 0x4f6e3a, hemiInt: 1.55, sun: 0xfff4e4,
    sunInt: 2.1, ground: 0x5c9a38, track: 0x6a6a6c, dune: 0, fog: [220, 1400] },
});
