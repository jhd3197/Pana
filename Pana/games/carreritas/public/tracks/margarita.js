import { createLayout } from './margarita-layout.js';
import { createWorld } from './margarita-world.js';
import { coastalTrack } from './coastal-track.js';
import { fishermen } from './lagoon-life.js';

// The island opens up 1.4x so the castle hairpins stay above a 15 m radius.
const scale = 1.4;
const layout = createLayout();

// La Restinga has no causeway: the road goes down a slipway into the
// mangrove lagoon and cars cross it as lanchas, anywhere inside its banks
// (course-rules.js), among the tourist peñeros and two boats of chigüires
// fishing. The lagoon surface is the sea's, at y = 0.
const RESTINGA = { below: 0.3, open: true };
// Race metres: one boat each side of the line, clear of the peñeros' loops.
const FISHING = [[589, -222, 0.5], [547, -95, -1.2]];

export default coastalTrack('margarita', layout, (group, layout, roadDistance) => createWorld(group, layout, roadDistance, scale), {
  scale,
  previewBounds: [[-370, 0, -510], [670, 80, 310]],
  // A bright Caribbean day: deep blue overhead, a warm sun over the turquoise.
  palette: { skySeed: 44, cloudCover: .3, horizon: 0xcfe6ee, skyTop: 0x1f86e0, halo: .35,
    hemiSky: 0xdff2ff, hemiGround: 0x8a7a48, hemiInt: 1.6, sun: 0xfff3dc,
    sunInt: 2.5, ground: 0x6e8e36, track: 0x5c5c60, dune: 0, fog: [600, 4200] },
  def: {
    transformGates: [RESTINGA],
    lagoonAt: (x, z) => layout.lagoonD(x / scale, z / scale) > -6 ? 0 : null,
    scenery(group, kit, T) { group.add(fishermen(T, FISHING)); },
  },
});
