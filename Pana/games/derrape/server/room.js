// Derrape online: one Colyseus room per invite code (see docs/plans/51).
// Each client simulates the cars it owns (its own, plus the bots if it hosts)
// and the room relays their poses. The room owns what everyone must agree on:
// phase, host, roster, grid, start time and the finish order.

import { schema, t } from '@colyseus/schema';
import { PanaRoom, Member, roomState, avatarJson, MAX_MEMBERS } from '../../../server/src/room-kit.js';
import { randomAvatar } from '../../../engine/avatar.js';
import {
  LAPS, MIN_GRID, COUNTDOWN_MS, LOAD_TIMEOUT_MS, FINISH_GRACE_MS,
  RIVALS, AI_WHEELS, CAR_COUNT, cleanCar, cleanWheel, cleanTrack, validPose,
} from '../public/online-rules.js';
import { CAR_DEFINITIONS } from '../public/car-definitions.js';

const RACE_CAP_MS = 20 * 60 * 1000;   // a race nobody finishes still ends

const Player = Member.extend({
  car: t.uint8(),
  wheel: t.string(),
  racing: t.boolean().default(false),   // on the grid of the current race
  loaded: t.boolean().default(false),
}, 'Player');

const Racer = schema({
  kind: t.string(),        // 'human' | 'bot'
  owner: t.string(),       // sessionId that simulates this car
  name: t.string(),
  avatar: t.string(),
  car: t.uint8(),
  wheel: t.string(),
  slot: t.uint8(),
  lap: t.int8(),
  done: t.boolean().default(false),
  time: t.number().default(0),
  place: t.uint8().default(0),
  dnf: t.boolean().default(false),
  retired: t.boolean().default(false),
}, 'Racer');

const DerrapeState = roomState({
  phase: t.string().default('lobby'),   // lobby | loading | count | race | results
  track: t.string().default('estadio'),
  bots: t.boolean().default(true),
  laps: t.uint8().default(LAPS),
  raceId: t.uint16().default(0),
  startAt: t.number().default(0),       // server epoch ms for "¡YA!"
  racers: t.map(Racer),
}, Player, 'DerrapeState');

const shuffle = (list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Members, host (and the party lead), reconnection and listings come from
// PanaRoom (server/src/room-kit.js); this room only runs the race.
export default class DerrapeRoom extends PanaRoom {
  memberClass = Player;
  state = new DerrapeState();

  onCreate(options) {
    super.onCreate(options);
    this.poses = new Map();    // racer id -> last pose
    this.firstFinish = 0;
    this.loadDeadline = 0;
    this.raceStarted = 0;
    this.state.track = cleanTrack(options.track);

    this.onMessage('pick', (client, m) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !m) return;
      p.car = cleanCar(m.car);
      p.wheel = cleanWheel(m.wheel);
    });
    this.onMessage('track', (client, m) => {
      if (this.isHost(client) && this.inLobby()) this.state.track = cleanTrack(m?.id);
    });
    this.onMessage('bots', (client, m) => {
      if (this.isHost(client) && this.inLobby()) this.state.bots = !!m?.on;
    });
    this.onMessage('start', (client) => { if (this.isHost(client) && this.inLobby()) this.startRace(); });
    this.onMessage('lobby', (client) => { if (this.isHost(client) && this.state.phase === 'results') this.toLobby(); });
    this.onMessage('loaded', (client, m) => {
      const p = this.state.players.get(client.sessionId);
      if (p && p.racing && m?.raceId === this.state.raceId) p.loaded = true;
    });
    this.onMessage('ping', (client, m) => client.send('pong', { c: m?.c, s: Date.now() }));

    // 20 Hz poses, [id, serverTimeEstimate, ...pose]: relayed at once (not
    // through state patches, to save latency).
    this.onMessage('p', (client, list) => {
      if (!Array.isArray(list) || !['count', 'race'].includes(this.state.phase)) return;
      const out = [];
      for (const entry of list.slice(0, MAX_MEMBERS)) {
        if (!Array.isArray(entry)) continue;
        const [id, stamp, ...pose] = entry;
        const r = this.state.racers.get(id);
        if (!r || r.owner !== client.sessionId || r.retired || !Number.isFinite(stamp) || !validPose(pose)) continue;
        this.poses.set(id, pose);
        if (r.lap !== pose[11]) r.lap = Math.max(-1, Math.min(LAPS + 1, pose[11] | 0));
        out.push(entry);
      }
      if (out.length) this.broadcast('p', out, { except: client });
    });
    // Throws, peels, hits, slips, honks and speech for the cars a client owns.
    this.onMessage('fx', (client, m) => {
      const r = m && this.state.racers.get(m.id);
      if (!r || r.owner !== client.sessionId || typeof m.k !== 'string' || m.k.length > 8) return;
      if (JSON.stringify(m.d ?? {}).length > 512) return;
      this.broadcast('fx', { id: m.id, k: m.k, d: m.d ?? {} }, { except: client });
    });
    this.onMessage('finish', (client, m) => {
      const r = m && this.state.racers.get(m.id);
      if (!r || r.owner !== client.sessionId || r.done || this.state.phase !== 'race') return;
      const time = Number(m.time);
      if (!Number.isFinite(time) || time <= 0 || time > RACE_CAP_MS / 1000) return;
      r.done = true;
      r.time = time;
      r.lap = LAPS + 1;
      if (!this.firstFinish && r.kind === 'human') this.firstFinish = Date.now();
    });
    // Leaving a race for the garage: the car goes, the player stays in the room.
    this.onMessage('retire', (client) => {
      const r = this.state.racers.get(client.sessionId);
      if (r && !r.done && ['loading', 'count', 'race'].includes(this.state.phase)) r.retired = true;
      const p = this.state.players.get(client.sessionId);
      if (p) p.racing = false;
    });

    this.clock.setInterval(() => this.tick(), 250);
  }

  createMember(client, options) {
    const p = super.createMember(client, options);
    p.car = cleanCar(options.car);
    p.wheel = cleanWheel(options.wheel);
    return p;
  }

  joined(client) { this.sendPoses(client); }
  returned(client) { this.sendPoses(client); }

  left(client) {
    const r = this.state.racers.get(client.sessionId);
    if (r && !r.done) r.retired = true;
  }

  // The host also drives the bots.
  hostChanged(id) {
    if (!id) return;
    for (const r of this.state.racers.values()) if (r.kind === 'bot') r.owner = id;
  }

  inLobby() { return this.state.phase === 'lobby' || this.state.phase === 'results'; }

  sendPoses(client) {
    client.send('poses', Object.fromEntries(this.poses));
  }

  startRace() {
    const humans = [...this.state.players.entries()].filter(([, p]) => p.connected)
      .sort((a, b) => a[1].joinedAt - b[1].joinedAt);
    if (!humans.length) return;
    this.state.racers.clear();
    this.poses.clear();
    this.firstFinish = 0;
    const total = Math.min(MAX_MEMBERS, this.state.bots ? Math.max(MIN_GRID, humans.length) : humans.length);
    const slots = shuffle([...Array(total).keys()]);
    for (const [id, p] of humans) {
      p.racing = true;
      p.loaded = false;
      this.state.racers.set(id, new Racer({
        kind: 'human', owner: id, name: p.name, avatar: p.avatar, car: p.car, wheel: p.wheel, slot: slots.pop(), lap: 0,
      }));
    }
    for (const p of this.state.players.values()) if (!p.connected) p.racing = false;
    const taken = new Set(humans.map(([, p]) => p.car));
    const cars = [...shuffle([...Array(CAR_COUNT).keys()].filter(i => !taken.has(i))), ...shuffle([...Array(CAR_COUNT).keys()])];
    const names = shuffle(RIVALS);
    for (let i = 0; this.state.racers.size < total; i++) {
      const car = cars[i % cars.length];
      this.state.racers.set(`bot-${i + 1}`, new Racer({
        kind: 'bot', owner: this.state.host, name: names[i % names.length], avatar: avatarJson(randomAvatar()),
        car, wheel: AI_WHEELS[CAR_DEFINITIONS[car].id] || 'calle', slot: slots.pop(), lap: 0,
      }));
    }
    this.state.startAt = 0;
    this.state.raceId = (this.state.raceId + 1) % 65535;
    this.state.phase = 'loading';
    this.loadDeadline = Date.now() + LOAD_TIMEOUT_MS;
  }

  toLobby() {
    this.state.phase = 'lobby';
    this.state.startAt = 0;
    this.state.racers.clear();
    this.poses.clear();
    for (const p of this.state.players.values()) { p.racing = false; p.loaded = false; }
  }

  // Finished cars by time, then everyone else by how far they got.
  rank() {
    const progress = (id, r) => r.lap * 1e6 + (this.poses.get(id)?.[12] ?? 0);
    const list = [...this.state.racers.entries()].filter(([, r]) => !r.retired).sort(([ia, a], [ib, b]) =>
      a.done && b.done ? a.time - b.time : a.done !== b.done ? (a.done ? -1 : 1) : progress(ib, b) - progress(ia, a));
    list.forEach(([, r], i) => { r.place = i + 1; if (!r.done) r.dnf = true; });
  }

  tick() {
    const now = Date.now(), s = this.state;
    const racing = [...s.players.values()].filter(p => p.racing);
    if (s.phase === 'loading') {
      if (!racing.length) return this.toLobby();
      if (racing.every(p => p.loaded || !p.connected) || now > this.loadDeadline) {
        s.startAt = now + COUNTDOWN_MS;
        s.phase = 'count';
      }
    } else if (s.phase === 'count') {
      if (now >= s.startAt) { s.phase = 'race'; this.raceStarted = now; }
    } else if (s.phase === 'race') {
      const humans = [...s.racers.values()].filter(r => r.kind === 'human' && !r.retired);
      if (!humans.length || humans.every(r => r.done)
        || (this.firstFinish && now > this.firstFinish + FINISH_GRACE_MS)
        || now > this.raceStarted + RACE_CAP_MS) {
        this.rank();
        s.phase = 'results';
      }
    }
  }
}
