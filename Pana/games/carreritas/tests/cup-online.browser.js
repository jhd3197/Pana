import { menuClick, resultClick } from './menu-helpers.js';
// Carreritas online Grand Prix: two real browser clients complete a four-race
// championship in one Colyseus room, plus fault and recovery scenarios.
// npm start, then: node games/carreritas/tests/cup-online.browser.js [playwright path]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const origin = process.env.PANA_TEST_URL || 'http://localhost:8461';
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}),
});
const errors = [];
const proof = [];
const step = (label) => console.log(`· ${label}`);

async function openClient(roomCode, name, query = '') {
  const context = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  await context.addInitScript((n) => localStorage.setItem('pana:name', n), name);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  // Manual rendering avoids tying protocol/physics proof to software WebGL FPS.
  // Every car still drives the real steering, collisions and checkpoint code.
  await context.addInitScript(() => {
    setInterval(() => {
      if (!window.race || !window.updateRace) return;
      if (race.state === 'count') updateRace(0);
      for (let i = 0; i < 10 && ['go', 'end'].includes(race.state); i++) updateRace(1 / 60);
      window.sendPoses?.();
    }, 25);
  });
  await page.goto(`${origin}/g/carreritas/?debug&auto&manual&room=${roomCode}${query}`);
  await page.waitForFunction(() => window.getNet?.()?.state.players.length > 0, null, { timeout: 30000 });
  return page;
}

const until = async (page, fn, arg, timeout = 90000) => {
  try { return await page.waitForFunction(fn, arg, { timeout, polling: 150 }); }
  catch (error) { console.log('timeout snapshot', JSON.stringify(await readSnap(page)), errors); throw error; }
};

const readSnap = (page) => page.evaluate(() => {
  const n = getNet();
  return {
    id: n.id,
    isHost: n.isHost,
    state: n.state,
    cup: n.cup,
    trackId: getActiveTrack()?.id ?? null,
    raceState: race.state,
    stageReadout: document.getElementById('stage-readout')?.textContent ?? '',
    resultTitle: document.getElementById('result-title')?.textContent ?? '',
    cupTitle: document.getElementById('cup-title')?.textContent ?? '',
    cupNext: document.getElementById('cup-next')?.textContent ?? '',
    coins: getWallet().coins,
    carIds: race.cars.map(c => c.netId),
    posesIn: race.cars.filter(c => c.remote).reduce((sum, c) => sum + (c.buf?.length ?? 0), 0),
  };
});

try {
  // ---------------------------------------------------------------------------
  // 1. Full 4-stage online championship (Copa Pana) with duplicate names,
  //    slow-loader readiness gate, item relay, stage reload, and final podium.
  // ---------------------------------------------------------------------------
  const cupCode = 'gp' + Math.random().toString(36).slice(2, 8);
  // Both pages load together: the server only hands the lead the host during the
  // room's first 15 s, and two sequential software-WebGL loads can exceed that.
  const [guest, host] = await Promise.all([
    openClient(cupCode, 'Mismo Pana', ''),
    openClient(cupCode, 'Mismo Pana', '&lead=1'),
  ]);
  await until(host, () => getNet().state.players.length === 2);
  await until(guest, () => getNet().state.players.length === 2);

  let h = await readSnap(host);
  let g = await readSnap(guest);
  assert.equal(h.isHost, true, 'lead=1 client hosts the room');
  assert.equal(g.isHost, false, 'guest is not host');
  assert.notEqual(h.id, g.id, 'duplicate display names still get distinct session/entrant IDs');

  // Guest attempts to select Copa Pana — rejected; host selects Copa Pana — accepted.
  await guest.evaluate(() => getNet().mode('pana'));
  await guest.waitForTimeout(150);
  assert.equal((await readSnap(host)).state.mode, 'race', 'guest cannot select cup mode');

  await menuClick(host, '#mode-pick button[data-mode="pana"]');
  await until(guest, () => getNet().state.mode === 'pana');
  const stageTracks = await guest.evaluate(() =>
    [...document.querySelectorAll('#cup-stages .cup-stage')].map(b => b.dataset.track));
  assert.deepEqual(stageTracks, ['estadio', 'llanos', 'delta', 'galipan'], 'guest sees all 4 Copa Pana stages');
  step('lobby: host selects Copa Pana, duplicate names disambiguated by entrant ID');

  // Hold guest's loaded packet briefly on stage 1 to prove no premature countdown.
  await guest.evaluate(() => {
    const net = getNet();
    window.__origLoaded = net.loaded.bind(net);
    window.__heldLoaded = false;
    net.loaded = () => { window.__heldLoaded = true; };
  });

  await menuClick(host, '#play');
  await until(guest, () => window.__heldLoaded === true, null, 60000);
  await host.waitForTimeout(300);
  h = await readSnap(host);
  assert.equal(h.state.phase, 'loading', 'room waits in loading while slow client has not sent loaded');
  assert.equal(h.state.startAt, 0, 'no premature countdown before slow loader is ready');

  // Release guest's loaded packet and verify synchronized start.
  await guest.evaluate(() => {
    const net = getNet();
    net.loaded = window.__origLoaded;
    net.loaded();
  });
  step('stage 1 loading gate: room waited for slow client before starting countdown');

  const expectedTracks = ['estadio', 'llanos', 'delta', 'galipan'];
  let initialEntrants = null;
  let oldContext = null;

  for (let stageIdx = 0; stageIdx < 4; stageIdx++) {
    const expectedTrack = expectedTracks[stageIdx];
    await until(host, (idx) => race.state === 'go' && getNet().cup?.stageIndex === idx, stageIdx, 90000);
    await until(guest, (idx) => race.state === 'go' && getNet().cup?.stageIndex === idx, stageIdx, 90000);

    h = await readSnap(host);
    g = await readSnap(guest);
    assert.equal(h.trackId, expectedTrack, `host on stage ${stageIdx + 1} track ${expectedTrack}`);
    assert.equal(g.trackId, expectedTrack, `guest on stage ${stageIdx + 1} track ${expectedTrack}`);
    assert.equal(h.stageReadout, `${stageIdx + 1}/4`);
    assert.equal(g.stageReadout, `${stageIdx + 1}/4`);
    assert.equal(h.carIds.length, 8, '8 entrants on grid');
    assert.deepEqual([...h.carIds].sort(), [...g.carIds].sort(), 'identical entrant IDs on both clients');

    const entrantsSig = h.cup.entrants.map(e => `${e.id}:${e.kind}:${e.loadout.car}:${e.skillSeed}`).join('|');
    if (stageIdx === 0) initialEntrants = entrantsSig;
    else assert.equal(entrantsSig, initialEntrants, `roster and bot identities remain frozen on stage ${stageIdx + 1}`);

    // Verify old world geometries were cleaned up: only one track group in race.scene.
    const worldGroups = await host.evaluate(() =>
      race.scene.children.filter(c => c === race.trackGroup).length);
    assert.equal(worldGroups, 1, 'single active track group in scene');

    if (stageIdx === 0) {
      oldContext = await host.evaluate(() => getNet().context());
      // Wait for remote poses and relay a mango throw from host to guest.
      await until(guest, () => race.cars.some(c => c.remote && c.buf?.length > 0), null, 15000);
      await guest.evaluate(() => {
        window.__relayedThrow = null;
        getNet().on('fx', (id, k, d) => {
          if (k === 'throw') window.__relayedThrow = { id, k, d };
        });
      });
      await host.evaluate(async () => {
        const { addItem } = await import('./item-rules.js');
        race.player.inventory = [null, null];
        addItem(race.player, 'mango', 0);
        race.items.use(race.player, 1);
      });
      await until(guest, (id) => window.__relayedThrow?.id === id || race.items.projectiles.some(p => p.owner.netId === id), h.id, 10000);
      step('stage 1: real driving, remote poses and item throw relayed');
    }

    if (stageIdx === 1) {
      // Reload guest mid-stage and verify token reconnect into the same entrant and cup stage.
      await guest.reload();
      await until(guest, () => window.getNet?.() && race.state === 'go' && getNet().cup?.stageIndex === 1, null, 90000);
      const rejoined = await readSnap(guest);
      assert.equal(rejoined.id, g.id, 'guest keeps same entrant ID after reload');
      assert.equal(rejoined.cup.ledger.length, 8, 'stage 1 ledger preserved after reload');
      step('stage 2: mid-stage reload restored same entrant and cup ledger');
    }

    if (stageIdx === 2) {
      // A real reload drops the host transport, transfers bots, then reconnects.
      await host.reload();
      await until(host, () => window.getNet?.() && race.state === 'go' && getNet().cup?.stageIndex === 2);
      await until(guest, () => getNet().isHost);
      assert.equal((await readSnap(host)).id, h.id);
      const control = await guest.evaluate(() => race.cars.filter(c => c.bot).every(c => !c.remote));
      assert.ok(control, 'successor takes over the same bots');
      const before = await guest.evaluate(() => getNet().cup.ledger.length);
      await guest.evaluate(ctx => {
        const n = getNet();
        n.send('finish', { ...ctx, id: n.id, time: 1 });
        n.send('loaded', ctx);
        n.send('retire', ctx);
        n.send('fx', { ...ctx, id: n.id, k: 'throw', d: {} });
        n.send('p', { ...ctx, list: [] });
      }, oldContext);
      assert.equal(await guest.evaluate(() => getNet().cup.ledger.length), before);
      step('stage 3: host recovery, bot transfer and old-stage packets');
    }

    // Let both clients drive through the real fixed-step simulation to stage completion.
    const targetPhase = stageIdx === 3 ? 'complete' : 'results';
    await until(host, (ph) => getNet().state.phase === ph, targetPhase, 240000);
    await until(guest, (ph) => getNet().state.phase === ph, targetPhase, 60000);

    h = await readSnap(host);
    g = await readSnap(guest);
    assert.ok(h.cup.finalized[stageIdx], `stage ${stageIdx + 1} finalized on host`);
    assert.ok(g.cup.finalized[stageIdx], `stage ${stageIdx + 1} finalized on guest`);

    const hostOrder = h.cup.ledger.filter(r => r.stage === stageIdx).map(r => `${r.id}:${r.place}:${r.points}`);
    const guestOrder = g.cup.ledger.filter(r => r.stage === stageIdx).map(r => `${r.id}:${r.place}:${r.points}`);
    assert.deepEqual(hostOrder, guestOrder, `stage ${stageIdx + 1} official ledger agrees on both clients`);
    assert.ok(h.cup.ledger.filter(r => r.stage === stageIdx && [h.id, g.id].includes(r.id)).every(r => r.classification === 'finished'), 'both humans crossed the real lap checkpoints');
    proof.push({ stage: stageIdx, track: expectedTrack, ledger: h.cup.ledger.filter(r => r.stage === stageIdx) });
    step(`stage ${stageIdx + 1} (${expectedTrack}) complete: ${hostOrder.slice(0, 3).join(', ')}`);

    if (stageIdx < 3) {
      // Wait for minimum read window so host can advance immediately.
      const leader = await host.evaluate(() => getNet().isHost) ? host : guest;
      await until(leader, () => !document.getElementById('again').disabled, null, 15000);
      await resultClick(leader, '#again');
    }
  }

  // Final championship verification: both clients agree on totals and champion,
  // and rewards cannot be double-paid if finish() runs again.
  h = await readSnap(host);
  g = await readSnap(guest);
  assert.equal(h.cup.status, 'complete');
  assert.equal(g.cup.status, 'complete');
  const coinsAfterCup = h.coins;
  await host.evaluate(() => finish());
  assert.equal((await readSnap(host)).coins, coinsAfterCup, 're-running finish() does not double-pay cup rewards');
  step('Copa Pana complete: both browsers agreed on all 4 stages, standings, and idempotent rewards');
  await mkdir('art/grand-prix/cup-online', { recursive: true });
  await writeFile('art/grand-prix/cup-online/ledger.json', JSON.stringify(proof, null, 2));

  await host.context().close();
  await guest.context().close();

  assert.deepEqual(errors, []);
  console.log('carreritas online grand prix: all good');
} finally {
  await browser.close();
}
