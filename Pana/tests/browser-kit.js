// Shared helpers for Playwright suites, so every suite waits on game state the
// same way instead of sleeping or re-writing its own "ready" check.
//
//   import { launch, openGame, waitPrepared, games } from '../../../tests/browser-kit.js';
//   const browser = await launch();
//   const page = await openGame(browser, 'domino', { name: 'Ana', room: 'qa-1' });
//
// Rules (AGENTS.md, "Checks"): wait on state (prepared, revision, phase, an event
// id), never on wall-clock time; force low quality; compare positions and heights
// with a tolerance.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

export const base = process.env.PANA_TEST_URL || process.env.PANA_QA_URL || 'http://localhost:8461';
const app = path.resolve(import.meta.dirname, '..');

// Every game the hub lists (a game exists once public/index.html does).
export const games = fs.readdirSync(path.join(app, 'games'))
  .filter(id => fs.existsSync(path.join(app, 'games', id, 'public', 'index.html'))).sort();

export function launch(options = {}) {
  const executablePath = process.env.PANA_BROWSER_PATH;
  return chromium.launch({
    headless: true,
    // Background tabs keep ticking, so a multi-client suite's hidden pages still play.
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
    ...(executablePath ? { executablePath } : {}),
    ...options,
  });
}

// Absolute path for screenshots, independent of the directory the suite ran from.
export function qaDir(metaUrl) {
  const dir = path.join(path.dirname(new URL(metaUrl).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'qa');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Opens a game as a fresh player (own context, low quality, sound off) and
// collects its page errors on page.errors.
export async function openGame(browser, game, { name = 'Pana', room, mobile = false, query = '', wait = true } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  await context.addInitScript(name => {
    localStorage.setItem('pana:name', name);
    localStorage.setItem('pana:settings', JSON.stringify({ sound: false, music: false, quality: 'baja' }));
  }, name);
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(`${game}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.errors.push(`${game} console: ${m.text()}`); });
  const params = new URLSearchParams(query);
  if (room) params.set('room', room);
  const search = params.toString();
  await page.goto(`${base}/g/${game}/${search ? `?${search}` : ''}`, { waitUntil: 'domcontentloaded' });
  if (wait) await waitPrepared(page);
  return page;
}

// Every game sets window.PANA_PREPARED once its module graph and scene are
// ready: the shared lobby (engine/game-entry.js) does it for games that use it.
export async function waitPrepared(page, timeout = 120_000) {
  await page.waitForFunction(() => window.PANA_PREPARED === true, null, { timeout });
}

// Waits until fn(state) is true for a value read in the page, e.g.
// await waitFor(page, () => window.domino.state.phase === 'playing').
export function waitFor(page, fn, arg, timeout = 60_000) {
  return page.waitForFunction(fn, arg, { timeout, polling: 50 });
}

export const near = (actual, expected, tolerance) => Math.abs(actual - expected) <= tolerance;
