// The room every game gets unless it ships games/<game>/server/room.js. One member (the room's host) simulates; the
// room relays `relay` messages, tagged with the sender's seat. engine/net.js HostRoom is its browser side.
//
// A message's `dest` says who gets it: 'host' (inputs, actions: only the host
// reads them), a seat number (one member's notice or catch-up), or nothing
// for everyone else in the room.

import { PanaRoom, roomState } from './room-kit.js';

const RelayState = roomState({}, undefined, 'RelayState');

export default class RelayRoom extends PanaRoom {
  state = new RelayState();

  onCreate(options) {
    super.onCreate(options);
    this.onMessage('relay', (client, v) => {
      const member = this.state.players.get(client.sessionId);
      if (!member || !v || typeof v !== 'object') return;
      const message = { id: member.seat, v };
      if (v.dest == null) { this.broadcast('relay', message, { except: client }); return; }
      const to = v.dest === 'host' ? this.state.host : this.memberBySeat(v.dest)[0];
      if (!to || to === client.sessionId) return;
      this.clients.find(c => c.sessionId === to)?.send('relay', message);
    });
  }
}
