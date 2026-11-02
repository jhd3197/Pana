// The arsenal (weapons.js) through the real rules: each weapon's flight,
// what it digs, the paint it lands, its fuse, the team's shots of it, and
// the bot's choice between them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, tickMatch, takeEvents, fire, explode, drill, selectWeapon, canUse, ammoLeft, launch, flightOptions, center, RULES } from '../public/rules.js';
import { WEAPONS, WEAPON_IDS, weaponOf, reachOf, startingAmmo, BASIC_WEAPON, FIRST_WEAPON } from '../public/weapons.js';
import { pickTarget, drillPlan, bestShot, createBot } from '../public/bot.js';
import { fillHeights, solidAt, carve } from '../../../engine/play/terrain-mask.js';
import { simulateFlight } from '../../../engine/play/ballistic.js';
import { PAINT_WEAPONS, PAINT_GRENADES } from '../../../engine/play/paint-arsenal.js';
import { GRENADES } from '../../pintura/public/armory-data.js';

const DT = 1 / 60;
const run = (m, seconds, input = () => ({})) => { for (let t = 0; t < seconds && m.phase !== 'finished'; t += DT) tickMatch(m, DT, input(m)); };
const solidCount = m => m.mask.solid.reduce((a, b) => a + b, 0);
// A flat field 10 high with no wind, capis placed by hand; our capi 0-0 on its turn.
function flatMatch(xs = [[10, 14, 18], [50, 56, 62]], height = 10) {
  const m = createMatch({ seed: 5 });
  fillHeights(m.mask, () => height);
  m.capys.forEach(c => { c.x = xs[c.team][c.slot]; c.y = height; c.grounded = true; c.vx = c.vy = 0; });
  m.wind = 0; takeEvents(m);
  return m;
}
const me = m => m.capys.find(c => c.id === m.turn.capy);

test('five weapons from Pepazo\'s arsenal, each clearly its own', () => {
  assert.deepEqual(WEAPON_IDS, ['bazooka', 'grenade', 'sniper', 'drill', 'scatter']);
  for (const w of WEAPONS) {
    assert.ok(Object.values(PAINT_WEAPONS).includes(w.name) || Object.values(PAINT_GRENADES).includes(w.name), `${w.id} carries an arsenal name (${w.name})`);
    assert.ok(w.model === 'grenade' || PAINT_WEAPONS[w.model], `${w.id} is held as a real model (${w.model})`);
    assert.ok(w.blurb && w.paint > 0 && w.crater > 0 && w.speed > 0 && ['shell', 'bounce', 'drill'].includes(w.flight), w.id);
  }
  // Pepazo's grenade names are the arsenal's.
  for (const g of GRENADES) assert.equal(PAINT_GRENADES[g.id], g.name);
  const [bazooka, grenade, sniper, drillW, scatter] = WEAPONS;
  assert.ok(bazooka.crater > grenade.crater && grenade.crater > scatter.crater && scatter.crater > sniper.crater, 'craters from big to tiny');
  assert.ok(sniper.paint > bazooka.paint && bazooka.paint > grenade.paint && grenade.paint > scatter.paint && scatter.paint > drillW.paint, 'single-hit paint');
  assert.ok(sniper.wind === 0 && sniper.gravity < 5 && sniper.speed > 2 * bazooka.speed, 'La Lejana: nearly straight, no wind');
  assert.ok(grenade.wind < bazooka.wind && grenade.fuse === 3, 'La Piñita: light in the wind, a 3 s fuse');
  assert.equal(grenade.ammo, Infinity, 'the basic weapon never runs out');
  assert.deepEqual(RULES.ammo, startingAmmo());
  assert.deepEqual(startingAmmo(), { bazooka: 3, sniper: 2, drill: 3, scatter: 3 });
});

test('each flight: La Lejana flies flat and ignores the wind, the shell arcs and drifts', () => {
  const m = flatMatch(), c = me(m);
  const reach = (weapon, wind) => { m.wind = wind; const s = launch(c, weapon, .05, 1, 1)[0]; return simulateFlight(s, flightOptions(m, [], weapon), { dt: DT, maxTime: 6 }); };
  const flat = reach('sniper', 0), windy = reach('sniper', 1);
  assert.equal(flat.x, windy.x, 'no wind on La Lejana');
  const drop = Math.abs(launch(c, 'sniper', .05, 1, 1)[0].y - 10.1);
  assert.ok(flat.x - c.x > 25, `La Lejana level at .05 rad runs ${(flat.x - c.x).toFixed(1)} before it drops ${drop.toFixed(1)}`);
  const calm = reach('bazooka', 0).x, blown = reach('bazooka', 1).x;
  assert.ok(blown > calm + .3, 'La Bazuca drifts with the wind');
  // El Trueno is five shells in a fan around the aim.
  const fan = launch(c, 'scatter', .5, 1, .8);
  assert.equal(fan.length, 5);
  const angles = fan.map(s => Math.atan2(s.vy, s.vx));
  assert.ok(Math.abs(angles[2] - .5) < 1e-9 && angles[0] < angles[1] && angles[3] < angles[4]);
});

test('craters: La Bazuca big, La Piñita medium, El Trueno small, La Lejana a pinhole', () => {
  const dug = weapon => { const m = flatMatch([[2, 3, 4], [90, 92, 94]], 20), before = solidCount(m); explode(m, 40, 20, 0, weapon); return before - solidCount(m); };
  for (const w of ['bazooka', 'grenade', 'scatter', 'sniper']) {
    const half = Math.PI * weaponOf(w).crater ** 2 / 2 * 100, cells = dug(w);
    assert.ok(Math.abs(cells - half) < half * .12 + 20, `${w}: ${cells} cells, a half disc of radius ${weaponOf(w).crater} is ${half.toFixed(0)}`);
  }
  assert.ok(dug('bazooka') > 4 * dug('scatter') && dug('scatter') > 4 * dug('sniper'));
});

test('La Licuadora bores a tunnel along its flight, long and narrow, with little paint', () => {
  const m = flatMatch([[2, 3, 4], [90, 92, 94]], 30), before = solidCount(m), { length, radius } = weaponOf('drill').tunnel;
  drill(m, 40, 20, 10, 0, 0);
  const dug = before - solidCount(m), expected = (2 * radius * (length + .4) + Math.PI * radius * radius) * 100;
  assert.ok(Math.abs(dug - expected) < expected * .06, `${dug} cells for a ${length}-long tunnel (${expected.toFixed(0)})`);
  for (let x = 40; x <= 40 + length; x += 1) assert.equal(solidAt(m.mask, x, 20), false, `open at ${x}`);
  assert.equal(solidAt(m.mask, 40 + length + radius + .3, 20), true, 'ends where it should');
  assert.equal(solidAt(m.mask, 45, 20 + radius + .3), true, 'narrow: a capi\'s height, not a crater');
  // Aimed down at a rival's feet: a shaft opens under it and it drops, with a little paint.
  const s = flatMatch([[10, 14, 18], [30, 56, 62]]), rival = s.capys.find(c => c.id === '1-0');
  drill(s, rival.x, 10, 0, -1, 0);
  const hit = takeEvents(s).find(e => e.type === 'hit' && e.capy === '1-0');
  assert.equal(hit?.paint, weaponOf('drill').paint);
  run(s, 2);
  assert.ok(rival.y < 10 - length * .6, `the rival fell down the shaft to ${rival.y.toFixed(1)}`);
});

test('La Piñita bounces, waits for its fuse, then bursts where it lies', () => {
  const m = flatMatch(), c = me(m);
  selectWeapon(m, 'grenade'); c.aim = .7;
  const firedAt = m.clock; fire(m, .55);
  let bounced = 0, blast = null;
  for (let t = 0; t < 6 && !blast; t += DT) {
    tickMatch(m, DT, {});
    for (const e of takeEvents(m)) { if (e.type === 'bounce') bounced++; if (e.type === 'blast') blast = { ...e, at: m.clock - firedAt }; }
  }
  assert.ok(bounced >= 1, `${bounced} bounces`);
  assert.ok(blast && Math.abs(blast.at - weaponOf('grenade').fuse) < 2 * DT, `burst ${blast?.at.toFixed(3)} s after the throw`);
  assert.equal(blast.weapon, 'grenade'); assert.ok(Math.abs(blast.y - 10) < .5, 'on the ground');
});

test('paint falls off with distance for each weapon; La Lejana pays only for a direct hit', () => {
  for (const w of ['bazooka', 'grenade', 'scatter']) {
    const k = weaponOf(w), paintAt = d => { const m = flatMatch(); const o = center(m.capys[3]); explode(m, o.x - d, o.y, 0, w); return m.capys[3].paint; };
    assert.equal(paintAt(0), k.paint, `${w} direct`);
    const edge = reachOf(k, RULES.radius);
    assert.ok(paintAt(edge * .6) < k.paint && paintAt(edge * .6) > paintAt(edge * .95), `${w} falls off`);
    assert.equal(paintAt(edge + .05), 0, `${w} out of reach`);
  }
  const m = flatMatch(), rival = m.capys[3];
  explode(m, rival.x + 5, rival.y + .7, 0, 'sniper', rival.id);
  assert.equal(rival.paint, weaponOf('sniper').paint, 'struck directly: full paint even from where the slug stopped');
  const miss = flatMatch(); explode(miss, miss.capys[3].x - 1.5, 10.7, 0, 'sniper');
  assert.equal(miss.capys[3].paint, 0, 'a near miss leaves La Lejana\'s target clean');
});

test('shots per team: La Bazuca runs out, the picker refuses it, La Piñita never does', () => {
  const m = flatMatch(), c = me(m);
  assert.equal(c.weapon, FIRST_WEAPON);
  m.ammo[0].bazooka = 1;
  assert.ok(fire(m, .4)); assert.equal(ammoLeft(m, 0, 'bazooka'), 0); assert.equal(m.used.bazooka, 1);
  run(m, 12);   // flight, retreat, settle, the other team's turn
  m.turn.time = .01; run(m, RULES.settleMax + 1);
  const next = me(m);
  assert.equal(next.team, 0);
  assert.notEqual(next.weapon, 'bazooka');
  assert.equal(selectWeapon(m, 'bazooka'), false, 'no shots left: the picker refuses it');
  assert.equal(canUse(m, 0, 'bazooka'), false); assert.equal(canUse(m, 1, 'bazooka'), true, 'the other team keeps its own');
  // A capi still holding an empty weapon throws La Piñita instead.
  next.weapon = 'bazooka'; assert.ok(fire(m, .5)); assert.equal(m.shot.weapon, BASIC_WEAPON);
  assert.equal(ammoLeft(m, 0, 'grenade'), Infinity);
});

test('a capi keeps the weapon it picked into its next turn; picking is only for the capi aiming', () => {
  const m = flatMatch(), c = me(m);
  tickMatch(m, DT, { weapon: 'sniper' });
  assert.equal(c.weapon, 'sniper'); assert.equal(takeEvents(m).filter(e => e.type === 'weapon').length, 1);
  m.turn.time = .01; run(m, RULES.settleMax + 1);       // ours times out
  assert.equal(me(m).team, 1); assert.equal(selectWeapon(m, 'drill'), true); assert.equal(me(m).weapon, 'drill');
  m.turn.time = .01; run(m, RULES.settleMax + 1);
  m.turn.time = .01; run(m, RULES.settleMax + 1);
  m.turn.time = .01; run(m, RULES.settleMax + 1);
  m.turn.time = .01; run(m, RULES.settleMax + 1);
  m.turn.time = .01; run(m, RULES.settleMax + 1);       // back round to capi 0-0
  assert.equal(me(m).id, '0-0'); assert.equal(me(m).weapon, 'sniper');
  m.phase = 'flight'; assert.equal(selectWeapon(m, 'grenade'), false, 'not while a shell flies');
});

test('the same shots on the same seed dig and paint the same', () => {
  const play = () => {
    const m = createMatch({ seed: 777 });
    for (const w of WEAPON_IDS) {
      const c = me(m); selectWeapon(m, w); c.aim = .6;
      fire(m, .7); run(m, 9);
      if (m.phase === 'aim') { m.turn.time = .01; }
      run(m, RULES.settleMax + 1);
    }
    return { solid: solidCount(m), stain: m.mask.stain.reduce((a, b) => a + b, 0), paint: m.capys.map(c => c.paint), used: m.used };
  };
  assert.deepEqual(play(), play());
});

test('the bot weighs its weapons: La Bazuca for a good hit, La Lejana to finish, La Piñita when the rest are spent', () => {
  const m = flatMatch([[10, 14, 18], [42, 56, 62]]), capy = m.capys.find(c => c.id === '0-2');
  assert.equal(pickTarget(m, capy).weapon, 'bazooka', 'a clean hit, fresh rivals: La Bazuca');
  m.capys.find(c => c.id === '1-0').paint = 45;
  const finish = pickTarget(m, capy);
  assert.equal(finish.weapon, 'sniper', `an exposed rival La Lejana paints out (picked ${finish.weapon})`); assert.equal(finish.rival.id, '1-0');
  m.ammo[0] = { bazooka: 0, sniper: 0, drill: 3, scatter: 0 };
  const basic = pickTarget(m, capy);
  assert.ok(basic.feasible && basic.weapon === 'grenade', `with only La Piñita and La Licuadora left: ${basic.weapon}`);
});

test('the bot fires El Trueno into a close group and bounces La Piñita behind cover', () => {
  const m = flatMatch([[10, 14, 18], [31, 33.5, 62]]), capy = m.capys.find(c => c.id === '0-2');
  m.ammo[0].bazooka = 0;
  assert.equal(pickTarget(m, capy).weapon, 'scatter', 'two rivals side by side, close');
  // A rival tucked under a thick roof that opens away from us: only a bounce gets in.
  const c = flatMatch([[10, 14, 18], [44, 80, 86]]), shooter = c.capys.find(k => k.id === '0-2');
  fillHeights(c.mask, x => x > 40 && x < 46 ? 17 : 10);
  carve(c.mask, 44.6, 11.6, 1.5); carve(c.mask, 46, 11.6, 1.5);
  c.capys.find(k => k.id === '1-0').y = 10;
  const pick = pickTarget(c, shooter);
  assert.ok(!pick.feasible || pick.weapon === 'grenade', `under cover: ${pick.feasible ? pick.weapon : 'nothing feasible'}`);
});

test('no shot at all: the bot bores towards the rival or lobs La Piñita, and never spends scarce shots on hopeless ones', () => {
  // Walled in by a hill close in front; the rival behind it.
  const m = flatMatch([[10, 14, 18], [40, 56, 62]]), capy = m.capys.find(c => c.id === '0-2');
  fillHeights(m.mask, x => x > 21 && x < 36 ? 40 : 10);
  const pick = pickTarget(m, capy);
  assert.equal(pick.feasible, false); assert.equal(pick.weapon, BASIC_WEAPON);
  assert.ok(drillPlan(m, capy, m.capys.find(c => c.id === '1-0')), 'a wall in the way: La Licuadora opens it');
  const bot = createBot({ team: 0, difficulty: 'experto', seed: 3 });
  m.turn.capy = capy.id; m.turn.time = 30;
  let shot = null;
  for (let t = 0; t < 30 && !shot; t += DT) { const input = bot.input(m); if (Number.isFinite(input.fire)) shot = input; tickMatch(m, DT, input); }
  assert.ok(shot && (shot.weapon === 'drill' || shot.weapon === BASIC_WEAPON), `fired ${shot?.weapon}`);
  assert.equal(ammoLeft(m, 0, 'bazooka'), 3, 'La Bazuca kept for a real shot');
  assert.equal(ammoLeft(m, 0, 'sniper'), 2);
  // Out of La Licuadora too: still a shot, La Piñita.
  const n = flatMatch([[10, 14, 18], [40, 56, 62]]), k = n.capys.find(c => c.id === '0-2');
  fillHeights(n.mask, x => x > 21 && x < 36 ? 40 : 10); n.ammo[0].drill = 0;
  assert.equal(drillPlan(n, k, n.capys.find(c => c.id === '1-0')), null);
});

test('the bot\'s search with every weapon stays light', () => {
  const m = createMatch({ seed: 2026 }), capy = me(m);
  const t0 = performance.now();
  for (let i = 0; i < 5; i++) pickTarget(m, capy);
  const each = (performance.now() - t0) / 5;
  assert.ok(each < 120, `pickTarget took ${each.toFixed(1)} ms`);
  const s = bestShot(m, capy, center(m.capys[3]), { weapon: 'grenade' });
  assert.ok(Number.isFinite(s.miss));
});
