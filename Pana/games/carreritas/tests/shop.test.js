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

test('taller parts: modest profiles, cfg patches and clean picks', async () => {
  const { PARTS, PART_SLOTS, cleanParts, partsProfile, renderConfig, statPills } = await import('../public/parts.js');
  const { composeTune } = await import('../public/wheel-definitions.js');
  for (const slot of PART_SLOTS) {
    assert.equal(PARTS[slot.id][0].id, 'fabrica', `${slot.id} starts with the stock part`);
    for (const part of PARTS[slot.id]) for (const v of Object.values(part.profile)) assert.ok(v >= 0.97 && v <= 1.1, `${slot.id}:${part.id} stays within ten percent`);
  }
  assert.deepEqual(cleanParts({ motor: 'turbo', aleron: 'fabrica', techo: 'nave', foo: 'bar' }), { motor: 'turbo' });
  assert.deepEqual(cleanParts('{"rin":"dorado"}'), { rin: 'dorado' });
  assert.deepEqual(cleanParts(null), {});
  const all = partsProfile({ motor: 'turbo', aleron: 'rally', techo: 'maletas' });
  const base = { top: 36, accel: 22, turn: 2.3, mass: 1.1, grip: 6 };
  const tuned = composeTune(base, {}, all);
  assert.ok(tuned.top / base.top < 1.03 && tuned.accel / base.accel < 1.07, 'the strongest build stays within a few percent');
  assert.ok(tuned.mass > base.mass, 'cargo adds weight');
  assert.deepEqual(composeTune(base, {}, {}).top, base.top);
  assert.deepEqual(renderConfig({ acabado: 'camuflaje' }), { acabado: 'camuflaje', rin: 'negro' }, 'one item patches several fields');
  assert.deepEqual(renderConfig({ acabado: 'camuflaje', rin: 'dorado' }).rin, 'dorado', 'a chosen rim wins');
  const chamo = { top: 35, accel: 26, turn: 2.6, mass: 0.8, grip: 7 };
  assert.deepEqual(statPills(chamo, composeTune(chamo, {}, partsProfile({ motor: 'carreras' }))).map(p => `${p.delta} ${p.label}`), ['2 Vel', '2 Acel'], 'the racing engine reads as +2 Vel on the bars');
});

test('direct part purchases keep the first purchase when the next is unaffordable', () => {
  const w = newWallet(); w.coins = 100;
  assert.equal(buy(w, 'motor', 'turbo', {}), true);
  assert.equal(w.coins, 25);
  const saved = structuredClone(w);
  assert.equal(buy(w, 'aleron', 'rally', {}), false);
  assert.deepEqual(w, saved, 'an unaffordable part neither spends nor changes ownership');
  assert.equal(buy(w, 'motor', 'turbo', {}), true);
  assert.deepEqual(w, saved, 'equipping an owned part again never charges twice');
});

test('wallets keep per-car parts and the cauchos; old saves migrate', async () => {
  const { migrateProfile } = await import('../public/cup-profile.js');
  assert.equal(cleanWallet({ wheel: 'ligeras' }).wheel, 'calle', 'a bought wheel must be owned');
  assert.equal(cleanWallet({ wheel: 'ligeras', owned: ['wheel:ligeras'] }).wheel, 'ligeras');
  const w = cleanWallet({ parts: { chamo: { motor: 'turbo', foo: 1 }, bala: { motor: 'nope' } }, wheel: 'palo' });
  assert.deepEqual(w.parts, { chamo: { motor: 'turbo' } });
  assert.equal(w.wheel, 'palo');
  assert.equal(cleanWallet({ wheel: 'tanque' }).wheel, 'calle');
  const old = migrateProfile({ wallet: { coins: 30 }, wheels: 'barro' });
  assert.equal(old.wallet.wheel, 'barro', 'carreritas:wheels moves into the wallet');
  assert.deepEqual(old.wallet.parts, {});
  const current = migrateProfile({ profile: { version: 2, wallet: { coins: 5, wheel: 'slick' } }, wheels: 'barro' });
  assert.equal(current.wallet.wheel, 'slick', 'the profile wins once it has a choice');
  const v2 = migrateProfile({ profile: { version: 2, wallet: { coins: 5 } }, wheels: 'lluvia' });
  assert.equal(v2.wallet.wheel, 'lluvia', 'existing v2 profiles pick up the old cauchos once');
});

test('online cosmetics carry clean parts and stay compact without them', async () => {
  const { cleanCosmetics } = await import('../public/online-rules.js');
  assert.deepEqual(cleanCosmetics({ paint: 'caribe' }), { paint: 'caribe', horn: 'propio', flame: 'fuego' });
  assert.deepEqual(cleanCosmetics(JSON.stringify({ parts: { motor: 'turbo', techo: 'x' } })).parts, { motor: 'turbo' });
});
