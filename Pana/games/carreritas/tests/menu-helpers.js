// Carreritas opens on the shared lobby (engine/game-entry.js). The host's
// ¡Arrancar! takes the room to Copa and Taller; a guest follows the host.
const prepared = page => page.waitForFunction(() => window.PANA_PREPARED && document.getElementById('pana-lobby-ready')?.disabled === false
  && !document.querySelector('.pk-cover:not(.is-done)'), null, { timeout: 120000 });

export async function leaveLobby(page) {
  await prepared(page);
  // The lobby holds ¡Arrancar! until every pana in the room has loaded: keep pressing.
  for (let tries = 0; tries < 120 && await page.locator('#pana-lobby-shell').isVisible(); tries++) {
    if (!await page.locator('#start').isDisabled()) await page.locator('#start').click();
    await page.waitForTimeout(500);
  }
  await page.locator('#pana-lobby-shell').waitFor({ state: 'hidden', timeout: 5000 });
}

// Atrás on Copa takes the room (or a lone pana) back to the lobby.
export async function backToLobby(page) {
  await prepared(page);
  if (await page.locator('#pana-lobby-shell').isVisible()) return;
  await menuStep(page, 'track');
  await page.locator('#menu-back').click();
  await page.locator('#pana-lobby-shell').waitFor();
}

// Drive the same visible step buttons that players use; never force hidden controls.
export async function menuStep(page, step) {
  await page.locator('.menu-flow').waitFor();
  await leaveLobby(page);
  if (await page.locator('#garage').getAttribute('data-menu-step') !== step) {
    await page.locator(step === 'car' ? '#menu-next' : '#taller-pistas').click();
  }
}

// Race options are lobby settings; split screen and mirror are choice rows
// there, so "#split" and "#mirror" pick the other choice of their row.
const LOBBY = /difficulty|data-laps|#laps-pick|#lobby-|#go-online/;
export async function menuClick(page, selector) {
  const row = { '#split': '#lobby-split', '#mirror': '#lobby-mirror' }[selector];
  if (row) selector = `${row} [aria-pressed="false"]`;
  if (LOBBY.test(selector)) {
    await backToLobby(page);
    await page.locator(selector).first().click();
    return;
  }
  const step = /data-mode|#mode-pick|#t-next|#t-prev|data-circuit/.test(selector) ? 'track' : 'car';
  await menuStep(page, step);
  const mode = selector.match(/data-mode=["']?(race|battle|pana|aventura|agua)/)?.[1];
  if (mode) {
    await page.locator(`button[data-format="${['race','battle'].includes(mode) ? mode : 'cups'}"]`).click();
    if (['race','battle'].includes(mode)) return;
  }
  await page.locator(selector).click();
}

// Select through the visible Garaje drawer, then return to the complete build.
export async function chooseCar(page, index) {
  await menuStep(page, 'car');
  await page.locator('#loadout-garage').click();
  const choice = page.locator('#shop-car .shop-item').nth(index);
  // The drawer remembers its last page; returning to an earlier car must
  // paginate backward too (the item suite visits every car, then selects 0).
  while (!await choice.isVisible()) {
    const first = await page.locator('#shop-car .shop-item').evaluateAll(items => items.findIndex(item => !item.hidden));
    const button = page.locator(`[data-page=${index < first ? 'previous' : 'next'}]`);
    if (await button.isDisabled()) throw new Error(`Car ${index} is not reachable from the current page`);
    await button.click();
  }
  await choice.click();
  await page.locator('#loadout-back').click();
}

// Results lead through the receipt ceremony before the chosen destination.
export async function resultClick(page, selector) {
  await page.locator(selector).click();
  if(await page.locator('#cash-in').isVisible()) {
    await page.locator('#cash-done').click();
    if(await page.locator('#cash-in').isVisible())await page.locator('#cash-done').click();
  }
}
