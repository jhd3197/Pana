// Xbox / PlayStation controllers in every game. game-entry.js loads this, so
// with no setup a controller already works the lobby, the pause menu and the
// results: the stick or d-pad moves between buttons, A presses, B goes back,
// Start opens the menu. A game adds play through createGameMenu({ pad }) by
// naming the keys its buttons stand for; the pad then presses those keys, so
// the game's keyboard code is the only input code it needs.
//
//   createGameMenu({ …, pad: {
//     move: 'wasd',                                // left stick and d-pad: 'arrows' or 'wasd'
//     keys: { a: ['Space', 'Saltar'], x: 'KeyE' }, // button → KeyboardEvent.code [, label]
//     cursor: true,                                // right stick moves a pointer, RT clicks
//     buttons: true,                               // in play the d-pad and A also work the HUD's buttons
//     playing: () => state.phase === 'play',       // false: the whole page is a menu
//   } });
//   pad: { native: true, help: [['A', 'Golpe'], …] } // the game reads the pad itself in play
//   padControls({ playing: () => false, menu: () => settings.open() })  // a page that is all menu;
//                                                  // Start (☰) runs `menu`, B clicks [data-pad-back]
//
// Buttons by their Xbox names: a b x y lb rb lt rt view start ls rs; the d-pad
// is up down left right. First-person games get right-stick look through
// padLook (engine/play/first-person.js uses it).

const NAMES = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'view', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right'];
const DIRS = ['up', 'down', 'left', 'right'];
export const MOVES = {
  arrows: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
  wasd: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
};
const DEAD = .5, CURSOR_SPEED = 1100;
const NAMED_KEYS = { Space: ' ', Enter: 'Enter', Escape: 'Escape', Tab: 'Tab', Backspace: 'Backspace', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Control', AltLeft: 'Alt' };
// The KeyboardEvent.key a code types, for games that read e.key.
export function keyOf(code) {
  if (NAMED_KEYS[code]) return NAMED_KEYS[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(code)) return code.slice(5);
  return code;   // ArrowUp, Home…
}
const codeOf = entry => Array.isArray(entry) ? entry[0] : entry;

let setup = { native: false, keys: {} };
export function padControls(options = {}) {
  release();
  setup = { native: false, keys: {}, ...options };
}
export const padSetup = () => setup;

// ---------- reading the pad ----------

const pressedOf = b => !!b && (b.pressed || b.value > .4);
// One frame of a pad: held buttons by name and the two sticks (y down).
export function readPad(pad) {
  if (!pad) return null;
  const held = {}, b = pad.buttons || [], ax = pad.axes || [];
  NAMES.forEach((name, i) => { held[name] = pressedOf(b[i]); });
  const stick = (x, y) => Math.hypot(x, y) > .18 ? { x, y } : { x: 0, y: 0 };
  return { held, left: stick(ax[0] || 0, ax[1] || 0), right: stick(ax[2] || 0, ax[3] || 0) };
}
const firstPad = () => [...(navigator.getGamepads?.() || [])].find(p => p && p.connected !== false && p.buttons?.length);

// The keys a pad frame holds down during play, as a set of codes.
export function playKeys(pad, { move, keys = {}, buttons } = {}) {
  const codes = new Set(), dirs = MOVES[move];
  if (dirs) {
    const { x, y } = pad.left, h = pad.held;
    if (h.up || y < -DEAD) codes.add(dirs.up); if (h.down || y > DEAD) codes.add(dirs.down);
    if (h.left || x < -DEAD) codes.add(dirs.left); if (h.right || x > DEAD) codes.add(dirs.right);
  }
  for (const [name, entry] of Object.entries(keys)) {
    if (buttons && (name === 'a' || DIRS.includes(name))) continue;   // those work the HUD
    if (pad.held[name]) codes.add(codeOf(entry));
  }
  return codes;
}

// ---------- menus ----------

const shown = node => !!node && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
const FOCUSABLE = 'button, a[href], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"]), [role=radio], [role=tab]';
// The menu showing, if any: an open dialog, a results card, a panel marked
// [data-pad-menu], the lobby, or the whole page when the game is not playing.
export function menuScope() {
  const dialog = [...document.querySelectorAll('dialog[open]')].filter(shown).at(-1);
  if (dialog) return dialog;
  for (const node of document.querySelectorAll('.pk-results, [data-pad-menu]')) if (!node.hidden && !node.classList.contains('hidden') && shown(node)) return node;
  const lobby = document.getElementById('pana-lobby-shell');
  if (lobby && !lobby.hidden && shown(lobby)) return lobby;
  if (setup.playing && !setup.playing()) return document.body;
  return null;
}
export function targets(scope) {
  return [...scope.querySelectorAll(FOCUSABLE)].filter(node => !node.disabled && node.getAttribute('aria-disabled') !== 'true'
    && !node.closest('[inert], [hidden], .hidden, .pk-touch, .pk-dpad, [aria-hidden="true"], [data-pad-skip]') && shown(node));
}
// The nearest control in a direction, preferring ones straight ahead.
export function nextTarget(from, all, dx, dy) {
  const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  for (const node of all) {
    if (node === from) continue;
    const b = node.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
    if ((bx - ax) * dx + (by - ay) * dy <= 0) continue;
    // Edges, not centres, for the distance: a wide button beside a narrow one still counts.
    const gap = dx ? (dx > 0 ? b.left - a.right : a.left - b.right) : (dy > 0 ? b.top - a.bottom : a.top - b.bottom);
    if (gap < -Math.min(a.width, a.height) / 2) continue;
    const across = dx ? Math.max(0, b.top - a.bottom, a.top - b.bottom) : Math.max(0, b.left - a.right, a.left - b.right);
    if (dx && across > Math.max(80, gap)) continue;   // sideways stays near its row
    const score = Math.max(0, gap) + across * 3 + Math.abs(dx ? by - ay : bx - ax) * .1;
    if (score < bestScore) { bestScore = score; best = node; }
  }
  return best;
}
// The main button, else the biggest one (a menu's big choices beat its tabs
// and step bars), else anything: a link first in line is usually "leave".
const area = n => { const r = n.getBoundingClientRect(); return r.width * r.height; };
const firstTarget = all => all.find(n => n.matches('.pk-btn--primary, .pana-primary, [autofocus]'))
  || all.filter(n => n.matches('button')).reduce((best, n) => (!best || area(n) > area(best) ? n : best), null) || all[0];
const clearMark = () => document.querySelectorAll('.pana-pad-focus').forEach(n => n.classList.remove('pana-pad-focus'));
function focusTarget(node) {
  if (!node) return;
  clearMark();
  node.classList.add('pana-pad-focus');   // before focus, so focus handlers can tell the pad moved there
  node.focus({ preventScroll: true, focusVisible: true });
  node.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

function sendKey(type, code, target = document.body) {
  target.dispatchEvent(new KeyboardEvent(type, { key: keyOf(code), code, bubbles: true, cancelable: true, composed: true }));
}

// In play the HUD's own controls (a hand of tiles, the answers, the bet
// buttons) are big and sit at the bottom: start from a big one near the
// bottom middle rather than a small link there.
function hudTarget(all) {
  const at = n => { const r = n.getBoundingClientRect(); return Math.hypot(r.left + r.width / 2 - innerWidth / 2, (r.top + r.height / 2 - innerHeight * .9) * 1.5) / Math.sqrt(r.width * r.height + 1); };
  return all.reduce((best, n) => (!best || at(n) < at(best) ? n : best), null);
}
const startTarget = (scope, all) => scope === document.body && !setup.playing ? hudTarget(all) : firstTarget(all);

function menuStep(scope, dx, dy) {
  const all = targets(scope), now = document.activeElement;
  if (!all.length) return;
  if (!all.includes(now)) { focusTarget(startTarget(scope, all)); return; }
  if (dx && now.matches('input[type=range]')) {
    now.value = String(Number(now.value) + dx * Number(now.step || 1));
    now.dispatchEvent(new Event('input', { bubbles: true })); now.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  // Segmented choices and tabs keep their own arrow keys sideways.
  if (dx && now.matches('[role=radio], [role=tab]') && now.parentElement.querySelectorAll('[role=radio], [role=tab]').length > 1) {
    sendKey('keydown', dx > 0 ? 'ArrowRight' : 'ArrowLeft', now);
    if (document.activeElement !== now) { clearMark(); document.activeElement.classList.add('pana-pad-focus'); return; }
  }
  focusTarget(nextTarget(now, all, dx, dy) || now);
}
function menuPress(scope) {
  const all = targets(scope), now = document.activeElement;
  if (!all.includes(now)) { focusTarget(startTarget(scope, all)); return; }
  if (!now.matches('input[type=range], input[type=text], input:not([type]), textarea, select')) now.click();
}
function menuBack(scope) {
  if (scope.matches('dialog')) { sendKey('keydown', 'Escape', scope); if (scope.open && !scope.classList.contains('pana-menu')) scope.close?.(); return; }
  // Outside a dialog B is "back": the page's [data-pad-back] link (the lobby's
  // Juegos, the editor's Volver a los juegos).
  (targets(scope).find(n => n.matches('.pana-close')) || [...document.querySelectorAll('[data-pad-back]')].find(shown))?.click();
}
function menuTab(scope, step) {
  const tabs = [...scope.querySelectorAll('[role=tab]')].filter(shown);
  if (!tabs.length) return;
  const i = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
  const next = tabs[(Math.max(0, i) + step + tabs.length) % tabs.length];
  next.click(); focusTarget(next);
}

// ---------- the pointer and the look ----------

let cursor = null, cursorX = (globalThis.innerWidth || 0) / 2, cursorY = (globalThis.innerHeight || 0) / 2, cursorMoved = 0, clicking = false;
function pointer(type, buttons = 0) {
  const target = document.elementFromPoint(cursorX, cursorY) || document.body;
  const init = { clientX: cursorX, clientY: cursorY, screenX: cursorX, screenY: cursorY, bubbles: true, cancelable: true, composed: true, button: 0, buttons, pointerId: 41, pointerType: 'mouse', isPrimary: true };
  target.dispatchEvent(new PointerEvent(type, init));
  const mouse = { pointerdown: 'mousedown', pointerup: 'mouseup', pointermove: 'mousemove' }[type];
  if (mouse) target.dispatchEvent(new MouseEvent(mouse, init));
  if (type === 'pointerup') target.dispatchEvent(new MouseEvent('click', init));
}
function showCursor(now) {
  if (!cursor) {
    cursor = document.createElement('div'); cursor.className = 'pana-pad-cursor'; cursor.setAttribute('aria-hidden', 'true');
    document.body.append(cursor);
  }
  cursor.hidden = false; cursorMoved = now;
  cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
}
const lookers = new Set();
// fn(x, y, dt) each frame of play while the right stick is pushed.
export function padLook(fn) { lookers.add(fn); return () => lookers.delete(fn); }

// ---------- the loop ----------

let before = null, keysDown = new Set(), repeatAt = 0, lastDir = '', lastScope = null, untouched = false, last = 0, running = false;
function holdKeys(codes) {
  for (const code of keysDown) if (!codes.has(code)) sendKey('keyup', code);
  for (const code of codes) if (!keysDown.has(code)) sendKey('keydown', code);
  keysDown = codes;
}
function release() {
  holdKeys(new Set());
  if (clicking) { clicking = false; pointer('pointerup'); }
}

function toast(text) {
  const node = Object.assign(document.createElement('div'), { className: 'pana-toast show', textContent: text });
  node.setAttribute('role', 'status'); document.body.append(node);
  setTimeout(() => { node.classList.remove('show'); setTimeout(() => node.remove(), 400); }, 2400);
}

function menu(scope, pad, now, edge, hud) {
  const held = pad.held, x = pad.left.x || (held.right - held.left), y = pad.left.y || (held.down - held.up);
  // A new menu on screen gets the focus on its main button, and keeps
  // following it (a start button enabled late) until the player moves.
  if (!hud && scope !== lastScope) untouched = !targets(scope).includes(document.activeElement);
  if (untouched) { const main = firstTarget(targets(scope)); if (main && main !== document.activeElement) focusTarget(main); }
  const dir = Math.abs(x) > DEAD || Math.abs(y) > DEAD ? (Math.abs(x) > Math.abs(y) ? (x > 0 ? 'r' : 'l') : (y > 0 ? 'd' : 'u')) : '';
  if (dir || edge('a')) untouched = false;
  if (dir && (dir !== lastDir || now > repeatAt)) {
    repeatAt = now + (dir !== lastDir ? 380 : 140);
    menuStep(scope, { r: 1, l: -1 }[dir] || 0, { d: 1, u: -1 }[dir] || 0);
  }
  lastDir = dir;
  if (edge('a')) menuPress(scope);
  if (hud) return;
  if (edge('b')) menuBack(scope);
  if (edge('lb')) menuTab(scope, -1);
  if (edge('rb')) menuTab(scope, 1);
}

function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  const pad = readPad(firstPad());
  if (!pad) { release(); before = null; running = false; return; }
  const was = before?.held || {}, edge = name => pad.held[name] && !was[name];
  const scope = menuScope();

  if (edge('start')) {
    const open = [...document.querySelectorAll('dialog[open]')].at(-1);
    release();
    if (open && !open.classList.contains('pana-menu')) menuBack(open);
    else if (!open && setup.menu) setup.menu();
    else sendKey('keydown', 'Escape', open || document.body);   // createGameMenu's Esc
  } else if (scope) {
    release();
    menu(scope, pad, now, edge, false);
  } else {
    if (setup.buttons) menu(document.body, pad, now, edge, true);
    else { lastDir = ''; clearMark(); }
    if (!setup.native) {
      // A button clicked during play keeps the focus, and games skip keys aimed at buttons.
      if (!setup.buttons && document.activeElement?.matches?.('button, a')) document.activeElement.blur();
      holdKeys(playKeys(pad, setup));
      const { x, y } = pad.right;
      if ((x || y) && lookers.size) for (const fn of lookers) fn(x, y, dt);
      if (setup.cursor) {
        if (x || y) {
          cursorX = Math.max(0, Math.min(innerWidth - 1, cursorX + x * Math.abs(x) * CURSOR_SPEED * dt));
          cursorY = Math.max(0, Math.min(innerHeight - 1, cursorY + y * Math.abs(y) * CURSOR_SPEED * dt));
          showCursor(now); pointer('pointermove', clicking ? 1 : 0);
        }
        if (pad.held.rt !== clicking) { clicking = pad.held.rt; showCursor(now); pointer(clicking ? 'pointerdown' : 'pointerup', clicking ? 1 : 0); }
      }
    }
  }
  if (cursor && !cursor.hidden && (scope || !setup.cursor || now - cursorMoved > 4000)) cursor.hidden = true;
  lastScope = scope; before = pad;
  requestAnimationFrame(frame);
}
function start() {
  if (running) return;
  running = true; last = performance.now(); requestAnimationFrame(frame);
}
if (globalThis.document) {
  addEventListener('gamepadconnected', () => { toast('Mando conectado'); start(); });
  addEventListener('gamepaddisconnected', () => { if (!firstPad()) toast('Mando desconectado'); });
  addEventListener('blur', release);
  // The mouse takes over from the pad's highlight.
  addEventListener('pointerdown', e => { if (e.isTrusted) clearMark(); }, true);
  // A pad connected before the page loaded is listed once the page sees a press.
  if (firstPad()) start();
}

// "Mando" lines for the Controles tab: [[buttons, what it does], …].
const LABELS = { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', view: 'View', start: 'Start', ls: 'L3', rs: 'R3', up: 'Cruceta ↑', down: 'Cruceta ↓', left: 'Cruceta ←', right: 'Cruceta →' };
export function padHelp(options = setup) {
  if (!options) return [];
  if (options.help || options.native) return [...(options.help || []), ['Start', 'Menú']];
  const lines = [];
  if (options.move) lines.push(['Stick izq. / Cruceta', options.moveLabel || 'Moverte']);
  if (options.buttons) lines.push(['Cruceta + A', 'Elegir los botones de la pantalla']);
  const byLabel = new Map();
  for (const [name, entry] of Object.entries(options.keys || {})) {
    if (!Array.isArray(entry) || !entry[1] || (options.buttons && name === 'a')) continue;
    byLabel.set(entry[1], [...(byLabel.get(entry[1]) || []), LABELS[name]]);
  }
  for (const [label, names] of byLabel) lines.push([names.join(' / '), label]);
  if (options.look) lines.push(['Stick der.', options.look]);
  if (options.cursor) lines.push(['Stick der. + RT', typeof options.cursor === 'string' ? options.cursor : 'Apuntar y tocar']);
  lines.push(['Start', 'Menú']);
  return lines;
}
