// A Colyseus room without Colyseus: enough of Room for unit tests of a
// PanaRoom subclass (handlers, clients, broadcasts, timers by hand).
//
//   const t = createTestRoom(PokerRoom, { code: 'abc' });
//   const ana = t.join('ana');  t.send(ana.client, 'start');  t.tick();
export function createTestRoom(RoomClass, options = {}, { name = 'test' } = {}) {
  const room = new RoomClass();
  room.roomName = name;
  room.roomId = `test-${Math.random().toString(36).slice(2, 8)}`;
  const handlers = new Map(), registered = [], broadcasts = [], timers = [];
  room.onMessage = (type, cb) => {
    registered.push(type);
    (handlers.get(type) ?? handlers.set(type, []).get(type)).push(cb);
  };
  room.setMetadata = async () => {};
  room.allowReconnection = async () => {};
  room.broadcast = (type, msg, opts) => broadcasts.push({ type, msg, opts });
  room.clock = { setInterval: (fn, ms) => timers.push({ fn, ms }), setTimeout: (fn, ms) => timers.push({ fn, ms, once: true }) };
  room.clients = [];
  room.onCreate(options);
  return {
    room, broadcasts, registered, timers,
    send(client, type, msg) { for (const cb of handlers.get(type) ?? []) cb(client, msg); },
    join(sessionId, joinOptions = {}) {
      const sent = [];
      const client = { sessionId, send: (type, payload) => sent.push({ type, payload }) };
      room.clients.push(client);
      room.onJoin(client, { name: sessionId, ...joinOptions });
      return { client, sent };
    },
    drop(client) { room.onDrop(client); },
    reconnect(client) { room.onReconnect(client); },
    leave(client) { room.clients = room.clients.filter(c => c !== client); room.onLeave(client); },
    tick(times = 1) { for (let i = 0; i < times; i++) for (const t of timers) t.fn(); },
  };
}
