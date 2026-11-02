// Gets any game from its lobby into real play, for suites that look at the
// HUD during a round (engine/tests/hud-layout.browser.js). Waits on state
// (the lobby closing, a game's phase, painted frames), never on the clock.
//
//   const page = await openGame(browser, game, { query: PLAY[game]?.query ?? 'debug', wait: false });
//   await enterPlay(page, game);
import { waitFor } from './browser-kit.js';

// Painted frames, for the HUD to settle after a phase change.
export const frames = (page, n = 30) => page.evaluate(n => new Promise(done => {
  const step = left => (left ? requestAnimationFrame(() => step(left - 1)) : done());
  step(n);
}), n);

const shown = (page, selector) => page.locator(selector).first().isVisible().catch(() => false);

// Per game: the query it opens with, the lobby button that starts a solo
// round (#start or #practice) and, where the game has a debug handle, the
// state that means a round is on.
export const PLAY = {
  billar: { query: 'debug', button: '#practice', ready: () => !['lobby', 'starter'].includes(billarDebug.room.state.phase) },
  bochinche: { query: 'debug', button: '#start' },
  bululu: { query: '', button: '#start', frames: 240 },
  caida: { query: 'debug', button: '#start', ready: () => !['lobby', 'starter'].includes(caidaDebug.room.state.phase) },
  capis: { query: 'debug', button: '#start' },
  carreritas: { query: 'debug&auto&track=estadio', carreritas: true },
  chapita: { query: 'debug', button: '#start' },
  cocina: { query: '', button: '#start' },
  criollas: { query: 'debug', button: '#start' },
  curiara: { query: 'debug', button: '#start' },
  domino: { query: 'debug', button: '#practice', ready: () => !['lobby', 'starter'].includes(dominoDebug.room.state.phase) },
  embuste: { query: 'debug', button: '#start', ready: () => embuste.room?.state?.phase === 'playing' || document.getElementById('hud')?.checkVisibility() },
  escondidas: { query: '', button: '#start' },
  galope: { query: 'debug', button: '#start' },
  lancha: { query: 'debug', button: '#start' },
  ludo: { query: 'debug', button: '#start' },
  parapente: { query: 'debug', button: '#start' },
  pintura: { query: 'debug', button: '#practice', ready: () => !['lobby', 'starter'].includes(pinturaDebug.room.state.phase) },
  poquer: { query: 'debug', button: '#practice', ready: () => !['lobby', 'starter'].includes(poquerDebug.room.state.phase) },
  qqsmp: { query: 'debug', button: '#start' },
  reliquia: { query: '', button: '#start' },
  stop: { query: 'debug', button: '#start' },
  tambor: { query: 'debug', button: '#start' },
  trifulca: { query: 'debug', button: '#start' },
};

// Presses the lobby's start button until the shared lobby closes.
async function leaveLobby(page, buttons) {
  await waitFor(page, () => window.PANA_PREPARED && !window.PANA_LOBBY_LOADING && ![...document.querySelectorAll('.pk-cover:not(.is-done)')].some(c => c.checkVisibility()), null, 120_000);
  await waitFor(page, () => !document.getElementById('pana-lobby-ready') || !document.getElementById('pana-lobby-ready').disabled, null, 120_000);
  for (let tries = 0; tries < 40 && await shown(page, '#pana-lobby-shell'); tries++) {
    for (const selector of [...buttons, '#start']) {
      if (await shown(page, selector) && !await page.locator(selector).first().isDisabled().catch(() => true)) {
        await page.locator(selector).first().click({ timeout: 5000 }).catch(() => {});
        break;
      }
    }
    await waitFor(page, () => !document.querySelector('#pana-lobby-shell')?.checkVisibility(), null, 3000).catch(() => {});
  }
  if (await shown(page, '#pana-lobby-shell')) throw new Error('the lobby did not close');
}

export async function enterPlay(page, game) {
  const recipe = PLAY[game] || { button: '#start' };
  if (recipe.carreritas) {
    const { menuClick } = await import('../games/carreritas/tests/menu-helpers.js');
    await waitFor(page, () => window.garage?.car, null, 120_000);
    await menuClick(page, '#play');
    await waitFor(page, () => race.state === 'go', null, 180_000);
  } else {
    await leaveLobby(page, [recipe.button || '#start']);
    if (recipe.ready) await waitFor(page, recipe.ready, null, 60_000);
  }
  await frames(page, recipe.frames ?? 120);
}
