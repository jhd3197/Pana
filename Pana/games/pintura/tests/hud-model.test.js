import test from 'node:test';
import assert from 'node:assert/strict';
import { race, pepas, lowAmmo, hitAngle, clock, KILL_LINES, PEPAS, calloutTitle, seesCallout, rulesTip } from '../public/hud-model.js';

const player = (id, score, extra = {}) => ({ id, name: `P${id}`, color: `c${id}`, score, hits: 0, team: id % 2, ...extra });

test('the race is you against the best rival, even when you lead', () => {
  const state = { players: [player(1, 3), player(2, 7), player(3, 5)] };
  const behind = race(state, 1, 10);
  assert.equal(behind.rank, 3); assert.equal(behind.rival.name, 'P2'); assert.equal(behind.me.score, 3); assert.equal(behind.goal, 10);
  const ahead = race(state, 2, 10);
  assert.equal(ahead.rank, 1); assert.equal(ahead.rival.name, 'P3');
  assert.equal(race({ players: [player(1, 0)] }, 1, 10).rival, null);
});

test('fewer hits received breaks a tie in the rank', () => {
  const state = { players: [player(1, 4, { hits: 3 }), player(2, 4, { hits: 1 })] };
  assert.equal(race(state, 1, 10).rank, 2); assert.equal(race(state, 2, 10).rank, 1);
});

test('teams race team against team, and flags end at three', () => {
  const state = { options: { mode: 'teams' }, teamScores: [4, 6], players: [player(1, 2), player(2, 1)] };
  const mine = race(state, 1, 10);   // id 1 is team 1
  assert.ok(mine.teams && !mine.flag); assert.deepEqual([mine.me.team, mine.me.score, mine.rival.team, mine.rival.score], [1, 6, 0, 4]);
  const flags = race({ ...state, options: { mode: 'ctf' } }, 2, 10);
  assert.ok(flags.flag); assert.equal(flags.goal, 3); assert.equal(flags.me.score, 4);
});

test('the pepas row fills in proportion and caps at twelve', () => {
  assert.deepEqual(pepas(12, 12), { total: 12, on: 12 }); assert.deepEqual(pepas(6, 12), { total: 12, on: 6 });
  assert.deepEqual(pepas(0, 12), { total: 12, on: 0 });
  assert.deepEqual(pepas(1, 18), { total: PEPAS, on: 1 });     // the last ball never reads as empty
  assert.deepEqual(pepas(9, 18), { total: PEPAS, on: 6 });
  assert.deepEqual(pepas(1, 1), { total: 1, on: 1 });          // a rocket's single shell
  assert.deepEqual(pepas(3, 3), { total: 3, on: 3 });
});

test('low ammo is empty or a quarter of a real magazine', () => {
  assert.ok(lowAmmo(0, 12) && lowAmmo(3, 12) && lowAmmo(0, 1));
  assert.ok(!lowAmmo(4, 12) && !lowAmmo(1, 1));
});

test('a hit angle is clockwise from where you look', () => {
  const me = { x: 0, z: 0 }, east = { x: 1, z: 0 };       // looking along +x
  assert.ok(Math.abs(hitAngle(me, { x: 5, z: 0 }, east)) < 1e-9);                  // ahead
  assert.ok(Math.abs(hitAngle(me, { x: 0, z: 5 }, east) - Math.PI / 2) < 1e-9);    // +z is your right
  assert.ok(Math.abs(hitAngle(me, { x: 0, z: -5 }, east) + Math.PI / 2) < 1e-9);   // -z your left
  assert.ok(Math.abs(Math.abs(hitAngle(me, { x: -5, z: 0 }, east)) - Math.PI) < 1e-9); // behind
  assert.ok(Math.abs(hitAngle(me, { x: 5, z: 0 }, { x: 0, z: 1 }) + Math.PI / 2) < 1e-9); // turn right and it is on your left
  assert.equal(hitAngle(me, me, east), null); assert.equal(hitAngle(me, null, east), null);
});

test('the clock rounds up and never goes negative; kill lines are the ones rules.js says', () => {
  assert.equal(clock(179.2), '3:00'); assert.equal(clock(65), '1:05'); assert.equal(clock(-3), '0:00'); assert.equal(clock(), '0:00');
  assert.ok(KILL_LINES.has('{owner} pintó a {victim} · {distance} m') && KILL_LINES.size === 2);
});

test('a headshot callout beats streak and revenge titles, which move to the detail line', () => {
  assert.deepEqual(calloutTitle({ headshot: true, streak: 1 }), { title: '¡A la cabeza!', extra: null });
  assert.deepEqual(calloutTitle({ headshot: true, streak: 3 }, { scope: 3.5 }), { title: '¡A la cabeza!', extra: '¡Triple!' });
  assert.deepEqual(calloutTitle({ headshot: true, streak: 2, revenge: true }), { title: '¡A la cabeza!', extra: '¡Venganza!' });
  assert.equal(calloutTitle({ streak: 3 }, { scope: 3.5 }).title, '¡Triple!');
  assert.equal(calloutTitle({ streak: 1 }, { scope: 3.5 }).title, '¡Francotirador!');
  assert.equal(calloutTitle({ streak: 1, direct: true }).title, '¡Bazucazo!');
  assert.equal(calloutTitle({ streak: 1 }).title, '¡Pepazo!');
});

test('the shooter sees every callout; a headshot also reaches its victim and whoever watches the shooter', () => {
  const out = { type: 'out', owner: 1, victim: 2 }, head = { ...out, headshot: true };
  assert.equal(seesCallout(out, 1), true); assert.equal(seesCallout(out, 2), false); assert.equal(seesCallout(out, 3, 1), false);
  assert.equal(seesCallout(head, 1), true); assert.equal(seesCallout(head, 2), true);
  assert.equal(seesCallout(head, 3, 1), true); assert.equal(seesCallout(head, 3, 4), false); assert.equal(seesCallout(head, 3), false);
  assert.equal(seesCallout({ ...head, type: 'hit' }, 1), false);
});

test('the rules tip names the room capture limit, not a fixed three', () => {
  assert.match(rulesTip({ mode: 'ctf', flagGoal: 5 }), /En bandera gana el equipo que llegue a 5 capturas\.$/);
  assert.match(rulesTip({ mode: 'ctf', flagGoal: 1 }), /llegue a 1 captura\.$/);
  assert.match(rulesTip({}), /llegue a 3 capturas\.$/, 'the default limit');
  assert.doesNotMatch(rulesTip({ flagGoal: 5 }), /tres capturas/);
});
