import { createLayout, MAP } from './chuao-layout.js';
import { createWorld } from './chuao-world.js';
import { coastalTrack } from './coastal-track.js';

const layout = createLayout();

// The quebrada is already water: cars run it as lanchas (transform-gates.js)
// without a second water sheet. The change happens under the falls — where
// the road passes closest to the curtain — and lasts to the end of the wet
// segments (f entrada, s quebrada, e salida).
function quebrada({ SEG, NR }) {
  const wet = i => ['f', 's', 'e'].includes(SEG[i]);
  const first = SEG.findIndex((_, i) => wet(i) && !wet((i + NR - 1) % NR));
  let last = first;
  while (wet((last + 1) % NR) && last - first < NR) last++;
  return { fromAt: [MAP.fall.x, MAP.fall.z], lead: 2, to: (last + 1) / NR, sheet: false };
}

export default { ...coastalTrack('chuao', layout, createWorld), transformGates: [quebrada(layout)] };
