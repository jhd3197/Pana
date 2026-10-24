import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch();
try {
  const page = await openGame(browser, 'carreritas', { query: 'debug&manual&track=estadio' });
  await waitFor(page, () => window.garage?.car);
  await page.evaluate(() => startRace(0, 'calle'));
  const result = await page.evaluate(async () => {
    const { addItem } = await import('./item-rules.js');
    const T = getActiveTrack(), [owner, victim] = race.cars, out = {};
    const place = (c, s) => {
      const a = T.pointAt(s), b = T.pointAt(s + 0.5);
      Object.assign(c, { x: a.x, z: a.y, y: T.groundAt(a.x, a.y), h: Math.atan2(b.x - a.x, b.y - a.y),
        vx: 0, vz: 0, vf: 0, vy: 0, onGround: true, lap: 1, prog: s - T.LINE,
        isPlayer: true, human: 1, done: false, ghost: false, phaseRemote: false, phaseT: 0, rescueT: 0,
        spin: 0, dizzy: 0, impacts: [], cloud: 0, shield: 0, boost: 0, coins: 0, lost: 0,
        inventory: [null, null], selected: 0 });
    };
    const reset = () => {
      race.state = 'go'; race.count = 0; race.items.clear();
      for (const b of [...race.items.boxes, ...race.items.coins]) b.down = 9999;
      place(owner, T.LINE + 35); place(victim, T.LINE + 65);
      for (const c of race.cars.slice(2)) c.done = true;
    };
    const step = seconds => { for (let i = 0; i < Math.ceil(seconds * 60); i++) race.items.update(1 / 60, race.cars, true); };
    const fire = kind => { owner.inventory = [null, null]; owner.selected = 0; addItem(owner, kind, 0); return race.items.use(owner); };

    reset();
    addItem(victim, 'mango', 0); addItem(victim, 'jugo', 0);
    fire('aguacero'); step(1);
    out.firstRain = victim.cloud > 0 && victim.inventory[victim.selected]?.kind === 'jugo';
    const rainLeft = victim.cloud;
    fire('aguacero'); step(1);
    out.repeatRain = victim.cloud < rainLeft && victim.inventory[victim.selected]?.kind === 'jugo';
    fire('chancleta'); step(2);
    out.crossProtection = victim.dizzy === 0 && victim.inventory[victim.selected]?.kind === 'jugo';
    step(8);
    fire('aguacero'); step(1);
    out.rainReturns = victim.cloud > 0 && victim.inventory.every(i => !i);

    reset();
    fire('chancleta'); step(2);
    out.firstChancleta = victim.dizzy > 0;
    victim.dizzy = 0; victim.shield = 5;
    fire('chancleta'); step(2);
    out.repeatChancleta = victim.dizzy === 0 && victim.shield > 2;
    victim.shield = 0;
    // Ordinary combat remains live during major-item recovery.
    fire('mango'); step(2);
    out.normalHit = victim.dizzy > 0;

    reset();
    victim.phaseT = 3;
    fire('chancleta'); step(1);
    out.escape = victim.dizzy === 0 && race.items.projectiles.length === 0;
    victim.phaseT = 0; step(1);
    out.noDelayedHit = victim.dizzy === 0;

    reset();
    victim.isPlayer = false; victim.human = 0; victim.useT = 100;
    addItem(victim, 'jugo', 0); addItem(victim, 'mango', 0);
    fire('mango'); step(0.1);
    out.reactionDelayed = victim.selected === 0;
    step(0.25);
    out.reactionReady = victim.selected === 1;
    step(1);
    out.defended = victim.dizzy === 0 && victim.inventory.filter(Boolean).length === 1;

    reset();
    // Two inventories filled at one row still work; anti-farming changes odds,
    // never silently consumes a pickup without granting an item.
    for (const box of race.items.boxes.slice(0, 2)) {
      box.down = 0;
      Object.assign(owner, { x: box.x, y: box.y, z: box.z, h: box.h, vf: 0 });
      race.items.update(1 / 60, [owner], true);
    }
    out.stationarySupplies = owner.inventory.every(i => i && !['chancleta', 'aguacero', 'jugo3', 'mango3'].includes(i.kind));
    reset(); fire('aguacero'); step(1);
    out.resetClearsRecovery = victim.cloud > 0;
    return out;
  });
  for (const [name, passed] of Object.entries(result)) assert.equal(passed, true, `${name}: ${JSON.stringify(result)}`);
  assert.deepEqual(page.errors, []);
  console.log('Race balance: repeated/mixed major attacks, normal combat, recovery escape, bot reaction and crate integration passed.', result);
} finally { await browser.close(); }
