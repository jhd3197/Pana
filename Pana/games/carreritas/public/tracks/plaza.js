import { withSightlines } from './authored-sightlines.js';
import { TRACK_DEFINITIONS } from '../track-definitions.js';
// A street race through a complete town, from the historic plaza to the hill.
import { ROUTE, townHeight } from './plaza-layout.js';
import { createTown, raceEdges } from './plaza-town.js';

export default withSightlines({
  ...TRACK_DEFINITIONS.find(track => track.id === 'plaza'),
  points: ROUTE, rounded: true, hw: 9, lineU: 0.075,
  elevation: townHeight,
  previewBounds: [[-355, 0, -355], [720, 80, 490]],
  sectors: [[0, 'Casco histórico'], [0.2, 'Camino del lago'], [0.35, 'Puente de los panas'],
    [0.51, 'Casas Botes'], [0.7, 'Subida del mirador'], [0.88, 'La alameda']],
  hazards:[{kind:'bus',u:.2},{kind:'bus',u:.53,phase:5}],
  items: { boxes: [0.12, 0.31, 0.52, 0.73, 0.91], boxLanes: [-6, -2, 2, 6],
    pads: [{ u: 0.23, off: -4 }, { u: 0.46, off: 4 }, { u: 0.68, off: 0 }, { u: 0.87, off: -4 }] },
  walls: false,
  palette: { horizon: 0xc8f1ea, skyTop: 0x168cee, halo: 1, skySeed: 7, cloudCover: .34, hemiSky: 0xd3e5ff, hemiGround: 0xb39a62, hemiInt: 1.6,
    sun: 0xffd89c, sunInt: 2.7, ground: 0x8cc25a, track: 0x857a80, dune: 0, fog: [210, 980] },
  environment: createTown,
  scenery: raceEdges,
});
