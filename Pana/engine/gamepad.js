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

import { getSettings, onSettings, inputAxis } from './settings.js';
import { loc } from './i18n.js';
export const NAMES = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'view', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right'];
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
  publishInput(true);
}

let detected=typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches?'touch':'keyboard',lastPointer=detected,padId='',connected=false;
const inputListeners=new Set();
export function controllerFamily(id='') {return /playstation|dualshock|dualsense|054c|sony/i.test(id)?'playstation':/nintendo|057e|switch/i.test(id)?'nintendo':/xbox|xinput|045e/i.test(id)?'xbox':'generic';}
export function inputState(){const s=getSettings();return {device:s.inputHints==='auto'?detected:s.inputHints,detected,connected,id:padId,family:s.padFamily==='auto'?controllerFamily(padId):s.padFamily};}
export function onInputDevice(fn){inputListeners.add(fn);fn(inputState());return()=>inputListeners.delete(fn);}
function publishInput(force=false){
  if(!globalThis.document)return;const state=inputState(),root=document.documentElement;
  const changed=root.dataset.panaInput!==state.device||root.dataset.panaPadFamily!==state.family;
  root.dataset.panaInput=state.device;root.dataset.panaPadFamily=state.family;
  if(changed||force){
    for(const fn of inputListeners)fn(state);
    // Explicit hint preferences also work without a connected controller.
    queueMicrotask(()=>showPrompts(menuScope()));
  }
}
function activate(device){if(detected!==device){detected=device;publishInput();}}
const FAMILIES={playstation:{A:loc('Cruz'),B:loc('Círculo'),X:loc('Cuadrado'),Y:loc('Triángulo'),LB:'L1',RB:'R1',LT:'L2',RT:'R2',Start:'Options',View:'Share'},nintendo:{A:'B',B:'A',X:'Y',Y:'X',LB:'L',RB:'R',LT:'ZL',RT:'ZR',Start:loc('Más'),View:loc('Menos')}};
// Spanish names of the pad's parts, as games write them in their controls.
const PARTS={'Stick izq.':loc('Stick izq.'),'Stick der.':loc('Stick der.'),Cruceta:loc('Cruceta')};
export function formatPadLabel(text,family=inputState().family){return text.replace(/\b(LB|RB|LT|RT|Start|View|A|B|X|Y)\b/g,key=>FAMILIES[family]?.[key]??key).replace(/Stick izq\.|Stick der\.|Cruceta/g,part=>PARTS[part]);}
// Actuators can outlive a page. Cancel explicitly when focus or navigation leaves it.
export function stopVibration(){
  for(const pad of globalThis.navigator?.getGamepads?.() || []){
    const actuator=pad?.vibrationActuator??pad?.hapticActuators?.[0];
    try { const result=actuator?.reset ? actuator.reset() : actuator?.pulse?.(0, 0); result?.catch?.(()=>{}); } catch { /* disconnected device */ }
  }
}
export async function testVibration(){
  const pad=activePad(),actuator=pad?.vibrationActuator??pad?.hapticActuators?.[0];
  if(!actuator)return false;
  try{if(actuator.playEffect)await actuator.playEffect('dual-rumble',{duration:140,strongMagnitude:.25,weakMagnitude:.4});else if(actuator.pulse)await actuator.pulse(.4,140);else return false;return true;}catch{return false;}
}

// ---------- reading the pad ----------

const pressedOf = b => !!b && (b.pressed || b.value > .4);
// One frame of a pad: held buttons by name and the two sticks (y down).
export function readPad(pad, settings=getSettings()) {
  if (!pad) return null;
  const held = {}, b = pad.buttons || [], ax = pad.axes || [];
  NAMES.forEach((name, i) => { held[name] = pressedOf(b[i]); });
  const stick = (x, y, kind) => ({x:inputAxis(x,settings,kind),y:inputAxis(y,settings,kind)});
  return { held, left: stick(ax[0] || 0, ax[1] || 0,'move'), right: stick(ax[2] || 0, ax[3] || 0,'look') };
}
// Windows lists more than controllers: headsets, wheels, virtual pads, an
// RGB hub. Slot 0 is often one of those, so the pad in use is the last one a
// player touched (a fresh press, or a stick away from where it rested),
// else the one just connected, else the first with the standard layout.
const usable = p => !!p && p.connected !== false && !!p.buttons?.length;
const seen = new Map();   // index → { id, rest axes, buttons held last look }
let activeIndex = -1;
function touched(p) {
  const was = seen.get(p.index), held = p.buttons.map(pressedOf);
  if (!was || was.id !== p.id) { seen.set(p.index, { id: p.id, rest: [...(p.axes || [])], held }); return false; }
  const hit = held.some((h, i) => h && !was.held[i]) || (p.axes || []).some((v, i) => Math.abs(v - (was.rest[i] ?? 0)) > .5);
  was.held = held;
  return hit;
}
export function padList() {
  const all = [...(globalThis.navigator?.getGamepads?.() || [])].filter(usable);
  return [...all.filter(p => p.mapping === 'standard'), ...all.filter(p => p.mapping !== 'standard')];
}
export function activePad() {
  const all = padList(), standard = all.filter(p => p.mapping === 'standard');
  // A jittery device without the standard layout never takes over from a real controller.
  for (const p of standard.length ? standard : all) if (touched(p)) { activeIndex = p.index; break; }
  return all.find(p => p.index === activeIndex) || all[0];
}

// The keys a pad frame holds down during play, as a set of codes.
export function playKeys(pad, { move, keys = {}, buttons } = {}) {
  const codes = new Set(), dirs = MOVES[move];
  if (dirs) {
    const { x, y } = pad.left, h = pad.held;
    if (h.up || y <= -DEAD) codes.add(dirs.up); if (h.down || y >= DEAD) codes.add(dirs.down);
    if (h.left || x <= -DEAD) codes.add(dirs.left); if (h.right || x >= DEAD) codes.add(dirs.right);
  }
  for (const [name, entry] of Object.entries(keys)) {
    if (buttons && (name === 'a' || DIRS.includes(name))) continue;   // those work the HUD
    if (pad.held[name]) codes.add(codeOf(entry));
  }
  return codes;
}

// ---------- menus ----------

const shown = node => !!node && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
const FOCUSABLE = 'button, summary, a[href], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"]), [role=radio], [role=tab]';
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
const firstTarget = all => all.find(n => n.matches('[data-room-start], #start, #play'))
  || all.find(n => n.matches('.pk-btn--primary, .pana-primary, [autofocus]'))
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
  if (!now.matches('input[type=range], input[type=text], input:not([type]), textarea, select')) {if(now.matches('a[href]'))stopVibration();else if(getSettings().padVibration)testVibration();now.click();}
}
function menuBack(scope) {
  if (scope.matches('dialog')) { sendKey('keydown', 'Escape', scope); if (scope.open && !scope.classList.contains('pana-menu')) scope.close?.(); return; }
  // Outside a dialog B is "back": the page's [data-pad-back] link (the lobby's
  // Juegos, the editor's Volver a los juegos).
  (targets(scope).find(n => n.matches('.pana-close')) || [...document.querySelectorAll('[data-pad-back]')].find(shown))?.click();
}
function menuTab(scope, step) {
  // The innermost row of tabs on screen wins: inside Ajustes, LB / RB walk
  // the category's own tabs; elsewhere the menu's.
  const rows = [...scope.querySelectorAll('[role=tablist]')].map(list => [...list.querySelectorAll('[role=tab]')].filter(shown)).filter(row => row.length > 1);
  const tabs = rows.at(-1) ?? [...scope.querySelectorAll('[role=tab]')].filter(shown);
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

let before = null, keysDown = new Set(), repeatAt = 0, lastDir = '', lastScope = null, untouched = false, last = 0, running = false,suspended=false,promptNode=null;
function showPrompts(scope){
  if(!promptNode){promptNode=document.createElement('div');promptNode.className='pana-pad-prompts';promptNode.setAttribute('aria-label',loc('Controles del mando'));document.body.append(promptNode);}
  const state=inputState();promptNode.hidden=!!scope||state.device!=='gamepad'||!getSettings().hints;
  const signature=JSON.stringify([padHelp(),state.family]);if(promptNode.dataset.signature===signature)return;promptNode.dataset.signature=signature;
  promptNode.replaceChildren(...padHelp().map(([key,label])=>{const row=document.createElement('span'),cap=document.createElement('kbd');cap.dataset.padKey='';cap.textContent=formatPadLabel(key);row.append(cap,document.createTextNode(label));return row;}));
}
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
  const held = pad.held, raw=activePad(), nav=readPad(raw,{...getSettings(),padMoveSensitivity:1,padCurve:'lineal'});
  const x = nav.left.x || (held.right - held.left), y = nav.left.y || (held.down - held.up);
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
  if (edge('lt')) menuPages(scope, -1);
  if (edge('rt')) menuPages(scope, 1);
}
// LT / RT step through a menu's pages ([data-pad-pages], e.g. Ajustes' categories).
function menuPages(scope, step) {
  const pages = [...(scope.querySelector('[data-pad-pages]')?.children || [])].filter(shown);
  if (pages.length < 2) return;
  const i = pages.findIndex(p => p.getAttribute('aria-current') === 'true');
  const next = pages[(Math.max(0, i) + step + pages.length) % pages.length];
  next.click(); focusTarget(next);
}

function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  const raw=activePad(),pad = readPad(raw);
  if (!pad) { release(); before = null; running = false;connected=false;padId='';activate(lastPointer);publishInput(true);if(promptNode)promptNode.hidden=true;return; }
  if(!connected||padId!==(raw.id||'')){connected=true;padId=raw.id||'';publishInput(true);}
  if(suspended||document.hidden){release();before=null;requestAnimationFrame(frame);return;}
  const was = before?.held || {}, edge = name => pad.held[name] && !was[name];
  // Sustained driving and slow stick travel are activity too. A controller
  // must not need a fresh edge. Use raw travel, independent of sensitivity.
  const held=(raw.buttons||[]).some(button=>button.pressed||button.value>.05);
  const steering=(raw.axes||[]).some(v=>Math.abs(v)>getSettings().padDeadzone+.01);
  if(held||steering)activate('gamepad');
  const scope = menuScope();
  showPrompts(scope);

  const testing=scope?.querySelector('[data-pad-test-active]');
  if(testing){
    release(); if(edge('b')||edge('start'))testing.click();
    before=pad;lastScope=scope;requestAnimationFrame(frame);return;
  }

  if (edge('start')) {
    const open = [...document.querySelectorAll('dialog[open]')].at(-1);
    release();
    if (open && !open.classList.contains('pana-menu')) menuBack(open);
    else if (!open && setup.menu) setup.menu();
    else sendKey('keydown', 'Escape', open || document.body);   // createGameMenu's Esc
  } else if (scope) {
    release();
    if(detected==='gamepad')menu(scope, pad, now, edge, false);
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
          cursorX = Math.max(0, Math.min(innerWidth - 1, cursorX + x * CURSOR_SPEED * getSettings().padCursorSpeed * dt));
          cursorY = Math.max(0, Math.min(innerHeight - 1, cursorY + y * CURSOR_SPEED * getSettings().padCursorSpeed * dt));
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
  onSettings(()=>publishInput(true));
  addEventListener('gamepadconnected', e => {
    // A controller just paired is the one wanted; another device announcing
    // itself only takes over when nothing is in use yet.
    const added=e.gamepad;if(usable(added)&&(added.mapping==='standard'||activeIndex<0))activeIndex=added.index;
    const pad=activePad(); connected=!!pad;padId=pad?.id||'';
    toast(loc('Mando conectado'));activate('gamepad');publishInput(true);start();
  });
  addEventListener('gamepaddisconnected', e => {
    seen.delete(e.gamepad?.index);if(e.gamepad?.index===activeIndex)activeIndex=-1;
    if (!activePad()) toast(loc('Mando desconectado'));
  });
  addEventListener('blur', ()=>{suspended=true;release();stopVibration();});
  addEventListener('pagehide', stopVibration);
  document.addEventListener('visibilitychange', ()=>{if(document.hidden)stopVibration();});
  addEventListener('focus', ()=>{suspended=false;if(activePad())start();});
  // The mouse takes over from the pad's highlight.
  addEventListener('pointerdown', e => { if (e.isTrusted) {clearMark();lastPointer=e.pointerType==='touch'?'touch':'keyboard';activate(lastPointer);} }, true);
  // Hovering is not a device choice: controllers and desktop overlays can
  // generate mouse motion. A real click or key press switches back explicitly.
  addEventListener('keydown', e=>{if(e.isTrusted&&!e.repeat){clearMark();lastPointer='keyboard';activate('keyboard');}},true);
  // A pad connected before the page loaded is listed once the page sees a press.
  if (activePad()) start();
}

// "Mando" lines for the Controles tab: [[buttons, what it does], …].
const LABELS = { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', view: 'View', start: 'Start', ls: 'L3', rs: 'R3', up: 'Cruceta ↑', down: 'Cruceta ↓', left: 'Cruceta ←', right: 'Cruceta →' };
export function padHelp(options = setup) {
  if (!options) return [];
  if (options.help || options.native) return [...(options.help || []), ['Start', loc('Menú')]];
  const lines = [];
  if (options.move) lines.push(['Stick izq. / Cruceta', options.moveLabel || loc('Moverte')]);
  if (options.buttons) lines.push(['Cruceta + A', loc('Elegir los botones de la pantalla')]);
  const byLabel = new Map();
  for (const [name, entry] of Object.entries(options.keys || {})) {
    if (!Array.isArray(entry) || !entry[1] || (options.buttons && name === 'a')) continue;
    byLabel.set(entry[1], [...(byLabel.get(entry[1]) || []), LABELS[name]]);
  }
  for (const [label, names] of byLabel) lines.push([names.join(' / '), label]);
  if (options.look) lines.push(['Stick der.', options.look]);
  if (options.cursor) lines.push(['Stick der. + RT', typeof options.cursor === 'string' ? options.cursor : loc('Apuntar y tocar')]);
  lines.push(['Start', loc('Menú')]);
  return lines;
}
