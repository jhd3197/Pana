import { createLayout } from './cata-layout.js';
import { createWorld } from './cata-world.js';
import { coastalTrack } from './coastal-track.js';
export default coastalTrack('cata', createLayout(), createWorld);
