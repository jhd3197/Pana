import test from 'node:test';
import assert from 'node:assert/strict';
import { cupById } from '../public/cup-definitions.js';
import { advanceStage, beginStage, createCupSession, finalizeStage, markRacing, markStarted } from '../public/cup-rules.js';
import { approximateCupText, CLASSIFICATION_TEXT, cupStandingsView, nextStageText, rankChangeText, tiebreakText } from '../public/cup-ui.js';

const session = createCupSession({ cupId: 'pana', seed: 4, entrants: [
  { id: 'a', name: 'Ana' }, { id: 'b', name: 'Beto' },
] });
const stage = (results) => {
  beginStage(session); markRacing(session);
  for (const item of session.entrants) if (!results.find(r => r.id === item.id && r.classification === 'dns')) markStarted(session, item.id);
  assert.equal(finalizeStage(session, { results }), true);
};

test('cup presentation derives race points and rank movement from the ledger', () => {
  stage([
    { id: 'a', classification: 'finished', started: true, time: 80 },
    { id: 'b', classification: 'dnf', started: true, progress: 500 },
  ]);
  let view = cupStandingsView(session);
  assert.equal(view.find(row => row.id === 'a').racePoints, 15);
  assert.equal(view.find(row => row.id === 'b').racePoints, 12);
  assert.equal(view.find(row => row.id === 'b').classification, 'dnf');
  assert.equal(CLASSIFICATION_TEXT.dnf, 'Sin terminar');
  assert.equal(advanceStage(session), true);
  stage([
    { id: 'a', classification: 'finished', started: true, time: 90 },
    { id: 'b', classification: 'finished', started: true, time: 80 },
  ]);
  view = cupStandingsView(session);
  assert.equal(view[0].id, 'b');
  assert.equal(view[0].rankChange, 1);
  assert.equal(view[1].rankChange, -1);
  assert.equal(rankChangeText(view[0].rankChange), 'Sube 1');
  assert.equal(rankChangeText(view[1].rankChange), 'Baja 1');
  assert.equal(tiebreakText(view[1].decidedBy), 'Desempate: mejor clasificación en la carrera 2.');
});

test('duration and next-stage copy include laps and an honest countdown', () => {
  assert.match(approximateCupText(cupById('pana')), /Duración aproximada: 11 min/);
  assert.equal(nextStageText(cupById('pana'), session, 11.2, id => id === 'llanos' ? 'Los Llanos' : id),
    'Siguiente: Los Llanos · 2 vueltas · continúa en 12 s');
  assert.equal(nextStageText(cupById('pana'), { status: 'complete' }), 'Copa completada');
});
