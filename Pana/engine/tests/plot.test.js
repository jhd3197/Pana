import test from 'node:test';
import assert from 'node:assert/strict';
import { cropState, scaled, HOUR, MINUTE, WILT } from '../plot/growth.js';
import { rotatingStock, rotationEndsAt, rotationWindow } from '../plot/rotation.js';
import { createPlot, plotKey } from '../plot/plot.js';
import { createMangoWallet } from '../mangos.js';
import { createProgress } from '../progress.js';

const memoryStorage = () => { const values = new Map(); return { values, getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }; };

const CROPS = [
  { id: 'free', growMs: 5 * MINUTE, seedCost: 0, mangos: 2, xp: 4, free: true },
  { id: 'a', growMs: HOUR, seedCost: 3, mangos: 10, xp: 20 },
  { id: 'b', growMs: 2 * HOUR, seedCost: 5, mangos: 20, xp: 30 },
  { id: 'c', growMs: 3 * HOUR, seedCost: 7, mangos: 30, xp: 40 },
  { id: 'd', growMs: 4 * HOUR, seedCost: 9, mangos: 40, xp: 50 },
];
const TIERS = [{ cost: 0, beds: 2 }, { cost: 10, beds: 3 }, { cost: 30, beds: 4 }];
const RANKS = [{ id: 'one', xp: 0, unlocks: [] }, { id: 'two', xp: 4, unlocks: ['decor:bench'] }];
const DECOR = [{ id: 'bench', unlock: 'decor:bench' }, { id: 'flag', unlock: 'decor:flag' }];
const SHOP = { salt: 'test', period: 4 * HOUR, size: 2, qty: [2, 2] };
const START = 1_800_000_000_000;

function setup({ mangos = 0, at = START, storage = memoryStorage() } = {}) {
  const clock = { at };
  const wallet = createMangoWallet(storage);
  if (mangos) wallet.credit(mangos, 'test:start');
  const progress = createProgress({ game: 'plot-test', ranks: RANKS, storage });
  const make = () => createPlot({ game: 'plot-test', crops: CROPS, tiers: TIERS, decor: DECOR, shop: SHOP, wallet, progress, storage, now: () => clock.at });
  return { clock, wallet, progress, storage, make, plot: make() };
}

// ---------- growth ----------
test('a crop moves through its stages on the clock alone', () => {
  const crop = { growMs: 100 * MINUTE }, at = minutes => cropState({ at: START }, crop, START + minutes * MINUTE);
  assert.equal(at(0).stage, 'seed');
  assert.equal(at(20).stage, 'sprout');
  assert.equal(at(60).stage, 'young');
  assert.equal(at(99).ready, false);
  assert.equal(at(99).remaining, MINUTE);
  assert.equal(at(100).stage, 'ready');
  assert.equal(at(100).growth, 1);
});

test('neglect is gentle: wilting starts late, stops at the floor and never kills', () => {
  const crop = { growMs: HOUR }, at = hours => cropState({ at: START }, crop, START + hours * HOUR);
  assert.equal(at(1 + 24).stage, 'ready', 'a whole day waiting costs nothing');
  assert.equal(at(1 + 24).share, 1);
  assert.equal(at(1 + 36).stage, 'wilted');
  assert.equal(at(1 + 36).share, .75);
  assert.equal(at(1 + 48).share, WILT.floor);
  assert.equal(at(24 * 365).share, WILT.floor, 'a year away pays the same as two days');
  assert.equal(at(24 * 365).ready, true);
});

test('a clock set back never gives a negative age', () => {
  const state = cropState({ at: START }, { growMs: HOUR }, START - 5 * HOUR);
  assert.equal(state.growth, 0);
  assert.equal(state.stage, 'seed');
  assert.equal(state.remaining, HOUR);
});

test('a wilted harvest still pays something', () => {
  assert.equal(scaled(10, .5), 5);
  assert.equal(scaled(1, .5), 1);
  assert.equal(scaled(0, .5), 0);
});

// ---------- rotation ----------
const ITEMS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => ({ id }));
const ids = shelf => shelf.map(entry => entry.item.id);

test('one window, one shelf: the same for everyone and for any catalog order', () => {
  const window = rotationWindow(START, SHOP.period), options = { salt: 'test', window, size: 3, qty: [2, 4] };
  assert.deepEqual(rotatingStock(ITEMS, options), rotatingStock(ITEMS, options));
  assert.deepEqual(rotatingStock([...ITEMS].reverse(), options).map(e => [e.item.id, e.qty]), rotatingStock(ITEMS, options).map(e => [e.item.id, e.qty]));
  assert.notDeepEqual(ids(rotatingStock(ITEMS, options)), ids(rotatingStock(ITEMS, { ...options, salt: 'other' })));
});

test('this exact shelf stays: a change here reshuffles every player', () => {
  const shelf = rotatingStock(ITEMS, { salt: 'test', window: 100, size: 3, qty: [2, 4] });
  assert.deepEqual(shelf.map(e => [e.item.id, e.qty]), [['e', 2], ['f', 3], ['d', 2]]);
});

test('the window is epoch time and turns over exactly on the period', () => {
  const period = 4 * HOUR, start = 450_000 * period;
  assert.equal(rotationWindow(start, period), 450_000);
  assert.equal(rotationWindow(start + period - 1, period), 450_000);
  assert.equal(rotationWindow(start + period, period), 450_001);
  assert.equal(rotationEndsAt(start + 5, period), start + period);
});

test('an item comes back only after the rest had their turn', () => {
  for (const first of [0, 7, 1000, 450_123]) {
    const seen = [];
    for (let window = first; window < first + 2; window++) seen.push(...ids(rotatingStock(ITEMS, { salt: 'test', window, size: 3 })));
    assert.equal(new Set(ids(rotatingStock(ITEMS, { salt: 'test', window: first, size: 3 }))).size, 3, 'no item twice on a shelf');
    const overlap = seen.length - new Set(seen).size;
    assert.ok(overlap <= 1, `windows ${first}.. share ${overlap} items: ${seen}`);
  }
});

test('a shelf bigger than the catalog just shows the catalog', () => {
  assert.equal(rotatingStock(ITEMS.slice(0, 2), { salt: 'test', window: 3, size: 5 }).length, 2);
  assert.deepEqual(rotatingStock([], { salt: 'test', window: 3, size: 5 }), []);
});

// ---------- the plot ----------
test('a new plot starts at the first tier, empty, and survives a reload', () => {
  const { plot, make, storage, clock } = setup();
  const fresh = plot.view();
  assert.equal(fresh.tier, 1);
  assert.deepEqual(fresh.beds, [null, null]);
  assert.equal(plot.plant(0, 'free').ok, true);
  assert.ok(storage.values.has(plotKey('plot-test')));
  clock.at += MINUTE;
  assert.equal(make().view().beds[0].crop, 'free', 'a reload finds the plant');
});

test('crops grow while nothing is running: only the timestamp matters', () => {
  const { plot, make, clock } = setup();
  plot.plant(0, 'free');
  assert.equal(plot.harvest(0).reason, 'growing');
  clock.at += 5 * MINUTE;                                  // the page was closed all this time
  const later = make();
  assert.equal(later.view().beds[0].stage, 'ready');
  assert.equal(later.harvest(0).ok, true);
});

test('a harvest pays mangos and XP once and clears the bed', () => {
  const { plot, wallet, progress, clock } = setup();
  plot.plant(0, 'free');
  clock.at += 5 * MINUTE;
  const paid = plot.harvest(0);
  assert.deepEqual([paid.mangos, paid.xp], [2, 4]);
  assert.equal(wallet.peek(), 2);
  assert.equal(progress.xp(), 4);
  assert.equal(progress.dives(), 0, 'a harvest is not a dive');
  assert.equal(plot.view().beds[0], null);
  assert.equal(plot.harvest(0).reason, 'empty');
  assert.equal(wallet.peek(), 2);
  assert.equal(plot.view().harvests, 1);
});

test('a harvest after a crash pays nothing twice: the receipt comes from the plant', () => {
  const { plot, wallet, storage, clock } = setup();
  plot.plant(0, 'free');
  const saved = storage.values.get(plotKey('plot-test'));
  clock.at += 5 * MINUTE;
  plot.harvest(0);
  storage.values.set(plotKey('plot-test'), saved);         // the bed's clearing never reached storage
  plot.harvest(0);
  assert.equal(wallet.peek(), 2);
});

test('a second device reusing a bed id sends its own wallet receipt', () => {
  const harvestAt = at => {
    const receipts = [], clock = { at };
    const plot = createPlot({ game: 'plot-test', crops: CROPS, tiers: TIERS, wallet: { credit: (n, receipt) => receipts.push(receipt) }, storage: memoryStorage(), now: () => clock.at });
    plot.plant(0, 'free');
    clock.at += 5 * MINUTE;
    plot.harvest(0);
    return receipts;
  };
  const [first] = harvestAt(START), [second] = harvestAt(START + MINUTE);
  assert.ok(first && second);
  assert.notEqual(first, second);
});

test('a wilted crop pays half and is still harvested', () => {
  const { plot, wallet, clock } = setup();
  plot.plant(0, 'free');
  clock.at += 5 * MINUTE + 60 * HOUR;
  const paid = plot.harvest(0);
  assert.equal(paid.wilted, true);
  assert.equal(paid.mangos, 1);
  assert.equal(wallet.peek(), 1);
});

test('harvest all takes only the ready beds and adds them up', () => {
  const { plot, wallet, clock } = setup({ mangos: 30 });
  const shelf = plot.stock();
  assert.ok(plot.buy(shelf.items[0].id).ok);
  plot.plant(0, 'free'); plot.plant(1, shelf.items[0].id);
  clock.at += 5 * MINUTE;
  const before = wallet.peek(), all = plot.harvestAll();
  assert.equal(all.count, 1);
  assert.equal(all.mangos, 2);
  assert.equal(wallet.peek(), before + 2);
  assert.equal(plot.view().beds[0], null);
  assert.ok(plot.view().beds[1], 'the growing one stays');
  assert.equal(plot.harvestAll().count, 0);
});

test('a seed is used up by planting; the free crop needs none', () => {
  const { plot } = setup({ mangos: 30 });
  assert.equal(plot.plant(0, 'nope').reason, 'crop');
  assert.equal(plot.plant(9, 'free').reason, 'bed');
  const id = plot.stock().items[0].id;
  assert.equal(plot.plant(0, id).reason, 'seed');
  plot.buy(id);
  assert.equal(plot.view().seeds[id], 1);
  assert.equal(plot.plant(0, id).ok, true);
  assert.equal(plot.view().seeds[id], undefined);
  assert.equal(plot.plant(0, 'free').reason, 'busy');
});

test('the house upgrades through its tiers for mangos and adds beds', () => {
  const { plot, wallet } = setup({ mangos: 45 });
  plot.plant(0, 'free');
  const planted = plot.view().beds[0];
  assert.equal(plot.upgrade().ok, true);
  assert.equal(plot.view().tier, 2);
  assert.equal(plot.view().beds.length, 3);
  assert.equal(plot.view().beds[0].id, planted.id, 'what was planted stays planted');
  assert.equal(wallet.peek(), 35);
  assert.equal(plot.upgrade().ok, true);
  assert.equal(wallet.peek(), 5);
  assert.equal(plot.upgrade().reason, 'top');
  assert.equal(plot.view().next, null);
  assert.equal(wallet.peek(), 5);
});

test('no mangos, no upgrade and no change', () => {
  const { plot, wallet } = setup({ mangos: 9 });
  assert.equal(plot.upgrade().reason, 'mangos');
  assert.equal(plot.view().tier, 1);
  assert.equal(wallet.peek(), 9);
});

test('the shelf is the same for two players and limits each one per window', () => {
  const one = setup({ mangos: 100 }), two = setup({ mangos: 100 });
  const shelf = one.plot.stock();
  assert.deepEqual(two.plot.stock().items.map(i => [i.id, i.qty]), shelf.items.map(i => [i.id, i.qty]));
  assert.ok(!shelf.items.some(item => item.crop.free), 'the free crop is never for sale');
  const id = shelf.items[0].id;
  assert.equal(one.plot.buy(id).left, 1);
  assert.equal(one.plot.buy(id).left, 0);
  assert.equal(one.plot.buy(id).reason, 'soldout');
  assert.equal(one.plot.view().seeds[id], 2);
  assert.equal(two.plot.stock().items[0].left, 2, "one player's purchases are theirs");
});

test('the next window restocks, with a different shelf', () => {
  const { plot, clock } = setup({ mangos: 100 });
  const first = plot.stock(), id = first.items[0].id;
  plot.buy(id);
  clock.at = first.endsAt;
  const next = plot.stock();
  assert.notEqual(next.window, first.window);
  assert.ok(next.items.every(item => item.left === item.qty), 'nothing carries over');
  assert.notDeepEqual(next.items.map(i => i.id), first.items.map(i => i.id));
  assert.equal(plot.buy('nope').reason, 'stock');
});

test('a decoration needs its rank, then goes out and comes back in', () => {
  const { plot, clock } = setup();
  assert.equal(plot.isDecorUnlocked('bench'), false);
  assert.equal(plot.setDecor('bench', true).reason, 'locked');
  plot.plant(0, 'free');
  clock.at += 5 * MINUTE;
  const paid = plot.harvest(0);
  assert.equal(paid.rankedUp, true);
  assert.deepEqual(paid.newUnlocks, ['decor:bench']);
  assert.equal(plot.setDecor('bench', true).ok, true);
  assert.deepEqual(plot.view().decor, ['bench']);
  assert.equal(plot.setDecor('bench', true).ok, true);
  assert.deepEqual(plot.view().decor, ['bench'], 'twice is still one');
  assert.equal(plot.setDecor('bench', false).ok, true);
  assert.deepEqual(plot.view().decor, []);
  assert.equal(plot.setDecor('flag', true).reason, 'locked');
  assert.equal(plot.setDecor('nope', true).reason, 'decor');
});

test('a broken save is cleaned, not trusted', () => {
  const storage = memoryStorage();
  storage.values.set(plotKey('plot-test'), JSON.stringify({
    tier: 99, sown: -4, beds: [{ id: 'x', crop: 'gone', at: 1 }, { id: 'y', crop: 'a', at: 'soon' }, 'junk', { id: 'z', crop: 'a', at: START }],
    seeds: { a: 2.9, b: -1, gone: 5 }, decor: ['bench', 'bench', 'gone'], shop: { window: 'x', bought: { a: -2 } },
  }));
  const view = setup({ storage }).plot.view();
  assert.equal(view.tier, TIERS.length);
  assert.equal(view.beds.length, TIERS.at(-1).beds);
  assert.deepEqual(view.beds.slice(0, 3), [null, null, null]);
  assert.equal(view.beds[3].id, 'z');
  assert.deepEqual(view.seeds, { a: 2 });
  assert.deepEqual(view.decor, ['bench']);

  const open = setup({ storage }).plot;
  open.view();
  storage.values.set(plotKey('plot-test'), 'not json');
  assert.equal(open.view().tier, TIERS.length, 'an open page keeps what it last read');
  assert.equal(setup({ storage }).plot.view().tier, 1, 'a new page starts over rather than crash');
});

test('storage that fails keeps the plot going in memory', () => {
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const clock = { at: START };
  const plot = createPlot({ game: 'plot-test', crops: CROPS, tiers: TIERS, storage: broken, now: () => clock.at });
  assert.equal(plot.plant(0, 'free').ok, true);
  assert.equal(plot.view().beds[0].crop, 'free');
  clock.at += 5 * MINUTE;
  assert.equal(plot.harvest(0).ok, true);
});

test('a change tells who is listening, until they stop', () => {
  const { plot } = setup();
  let calls = 0;
  const off = plot.onChange(() => calls++);
  plot.plant(0, 'free');
  assert.equal(calls, 1);
  off();
  plot.plant(1, 'free');
  assert.equal(calls, 1);
});

// ---------- the wallet's new half ----------
test('spending takes what is there, or nothing', () => {
  const storage = memoryStorage(), wallet = createMangoWallet(storage);
  assert.equal(wallet.peek(), 0);
  assert.equal(wallet.spend(5), false);
  wallet.credit(10, 'r1');
  assert.equal(wallet.spend(4), true);
  assert.equal(wallet.peek(), 6);
  assert.equal(wallet.spend(7), false);
  assert.equal(createMangoWallet(storage).peek(), 6);
});

test('a plot that reads and spends leaves the old Carreritas coins waiting', () => {
  const storage = memoryStorage(), wallet = createMangoWallet(storage);
  wallet.peek();
  wallet.credit(10, 'conuco:b1');
  wallet.spend(4);
  assert.equal(createMangoWallet(storage).balance(140), 146, 'the hand-over still lands');
  assert.equal(createMangoWallet(storage).balance(140), 146, 'once');
});
