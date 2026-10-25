import test from 'node:test';
import assert from 'node:assert/strict';
import { botParticipation, botLevel, isRoomFieldVisible } from '../room-option-fields.js';
import { Race as Galope } from '../../games/galope/public/rules.js';
import { Race as Curiara } from '../../games/curiara/public/rules.js';
import { Race as Lancha } from '../../games/lancha/public/rules.js';
import { roomOptions as flightOptions } from '../../games/parapente/public/options.js';

test('bot visibility is conditional without changing the saved skill', () => {
  const skill = botLevel('level', 'easy', 'normal', 'hard', { visibleWhen: { bots: [true] } });
  const options = { bots: false, level: 'hard' };
  assert.equal(isRoomFieldVisible(skill, options), false);
  assert.equal(isRoomFieldVisible(skill, { ...options, bots: true }), true);
  assert.equal(options.level, 'hard');
  assert.equal(isRoomFieldVisible(botParticipation(), options), true);
});

for (const [name, Race] of [['galope', Galope], ['curiara', Curiara], ['lancha', Lancha]]) {
  test(`${name}: bot choice survives restore and drives start without a DOM checkbox`, () => {
    const race = new Race(); race.addPlayer('ana', 'Ana');
    assert.equal(race.configure({ bots: false }), true);
    const restored = Race.restore(race.snapshot(), new Map([['ana', {}]]));
    assert.equal(restored.options.bots, false);
    restored.start();
    const racers = name === 'galope' ? restored.players : restored.boats;
    assert.equal(racers.length, 1);
    assert.equal(restored.configure({ bots: true }), false, 'room choices lock during the race');
    assert.equal(new Race().options.bots, true, 'default still fills the race');
  });
}

test('legacy no-rivals choices migrate without losing other options', () => {
  const race = new Lancha();
  assert.equal(race.configure({ rivals: 'none', guide: false }), true);
  assert.equal(race.options.bots, false);
  assert.equal(race.options.rivals, 'normal');
  assert.equal(race.options.guide, false);
  assert.equal(race.configure({ bots: 'false' }), false);
  assert.equal(race.configure({ rivals: 'none', bots: 'false' }), false, 'legacy migration must not hide an invalid patch');
  const options = flightOptions({ rivals: 'none', guide: false }, { thermals: 'strong' });
  assert.deepEqual(options, { bots: false, rivals: 'normal', guide: false, thermals: 'strong' });
  assert.equal(flightOptions(options, { bots: true }).bots, true);
  assert.equal(flightOptions(options, { bots: 'false' }), null);
  assert.equal(flightOptions(options, { rivals: 'none', bots: null }), null);
  assert.equal(flightOptions(options, { rivals: 'none', bots: true }).bots, true, 'explicit modern participation takes precedence');
});
