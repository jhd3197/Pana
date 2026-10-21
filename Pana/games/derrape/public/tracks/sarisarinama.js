import * as THREE from 'three';
import { createLayout, MAP } from './sarisarinama-layout.js';
import { createWorld } from './sarisarinama-world.js';
import { coastalTrack } from './coastal-track.js';

// The spiral passes over the lake gallery: a layered lap whose surface is
// resolved by height, so the road stays flat (no crossfall) everywhere.
export default coastalTrack('sarisarinama', createLayout(), createWorld, {
  scale: 1,
  previewBounds: [[-370, 20, -250], [230, 110, 340]],
  // A misty midday over the tepuy: pale haze, a soft high sun.
  palette: { skySeed: 44, cloudCover: .55, horizon: 0xd8e2e2, skyTop: 0x3a76d0,
    sunDirection: new THREE.Vector3(...MAP.sun.dir),
    hemiSky: 0xeef4ff, hemiGround: 0x3c4a30, hemiInt: 1.55, sun: 0xfff2dc,
    sunInt: 2.5, ground: 0x3c5a2e, track: 0x56595d, dune: 0, fog: [520, 3600] },
  def: { layered: true, crossfall: undefined },
});
