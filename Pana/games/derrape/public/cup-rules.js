import { cupById } from './cup-definitions.js';

export const POINTS = [15, 12, 10, 8, 6, 4, 2, 1];
export const CLASSIFIED = new Set(['finished', 'dnf']);
export const CLASSIFICATIONS = new Set(['finished', 'dnf', 'dns', 'retired']);
const TROPHIES = ['oro', 'plata', 'bronce'];

function hashSeed(value) {
  let h = 2166136261;
  for (const char of String(value)) { h ^= char.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function randomSource(seed) {
  let a = hashSeed(seed);
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function seededOrder(ids, seed) {
  const random = randomSource(seed);
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const copyEntrant = (entrant, index) => {
  if (!entrant || typeof entrant !== 'object') throw new TypeError('Invalid entrant');
  const id = String(entrant.id ?? '').trim();
  if (!id || id.length > 80) throw new TypeError('Every entrant needs a stable ID');
  return Object.freeze({
    id,
    name: String(entrant.name ?? `Pana ${index + 1}`).slice(0, 40),
    kind: entrant.kind === 'human' ? 'human' : 'bot',
    owner: entrant.owner == null ? null : String(entrant.owner),
    avatar: entrant.avatar ?? null,
    loadout: Object.freeze({
      car: entrant.loadout?.car ?? entrant.car ?? 0,
      wheel: entrant.loadout?.wheel ?? entrant.wheel ?? 'calle',
    }),
    skillSeed: String(entrant.skillSeed ?? `${id}:skill`),
  });
};

export function createCupSession({ cupId = 'pana', sessionId, seed = 1, difficulty = 'normal', bots = true, entrants }) {
  const cup = cupById(cupId);
  if (!cup || cup.id !== cupId || !cup.available) throw new TypeError('Cup is not available');
  if (!Array.isArray(entrants) || entrants.length < 1 || entrants.length > 8) throw new TypeError('A cup needs one to eight entrants');
  const roster = entrants.map(copyEntrant);
  const ids = roster.map(entrant => entrant.id);
  if (new Set(ids).size !== ids.length) throw new TypeError('Entrant IDs must be unique');
  const grid = seededOrder(ids, `${seed}:grid`);
  return {
    version: 1,
    sessionId: String(sessionId ?? `${cup.id}-${seed}`),
    cupId: cup.id,
    edition: cup.edition,
    seed: String(seed),
    difficulty,
    bots: !!bots,
    status: 'ready',
    stageIndex: 0,
    entrants: Object.freeze(roster),
    initialGrid: Object.freeze([...grid]),
    grids: [grid, null, null, null],
    attempts: [0, 0, 0, 0],
    started: [[], [], [], []],
    finishes: [{}, {}, {}, {}],
    finalized: [null, null, null, null],
    ledger: [],
    absent: [],
    retiredAt: {},
  };
}

const entrantIds = (session) => session.entrants.map(entrant => entrant.id);
const hasEntrant = (session, id) => session.entrants.some(entrant => entrant.id === id);
const contextMatches = (session, stageIndex, attempt) => stageIndex === session.stageIndex
  && Number.isInteger(stageIndex) && stageIndex >= 0 && stageIndex < 4
  && attempt === session.attempts[stageIndex];

export function stageResults(session, stageIndex) {
  return session.ledger.filter(record => record.stage === stageIndex);
}

export function standings(session) {
  const initial = new Map(session.initialGrid.map((id, index) => [id, index]));
  const rows = session.entrants.map(entrant => {
    const records = session.ledger.filter(record => record.id === entrant.id);
    return {
      id: entrant.id,
      name: entrant.name,
      entrant,
      points: records.reduce((sum, record) => sum + record.points, 0),
      wins: records.filter(record => record.place === 1 && CLASSIFIED.has(record.classification)).length,
      records,
      initialSlot: initial.get(entrant.id),
      decidedBy: null,
    };
  });
  rows.sort((a, b) => compareRows(a, b).result);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i - 1].points === rows[i].points) rows[i].decidedBy = compareRows(rows[i - 1], rows[i]).reason;
  }
  return rows;
}

function compareRows(a, b) {
  if (a.points !== b.points) return { result: b.points - a.points, reason: 'points' };
  if (a.wins !== b.wins) return { result: b.wins - a.wins, reason: 'wins' };
  for (let stage = 3; stage >= 0; stage--) {
    const ar = a.records.find(record => record.stage === stage);
    const br = b.records.find(record => record.stage === stage);
    if (!ar || !br) continue;
    const ac = CLASSIFIED.has(ar.classification) ? 1 : 0;
    const bc = CLASSIFIED.has(br.classification) ? 1 : 0;
    if (ac !== bc) return { result: bc - ac, reason: `stage-${stage + 1}` };
    if (ar.place !== br.place) return { result: ar.place - br.place, reason: `stage-${stage + 1}` };
  }
  return { result: a.initialSlot - b.initialSlot, reason: 'initial-grid' };
}

export function explainTie(session, firstId, secondId) {
  const rows = standings(session);
  const a = rows.find(row => row.id === firstId), b = rows.find(row => row.id === secondId);
  if (!a || !b) return null;
  return compareRows(a, b).reason;
}

export function gridForStage(session, stageIndex = session.stageIndex) {
  if (stageIndex === 0) return [...session.initialGrid];
  const previous = new Map(stageResults(session, stageIndex - 1).map(record => [record.id, record]));
  const absent = new Set(session.absent);
  const ordered = standings(session);
  const classified = ordered.filter(row => !absent.has(row.id) && CLASSIFIED.has(previous.get(row.id)?.classification));
  const last = ordered.filter(row => !classified.includes(row));
  return [...classified, ...last].map(row => row.id);
}

export function beginStage(session) {
  if (session.status !== 'ready' || session.finalized[session.stageIndex]) return false;
  const index = session.stageIndex;
  session.attempts[index]++;
  session.grids[index] = Object.freeze(gridForStage(session, index));
  session.started[index] = [];
  session.finishes[index] = {};
  session.status = 'loading';
  return true;
}

export function markRacing(session, stageIndex = session.stageIndex, attempt = session.attempts[session.stageIndex]) {
  if (session.status !== 'loading' || !contextMatches(session, stageIndex, attempt)) return false;
  session.status = 'racing';
  return true;
}

export function markStarted(session, id, stageIndex = session.stageIndex, attempt = session.attempts[session.stageIndex]) {
  if (session.status !== 'racing' || !contextMatches(session, stageIndex, attempt) || !hasEntrant(session, id)) return false;
  if (session.absent.includes(id) || session.started[stageIndex].includes(id)) return false;
  session.started[stageIndex].push(id);
  return true;
}

export function acceptFinish(session, { id, time, progress = 0, stageIndex = session.stageIndex, attempt = session.attempts[session.stageIndex] }) {
  if (session.status !== 'racing' || !contextMatches(session, stageIndex, attempt) || !hasEntrant(session, id)) return false;
  if (!Number.isFinite(time) || time <= 0 || session.finishes[stageIndex][id]) return false;
  if (!session.started[stageIndex].includes(id) || session.absent.includes(id)) return false;
  session.finishes[stageIndex][id] = { time, progress: Number.isFinite(progress) ? progress : 0 };
  return true;
}

export function retireEntrant(session, id) {
  if (!hasEntrant(session, id) || session.absent.includes(id) || session.status === 'complete') return false;
  session.absent.push(id);
  if (['loading', 'racing'].includes(session.status) && !session.finalized[session.stageIndex] && !session.finishes[session.stageIndex][id]) {
    session.retiredAt[id] = session.stageIndex;
  }
  return true;
}

function validSubmission(session, stageIndex, results) {
  if (!Array.isArray(results) || results.length !== session.entrants.length) return false;
  const ids = results.map(result => result?.id);
  if (new Set(ids).size !== ids.length || ids.some(id => !hasEntrant(session, id))) return false;
  return entrantIds(session).every(id => ids.includes(id));
}

export function finalizeStage(session, { stageIndex = session.stageIndex, attempt = session.attempts[session.stageIndex], results }) {
  if (session.status !== 'racing' || !contextMatches(session, stageIndex, attempt) || session.finalized[stageIndex]) return false;
  if (!validSubmission(session, stageIndex, results)) return false;
  const byId = new Map(results.map(result => [result.id, result]));
  const prepared = [];
  for (const entrant of session.entrants) {
    const id = entrant.id;
    const input = byId.get(id);
    const accepted = session.finishes[stageIndex][id];
    const started = session.started[stageIndex].includes(id) || input.started === true || !!accepted;
    let classification = accepted ? 'finished' : input.classification;
    if (session.absent.includes(id) && !accepted) {
      classification = session.retiredAt[id] === stageIndex ? 'retired' : 'dns';
    }
    if (!CLASSIFICATIONS.has(classification)) return false;
    if (classification === 'finished' && !accepted && (!started || !Number.isFinite(input.time) || input.time <= 0)) return false;
    if (classification === 'dnf' && !started) return false;
    if (classification === 'dns' && started && !session.absent.includes(id)) return false;
    const time = classification === 'finished' ? accepted?.time ?? input.time : null;
    const progress = Number.isFinite(accepted?.progress) ? accepted.progress : Number.isFinite(input.progress) ? input.progress : 0;
    prepared.push({ id, stage: stageIndex, classification, started, time, progress: Math.max(0, progress), place: 0, points: 0 });
  }

  const rank = (a, b) => {
    const ag = a.classification === 'finished' ? 3 : a.classification === 'dnf' ? 2 : a.classification === 'retired' ? 1 : 0;
    const bg = b.classification === 'finished' ? 3 : b.classification === 'dnf' ? 2 : b.classification === 'retired' ? 1 : 0;
    if (ag !== bg) return bg - ag;
    if (a.classification === 'finished') return a.time - b.time;
    if (a.classification === 'dnf') return b.progress - a.progress;
    return session.initialGrid.indexOf(a.id) - session.initialGrid.indexOf(b.id);
  };
  prepared.sort(rank);
  prepared.forEach((record, index) => {
    record.place = index + 1;
    record.points = CLASSIFIED.has(record.classification) ? POINTS[index] ?? 0 : 0;
  });
  session.ledger.push(...prepared);
  session.finalized[stageIndex] = Object.freeze({ attempt, records: Object.freeze(prepared.map(record => record.id)) });
  session.status = stageIndex === 3 ? 'complete' : 'intermission';
  return true;
}

export function advanceStage(session) {
  if (session.status !== 'intermission' || !session.finalized[session.stageIndex] || session.stageIndex >= 3) return false;
  session.stageIndex++;
  session.status = 'ready';
  return true;
}

export function abandonCup(session) {
  if (session.status === 'complete' || session.status === 'abandoned') return false;
  session.status = 'abandoned';
  return true;
}

export function cupTrophy(session, entrantId) {
  if (session.status !== 'complete' || session.finalized.filter(Boolean).length !== 4) return null;
  const place = standings(session).findIndex(row => row.id === entrantId);
  return TROPHIES[place] ?? null;
}

export function assertCupInvariants(session) {
  if (!Number.isInteger(session.stageIndex) || session.stageIndex < 0 || session.stageIndex > 3) return false;
  if (session.finalized.filter(Boolean).length > 4) return false;
  if (session.status === 'complete' && session.finalized.filter(Boolean).length !== 4) return false;
  const keys = new Set();
  const totals = Object.fromEntries(entrantIds(session).map(id => [id, 0]));
  for (const record of session.ledger) {
    const key = `${record.stage}:${record.id}`;
    if (keys.has(key) || !hasEntrant(session, record.id)) return false;
    keys.add(key);
    totals[record.id] += record.points;
  }
  for (const row of standings(session)) if (row.points !== totals[row.id]) return false;
  return session.status !== 'abandoned' || session.finalized.filter(Boolean).length < 4;
}
