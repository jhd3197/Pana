import test from 'node:test';
import assert from 'node:assert/strict';
import { kitRating, MARKERS, ARMOR, GRENADES } from '../public/armory-data.js';
import { bandOf } from '../../../engine/kit-rating.js';

test('kit rating follows effective combat stats, not cosmetic or unknown input', () => {
  const base=kitRating();
  assert.equal(kitRating({finish:'uva',charm:'mango',pattern:'dots',rating:9999}),base);
  assert.equal(kitRating(null),base);
  assert.ok(kitRating({}, {fastReload:true})>base);
  assert.ok(kitRating({}, {toughness:5})>base);
  assert.equal(kitRating({weapon:'rocket'},{weapons:'pistol'}),base);
  assert.notEqual(kitRating({attachments:['hopper']}),base);
  assert.notEqual(kitRating({armor:'padded'}),base);
  assert.notEqual(kitRating({grenade:'chispita'}),base);
});

test('all weapon, armor and grenade combinations have bounded integer ratings', () => {
  for(const weapon of MARKERS) for(const armor of ARMOR) for(const grenade of GRENADES) {
    const score=kitRating({weapon:weapon.id,armor:armor.id,grenade:grenade.id});
    assert.ok(Number.isInteger(score) && score>=100 && score<=800);
    assert.match(bandOf(score).letter,/^[DCBAS]$/);
  }
  assert.equal(bandOf(449).letter,'D');assert.equal(bandOf(450).letter,'C');
  assert.equal(bandOf(550).letter,'B');assert.equal(bandOf(650).letter,'A');assert.equal(bandOf(750).letter,'S');
});
