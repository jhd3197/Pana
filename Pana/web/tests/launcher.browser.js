import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.PANA_TEST_URL || 'http://localhost:8470';
const browser = await chromium.launch({ headless: true });
const errors = [];
const output = 'Pana/web/qa';
fs.mkdirSync(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.locator('.game').last().waitFor();
  await page.locator('#feature-art img').evaluate(img => img.decode());
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('#feature-name').textContent(), 'Carreritas');
  assert.equal(await page.locator('#feature-art canvas').count(), 0);
  assert.ok((await page.locator('#feature').boundingBox()).height >= 500, 'initial hero gives the artwork more space');
  // Every tile shows its illustration, or its live card.js art while it has none (Trifulca).
  assert.equal(await page.locator('.game-art[src]').count() + await page.locator('canvas.game-art').count(), await page.locator('.game').count());
  await page.screenshot({ path: `${output}/launcher-desktop.png` });
  assert.equal(await page.locator('[data-row="Mesa"] .game').count(), await page.locator('[data-id="ludo"]').count() ? 7 : 6);
  assert.deepEqual(await page.locator('.game-row-title').evaluateAll(n => n.map(t => t.firstChild.textContent)), ['Carreras', 'Mesa', 'Fiesta', 'Aventura']);
  // A wheel over the banner scrolls the document; no small nested scroll trap.
  await page.mouse.move(900, 250);
  await page.mouse.wheel(0, 650);
  await page.waitForFunction(() => scrollY > 300);
  assert.equal(await page.locator('.games-wrap').evaluate(e => e.scrollTop), 0);
  await page.waitForFunction(() => document.body.classList.contains('hero-compact'));
  const heroBounds = await page.locator('#feature').boundingBox();
  assert.ok(heroBounds.y >= -1 && heroBounds.y <= 1, 'hero remains pinned');
  assert.ok(heroBounds.height < 250, 'hero leaves more room for browsing');
  const mesaY = await page.locator('[data-row="Mesa"] .game').evaluateAll(cards => cards.map(c => Math.round(c.getBoundingClientRect().top)));
  assert.equal(new Set(mesaY).size, 1, 'each category stays in one horizontal row');
  const mesa = page.locator('[data-row="Mesa"] .games');
  await page.locator('[data-row="Mesa"] .rail-arrow').last().click();
  await page.waitForFunction(() => document.querySelector('[data-row="Mesa"] .games').scrollLeft > 100);
  await mesa.evaluate(e => e.scrollTo({ left: 0, behavior: 'instant' }));
  await mesa.scrollIntoViewIfNeeded();
  // The sticky hero resizes while scrolling. Use the visible part of the rail,
  // not its center, which can sit behind the hero or below the viewport.
  const railPoint = async edge => {
    await page.waitForFunction(() => {
      const r = document.querySelector('[data-row="Mesa"] .games').getBoundingClientRect();
      const key = [r.top, r.bottom, scrollY, document.querySelector('#feature').getBoundingClientRect().bottom].join(':');
      const prev = window.__railLayout;
      window.__railLayout = { key, frames: prev?.key === key ? prev.frames + 1 : 0 };
      return window.__railLayout.frames >= 3;
    }, null, { polling: 'raf' });
    await page.waitForFunction(() => {
      const r = document.querySelector('[data-row="Mesa"] .games').getBoundingClientRect();
      const hero = document.querySelector('#feature').getBoundingClientRect();
      return Math.min(r.bottom, innerHeight) - Math.max(r.top, hero.bottom) > 30;
    });
    return mesa.evaluate((e, edge) => {
      const r = e.getBoundingClientRect(), top = Math.max(r.top, document.querySelector('#feature').getBoundingClientRect().bottom);
      return { x: edge ? r.right - 8 : r.left + r.width / 2, y: (top + Math.min(r.bottom, innerHeight)) / 2 };
    }, edge);
  };
  let point = await railPoint(false);
  await page.mouse.move(point.x, point.y);
  await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => document.querySelector('[data-row="Mesa"] .games').scrollLeft > 100);
  await mesa.evaluate(e => e.scrollTo({ left: 0, behavior: 'instant' }));
  point = await railPoint(true);
  await page.mouse.move(point.x, point.y);
  await page.waitForFunction(() => document.querySelector('[data-row="Mesa"] .games').scrollLeft > 60);
  await page.mouse.move(5, 5);
  await page.screenshot({ path: `${output}/launcher-browsing.png` });
  assert.equal(await page.locator('.game-row-count, #game-results').count(), 0);
  assert.equal(await page.locator('#game-search').isVisible(), false);
  await page.locator('#open-game-search').click();
  await page.locator('#game-search').fill('domino');
  assert.equal(await page.locator('.game:not([hidden])').count(), 1);
  assert.equal(await page.locator('.game:not([hidden])').getAttribute('data-id'), 'domino');
  await page.locator('#game-search').fill('zz-no-game');
  assert.equal(await page.locator('#game-empty').isVisible(), true);
  await page.locator('#close-game-search').click();
  assert.equal(await page.locator('#game-search').inputValue(), '');
  assert.equal(await page.locator('#open-game-search').evaluate(e => e === document.activeElement), true);
  assert.ok(await page.locator('.game:not([hidden])').count() > 12);
  assert.equal(await page.locator('#game-search').isVisible(), false);
  const cardCount = await page.locator('.game').count();
  for (let pass = 0; pass < 3; pass++) {
    const cycles = await page.locator('#games').getAttribute('data-cycles') || '0';
    await page.evaluate(() => {
      scrollTo(0, document.documentElement.scrollHeight);
      window.loopRow = document.getElementById('games').children[1];
      window.loopY = window.loopRow.getBoundingClientRect().top;
    });
    await page.waitForFunction(n => Number(document.getElementById('games').dataset.cycles) > Number(n), cycles);
    assert.ok(await page.evaluate(() => Math.abs(window.loopRow.getBoundingClientRect().top - window.loopY) < 2), 'cycling preserves the visible row position');
  }
  assert.equal(await page.locator('.game').count(), cardCount, 'loop does not duplicate cards');
  await page.evaluate(() => scrollBy(0, -320));
  await page.waitForFunction(() => document.getElementById('feature').getBoundingClientRect().height >= 500);
  assert.ok(Number(await page.locator('#games').getAttribute('data-cycles')) > 0, 'hero expands again after cycling');
  assert.equal(await page.locator('.games').first().evaluate(e => getComputedStyle(e).scrollbarWidth), 'none');
  assert.equal(await page.locator('.skip-link').getAttribute('data-pad-skip'), '');
  await page.locator('#favorite-featured').click();
  assert.equal(await page.locator('#favorite-featured').getAttribute('aria-pressed'), 'true');
  const favoriteId = await page.locator('#play-featured').getAttribute('data-game');
  await page.locator('#open-favorites').click();
  assert.equal(await page.locator('.game:not([hidden])').count(), 1);
  assert.equal(await page.locator('.game:not([hidden])').getAttribute('data-id'), favoriteId);
  await page.locator('#close-game-search').click();
  await page.locator('#catalog-settings').click();
  await page.locator('#pana-menu-dialog[open]').waitFor();
  await page.keyboard.press('Escape');
  const hoverCard = page.locator('[data-id="domino"]');
  assert.equal(await hoverCard.evaluate(e => getComputedStyle(e).height), '180px');
  await hoverCard.hover();
  await page.locator('[data-id="domino"].is-preview').waitFor();
  await page.waitForFunction(() => document.querySelector('[data-id="domino"]').getBoundingClientRect().width > 330);
  await page.waitForFunction(() => document.querySelector('[data-id="domino"]').getBoundingClientRect().height >= 239);
  assert.equal(await page.locator('#play-featured').getAttribute('data-game'), 'domino');
  for (const game of ['criollas', 'ludo', 'qqsmp']) {
    if (!await page.locator(`[data-id="${game}"]`).count()) continue;
    const card = page.locator(`[data-id="${game}"] img`);
    assert.match(await card.getAttribute('src'), new RegExp(`${game}-card\\.jpg$`));
    await card.scrollIntoViewIfNeeded();   // rows below the strip load their art lazily
    await card.evaluate(img => img.decode());
    await page.locator(`[data-id="${game}"] button`).click();
    assert.match(await page.locator('#feature-art img').getAttribute('src'), new RegExp(`${game}\\.jpg$`));
    await page.locator('#feature-art img').evaluate(img => img.decode());
  }
  await page.locator('[data-id="caida"] button').click();
  assert.equal(await page.locator('#feature-name').textContent(), 'Caída');
  await page.locator('#create-room').click();
  assert.match(await page.locator('#room-link').inputValue(), /\/g\/caida\/\?room=/);
  await page.locator('#room-copy').click();
  await page.getByRole('button', { name: 'Link copiado', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await page.locator('#room-link').inputValue());
  await page.locator('#room-dialog [data-close-dialog]').click();
  for (const game of ['tambor', 'stop', 'chapita', 'parapente', 'trifulca', 'bochinche', 'capis']) {
    if (!await page.locator(`[data-id="${game}"]`).count()) continue;
    const card = page.locator(`[data-id="${game}"] img`);
    assert.match(await card.getAttribute('src'), new RegExp(`${game}-card\\.jpg$`));
    await card.scrollIntoViewIfNeeded();   // rows below the strip load their art lazily
    await card.evaluate(img => img.decode());
    await page.locator(`[data-id="${game}"] button`).click();
    assert.match(await page.locator('#feature-art img').getAttribute('src'), new RegExp(`${game}\\.jpg$`));
    await page.locator('#feature-art img').evaluate(img => img.decode());
  }
  await page.locator('[data-id="pintura"] button').click();
  assert.equal(await page.locator('#feature-name').textContent(), 'Pepazo');
  // A controller: the d-pad walks the rows, the banner follows, A plays.
  await page.evaluate(() => {
    window.__pad = { connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.__pad];
    dispatchEvent(new Event('gamepadconnected'));
  });
  const press = async i => {
    for (const on of [true, false]) {
      await page.evaluate(([i, on]) => { window.__pad.buttons[i] = { pressed: on, value: on ? 1 : 0 }; }, [i, on]);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    }
  };
  await page.locator('[data-row="Carreras"] .game-pick').first().focus();
  // Focusing a recycled row scrolls it into view; wait for the loop to place
  // its following row before asking the controller to move down into it.
  await page.waitForFunction(() => document.querySelector('[data-row="Mesa"]').getBoundingClientRect().top > document.querySelector('[data-row="Carreras"]').getBoundingClientRect().top);
  await press(13);   // down from the first grid row to Mesa
  assert.equal(await page.evaluate(() => document.activeElement.closest('[data-row]')?.dataset.row), 'Mesa');
  const padGame = await page.evaluate(() => document.activeElement.closest('.game').dataset.id);
  await page.waitForFunction(id => document.querySelector(`[data-id="${id}"]`).getBoundingClientRect().height >= 239, padGame);
  await page.evaluate(() => document.activeElement.closest('.game').dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })));
  assert.equal(await page.evaluate(() => document.activeElement.closest('.game').classList.contains('is-preview')), true, 'mouse leave cannot collapse controller preview');
  await page.evaluate(() => {
    const pick = document.activeElement;
    pick.closest('.game').classList.remove('is-preview');
    pick.classList.remove('pana-pad-focus');
    pick.classList.add('pana-pad-focus');
  });
  await page.waitForFunction(() => document.activeElement.closest('.game').classList.contains('is-preview'));
  assert.equal(await page.evaluate(() => document.querySelector('.game-pick[aria-pressed="true"]').closest('.game').dataset.id), padGame);
  await page.evaluate(() => document.addEventListener('pana:launch', e => { e.preventDefault(); window.padIntent = e.detail; }, { once: true }));
  await press(0);
  assert.equal(await page.evaluate(() => window.padIntent.game), padGame);
  await press(9);   // the menu button (☰) opens Ajustes, B closes it
  await page.locator('#pana-menu-dialog[open]').waitFor();
  await press(1);
  await page.waitForFunction(() => !document.querySelector('#pana-menu-dialog[open]'));
  for (const tile of ['open-game-search', 'open-favorites']) {
    await page.locator('#' + tile).focus();
    await press(0);
    await page.locator('#game-search-panel').waitFor({ state: 'visible' });
    await press(1);
    await page.locator('#game-search-panel').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement.id), tile, 'B returns to the originating tile');
  }
  await page.locator('#catalog-settings').focus();
  await press(0);
  await page.locator('#pana-menu-dialog[open]').waitFor();
  await press(1);
  await page.waitForFunction(() => !document.querySelector('#pana-menu-dialog[open]'));
  await page.evaluate(() => { navigator.getGamepads = () => []; });
  await page.locator('[data-id="pintura"] button').click();
  await page.locator('#open-settings').click();
  await page.locator('#pana-menu-dialog[open]').waitFor();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#feature-art img').evaluate(img => img.decode());
  await page.screenshot({ path: `${output}/launcher-mobile.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#join-code').click();
  await page.locator('#room-code').fill('launcher-qa');
  // Verify the hosting hook can prevent every room-code launch before navigation.
  await page.evaluate(() => document.addEventListener('pana:launch', e => { e.preventDefault(); window.intent = e.detail; }, { once: true }));
  await page.locator('#code-form button').click();
  assert.equal(await page.evaluate(() => window.intent.game), 'pintura');
  assert.match(await page.evaluate(() => window.intent.url), /room=launcher-qa/);
  assert.deepEqual(errors, []);
  const duplicates = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await duplicates.route('**/api/games?*', async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.games.find(g => g.id === 'carreritas').featured = 1;
    await route.fulfill({ response, json: body });
  });
  await duplicates.goto(base);
  const repeated = duplicates.locator('[data-id="carreritas"] .game-pick');
  await repeated.last().waitFor();
  assert.equal(await repeated.count(), 2);
  for (const row of ['Carreras', 'Destacados']) {
    const card = duplicates.locator(`[data-row="${row}"] [data-id="carreritas"]`);
    await card.locator('.game-pick').focus();
    await card.locator('.game-pick[aria-pressed="true"]').waitFor();
    assert.equal(await duplicates.locator('.game-pick[aria-pressed="true"]').count(), 1);
    assert.equal(await card.locator('.game-pick').getAttribute('aria-pressed'), 'true');
  }
  await duplicates.close();
  console.log('Launcher: artwork, categories, names, private/code rooms, settings, mobile and hosting hook passed.');
} finally { await browser.close(); }
