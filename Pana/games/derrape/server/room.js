// Derrape online: one Colyseus room per invite code (see docs/plans/51, 56).
// Each client simulates the cars it owns (its own, plus the bots if it hosts)
// and the room relays their poses. The room owns what everyone must agree on:
// phase, host, roster, grid, start time, finish order and Grand Prix cup state.

import { schema, t } from '@colyseus/schema';
import { randomUUID } from 'node:crypto';
import { PanaRoom, Member, roomState, avatarJson, MAX_MEMBERS } from '../../../server/src/room-kit.js';
import { randomAvatar } from '../../../engine/avatar.js';
import {
  LAPS, MIN_GRID, GP_GRID, COUNTDOWN_MS, LOAD_TIMEOUT_MS, GP_LOAD_TIMEOUT_MS,
  FINISH_GRACE_MS, GP_INTERMISSION_MS, GP_MIN_READ_MS, GP_PROTOCOL,
  RIVALS, AI_WHEELS, CAR_COUNT, cleanCar, cleanWheel, cleanTrack, cleanDifficulty, cleanCosmetics, validPose,
} from '../public/online-rules.js';
import { CAR_DEFINITIONS } from '../public/car-definitions.js';
import { CUPS, canonicalCupId, cupById } from '../public/cup-definitions.js';
import {
  abandonCup, acceptFinish, advanceStage, beginStage, createCupSession,
  finalizeStage, markRacing, markStarted, retireEntrant, retryStage, seededOrder,
} from '../public/cup-rules.js';

const RACE_CAP_MS = 20 * 60 * 1000;   // a race nobody finishes still ends
const isAvailableCup = (mode) => CUPS.some(c => c.id === canonicalCupId(mode));
const cleanMode = (mode) => isAvailableCup(mode) ? canonicalCupId(mode) : 'race';

const Player = Member.extend({
  cosmetics: t.string().default('{}'),
  car: t.uint8(),
  wheel: t.string(),
  protocol: t.uint8().default(1),
  racing: t.boolean().default(false),   // on the grid of the current race
  loaded: t.boolean().default(false),
}, 'Player');

const Racer = schema({
  cosmetics: t.string().default('{}'),
  kind: t.string(),        // 'human' | 'bot'
  owner: t.string(),       // sessionId that simulates this car
  name: t.string(),
  avatar: t.string(),
  car: t.uint8(),
  wheel: t.string(),
  slot: t.uint8(),
  skillSeed: t.string().default(''),
  lap: t.int8(),
  done: t.boolean().default(false),
  time: t.number().default(0),
  place: t.uint8().default(0),
  dnf: t.boolean().default(false),
  dns: t.boolean().default(false),
  retired: t.boolean().default(false),
}, 'Racer');

const DerrapeState = roomState({
  phase: t.string().default('lobby'),   // lobby | loading | count | race | results | complete
  mode: t.string().default('race'),     // 'race' | canonical cup id
  difficulty: t.string().default('normal'),
  track: t.string().default('estadio'),
  bots: t.boolean().default(true),
  laps: t.uint8().default(LAPS),
  raceId: t.uint16().default(0),
  startAt: t.number().default(0),       // server epoch ms for "¡YA!"
  intermissionEndsAt: t.number().default(0),
  notice: t.string().default(''),
  cupJson: t.string().default(''),
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

  onCreate(options = {}) {
    super.onCreate(options);
    this.poses = new Map();    // racer id -> last pose
    this.firstFinish = 0;
    this.loadDeadline = 0;
    this.raceStarted = 0;
    this.resultsAt = 0;
    this.cupSession = null;
    this.cupDef = null;
    this.state.track = cleanTrack(options.track);
    this.state.mode = cleanMode(options.mode);
    this.state.difficulty = cleanDifficulty(options.difficulty);
    if (isAvailableCup(this.state.mode)) {
      const cup = cupById(this.state.mode);
      this.state.track = cup.stages[0].track;
      this.state.laps = cup.stages[0].laps;
    }

    this.onMessage('pick', (client, m) => {
      if (!this.canConfigure()) return;
      const p = this.state.players.get(client.sessionId);
      if (!p || !m) return;
      p.car = cleanCar(m.car);
      p.wheel = cleanWheel(m.wheel);
      p.cosmetics = JSON.stringify(cleanCosmetics(m.cosmetics));
    });
    this.onMessage('track', (client, m) => {
      if (this.isHost(client) && this.canConfigure() && !isAvailableCup(this.state.mode)) {
        this.state.track = cleanTrack(m?.id);
      }
    });
    this.onMessage('bots', (client, m) => {
      if (this.isHost(client) && this.canConfigure()) this.state.bots = !!m?.on;
    });
    this.onMessage('mode', (client, m) => {
      if (!this.isHost(client) || !this.canConfigure() || !this.supportsGp(client, m?.mode)) return;
      this.state.mode = cleanMode(m?.mode);
      if (isAvailableCup(this.state.mode)) {
        const cup = cupById(this.state.mode);
        this.state.track = cup.stages[0].track;
        this.state.laps = cup.stages[0].laps;
      } else {
        this.state.laps = LAPS;
      }
    });
    this.onMessage('difficulty', (client, m) => {
      if (this.isHost(client) && this.canConfigure()) this.state.difficulty = cleanDifficulty(m?.id);
    });
    this.onMessage('start', (client) => {
      if (!this.isHost(client)) return;
      if (isAvailableCup(this.state.mode) && !this.allHumansSupportGp()) {
        this.state.notice = 'Un pana tiene una versión anterior y no puede entrar al Gran Premio.';
        return;
      }
      if (this.state.phase === 'lobby' || (this.state.phase === 'results' && !this.cupSession) || this.state.phase === 'complete') {
        this.startRace();
      } else if (this.state.phase === 'results' && this.cupSession?.status === 'intermission') {
        if (Date.now() - this.resultsAt >= GP_MIN_READ_MS) this.advanceCupStage();
      }
    });
    this.onMessage('next', (client, m) => {
      if (!this.isHost(client) || !this.cupSession || this.state.phase !== 'results' || this.cupSession.status !== 'intermission') return;
      if (!this.matchesContext(m)) return;
      if (Date.now() - this.resultsAt >= GP_MIN_READ_MS) this.advanceCupStage();
    });
    this.onMessage('lobby', (client) => {
      if (this.isHost(client) && (this.state.phase === 'results' || this.state.phase === 'complete')) this.toLobby();
    });
    this.onMessage('loaded', (client, m) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !p.racing || !this.matchesContext(m)) return;
      p.loaded = true;
      this.sendPoses(client);
    });
    this.onMessage('ping', (client, m) => client.send('pong', { c: m?.c, s: Date.now() }));

    // 20 Hz poses, [id, serverTimeEstimate, ...pose]: relayed at once (not
    // through state patches, to save latency).
    this.onMessage('p', (client, payload) => {
      if (!['count', 'race'].includes(this.state.phase)) return;
      const list = Array.isArray(payload) ? payload : Array.isArray(payload?.list) ? payload.list : null;
      if (!list) return;
      if (this.cupSession && Array.isArray(payload)) return;
      if (!Array.isArray(payload) && !this.matchesContext(payload)) return;
      const out = [];
      const maxLap = (this.state.laps || LAPS) + 1;
      for (const entry of list.slice(0, MAX_MEMBERS)) {
        if (!Array.isArray(entry)) continue;
        const [id, stamp, ...pose] = entry;
        const r = this.state.racers.get(id);
        if (!r || r.owner !== client.sessionId || r.retired || r.dns || !Number.isFinite(stamp) || !validPose(pose)) continue;
        this.poses.set(id, pose);
        if (r.lap !== pose[11]) r.lap = Math.max(-1, Math.min(maxLap, pose[11] | 0));
        out.push(entry);
      }
      if (out.length) this.broadcast('p', this.cupSession ? { ...this.currentContext(), list: out } : out, { except: client });
    });
    // Throws, peels, hits, slips, honks and speech for the cars a client owns.
    this.onMessage('fx', (client, m) => {
      const r = m && this.state.racers.get(m.id);
      if (!r || r.owner !== client.sessionId || r.retired || r.dns || typeof m.k !== 'string' || m.k.length > 8) return;
      if (!['count', 'race'].includes(this.state.phase)) return;
      if ((this.cupSession || m.raceId != null) && !this.matchesContext(m)) return;
      if (JSON.stringify(m.d ?? {}).length > 512) return;
      this.broadcast('fx', { ...this.currentContext(), id: m.id, k: m.k, d: m.d ?? {} }, { except: client });
    });
    this.onMessage('finish', (client, m) => {
      const r = m && this.state.racers.get(m.id);
      if (!r || r.owner !== client.sessionId || r.done || r.retired || r.dns || this.state.phase !== 'race') return;
      if (!this.matchesContext(m)) return;
      const time = Number(m.time);
      const capSec = this.stageCapMs() / 1000;
      if (!Number.isFinite(time) || time <= 0 || time > capSec) return;
      const targetLaps = this.state.laps || LAPS;
      if (this.cupSession) {
        const progress = targetLaps * 1e6 + (this.poses.get(m.id)?.[12] ?? 0);
        if (!acceptFinish(this.cupSession, {
          id: m.id, time, progress,
          stageIndex: this.cupSession.stageIndex,
          attempt: this.cupSession.attempts[this.cupSession.stageIndex],
        })) return;
        this.syncCupJson();
      }
      r.done = true;
      r.time = time;
      r.lap = targetLaps + 1;
      if (!this.firstFinish && r.kind === 'human') this.firstFinish = Date.now();
    });
    // Leaving a race for the garage: the car goes, the player stays in the room.
    this.onMessage('retire', (client, m) => {
      if ((this.cupSession || m?.raceId != null) && !this.matchesContext(m)) return;
      this.retireHuman(client.sessionId);
    });

    this.clock.setInterval(() => this.tick(), 250);
  }

  createMember(client, options = {}) {
    const p = super.createMember(client, options);
    p.car = cleanCar(options.car);
    p.wheel = cleanWheel(options.wheel);
    p.cosmetics = JSON.stringify(cleanCosmetics(options.cosmetics));
    p.protocol = Number.isInteger(options.protocol) && options.protocol >= GP_PROTOCOL ? options.protocol : 1;
    return p;
  }

  supportsGp(client, targetMode) {
    if (!isAvailableCup(targetMode)) return true;
    const p = this.state.players.get(client.sessionId);
    return (p?.protocol ?? 1) >= GP_PROTOCOL;
  }

  allHumansSupportGp() {
    const humans = [...this.state.players.values()].filter(p => p.connected);
    return humans.every(p => (p.protocol ?? 1) >= GP_PROTOCOL);
  }

  canConfigure() {
    if (this.cupSession && !['complete', 'abandoned'].includes(this.cupSession.status)) return false;
    return ['lobby', 'results', 'complete'].includes(this.state.phase);
  }

  inLobby() {
    return this.canConfigure();
  }

  currentContext() {
    const ctx = { raceId: this.state.raceId };
    if (this.cupSession) {
      const stageIndex = this.cupSession.stageIndex;
      ctx.sessionId = this.cupSession.sessionId;
      ctx.stage = stageIndex;
      ctx.attempt = this.cupSession.attempts[stageIndex] ?? 1;
    }
    return ctx;
  }

  matchesContext(m) {
    if (!m || typeof m !== 'object') return false;
    if (m.raceId != null && m.raceId !== this.state.raceId) return false;
    if (!this.cupSession) return m.raceId === this.state.raceId;
    const stageIndex = this.cupSession.stageIndex;
    const attempt = this.cupSession.attempts[stageIndex];
    return m.raceId === this.state.raceId && m.sessionId === this.cupSession.sessionId
      && m.stage === stageIndex && m.attempt === attempt;
  }

  stageCapMs() {
    if (this.cupDef && this.cupSession) {
      const stage = this.cupDef.stages[this.cupSession.stageIndex];
      return (stage?.capSeconds || 240) * 1000;
    }
    return RACE_CAP_MS;
  }

  syncCupJson() {
    this.state.cupJson = this.cupSession ? JSON.stringify(this.cupSession) : '';
  }

  joined(client) { this.sendPoses(client); }
  returned(client) {
    const r = this.state.racers.get(client.sessionId);
    const p = this.state.players.get(client.sessionId);
    if (p && r && !r.dns && !r.retired && this.state.phase === 'loading') p.racing = true;
    this.sendPoses(client);
  }

  left(client) {
    this.retireHuman(client.sessionId);
  }

  retireHuman(sessionId) {
    const r = this.state.racers.get(sessionId);
    if (r && !r.done && ['loading', 'count', 'race'].includes(this.state.phase)) r.retired = true;
    const p = this.state.players.get(sessionId);
    if (p) { p.racing = false; p.loaded = false; }
    if (this.cupSession) {
      if (retireEntrant(this.cupSession, sessionId)) this.syncCupJson();
    }
  }

  // The host also drives the bots.
  hostChanged(id) {
    if (!id) return;
    for (const r of this.state.racers.values()) if (r.kind === 'bot') r.owner = id;
    if (this.cupSession) {
      this.cupSession.entrants = Object.freeze(this.cupSession.entrants.map(e =>
        e.kind === 'bot' ? Object.freeze({ ...e, owner: id }) : e));
      this.syncCupJson();
    }
  }

  sendPoses(client) {
    client.send('poses', { ...this.currentContext(), poses: Object.fromEntries(this.poses) });
  }

  startRace() {
    const humans = [...this.state.players.entries()].filter(([, p]) => p.connected)
      .sort((a, b) => a[1].joinedAt - b[1].joinedAt);
    if (!humans.length) return;
    this.state.notice = '';
    if (isAvailableCup(this.state.mode)) {
      if (!this.allHumansSupportGp()) {
        this.state.notice = 'Un pana tiene una versión anterior y no puede entrar al Gran Premio.';
        return;
      }
      return this.startCup(humans);
    }
    this.cupSession = null;
    this.cupDef = null;
    this.syncCupJson();
    this.state.racers.clear();
    this.poses.clear();
    this.firstFinish = 0;
    this.state.laps = LAPS;
    const total = Math.min(MAX_MEMBERS, this.state.bots ? Math.max(MIN_GRID, humans.length) : humans.length);
    const slots = shuffle([...Array(total).keys()]);
    for (const [id, p] of humans) {
      p.racing = true;
      p.loaded = false;
      this.state.racers.set(id, new Racer({
        kind: 'human', owner: id, name: p.name, avatar: p.avatar, car: p.car, wheel: p.wheel, cosmetics: p.cosmetics, slot: slots.pop(), lap: 0,
      }));
    }
    for (const p of this.state.players.values()) if (!p.connected) { p.racing = false; p.loaded = false; }
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
    this.state.intermissionEndsAt = 0;
    this.state.raceId = (this.state.raceId + 1) % 65535 || 1;
    this.state.phase = 'loading';
    this.loadDeadline = Date.now() + LOAD_TIMEOUT_MS;
  }

  startCup(humans) {
    const cup = cupById(this.state.mode);
    const seed = `${this.code || 'room'}:${Date.now()}:${Math.random()}`;
    const sessionId = `gp-${randomUUID()}`;
    const total = Math.min(MAX_MEMBERS, this.state.bots ? Math.max(GP_GRID, humans.length) : humans.length);
    const taken = new Set(humans.map(([, p]) => p.car));
    const botCars = [
      ...seededOrder([...Array(CAR_COUNT).keys()].filter(i => !taken.has(i)), `${seed}:cars`),
      ...seededOrder([...Array(CAR_COUNT).keys()], `${seed}:cars-all`),
    ];
    const botNames = seededOrder(RIVALS, `${seed}:names`);
    const entrants = humans.map(([id, p]) => ({
      id, name: p.name, kind: 'human', owner: id, avatar: p.avatar,
      loadout: { car: p.car, wheel: p.wheel, ...cleanCosmetics(p.cosmetics) }, skillSeed: `${sessionId}:${id}`,
    }));
    for (let i = 0; entrants.length < total; i++) {
      const car = botCars[i % botCars.length];
      const botId = `bot-${i + 1}`;
      entrants.push({
        id: botId, name: botNames[i % botNames.length], kind: 'bot', owner: this.state.host,
        avatar: avatarJson(randomAvatar()),
        loadout: { car, wheel: AI_WHEELS[CAR_DEFINITIONS[car].id] || 'calle' },
        skillSeed: `${sessionId}:${botId}`,
      });
    }
    this.cupDef = cup;
    this.cupSession = createCupSession({
      cupId: cup.id, sessionId, seed, difficulty: this.state.difficulty, bots: this.state.bots, entrants,
    });
    this.openCupStage();
  }

  openCupStage() {
    if (!this.cupSession || !this.cupDef) return;
    if (this.cupSession.status === 'ready') beginStage(this.cupSession);
    else if (['loading', 'racing'].includes(this.cupSession.status)) retryStage(this.cupSession);
    else return;
    const stageIndex = this.cupSession.stageIndex;
    const stage = this.cupDef.stages[stageIndex];
    const grid = this.cupSession.grids[stageIndex];
    const absent = new Set(this.cupSession.absent);
    this.state.track = stage.track;
    this.state.laps = stage.laps;
    this.state.racers.clear();
    this.poses.clear();
    this.firstFinish = 0;
    for (const p of this.state.players.values()) { p.racing = false; p.loaded = false; }
    grid.forEach((id, slot) => {
      const entrant = this.cupSession.entrants.find(e => e.id === id);
      if (!entrant) return;
      const isAbsent = absent.has(id);
      if (entrant.kind === 'human') {
        const p = this.state.players.get(id);
        if (p && p.connected && !isAbsent) {
          p.racing = true;
          p.loaded = false;
        } else if (!p) {
          retireEntrant(this.cupSession, id);
        }
      }
      const retiredNow = this.cupSession.absent.includes(id);
      this.state.racers.set(id, new Racer({
        kind: entrant.kind,
        owner: entrant.kind === 'bot' ? this.state.host : entrant.id,
        name: entrant.name,
        avatar: typeof entrant.avatar === 'string' ? entrant.avatar : avatarJson(entrant.avatar),
        car: entrant.loadout.car,
        wheel: entrant.loadout.wheel,
        cosmetics: JSON.stringify(cleanCosmetics(entrant.loadout)),
        slot,
        skillSeed: entrant.skillSeed,
        lap: 0,
        dns: retiredNow,
        retired: retiredNow,
      }));
    });
    this.state.startAt = 0;
    this.state.intermissionEndsAt = 0;
    this.state.raceId = (this.state.raceId + 1) % 65535 || 1;
    this.state.phase = 'loading';
    this.loadDeadline = Date.now() + GP_LOAD_TIMEOUT_MS;
    this.syncCupJson();
  }

  advanceCupStage() {
    if (!this.cupSession || this.cupSession.status !== 'intermission') return false;
    if (!advanceStage(this.cupSession)) return false;
    this.openCupStage();
    return true;
  }

  toLobby(notice = '') {
    if (this.cupSession && !['complete', 'abandoned'].includes(this.cupSession.status)) {
      abandonCup(this.cupSession);
    }
    this.cupSession = null;
    this.cupDef = null;
    this.syncCupJson();
    this.state.phase = 'lobby';
    this.state.startAt = 0;
    this.state.intermissionEndsAt = 0;
    this.state.notice = notice;
    this.state.racers.clear();
    this.poses.clear();
    for (const p of this.state.players.values()) { p.racing = false; p.loaded = false; }
  }

  // Finished cars by time, then everyone else by how far they got.
  rank() {
    const progress = (id, r) => Math.max(0, r.lap) * 1e6 + (this.poses.get(id)?.[12] ?? 0);
    if (this.cupSession) {
      const stageIndex = this.cupSession.stageIndex;
      const attempt = this.cupSession.attempts[stageIndex];
      const results = this.cupSession.entrants.map(entrant => {
        const r = this.state.racers.get(entrant.id);
        const accepted = this.cupSession.finishes[stageIndex][entrant.id];
        const started = this.cupSession.started[stageIndex].includes(entrant.id);
        let classification = 'dnf';
        if (accepted || r?.done) classification = 'finished';
        else if (this.cupSession.absent.includes(entrant.id)) {
          classification = this.cupSession.retiredAt[entrant.id] === stageIndex ? 'retired' : 'dns';
        } else if (!started || r?.dns) {
          classification = 'dns';
        }
        return {
          id: entrant.id,
          classification,
          started,
          time: accepted?.time ?? (r?.done ? r.time : null),
          progress: accepted?.progress ?? (r ? progress(entrant.id, r) : 0),
        };
      });
      finalizeStage(this.cupSession, { stageIndex, attempt, results });
      const stageRecs = this.cupSession.ledger.filter(rec => rec.stage === stageIndex);
      for (const rec of stageRecs) {
        const r = this.state.racers.get(rec.id);
        if (!r) continue;
        r.place = rec.place;
        r.done = rec.classification === 'finished';
        r.dnf = rec.classification === 'dnf';
        r.dns = rec.classification === 'dns';
        r.retired = rec.classification === 'retired';
        if (rec.time != null) r.time = rec.time;
      }
      this.syncCupJson();
      return;
    }
    const list = [...this.state.racers.entries()].filter(([, r]) => !r.retired).sort(([ia, a], [ib, b]) =>
      a.done && b.done ? a.time - b.time : a.done !== b.done ? (a.done ? -1 : 1) : progress(ib, b) - progress(ia, a));
    list.forEach(([, r], i) => { r.place = i + 1; if (!r.done) r.dnf = true; });
  }

  tick() {
    const now = Date.now(), s = this.state;
    const racing = [...s.players.values()].filter(p => p.racing);
    if (s.phase === 'loading') {
      if (!racing.length) return this.toLobby(this.cupSession ? 'Ningún pana estuvo listo a tiempo. Volvimos a la sala.' : '');
      const allReady = racing.every(p => p.loaded || !p.connected);
      if (allReady || now > this.loadDeadline) {
        const readyHumans = racing.filter(p => p.loaded && p.connected);
        if (!readyHumans.length) {
          return this.toLobby('Ningún pana cargó la pista a tiempo. Volvimos a la sala.');
        }
        for (const [id, p] of s.players.entries()) {
          if (p.racing && !p.loaded) {
            p.racing = false;
            const r = s.racers.get(id);
            if (r) r.dns = true;
          }
        }
        s.startAt = now + COUNTDOWN_MS;
        s.phase = 'count';
      }
    } else if (s.phase === 'count') {
      if (now >= s.startAt) {
        s.phase = 'race';
        this.raceStarted = now;
        if (this.cupSession) {
          const stageIndex = this.cupSession.stageIndex;
          const attempt = this.cupSession.attempts[stageIndex];
          markRacing(this.cupSession, stageIndex, attempt);
          for (const [id, r] of s.racers.entries()) {
            if (!r.dns && !r.retired) markStarted(this.cupSession, id, stageIndex, attempt);
          }
          this.syncCupJson();
        }
      }
    } else if (s.phase === 'race') {
      const humans = [...s.racers.values()].filter(r => r.kind === 'human' && !r.retired && !r.dns);
      if (!humans.length || humans.every(r => r.done)
        || (this.firstFinish && now > this.firstFinish + FINISH_GRACE_MS)
        || now > this.raceStarted + this.stageCapMs()) {
        this.rank();
        this.resultsAt = now;
        if (this.cupSession?.status === 'complete') {
          s.intermissionEndsAt = 0;
          s.phase = 'complete';
        } else if (this.cupSession?.status === 'intermission') {
          s.intermissionEndsAt = now + GP_INTERMISSION_MS;
          s.phase = 'results';
        } else {
          s.intermissionEndsAt = 0;
          s.phase = 'results';
        }
      }
    } else if (s.phase === 'results' && this.cupSession?.status === 'intermission') {
      const connectedHumans = [...s.players.values()].filter(p => p.connected);
      if (!connectedHumans.length) return this.toLobby();
      if (s.intermissionEndsAt > 0 && now >= s.intermissionEndsAt) {
        this.advanceCupStage();
      }
    }
  }
}
