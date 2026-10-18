import assert from 'node:assert/strict';
import { launch, base, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch(), pages = [], errors = [];
try {
  const code = `bululu-six-${Date.now()}`;
  for (let i = 0; i < 6; i++) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    await context.addInitScript(i => {
      localStorage.setItem('pana:name', `Pana ${i + 1}`);
      localStorage.setItem('pana:settings', JSON.stringify({ quality: 'baja', sound: false }));
      // Six independent network clocks run normally; draw only explicit proofs
      // instead of continuously rendering six islands in software WebGL.
      window.requestAnimationFrame = () => 0;
    }, i);
    const page = await context.newPage(); pages.push(page);
    page.on('pageerror', e => errors.push(e.message));
    if (i === 0 || i === 5) {
      await page.goto(`${base}/g/bululu/?debug&room=${code}&speed=3&mini=criollas`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    } else {
      // Four additional real connections exercise the exact shipped room class
      // without building redundant island renderers. Host and seat six run the
      // complete game; all twelve six-actor scenes have a separate replay suite.
      await page.goto(`${base}/api/health`);
      await page.evaluate(async ({ code, i }) => {
        const { BululuRoom } = await import('/g/bululu/network.js');
        const { loadAvatar } = await import('/engine/avatar.js');
        const room = new BululuRoom({ code, name: `Pana ${i + 1}`, avatar: loadAvatar(), events: {
          host() {}, members() {}, state(state) { window.players = state.players; }, choice() {}, frames() {},
        } });
        window.onlineState = () => ({ room, options: room.state?.options });
        await room.connect();
      }, { code, i });
    }
    await waitFor(page, () => window.onlineState?.().room?.connected, null, 120000);
  }
  const [host] = pages, sixth = pages[5];
  await waitFor(sixth, () => players.filter(p => p.human).length === 6);
  assert.equal(await sixth.evaluate(() => onlineState().me), 5);
  const choose = (page, id, value) => page.locator(`[data-room-option="${id}"][data-value="${value}"]`).click();
  await choose(host, 'board', 'muelle');
  await choose(host, 'minigames', 'calm');
  await host.locator('[data-room-option="rounds"][data-value="20"]').focus();
  await host.keyboard.press('Enter');
  await waitFor(sixth, () => onlineState().options.rounds === 20);
  assert.equal(await host.evaluate(() => onlineState().room.state.started), false, 'keyboard settings never start the match');
  await host.locator('#pana-room-more').click();
  for (const [id, value] of [['startCoins', 20], ['surprises', 'many'], ['stealing', false], ['finalBonus', false], ['dice', 1], ['cpu', 'fast']]) await choose(host, id, value);
  await host.locator('#pana-room-done').click();
  await waitFor(sixth, () => onlineState().options.cpu === 'fast' && onlineState().options.dice === 1);
  assert.deepEqual(await sixth.evaluate(() => onlineState().options), await host.evaluate(() => onlineState().options));
  assert.equal(await sixth.evaluate(() => board.tiles.length), 32);
  assert.deepEqual(await sixth.evaluate(() => players.map(p => p.coins)), Array(6).fill(20));
  await sixth.locator('#pana-room-more').click();
  assert.equal(await sixth.locator('[data-room-option="dice"][data-value="2"]').isDisabled(), true);
  await sixth.locator('#pana-room-done').click();
  await sixth.evaluate(() => changeOptions({ dice: 2 }));
  assert.equal(await sixth.evaluate(() => onlineState().options.dice), 1);
  const harbor = await host.evaluate(() => {
    const visited = new Set(), queue = [0];
    while (queue.length) { const i = queue.shift(); if (visited.has(i)) continue; visited.add(i); queue.push(...board.tiles[i].next); }
    renderer.shadowMap.enabled = false; renderer.render(boardScene, boardCam);
    return { visited: visited.size, finite: board.tiles.every(t => [t.x, t.y, t.z].every(Number.isFinite)), spots: players.map((p, i) => board.spot(0, i, 6)) };
  });
  assert.equal(harbor.visited, 32); assert(harbor.finite);
  assert.equal(new Set(harbor.spots.map(p => `${p.x},${p.z}`)).size, 6);
  console.log('PASS six real clients: host settings synchronize, guests cannot edit, Muelle has 32 reachable 3D tiles');

  await host.locator('#start').click();
  const rolled = new Set();
  for (let choices = 0; choices < 80; choices++) {
    await waitFor(host, () => onlineState().pendingChoice || minigame()?.state === 'run', null, 120000);
    if (await host.evaluate(() => minigame()?.state === 'run')) break;
    const prompt = await host.evaluate(() => ({ ...onlineState().pendingChoice, index: players.findIndex(p => p.seat === onlineState().pendingChoice.seat) }));
    assert(prompt.index >= 0 && prompt.index < 6);
    const owner = pages[prompt.index];
    await waitFor(owner, id => onlineState().room.prompt?.id === id || onlineState().room.state?.prompt?.id === id, prompt.id);
    if (prompt.options.some(o => o.label.includes('Tira'))) {
      rolled.add(prompt.index);
      assert.equal(await host.evaluate(() => dice.filter(d => d.mesh.visible).length), 1);
    }
    console.log('Answering', JSON.stringify({ prompt, sender: await owner.evaluate(() => onlineState().room.id) }));
    await owner.evaluate(id => onlineState().room.choose(id, 0), prompt.id);
    await waitFor(host, id => onlineState().pendingChoice?.id !== id, prompt.id);
  }
  assert.equal(rolled.size, 6, 'each human receives an authoritative board turn');
  await waitFor(sixth, () => minigame()?.state === 'run' && minigame()?.def.id === 'criollas');
  await sixth.evaluate(() => document.activeElement?.blur());
  await sixth.keyboard.press('Space');
  await waitFor(host, () => minigame()?.game.sim.players[5].left === 1);
  assert.deepEqual(await host.evaluate(() => minigame().game.sim.players.map(p => p.left)), [2, 2, 2, 2, 2, 1]);
  await waitFor(sixth, () => minigame()?.game.sim.players[5].left === 1);
  assert.equal(await host.evaluate(() => onlineState().checkpoint.options.dice), 1);
  console.log('PASS six board turns, one visible die, sixth-seat throw affects only that player and replays remotely');

  for (const page of pages.slice(1, 5)) await page.context().close();
  await host.context().close();
  const nextHost = sixth;
  await waitFor(nextHost, () => onlineState().room.isHost);
  assert.equal(await nextHost.evaluate(() => onlineState().options.board), 'muelle');
  assert.equal(await nextHost.evaluate(() => onlineState().options.startCoins), 20);
  assert.equal(await nextHost.evaluate(() => players.length), 6);
  assert.deepEqual(errors, []);
  console.log('PASS host handoff retains six seats and every room option');
} catch (error) {
  for (const page of pages.filter(p => !p.isClosed())) console.error(await page.evaluate(() => JSON.stringify({ me: onlineState().room.id, prompt: onlineState().pendingChoice, roomPrompt: onlineState().room.prompt, wirePrompt: onlineState().room.state?.prompt, mini: window.minigame?.()?.state, promptDOM: document.querySelector('#prompt')?.outerHTML })).catch(() => 'unavailable'));
  throw error;
} finally { await browser.close(); }
