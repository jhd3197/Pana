import test from 'node:test';
import assert from 'node:assert/strict';
import CarreritasRoom from '../server/room.js';
import { GP_PROTOCOL, GP_MIN_READ_MS, GP_LOAD_TIMEOUT_MS, packPose } from '../public/online-rules.js';
import { standings } from '../public/cup-rules.js';

function createTestRoom(options = {}) {
  const room = new CarreritasRoom();
  room.roomName = 'carreritas';
  room.roomId = `test-${Math.random().toString(36).slice(2, 8)}`;
  const handlers = new Map();
  const broadcasts = [];
  room.onMessage = (type, cb) => handlers.set(type, cb);
  room.setMetadata = async () => {};
  room.allowReconnection = async () => {};
  room.broadcast = (type, msg, opts) => broadcasts.push({ type, msg, opts });
  room.clock = { setInterval: () => {} };
  room.onCreate(options);
  return {
    room,
    broadcasts,
    send(client, type, msg) {
      const handler = handlers.get(type);
      if (handler) handler(client, msg);
    },
    join(sessionId, joinOpts = {}) {
      const sent = [];
      const client = {
        sessionId,
        send: (type, payload) => sent.push({ type, payload }),
      };
      room.onJoin(client, { protocol: GP_PROTOCOL, name: sessionId, ...joinOpts });
      return { client, sent };
    },
  };
}

function validPosePacket(id, lap = 1, prog = 45) {
  const pose = packPose({
    x: 5, y: 0, z: -3, h: 0.2, pitch: 0, roll: 0, vf: 18, steer: 0, spin: 0, boost: 0,
    onGround: true, dizzy: 0, inventory: [], done: false, lap, prog, lost: 0, coins: 2,
  });
  return [id, Date.now(), ...pose];
}

test('host-only cup and difficulty selection, protocol capability check, and stage-specific laps', () => {
  const { room, send, join } = createTestRoom();
  const { client: host } = join('host-1', { name: 'Ana', car: 1, wheel: 'pista' });
  const { client: guest } = join('guest-2', { name: 'Beto', car: 2, wheel: 'monte' });

  assert.equal(room.state.host, 'host-1');
  assert.equal(room.state.mode, 'race');
  assert.equal(room.state.difficulty, 'normal');

  // Guest cannot change mode or difficulty
  send(guest, 'mode', { mode: 'aventura' });
  send(guest, 'difficulty', { id: 'dificil' });
  assert.equal(room.state.mode, 'race');
  assert.equal(room.state.difficulty, 'normal');

  // Host selects Copa Aventura (via legacy alias 'arepa' or canonical 'aventura') + dificil difficulty
  send(host, 'mode', { mode: 'arepa' });
  send(host, 'difficulty', { id: 'dificil' });
  assert.equal(room.state.mode, 'aventura');
  assert.equal(room.state.difficulty, 'dificil');
  assert.equal(room.state.track, 'desierto');
  assert.equal(room.state.laps, 2);

  // Track message is ignored while a cup mode is selected
  send(host, 'track', { id: 'estadio' });
  assert.equal(room.state.track, 'desierto');

  // If a legacy client (protocol 1) joins, starting a cup sets a notice instead of launching
  const { client: legacy } = join('legacy-3', { protocol: 1, name: 'Viejo' });
  send(host, 'start');
  assert.equal(room.state.phase, 'lobby');
  assert.ok(room.state.notice.includes('versión anterior'));

  // Once legacy leaves, host can start the cup
  room.onLeave(legacy);
  send(host, 'start');
  assert.equal(room.state.phase, 'loading');
  assert.ok(room.cupSession);
  assert.equal(room.cupSession.cupId, 'aventura');
  assert.equal(room.cupSession.entrants.length, 8);
});

test('persistent 8-entrant roster, stage lap targets, stale packet rejection, and full 4-stage lifecycle', () => {
  const { room, send, join, broadcasts } = createTestRoom({ mode: 'aventura', difficulty: 'facil' });
  const { client: host } = join('host-1', { name: 'Ana', car: 0, wheel: 'calle' });
  const { client: guest } = join('guest-2', { name: 'Beto', car: 3, wheel: 'pista' });

  send(host, 'start');
  assert.equal(room.state.phase, 'loading');
  const initialEntrants = room.cupSession.entrants.map(e => ({ id: e.id, skillSeed: e.skillSeed, car: e.loadout.car }));
  assert.equal(initialEntrants.length, 8);

  const expectedTracks = ['desierto', 'chichi', 'selva', 'paramo'];
  const expectedLaps = [2, 1, 2, 2];

  for (let stage = 0; stage < 4; stage++) {
    assert.equal(room.cupSession.stageIndex, stage);
    assert.equal(room.state.track, expectedTracks[stage]);
    assert.equal(room.state.laps, expectedLaps[stage]);

    const ctx = {
      raceId: room.state.raceId,
      sessionId: room.cupSession.sessionId,
      stage,
      attempt: room.cupSession.attempts[stage],
    };

    // Stale loaded packet from wrong stage or raceId is ignored
    send(host, 'loaded', { ...ctx, raceId: ctx.raceId + 99 });
    send(host, 'loaded', { ...ctx, stage: stage + 1 });
    assert.equal(room.state.players.get('host-1').loaded, false);

    // Valid loaded packets advance loading -> count -> race
    send(host, 'loaded', ctx);
    send(guest, 'loaded', ctx);
    room.tick();
    assert.equal(room.state.phase, 'count');
    room.state.startAt = Date.now() - 10;
    room.tick();
    assert.equal(room.state.phase, 'race');

    // Pose clamping respects stage-specific lap count (e.g. Chichi = 1 lap -> maxLap = 2)
    send(host, 'p', { ...ctx, list: [validPosePacket('host-1', 9, 120)] });
    assert.equal(room.state.racers.get('host-1').lap, expectedLaps[stage] + 1);

    // Stale pose packet with wrong attempt is ignored
    const prevBroadcastCount = broadcasts.length;
    send(host, 'p', { ...ctx, attempt: ctx.attempt + 1, list: [validPosePacket('host-1', 1, 50)] });
    assert.equal(broadcasts.length, prevBroadcastCount);

    // Stale finish packet (wrong stage / attempt / raceId) is rejected
    send(host, 'finish', { ...ctx, stage: stage + 1, id: 'host-1', time: 42.5 });
    assert.equal(room.state.racers.get('host-1').done, false);

    // First valid finish is accepted; duplicate finish with faster time is ignored
    send(host, 'finish', { ...ctx, id: 'host-1', time: 45.2 });
    send(host, 'finish', { ...ctx, id: 'host-1', time: 12.1 });
    assert.equal(room.state.racers.get('host-1').done, true);
    assert.equal(room.state.racers.get('host-1').time, 45.2);
    assert.equal(room.state.racers.get('host-1').lap, expectedLaps[stage] + 1);

    // Guest finishes second; host also reports one bot finish
    send(guest, 'finish', { ...ctx, id: 'guest-2', time: 47.8 });
    send(host, 'finish', { ...ctx, id: 'bot-1', time: 49.0 });

    // Tick finalizes stage since all humans are done
    room.tick();
    if (stage < 3) {
      assert.equal(room.state.phase, 'results');
      assert.equal(room.cupSession.status, 'intermission');

      // Early next before GP_MIN_READ_MS is ignored
      send(host, 'next', ctx);
      assert.equal(room.cupSession.stageIndex, stage);

      // After GP_MIN_READ_MS, host can advance; duplicate next for same stage is ignored
      room.resultsAt = Date.now() - (GP_MIN_READ_MS + 50);
      send(host, 'next', ctx);
      assert.equal(room.cupSession.stageIndex, stage + 1);
      assert.equal(room.state.phase, 'loading');
      send(host, 'next', ctx);
      assert.equal(room.cupSession.stageIndex, stage + 1);
    } else {
      assert.equal(room.state.phase, 'complete');
      assert.equal(room.cupSession.status, 'complete');
    }
  }

  // Roster identity and bot skillSeeds remained identical across all 4 stages
  assert.deepEqual(
    room.cupSession.entrants.map(e => ({ id: e.id, skillSeed: e.skillSeed, car: e.loadout.car })),
    initialEntrants,
  );
  assert.equal(room.cupSession.ledger.length, 32);
  const rows = standings(room.cupSession);
  assert.equal(rows[0].id, 'host-1');
  assert.equal(rows[0].points, 60);
});

test('loading timeout marks unready human as DNS while ready humans race, and all-DNS aborts to lobby', () => {
  const { room, send, join } = createTestRoom({ mode: 'pana' });
  const { client: host } = join('host-1', { name: 'Ana' });
  join('guest-2', { name: 'Beto' });

  send(host, 'start');
  assert.equal(room.state.phase, 'loading');

  // Only host loads; guest times out
  send(host, 'loaded', {
    raceId: room.state.raceId,
    sessionId: room.cupSession.sessionId,
    stage: 0,
    attempt: 1,
  });
  room.loadDeadline = Date.now() - (GP_LOAD_TIMEOUT_MS + 10);
  room.tick();

  assert.equal(room.state.phase, 'count');
  assert.equal(room.state.racers.get('guest-2').dns, true);
  assert.equal(room.state.players.get('guest-2').racing, false);

  // If nobody loads before the deadline on a fresh cup, room aborts cleanly to lobby
  const { room: room2, send: send2, join: join2 } = createTestRoom({ mode: 'pana' });
  const { client: host2 } = join2('host-a', { name: 'Sol' });
  send2(host2, 'start');
  room2.loadDeadline = Date.now() - 10;
  room2.tick();
  assert.equal(room2.state.phase, 'lobby');
  assert.equal(room2.cupSession, null);
  assert.ok(room2.state.notice.includes('Ningún pana'));
});

test('host handoff transfers bot ownership without resetting skillSeed or scores', () => {
  const { room, send, join } = createTestRoom({ mode: 'pana' });
  const { client: host } = join('host-1', { name: 'Ana' });
  const { client: guest } = join('guest-2', { name: 'Beto' });

  send(host, 'start');
  const seedsBefore = room.cupSession.entrants.filter(e => e.kind === 'bot').map(e => e.skillSeed);

  // Host drops mid-loading; guest becomes host and takes ownership of all bots
  room.onDrop(host);
  assert.equal(room.state.host, 'guest-2');
  for (const r of room.state.racers.values()) {
    if (r.kind === 'bot') assert.equal(r.owner, 'guest-2');
  }
  const botsAfter = room.cupSession.entrants.filter(e => e.kind === 'bot');
  assert.ok(botsAfter.every(e => e.owner === 'guest-2'));
  assert.deepEqual(botsAfter.map(e => e.skillSeed), seedsBefore);

  // Guest can now report bot finishes once racing
  const ctx = {
    raceId: room.state.raceId,
    sessionId: room.cupSession.sessionId,
    stage: 0,
    attempt: 1,
  };
  send(guest, 'loaded', ctx);
  room.tick();
  room.state.startAt = Date.now() - 10;
  room.tick();
  assert.equal(room.state.phase, 'race');

  send(guest, 'finish', { ...ctx, id: 'bot-1', time: 51.4 });
  assert.equal(room.state.racers.get('bot-1').done, true);
});

test('GP rejects missing context, legacy poses, foreign ownership and stale effects', () => {
  const { room, send, join, broadcasts } = createTestRoom({ mode: 'pana' });
  const { client: host } = join('host'), { client: guest } = join('guest');
  send(host, 'start');
  const ctx = room.currentContext();
  for (const packet of [undefined, {}, { raceId: ctx.raceId }, { ...ctx, sessionId: 'old' }]) {
    send(host, 'loaded', packet);
    assert.equal(room.state.players.get('host').loaded, false);
    send(host, 'retire', packet);
    assert.deepEqual(room.cupSession.absent, []);
  }
  send(host, 'loaded', ctx); send(guest, 'loaded', ctx); room.tick();
  room.state.startAt = Date.now() - 10; room.tick();
  const before = broadcasts.length;
  send(host, 'p', [validPosePacket('host')]);
  send(host, 'p', { ...ctx, list: [validPosePacket('guest')] });
  send(host, 'fx', { id: 'host', k: 'throw', d: {} });
  send(host, 'fx', { ...ctx, stage: 3, id: 'host', k: 'throw', d: {} });
  send(host, 'finish', { id: 'host', time: 40 });
  assert.equal(broadcasts.length, before);
  assert.equal(room.state.racers.get('host').done, false);
});

test('departures preserve accepted finishes and prior points, later stages are DNS', () => {
  const { room, send, join } = createTestRoom({ mode: 'pana' });
  const { client: host } = join('host'), { client: guest } = join('guest');
  send(host, 'start');
  const ctx = room.currentContext();
  send(host, 'loaded', ctx); send(guest, 'loaded', ctx); room.tick();
  room.state.startAt = Date.now() - 10; room.tick();
  send(host, 'finish', { ...ctx, id: 'host', time: 50 });
  room.onDrop(host); room.onLeave(host);
  send(guest, 'finish', { ...ctx, id: 'guest', time: 55 }); room.tick();
  assert.equal(room.cupSession.ledger.find(r => r.id === 'host').classification, 'finished');
  const points = standings(room.cupSession).find(r => r.id === 'host').points;
  room.resultsAt = Date.now() - GP_MIN_READ_MS - 1;
  send(guest, 'next', ctx);
  assert.equal(room.state.racers.get('host').dns, true);
  const ctx2 = room.currentContext();
  send(guest, 'loaded', ctx2); room.tick(); room.state.startAt = Date.now() - 10; room.tick();
  send(guest, 'finish', { ...ctx2, id: 'guest', time: 70 }); room.tick();
  assert.equal(standings(room.cupSession).find(r => r.id === 'host').points, points);
  assert.equal(room.cupSession.ledger.find(r => r.id === 'host' && r.stage === 1).classification, 'dns');
});

test('late spectators stay outside locked roster and a new cup resets all race state', () => {
  const { room, send, join } = createTestRoom({ mode: 'pana' });
  const { client: host } = join('host'); send(host, 'start');
  const sessionId = room.cupSession.sessionId;
  const { client: spectator } = join('spectator');
  assert.equal(room.state.players.get('spectator').racing, false);
  assert.ok(!room.cupSession.entrants.some(e => e.id === spectator.sessionId));
  send(spectator, 'loaded', room.currentContext());
  assert.equal(room.state.players.get('spectator').loaded, false);
  room.toLobby();
  assert.equal(room.poses.size, 0); assert.equal(room.state.racers.size, 0);
  send(host, 'mode', { mode: 'aventura' }); send(host, 'start');
  assert.notEqual(room.cupSession.sessionId, sessionId);
  assert.ok(room.cupSession.entrants.some(e => e.id === 'spectator'));
  assert.equal(room.cupSession.ledger.length, 0);
  assert.equal(room.state.track, 'desierto');
});

test('appearance is validated, frozen for all stages and shared with every client', () => {
  const {room,send,join}=createTestRoom({mode:'agua'});
  const {client:host}=join('host',{cosmetics:{paint:'caribe',horn:'fiesta',flame:'hielo'}});
  join('guest',{cosmetics:{paint:'foreign',horn:7,flame:'foreign'}});send(host,'start');
  const saved=room.cupSession.entrants.find(e=>e.id==='host').loadout;
  assert.deepEqual([saved.paint,saved.horn,saved.flame],['caribe','fiesta','hielo']);
  send(host,'pick',{car:7,wheel:'barro',cosmetics:{paint:'pasion'}});
  assert.equal(room.cupSession.entrants.find(e=>e.id==='host').loadout,saved);
  assert.deepEqual(JSON.parse(room.state.racers.get('host').cosmetics),{paint:'caribe',horn:'fiesta',flame:'hielo'});
  assert.equal(room.cupSession.entrants.find(e=>e.id==='guest').loadout.paint,'fabrica');
});
