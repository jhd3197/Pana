// Dominó's own room: the server deals, runs the bots and the turn clock, and
// sends each pana only their own hand (DominoGame.view). Members play by
// their room seat number, as on the old host-run table; the room's host
// starts, configures and arranges.
import crypto from 'node:crypto';
import { PanaRoom, roomState, memberAvatar } from '../../../server/src/room-kit.js';
import { DominoGame } from '../public/rules.js';

const TICK = .1;

export default class DominoRoom extends PanaRoom {
  state = new (roomState({}, undefined, 'DominoRoomState'))();
  onCreate(options) {
    super.onCreate(options);
    this.game = new DominoGame(crypto.randomInt(1, 2 ** 32));
    this.away = new Map();   // a dropped member's seat → their place at the table
    this.pausing = new Set();   // seats with the menu open; the table waits only when all of them are
    this.onMessage('pause', (client, data) => { const seat = this.seatOf(client); if (seat != null) data?.on ? this.pausing.add(seat) : this.pausing.delete(seat); });
    this.onMessage('action', (client, data) => {
      const seat = this.seatOf(client);
      if (seat == null || !data || typeof data !== 'object') return;
      // The room numbers each member's actions; a client's own count is never trusted.
      const accepted = this.game.accept(seat, { ...data, seq: (this.game.ledger[seat] || 0) + 1 }, this.hostSeat());
      this.publish(accepted ? null : client);
    });
    this.clock.setInterval(() => { if (!this.paused() && this.game.tick(TICK)) this.publish(); }, TICK * 1000);
  }
  paused() { const here = this.connectedMembers(); return here.length > 0 && here.every(([, m]) => this.pausing.has(m.seat)); }
  hostSeat() { return this.state.players.get(this.state.host)?.seat ?? null; }
  seatAt(member, place) {
    const p = this.game.players[place];
    if (p && p.id === null) { Object.assign(p, { id: member.seat, name: member.name, avatar: memberAvatar(member) }); this.game.revision++; }
    else this.game.addPlayer(member.seat, member.name, memberAvatar(member));
  }
  // A newcomer never takes a chair kept for a pana who is reconnecting.
  joined(client, member) {
    const held = new Set(this.away.values());
    this.seatAt(member, this.game.players.findIndex((p, i) => p.id === null && !held.has(i)));
    this.publish();
  }
  // A dropped pana's seat plays as a bot until they return to it.
  dropped(client, member) {
    if (!member) return;
    const place = this.game.players.findIndex(p => p.id === member.seat);
    if (place >= 0) { this.away.set(member.seat, place); this.game.removePlayer(member.seat); }
    this.publish();
  }
  returned(client, member) {
    if (!member) return;
    this.seatAt(member, this.away.get(member.seat)); this.away.delete(member.seat);
    this.publish();
  }
  left(client, member) {
    if (member) { this.away.delete(member.seat); this.pausing.delete(member.seat); this.game.removePlayer(member.seat); }
    this.publish();
  }
  // only: one client (a refused action still shows its sender the table as it is).
  publish(only = null) {
    for (const client of only ? [only] : this.clients) {
      const seat = this.seatOf(client);
      if (seat != null) client.send('view', this.game.view(this.game.players.findIndex(p => p.id === seat)));
    }
  }
}
