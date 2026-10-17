import RelayRoom from '../../../server/src/relay-room.js';

// The board and every minigame have exactly four spots. The shared room kit
// rejects a fifth visitor instead of creating another room with the same code.
export default class BululuRoom extends RelayRoom {
  maxClients = 4;
}
