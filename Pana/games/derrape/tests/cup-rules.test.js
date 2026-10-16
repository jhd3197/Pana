import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POINTS, abandonCup, acceptFinish, advanceStage, assertCupInvariants, beginStage,
  createCupSession, cupTrophy, explainTie, finalizeStage, gridForStage, markRacing,
  markStarted, retireEntrant, seededOrder, stageResults, standings,
} from '../public/cup-rules.js';

const entrants = (count = 4) => Array.from({ length: count }, (_, i) => ({
  id: `entrant-${i + 1}`,
  name: i < 2 ? 'Mismo nombre' : `Rival ${i + 1}`,
  kind: i === 0 ? 'human' : 'bot',
  car: i,
  wheel: 'calle',
  skillSeed: `skill-${i + 1}`,
}));
const make = (count = 4) => createCupSession({ cupId: 'pana', sessionId: 'session-test', seed: 'fixed', entrants: entrants(count) });
const ids = (session) => session.entrants.map(entrant => entrant.id);

function openStage(session, startedIds = ids(session)) {
  assert.equal(beginStage(session), true);
  assert.equal(markRacing(session), true);
  for (const id of startedIds) assert.equal(markStarted(session, id), true);
}

function finishByTime(session, order) {
  openStage(session);
  order.forEach((id, index) => assert.equal(acceptFinish(session, { id, time: 80 + index * 3, progress: 1000 }), true));
  const results = ids(session).map(id => ({ id, classification: order.includes(id) ? 'finished' : 'dns', started: order.includes(id) }));
  assert.equal(finalizeStage(session, { results }), true);
}

test('a complete four-stage cup keeps one ledger entry per entrant and stage', () => {
  const session = make();
  const [a, b, c, d] = ids(session);
  const orders = [[a, b, c, d], [b, a, d, c], [a, c, b, d], [d, a, b, c]];
  for (let stage = 0; stage < 4; stage++) {
    assert.equal(session.stageIndex, stage);
    finishByTime(session, orders[stage]);
    assert.equal(stageResults(session, stage).length, 4);
    assert.equal(assertCupInvariants(session), true);
    if (stage < 3) {
      assert.equal(advanceStage(session), true);
      assert.equal(advanceStage(session), false, 'duplicate advancement is harmless');
      assert.equal(session.stageIndex, stage + 1);
    }
  }
  assert.equal(session.status, 'complete');
  assert.equal(session.ledger.length, 16);
  assert.equal(finalizeStage(session, { results: [] }), false);
  assert.equal(session.ledger.length, 16, 'duplicate acceptance cannot append results');
  for (const row of standings(session)) {
    assert.equal(row.points, session.ledger.filter(record => record.id === row.id).reduce((sum, record) => sum + record.points, 0));
  }
  assert.equal(cupTrophy(session, a), 'oro');
  assert.equal(cupTrophy(session, b), 'plata');
});

test('equal display names never merge identities, loadouts or results', () => {
  const session = createCupSession({ cupId: 'pana', entrants: entrants(2), seed: 7 });
  assert.notEqual(session.entrants[0].id, session.entrants[1].id);
  assert.equal(session.entrants[0].name, session.entrants[1].name);
  assert.ok(Object.isFrozen(session.entrants));
  assert.ok(Object.isFrozen(session.entrants[0].loadout));
  finishByTime(session, [session.entrants[1].id, session.entrants[0].id]);
  const rows = standings(session);
  assert.equal(rows[0].id, 'entrant-2');
  assert.equal(rows[0].points, POINTS[0]);
  assert.equal(rows[1].points, POINTS[1]);
});

test('duplicate, missing, foreign and stale-stage submissions are rejected atomically', () => {
  const session = make();
  const [a, b, c, d] = ids(session);
  openStage(session, [a, b, c]);
  const valid = [
    { id: a, classification: 'finished', started: true, time: 80 },
    { id: b, classification: 'dnf', started: true, progress: 900 },
    { id: c, classification: 'dnf', started: true, progress: 800 },
    { id: d, classification: 'dns', started: false },
  ];
  assert.equal(finalizeStage(session, { results: [...valid, { id: 'foreign', classification: 'dns' }] }), false);
  assert.equal(session.ledger.length, 0);
  assert.equal(finalizeStage(session, { results: valid.slice(1) }), false);
  assert.equal(session.ledger.length, 0);
  assert.equal(finalizeStage(session, { results: [valid[0], valid[0], valid[2], valid[3]] }), false);
  assert.equal(session.ledger.length, 0);
  assert.equal(finalizeStage(session, { stageIndex: 1, results: valid }), false);
  assert.equal(finalizeStage(session, { attempt: 0, results: valid }), false);
  assert.equal(finalizeStage(session, { results: valid }), true);
  const before = JSON.stringify(session.ledger);
  assert.equal(finalizeStage(session, { results: valid }), false);
  assert.equal(JSON.stringify(session.ledger), before);
});

test('accepted finishes survive departure; later stages are DNS and earlier points remain', () => {
  const session = make(3);
  const [a, b, c] = ids(session);
  openStage(session);
  assert.equal(acceptFinish(session, { id: a, time: 91 }), true);
  assert.equal(retireEntrant(session, a), true);
  assert.equal(retireEntrant(session, a), false);
  assert.equal(finalizeStage(session, { results: ids(session).map(id => ({ id, classification: 'retired', started: true, progress: 500 })) }), true);
  const retiredFinish = stageResults(session, 0).find(record => record.id === a);
  assert.equal(retiredFinish.classification, 'finished');
  assert.equal(retiredFinish.points, 15);
  assert.equal(advanceStage(session), true);
  openStage(session, [b, c]);
  assert.equal(markStarted(session, a), false);
  assert.equal(finalizeStage(session, { results: ids(session).map(id => ({ id, classification: id === a ? 'retired' : 'dnf', started: true, progress: 400 })) }), true);
  const later = stageResults(session, 1).find(record => record.id === a);
  assert.equal(later.classification, 'dns');
  assert.equal(later.points, 0);
  assert.equal(standings(session).find(row => row.id === a).points, 15);
});

test('withdrawal before finishing is retired, while loading absence is DNS', () => {
  const session = make(3);
  const [a, b, c] = ids(session);
  assert.equal(beginStage(session), true);
  assert.equal(retireEntrant(session, a), true);
  assert.equal(markRacing(session), true);
  markStarted(session, b);
  assert.equal(finalizeStage(session, { results: [
    { id: a, classification: 'dns', started: false },
    { id: b, classification: 'dnf', started: true, progress: 200 },
    { id: c, classification: 'dns', started: false },
  ] }), true);
  const records = stageResults(session, 0);
  assert.equal(records.find(record => record.id === a).classification, 'retired');
  assert.equal(records.find(record => record.id === a).points, 0);
  assert.equal(records.find(record => record.id === c).classification, 'dns');
  assert.equal(records.find(record => record.id === b).classification, 'dnf');
});

test('all-DNF racing classifies by progress and still assigns place points', () => {
  const session = make(3);
  const [a, b, c] = ids(session);
  openStage(session);
  assert.equal(finalizeStage(session, { results: [
    { id: a, classification: 'dnf', started: true, progress: 400 },
    { id: b, classification: 'dnf', started: true, progress: 900 },
    { id: c, classification: 'dnf', started: true, progress: 100 },
  ] }), true);
  const records = stageResults(session, 0);
  assert.deepEqual(records.map(record => record.id), [b, a, c]);
  assert.deepEqual(records.map(record => record.points), [15, 12, 10]);
  assert.equal(standings(session)[0].wins, 1);
});

test('ties use wins before reverse-stage classifications', () => {
  const session = make(8);
  const [a, b] = ids(session);
  const placesA = [1, 2, 2, 6], placesB = [2, 1, 1, 8];
  session.ledger = [0, 1, 2, 3].flatMap(stage => [[a, placesA[stage]], [b, placesB[stage]]]
    .map(([id, place]) => ({ id, stage, classification: 'finished', started: true, time: 100 + place, place, points: POINTS[place - 1] })));
  const rows = standings(session);
  assert.equal(rows.find(row => row.id === a).points, 43);
  assert.equal(rows.find(row => row.id === b).points, 43);
  assert.equal(rows.find(row => row.id === b).wins, 2);
  assert.equal(rows[0].id, b);
  assert.equal(explainTie(session, a, b), 'wins');

  const second = make(3);
  const records = [
    [a, 1, 15], [b, 2, 12],
    [a, 3, 10], [b, 1, 15],
    [a, 3, 10], [b, 3, 10],
    [a, 2, 12], [b, 3, 10],
  ];
  second.ledger = records.map(([id, place, points], index) => ({ id, stage: Math.floor(index / 2), classification: 'finished', started: true, time: 100 + place, place, points }));
  assert.equal(standings(second)[0].id, a);
  assert.equal(explainTie(second, a, b), 'stage-4');
});

test('seeded grids freeze, subsequent grids place classified starters first', () => {
  assert.deepEqual(seededOrder(['a', 'b', 'c'], 42), seededOrder(['a', 'b', 'c'], 42));
  const session = make(3);
  const [a, b, c] = ids(session);
  assert.deepEqual(gridForStage(session, 0), session.initialGrid);
  openStage(session, [a, b]);
  assert.equal(finalizeStage(session, { results: [
    { id: a, classification: 'dnf', started: true, progress: 500 },
    { id: b, classification: 'dnf', started: true, progress: 700 },
    { id: c, classification: 'dns', started: false },
  ] }), true);
  assert.deepEqual(gridForStage(session, 1).slice(-1), [c]);
  assert.equal(advanceStage(session), true);
  assert.equal(beginStage(session), true);
  assert.ok(Object.isFrozen(session.grids[1]));
  assert.equal(markRacing(session, 1, session.attempts[1] - 1), false, 'stale attempt cannot start');
});

test('sparse grids and abandoned cups cannot award a championship trophy', () => {
  const session = make(1);
  const [only] = ids(session);
  assert.equal(abandonCup(session), true);
  assert.equal(session.status, 'abandoned');
  assert.equal(cupTrophy(session, only), null);
  assert.equal(beginStage(session), false);
  assert.equal(assertCupInvariants(session), true);
  assert.throws(() => createCupSession({ cupId: 'agua', entrants: entrants(1) }), /not available/);
  assert.throws(() => createCupSession({ cupId: 'pana', entrants: [entrants(1)[0], entrants(1)[0]] }), /unique/);
});
