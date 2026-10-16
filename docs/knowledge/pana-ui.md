# Shared game UI: pause menu and settings

Every game and the hub use one pause menu and one settings store:

- `engine/settings.js` — `pana:settings` in localStorage: `sound`, `volume`
  (0–1), `quality` (`alta`/`media`/`baja` → pixel-ratio cap 2/1.5/1) and
  `hints`. `onSettings(fn)` calls back now and on every change, including
  changes made in another tab. `bindSound(sound)` and
  `bindRenderer(renderer, max)` keep the fx.js sound and a renderer in step.
- `engine/ui.js` — `createGameMenu(options)` builds a native modal `<dialog>`
  with the tabs Juego (resume, game actions, invite, exit), Ajustes (shared
  settings plus game options) and Controles. It owns Esc, focus and input
  blocking; the game only decides what pausing means.
- `engine/ui.css` — scoped `.pana-*` styles. Pages link it before their own
  stylesheet; ui.js injects it if a page forgot.

## Adding the menu to a game

```js
import { sound } from '/engine/fx.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { pixelRatio, bindRenderer } from '/engine/settings.js';

renderer.setPixelRatio(pixelRatio(2)); bindRenderer(renderer, 2);
const menu = createGameMenu({
  title: 'Mi juego', heading: 'Pausa', sound,
  note: () => 'La partida está en pausa.',
  controls: [['W A S D / ↑ ← ↓ →', 'Moverte'], ['M', 'Sonido'], ['Esc', 'Pausa']],
  actions: [{ id: 'restart', label: 'Reiniciar', visible: () => playing, run: restart }],
  options: [{ id: 'sky', label: 'Luz', choices: [['day', 'Día']], get, set }],
  invite: () => inviteUrl(code),     // optional: adds "Copiar invitación"
  onOpen() { paused = true; clearHeldKeys(); },
  onClose() { paused = false; },
});
hud.append(menu.createButton({ id: 'menu' }));      // "Menú Esc"
// Optional: menu.createSoundButton(), menu.createInviteButton()
// In the game's keydown handler: if (key === 'm') toggleMute();
```

Put the menu button somewhere visible on touch screens: phones have no Esc.

Room codes and invite links come from `/engine/invite.js`: `roomFromUrl() ||
newRoomCode()` for the code, `inviteUrl(code)` for the link to share. An invite carries
only `?room=`; never the sender's name, `debug`, `manual` or `lead` (an invitee must
not become the party's lead). The hub builds its links with `playUrl()`.

`orientation: 'horizontal' | 'vertical' | 'libre'` (default `libre`) is how the game
wants a phone held. Racing games (Derrape, Galope) are horizontal; Cocina, Escondidas and
Reliquia, whose phone HUDs are built upright, are vertical. On touch screens Ajustes
shows **Orientación** (Según el juego / Horizontal / Vertical, saved as
`orientation` in settings.js). A phone held the other way gets a "Gira tu teléfono"
screen with "Jugar así" (and, where the browser can lock it, "Pantalla completa").
`<html data-pana-orientation>` carries the wanted orientation for CSS. The game's
landscape layout still has to work: test both with a touch emulator.
Mark keyboard reminders with `data-pana-hint` so the "Ayudas de teclado"
setting can hide them.

## Rules and traps

- **Do not handle Escape in the game.** The menu listens in the capture phase.
  While it is open, keys never reach game handlers. Keys aimed at the menu stop
  at the dialog; the others stop at `window`. Games still get `keyup`, so clear
  held keys in `onOpen`.
- **Pausing is the game's job.** Derrape skips fixed steps, Bululú feeds
  `dt = 0` to its job/tween clock, and Cocina and Escondidas freeze only solo
  rounds. In multiplayer, `note()` must say the round continues.
- **Game CSS styles bare elements** (`header`, `dl`, `dd`, `kbd`, …). Derrape
  even hides `dl` on phones. The menu therefore uses only classed `div`/`span`
  elements, and its button reset is wrapped in `:where()` so `.pana-*` rules
  win.
- **Sound defaults to on**, and the first pointer or key press unlocks
  WebAudio. All fx.js sounds go through `sound.out()`, one master gain node, so
  volume reaches every effect. New sounds must connect to `this.out()`, not
  `ctx.destination`.
- The hub uses `createGameMenu({ pause: false, hotkey: false })` as a
  settings-only dialog.
- Stable test IDs: `#pana-menu-dialog`, `#pana-resume`, `#pana-copy-room`,
  `#pana-set-sound`, `#pana-set-volume`, `#pana-set-quality`,
  `#pana-set-hints`, `#pana-tab-<game|settings|controls>`, plus each action's
  own `id`.

## Regression

`node Pana/engine/tests/ui.browser.js [playwright-package] [browser]` against
`npm start`. It covers hub → game persistence, live resolution changes, Esc,
focus containment and return, input blocking, invite links and `M`.
