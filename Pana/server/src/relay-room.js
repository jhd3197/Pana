// The room every game gets unless it ships games/<game>/server/room.js: the
// /ws relay's model on Colyseus. One member (the room's host) simulates; the
// room relays `relay` messages to everyone else, tagged with the sender's
// seat. engine/net.js HostRoom is its browser side.

import { PanaRoom, roomState } from './room-kit.js';

const RelayState = roomState({}, undefined, 'RelayState');

export default class RelayRoom extends PanaRoom {
  state = new RelayState();

  onCreate(options) {
    super.onCreate(options);
    this.onMessage('relay', (client, v) => {
      const member = this.state.players.get(client.sessionId);
      if (member && v && typeof v === 'object') this.broadcast('relay', { id: member.seat, v }, { except: client });
    });
  }
}
