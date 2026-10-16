import test from 'node:test';
import assert from 'node:assert/strict';
import { newWallet, cleanWallet, earnings, buy, unlocked, mirrorUnlocked, repaintHex, hexToHsl, hslToHex, PAINTS, FLAMES } from '../public/shop.js';

test('a race pays the coins you picked up plus a podium and trophy bonus', () => {
  assert.equal(earnings({ collected: 7, place: 0 }), 17);
  assert.equal(earnings({ collected: 7, place: 3 }), 7);
  assert.equal(earnings({ collected: 0, place: 0, trophy: 'oro' }), 50);
});

test('buying spends once; owned items stay owned; locks need trophies', () => {
  const w = newWallet();
  w.coins = 30;
  assert.equal(buy(w, 'paint', 'caribe', {}), true);
  assert.equal(w.coins, 5);
  assert.equal(buy(w, 'paint', 'caribe', {}), true, 'already owned: no charge');
  assert.equal(w.coins, 5);
  assert.equal(buy(w, 'paint', 'azabache', {}), false, 'cannot afford');
  const gold = PAINTS.find(p => p.unlock === 'oro');
  assert.equal(unlocked(gold, {}), false);
  assert.equal(unlocked(gold, { mango: 'oro' }), true);
  assert.equal(unlocked(FLAMES.find(f => f.unlock), { mango: 'oro' }), false);
  assert.equal(unlocked(FLAMES.find(f => f.unlock), { mango: 'bronce', arepa: 'plata' }), true);
  assert.equal(unlocked(FLAMES.find(f => f.unlock), { pana: 'bronce', aventura: 'plata' }), true);
  assert.equal(unlocked(FLAMES.find(f => f.unlock), { mango: 'bronce', pana: 'plata' }), false, 'legacy and current Pana are one cup');
  assert.equal(mirrorUnlocked({}), false);
  assert.equal(mirrorUnlocked({ arepa: 'bronce' }), true);
});

test('stored wallets are cleaned', () => {
  const w = cleanWallet({ coins: -5, owned: ['paint:caribe', 3], horn: 'nope' });
  assert.equal(w.coins, 0);
  assert.ok(w.owned.includes('paint:caribe') && w.owned.includes('paint:fabrica'));
  assert.equal(w.horn, 'propio');
  assert.equal(cleanWallet(null).coins, 0);
});

test('repainting keeps shading inside the paint family and leaves other colours', () => {
  assert.equal(hslToHex(...hexToHsl('#1f6fe0')), '#1f6fe0');
  const main = repaintHex('#e0262f', '#e0262f', '#1f6fe0');
  assert.equal(main, '#1f6fe0');
  const shade = repaintHex('#a8141c', '#e0262f', '#1f6fe0');
  assert.ok(shade && hexToHsl(shade)[2] < hexToHsl('#1f6fe0')[2], 'the darker panel stays darker');
  assert.equal(repaintHex('#262732', '#e0262f', '#1f6fe0'), null, 'tyres and trim untouched');
  assert.equal(repaintHex('#ffd23f', '#e0262f', '#1f6fe0'), null, 'lamps untouched');
});
