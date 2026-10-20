import { createLayout } from './choroni-layout.js';
import { createWorld } from './choroni-world.js';
import { coastalTrack } from './coastal-track.js';
export default coastalTrack('choroni', createLayout(), createWorld);
