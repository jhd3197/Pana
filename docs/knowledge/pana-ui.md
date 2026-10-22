# Shared game UI: pause menu and settings

## Illustrated loading lobbies and portraits

Games with the shared `.pk-lobby` load `engine/game-entry.js` using
`data-pana-entry="./game.js"` and link `engine/game-lobby.css` last. The light
entry paints the illustrated roster first, then dynamically imports the real
game module. It moves existing controls, keeping their IDs, event handlers and
host permissions. Game-owned avatar rosters move into the large roster area;
the shell never assigns teams or seats. Do not add settings from mockups unless
the game implements those rules.

At the end of game initialization, await `prepareScene({renderer,scene,camera})`
from `engine/game-load.js`. It decodes material images, compiles shaders and
renders once for GPU upload. Caída and Dominó export `sceneReady` for their lazy
scene import. A failed preparation keeps retry/back controls; elapsed time never
marks a game ready. Rendering pauses behind the illustrated lobby, while room
messages continue. Visibility follows the original lobby's hidden state, including
late joins into active games. Later round/minigame assets retain their own loaders.

Portraits use `portrait-cache.js`, keyed by the complete normalized wardrobe,
with at most 24 local 256px images. `portrait.js` lazily renders a missing image
once and disposes its WebGL context. The creator captures from its existing
renderer after edits. Hosted accounts may store the same image; public Pana
continues to need no account. Bump the cache prefix when the model/camera changes.

Navigation uses the shared SVG chevrons. `navigation.js` converts legacy arrow
text on buttons/links, leaving keyboard hints and touch direction keys alone.

Every game and the hub use one pause menu and one settings store:

- `engine/settings.js` — `pana:settings` in localStorage: `sound`, `volume`
  (0–1), `quality` (`alta`/`media`/`baja` → pixel-ratio cap 2/1.5/1) and
  `hints`. `onSettings(fn)` calls back now and on every change, including
  changes made in another tab. `bindSound(sound)` and
  `bindRenderer(renderer, max)` keep the fx.js sound and a renderer in step.
- `engine/ui.js` — `createGameMenu(options)` builds a native modal `<dialog>`
  with the tabs Juego (resume, game actions, invite, exit), Ajustes (shared
  settings, device instructions and game options). It owns Esc, focus and input
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
wants a phone held. Racing games (Carreritas, Galope) are horizontal; Cocina, Escondidas and
Reliquia, whose phone HUDs are built upright, are vertical. On touch screens Ajustes
shows **Orientación** (Según el juego / Horizontal / Vertical, saved as
`orientation` in settings.js). A phone held the other way gets a "Gira tu teléfono"
screen with "Jugar así" (and, where the browser can lock it, "Pantalla completa").
`<html data-pana-orientation>` carries the wanted orientation for CSS. The game's
landscape layout still has to work: test both with a touch emulator.
Mark keyboard reminders with `data-pana-hint` so the "Ayudas de controles"
setting can hide them.

## Shared input settings

The menu occupies the viewport, keeping native dialog focus containment and
each game's `onOpen` / `onClose` behavior. `settings-workspace.js` loads only
when Ajustes opens. It moves the existing audio, image and game option nodes
into categories, preserving IDs and handlers. `/ajustes.html` exposes the same
workspace outside a game. Personal settings never change room rules.

Device instructions and tuning share one category per device, initially the
active device. There is no separate Controls tab or input landing page.
Controller deadzone, movement and look sensitivity remain visible; other tuning and
manual hint overrides live in disclosures. The live monitor appears only in
Mando and names the connected hardware, even while a mouse adjusts it.
Legacy `open('controls')` calls route to Ajustes.

`pana:settings` stores independent `mouseSensitivity`, `mouseVertical`,
`mouseInvertY`, `touchSensitivity`, `touchInvertY`, `padDeadzone`,
`padMoveSensitivity`, `padLookSensitivity`, `padVertical`, `padInvertY`,
`padCurve` (lineal/suave/rapida), `padCursorSpeed` and `padVibration`.
`normalizeSettings` clamps persisted ranges; `resetInputSettings` preserves
audio, image and hint visibility. First-person controls consume live values,
including separate touch drag tuning. Legacy first-person mouse presets
migrate when no numeric preference exists. Settings still work in memory when
storage is unavailable, and storage events synchronize open tabs.

`gamepad.js` exports `inputState()` and `onInputDevice(fn)`: `detected` is the
last active physical device, while `device` follows the `inputHints` display
override (auto/keyboard/gamepad/touch). Synthetic controller key/pointer events
must never count as physical keyboard or mouse input. An idle controller must
not take focus back after a real key press; held buttons or raw stick travel
beyond the configured deadzone reactivate it, including slow or steady input.
Mouse hover never changes the device; trusted clicks and key presses do.
Disconnect releases translated keys. Window blur suspends the
controller translator until focus returns.

The root carries `data-pana-input` and `data-pana-pad-family`. Keyboard hint
groups and legacy keycaps hide for controller/touch input; controller keycaps
use `data-pad-key`. Gameplay controller prompts come from each game's real
`pad` mapping. Device instructions remain visible in their own settings page
even when another device navigates there. `padFamily` can
override ID-based Xbox/PlayStation/Nintendo/generic labels without changing
the browser's standard button indices. Controller navigation targets the
lobby's start action before other primary buttons such as an armory button.

Native controller readers must call `inputAxis(value, getSettings())`, as
Carreritas and Trifulca do. `readPad` uses that same function; `kind: 'look'`
scales full-travel camera speed, while movement stays bounded to one. Menu
navigation deliberately uses normal movement sensitivity and a linear curve
so a player's low gameplay setting cannot disable navigation. The live tester
shows raw and shaped values; its explicit test mode consumes navigation until
B/Start (or the finish button) ends the test. Vibration is optional browser
support: failed probes show an unavailable message, not a successful effect.

`settings.browser.js` measures actual mouse/touch look deltas, controller
arbitration, tester behavior, persistence and responsive layout. The all-games
smoke opens the real settings menu under each game's CSS, including phone width.

## Loading cover

`engine/loading-cover.js` (`showCover`) is the one loading screen: the page's
art, its name, what is loading now and an indeterminate bar, over everything.
`done()` fades it once the next frame has painted. `game-entry.js` shows it
from the first paint until the game module and its `sceneReady` have loaded,
the room link has arrived (up to 5 s) and the lobby is docked in its final
layout, so nothing is seen moving into place. `pana:load-stage` events
update its line. A failure leaves the message on the cover with a retry. Each
switch between the lobby and the game gets a short cover too ("¡A jugar!",
"De vuelta a la sala…"). The Mi pana editor covers itself with the player's
portrait until `editor.js` is ready.

## Game controllers

`engine/gamepad.js` makes an Xbox or PlayStation pad work in every game that
loads through `game-entry.js`, with no game code at all for menus. The stick or
d-pad moves a yellow highlight between the visible buttons, A presses, B backs
out of a dialog or clicks the page's `[data-pad-back]` link (the lobby's Juegos,
the editor's Volver a los juegos), LB/RB change the menu's tabs and Start
(the ☰ menu button) is Esc, or the page's `menu` (the hub opens Ajustes). The pad treats
these as menus: an open `dialog`, a visible `.pk-results`, any visible panel
marked `[data-pad-menu]`, and the lobby. A new menu puts the highlight on its
`.pk-btn--primary` (or `.pana-primary`) button. The highlight follows that
button if it gets enabled late, until the player moves.

During play a game names the keys its buttons stand for, through the menu:

```js
createGameMenu({ …, pad: {
  move: 'wasd',                                  // or 'arrows': left stick and d-pad
  keys: { rt: ['KeyW', 'Avanzar'], a: ['Space', 'Saltar'] },
  cursor: 'Apuntar',                             // right stick moves a pointer, RT clicks
  buttons: true,                                 // d-pad + A work the HUD's buttons
} });
```

The pad sends untrusted `keydown`/`keyup` events to `document.body`, with both
`code` and `key`, so the game's keyboard handlers do the rest. `buttons` suits
turn games whose moves are DOM buttons (Dominó, Póquer, ¿Quién quiere…?). It
starts from the big control nearest the bottom middle of the screen, and A
stays with the buttons. `createLookControls` turns the camera with the right
stick, so first-person games need no `cursor`. `{ native: true, help }` is for
a game that reads the pad itself (Trifulca): the menus still work, and `help`
fills the instructions in Ajustes → Mando. Carreritas is native too:
controls.js drives the car, and the
engine owns the garage menus and Start, so its own pad code no longer
toggles the pause. Without a main button, a menu starts the pad on its
biggest button, such as Carreritas's "Un jugador" card rather than the step bar.

The menu imports `gamepad.js` dynamically for device-aware help. The settings
workspace is lazy too; neither adds to a game's static module budget.

## Rules and traps

- **Do not handle Escape in the game.** The menu listens in the capture phase.
  While it is open, keys never reach game handlers. Keys aimed at the menu stop
  at the dialog; the others stop at `window`. Games still get `keyup`, so clear
  held keys in `onOpen`.
- **Pausing is the game's job.** Carreritas skips fixed steps, Bululú feeds
  `dt = 0` to its job/tween clock, and Cocina and Escondidas freeze only solo
  rounds. In multiplayer, `note()` must say the round continues.
- **Game CSS styles bare elements** (`header`, `dl`, `dd`, `kbd`, …). Carreritas
  even hides `dl` on phones. The menu therefore uses only classed `div`/`span`
  elements, and its button reset is wrapped in `:where()` so `.pana-*` rules
  win.
- **Sound defaults to on**, and the first pointer or key press unlocks
  WebAudio. All fx.js sounds go through `sound.out()`, one master gain node, so
  volume reaches every effect. New sounds must connect to `this.out()`, not
  `ctx.destination`.
- The hub uses `createGameMenu({ pause: false, hotkey: false })` as a
  settings-only dialog.
- The shared menu explicitly wraps Tab and Shift+Tab across visible, enabled
  controls. Native modal focus alone can still advance to browser chrome.
  Browser checks must first reveal Carreritas's final garage step before asserting
  that closing the menu restores focus to its Play button.
- Stable test IDs: `#pana-menu-dialog`, `#pana-resume`, `#pana-copy-room`,
  `#pana-set-sound`, `#pana-set-volume`, `#pana-set-quality`,
  `#pana-set-hints`, `#pana-tab-<game|settings|controls>`, plus each action's
  own `id`.

## Shared room settings

`engine/room-options.js` owns primary segmented choices and the prototype's
“Más ajustes” native dialog. Each game supplies a pure field schema with `id`,
`label`, `default`, typed `choices: [[value, label]]` and optional `advanced`.
`createRoomOptions(container, { title, fields, change, reset })` calls `change`
with a patch object, never a key/value pair. Load `room-options.css` with kit.css.
Call `update(authoritativeValues, mayEdit)` from snapshots, and close the dialog
when leaving the lobby. Guests can inspect options but cannot edit them.

The renderer never changes selected values optimistically. Validate patches in
the existing host/server action using `applyRoomOptions` from the pure
`room-options-rules.js`; it rejects mixed-invalid patches atomically and keeps
number/boolean types. Use `optionDefaults` for reset and preserve choices in
fresh/practice state factories as well as migration snapshots.

Escape closes this dialog without also opening the pause menu. Tab wraps among
visible enabled buttons, inputs, selects and links; closing restores the
trigger's focus. The two-column
advanced panel becomes one scrollable column on phones. Shared entry docks
actual game start/practice controls in its footer so a long settings column
cannot bury them. Six-player roster cards use three columns on desktop and two
on phones. Table/live scaffolds include real validated example options.

### Adopting existing controls

Mark existing controls in the original `.pk-lobby`; keep their IDs, handlers and
authoritative update logic. After the game and scene initialize, entry calls
`finalizeRoomOptions(originalLobby)` before docking the roster and footer.

| Hook | Destination |
| --- | --- |
| `data-room-primary` | Primary settings, before schema-generated choices |
| `data-room-extra` | Más ajustes, after advanced schema choices |
| `data-room-help` | Más ajustes; a help-button click closes it before the existing help handler runs |
| `data-pana-roster` | Left roster area; hides generic member cards while visible |
| `data-room-personal` | Left roster area, for existing personal controls |

Adoption moves nodes rather than cloning them. Team cards are excluded from
extras even if a nested element has an extra/help hook. The options container
moves to the end of the original lobby, so its single Más ajustes button is the
last settings entry. Do not put duplicate invite/start controls or introductory
copy below it. Adopted controls retain their own permission checks: `update()`
only disables fields generated by the schema. A game's reset callback must also
reset adopted **room-wide** choices, such as its map, in one validated action;
it must not reset a player's personal camera.

### Grouped avatar rosters

Use `createLobbyRoster(container, { onMove })` from `engine/lobby-roster.js` for
teams, boat crews or individual seats. Its CSS is imported by game-lobby.css.
The renderer marks its container `data-pana-roster` automatically.

```js
const roster = createLobbyRoster(container, {
  onMove: (from, to) => room.moveSeat(from, to),
});
roster.update(groups, {
  ownId: room.id, hostId: room.hostId,
  enabled: room.connected && state.phase === 'lobby',
  canArrange: room.isHost,
  members: room.link?.state.players || [],
});
```

`groups` is `[{ id, title, color, seats: [{ key, player, label? }] }]`.
Seat keys are stable game-owned numbers or strings. `player` is null for a free
place, or `{ id, name, avatar, bot }`; optional `label` names a role such as
Proa/Popa. `members` is an array, not a Map. Raw room members can carry session
IDs plus stable `seat` IDs: the renderer matches either, reads `assetsReady` and
`lobbyReady`, and displays Cargando/Listo/Esperando. Without readiness metadata
it uses En la sala. Convert the room's host session ID to its stable seat ID
before passing `hostId` when game players use seat IDs.

Guests move themselves with Cambiarme aquí, Unirme aquí or Cambiar on another
card. The first prefers a free/bot place in the chosen group. Hosts can select
an occupied card with Organizar, then choose its destination. Selection clears
if an authoritative update replaces that occupant. These buttons only request
a move; each game's existing action must reject unrelated guest swaps and
changes during play. Do not implement team membership in the renderer.

`createTableSeating(container, onSwap)` adapts this renderer for table arrays.
`update(players, { teams, enabled, canArrange, ownId, hostId, members })` groups
even/odd indices into two teams, or shows one individual group. Set `enabled`
for every connected lobby player and `canArrange` only for the host. Stable
member IDs and game-owned seat indices are different values. Call `dispose()`
on either renderer when its game tears down.

Desktop teams appear side by side with up to three cards each; mobile stacks
groups and uses two cards per row. Own-card borders are yellow, while team
headings and the Tu equipo badge use team color. The root class is
`.pk-lobby-team-roster`; `.pk-roster` already belongs to results and must not be
reused. Shared headings use classed divs to avoid games' bare-header CSS.

`lobby-roster.browser.js` checks card actions, readiness, focus and mobile width.
`table-seating.browser.js` proves actual guest self-swaps, host arrangements,
results/setup and host migration over two clients. Billar's six-client suite
checks its grouped roster before all six players take real shots.

## Regression checks

`node Pana/engine/tests/ui.browser.js [playwright-package] [browser]` against
`npm start`. It covers hub → game persistence, live resolution changes, Esc,
focus containment and return, input blocking, invite links and `M`.

## Shared reference sala

Carreritas and Pepazo opt into `engine/sala.js`/`sala.css` after scene preparation.
Their original lobby exposes `panaSala.read()` with connection state, summary,
real members and kit ratings; `openKit` opens the existing workshop/armory.
The shared shell still owns membership, readiness, invite links and the start
barrier. Clicking your own card uses that same readiness action; empty cards
copy the room link. Carreritas opens its existing room connection before copying
an invite when currently local. No prototype sample players are fabricated.

Connection status and Reintentar occupy one place at the settings card's foot.
Offline keeps a yellow local-play action; retry reloads the existing connection
flow. Pepazo's actual team arrangement remains under Más ajustes so the eight
sala cards stay in place. Other games retain their existing lobby presentation.

Await the sala stylesheet before clearing `PANA_LOBBY_LOADING`; a game's own
`PANA_PREPARED` can be true before the shell has docked its final controls.
Browser readiness checks require both. `sala.browser.js` proves two-client
readiness, host permissions, personal workshop persistence, kit ratings, team
settings and offline retry; `lobby.browser.js` covers the generic shell.
