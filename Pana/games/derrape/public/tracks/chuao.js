import { createLayout } from './chuao-layout.js';
import { createWorld } from './chuao-world.js';
import { coastalTrack } from './coastal-track.js';

const layout = createLayout();

// The quebrada (segments f entrada, s quebrada, e salida) is already water:
// cars run it as lanchas (transform-gates.js) without a second water sheet.
function quebrada({ SEG, NR }) {
  const wet = i => ['f', 's', 'e'].includes(SEG[i]);
  const first = SEG.findIndex((_, i) => wet(i) && !wet((i + NR - 1) % NR));
  let last = first;
  while (wet((last + 1) % NR) && last - first < NR) last++;
  return { from: first / NR, to: (last + 1) / NR, sheet: false };
}

export default { ...coastalTrack('chuao', layout, createWorld), transformGates: [quebrada(layout)] };
