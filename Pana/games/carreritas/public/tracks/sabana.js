import { withSightlines } from './authored-sightlines.js';
import { createLayout } from './sabana-layout.js';
import { createWorld } from './sabana-world.js';
import { coastalTrack } from './coastal-track.js';

const layout = createLayout();
// A big bright afternoon over the plateau. The haze stays thin so the
// tepuyes read on the horizon; the storm is scenery on the race clock.
export default withSightlines(coastalTrack('sabana', layout, createWorld, {
  scale: 1,
  previewBounds: [[-460, 0, -500], [500, 60, 460]],
  palette: { skySeed: 44, cloudCover: .42, halo: .25, horizon: 0xcfe2ef, skyTop: 0x2a74d0,
    hemiSky: 0xe6f2ff, hemiGround: 0x7a6a3a, hemiInt: 1.6, sun: 0xfff0d6,
    sunInt: 2.5, ground: 0x8a9a3e, track: 0xc47a4a, dune: 0, fog: [1000, 9000] },
  // The clear sheet over the jasper is slick; the rest of the lap keeps full grip.
  gripAt: (x, z) => {
    const near = layout.sampleR(layout.RR, x, z);
    return near.i >= 0 && layout.ford[near.i] > .5 ? .85 : 1;
  },
}));
