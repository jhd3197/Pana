import { createLayout } from './chuao-layout.js';
import { createWorld } from './chuao-world.js';
import { coastalTrack } from './coastal-track.js';
export default coastalTrack('chuao', createLayout(), createWorld);
