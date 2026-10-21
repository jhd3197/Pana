import { createLayout } from './margarita-layout.js';
import { createWorld } from './margarita-world.js';
import { coastalTrack } from './coastal-track.js';

// The island opens up 1.4x so the castle hairpins stay above a 15 m radius.
const scale = 1.4;
const layout = createLayout();

// La Restinga floods the causeway through the mangrove lagoon: cars run its
// whole length as lanchas beside the tourist peñeros (transform-gates.js).
function restinga({ SEG, NR }) {
  return { from: SEG.indexOf('r') / NR, to: (SEG.lastIndexOf('r') + 1) / NR };
}

const track = coastalTrack('margarita', layout, (group, layout, roadDistance) => createWorld(group, layout, roadDistance, scale), {
  scale,
  previewBounds: [[-370, 0, -510], [670, 80, 310]],
  // A bright Caribbean day: deep blue overhead, a warm sun over the turquoise.
  palette: { skySeed: 44, cloudCover: .3, horizon: 0xcfe6ee, skyTop: 0x1f86e0, halo: .35,
    hemiSky: 0xdff2ff, hemiGround: 0x8a7a48, hemiInt: 1.6, sun: 0xfff3dc,
    sunInt: 2.5, ground: 0x6e8e36, track: 0x5c5c60, dune: 0, fog: [600, 4200] },
});
export default { ...track, transformGates: [restinga(layout)] };
