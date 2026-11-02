# HUD instructions audit

Instructions never go on the HUD; they live in the pause-menu Instrucciones
page (`engine/controls-page.js`). An instruction is any text shown during play
that explains controls or how to play: key lists, `<kbd>` keycaps that only
remind a key, "Clic para…", "Mantén…", hint, tip, legend and help elements,
how-to cards shown during play, and `mountControlHints` lines. A contextual
prompt may stay: it appears only when it matters and says what is happening or
what can be done right now ("E Agarrar" beside a treasure, "¡Tu turno!",
"Sin pepas · R para recargar", a countdown). Lobby text is listed and marked
"lobby"; it is lower priority. The `createGameMenu({ controls, tips, pad })`
data is the pause menu, not the HUD, and is the source for the new page.

Line numbers are from `Pana/` at the time of the audit. Paths are relative to
`Pana/games/<game>/public/` unless they start with `engine/`.

Classification rules used throughout:

- A `<kbd>` that carries `data-pana-hint` is a keyboard reminder by the
  codebase's own definition: instruction (drop the keycap, keep the button).
- A `<kbd>` on a button that only appears or enables when its action is
  available (the "E Usar" style prompt) is contextual.
- A static `<kbd>` with no `data-pana-hint` on a permanent HUD button is an
  instruction keycap.
- State lines that change with the situation stay, even when one branch names
  a key; branches that are pure control teaching are listed separately.

## Engine pieces

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| `engine/control-hints.js` (`mountControlHints`, lines 62-97; `keyFor`, line 54) | Once per session at round start, dismissed on any input | The game's hint list, e.g. "WASD caminar" | instruction | Instrucciones page (only pintura mounts it) |
| `engine/kit.css:349-350` `.pk-hints` | Wherever a game uses it | Key-list styling | instruction (style) | Remove when no game uses it |
| `engine/kit.css:352-354` `.pk-control-hints` | With `mountControlHints` | Styling of the hint line | instruction (style) | Remove with `mountControlHints` users |
| `engine/ui.css:183`, `engine/ui.js:22-23`, `engine/settings.js:42`, `engine/ui.js:131,147,154,239` | Setting "Ayudas de controles en pantalla" toggles `.pana-no-hints` which hides `[data-pana-hint]` | "Ayudas de controles en pantalla" | settings switch | Becomes moot once no HUD hints remain |
| `engine/ui.js:306-308` `createButton` `<kbd data-pana-hint>Esc</kbd>` | Menu button in every game's nav | "Menú Esc" | instruction (keycap) | Instrucciones page (drop the keycap) |
| `engine/ui.css:335` | Hides `[data-pana-hint]` and loose `kbd` on gamepad/touch | n/a | rule | Keep until keycaps are gone |
| `engine/touch.js:137-140` orientation overlay | Touch device in the wrong orientation | "Gira tu teléfono" | contextual prompt | stays (contextual) |

## billar

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:70 `#charge-tip.charge-tip` (shown by game.js:229; CSS style.css:31, hud-banderin.css:31,36,45; referenced by `aria-describedby` at index.html:68) | Your turn, not ball in hand | "Mantén para cargar; suelta para tirar." | instruction | Instrucciones page |
| index.html:68 `#shoot` `<kbd data-pana-hint>` | Your turn | "Espacio" | instruction (keycap) | Instrucciones page |
| index.html:57 `.side-label` `<kbd data-pana-hint>` (CSS style.css:62) | During play | "Cámara C" | instruction (keycap) | Instrucciones page |
| game.js:221 `#message` (ball in hand branch) | Ball in hand, your turn | "Toca un lugar libre de la mesa. Después apunta y tira." / "Coloca en la zona amarilla…" | contextual prompt | stays (contextual) |
| index.html:60 power bar "Suelta" | While charging | "Suelta" | contextual prompt | stays (contextual) |
| index.html:31 `#rules` | Lobby | "Cómo se juega" | lobby | Lobby help button |

Menu data: game.js:49 `createGameMenu`, pad at 50, controls at 53, tips at 54.

## bochinche

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:72 `p.key-guide[data-pana-hint]` (CSS style.css:19,27; hud-banderin.css:86) | Whole fight | "A D mover · Espacio saltar · J golpe · K especial · Shift escudo · L agarre" | instruction | Instrucciones page |
| index.html:51-52 `#rules`, "Probar rayos" | Lobby | "Cómo se juega" | lobby | Lobby help button |

Menu data: game.js:60 `createGameMenu`, pad at 61, controls at 65, tips at 66 (lightning-lab.js:9 has its own lab menu with controls).

## bululu

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:57 `div.keys[data-pana-hint]` (CSS style.css:207,239-247,526) | Board phase | "Espacio: tirar / saltar · A D: moverte · Tab: ver tablero · L: luz · M: sonido · Esc: pausa" | instruction | Instrucciones page |
| index.html:51-55 `div.legend` (CSS style.css:207,210-237,510) | Board phase | "+3 Gana 3", "−3 Pierde 3", "? Evento loco" | instruction (legend) | Instrucciones page |
| index.html:123-131 `#mini-intro` with `#mini-howto`, `#mini-keys` (game.js:640-648; online-view.js:11-14,20,32-36; CSS style.css:389-391,537,596-597; data from each `minigames/*.js` `howto` and `keys`) | Before every minigame, until ¡Listo! | e.g. "Salta el tronco cuando pase por debajo…", "Espacio / W saltar" | instruction (how-to card) | Instrucciones page (needs per-minigame section); keep title, prize and ready row |
| index.html:49 `#look` `<kbd data-pana-hint>` and board-camera.js:47 | Board phase | "Ver tablero Tab" / "Volver Tab" | instruction (keycap) | Instrucciones page |
| game.js:326 `#prompt` buttons `<kbd data-pana-hint>` | Choice prompts | e.g. "¡Listo! Espacio" | instruction (keycap) | Instrucciones page (keep buttons) |
| index.html:66 `#mini-hint` (presentation.js:72-78, `hint()` in minigames/caigas.js:231, choque.js:340, coleo.js:304, embuste.js:210, momia.js:262, raudal.js:93, remolino.js:94) | During a minigame | e.g. "¡JALA LA COLA AHORA!", "Turbo listo (Espacio)", "¡A votar! ← → elige · Espacio vota por {name}" | contextual prompt | stays (contextual); key names in choque/embuste/raudal/remolino lines could be dropped |
| index.html:38 `#minimap` title | Hover only | "Toca el mapa para mirar ahí" | tooltip | stays |
| index.html:113 `#start` `<kbd data-pana-hint>` | Lobby | "¡A jugar! Espacio" | lobby | Lobby |

Menu data: game.js:111 `createGameMenu` (pad at 111), controls at 115, tips at 117.

## caida

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:76 `span.rack-keys[data-pana-hint]` (CSS style.css:105-106,185) | Whole hand | "1–3 elegir C cantar" | instruction | Instrucciones page |
| cards.js:9 `span.card-key[data-pana-hint]` (CSS style.css:131) | On each card in hand | "1", "2", "3" | instruction (keycap) | Instrucciones page |
| index.html:85 `#play` `<kbd data-pana-hint>` | Whole hand | "Jugar ↵" | instruction (keycap) | Instrucciones page |
| index.html:87 `#hint` `<kbd data-pana-hint>` | Whole hand | "Pista H" | instruction (keycap) | Instrucciones page |
| index.html:74 `#instruction` (game.js:143) | Whole hand, text follows state | "Elige una carta para ver tu jugada." / capture preview | contextual prompt | stays (contextual) |
| index.html:75 `#canto-help` (game.js:135) | When a canto is available | "{canto}. Canta antes de jugar." | contextual prompt | stays (contextual) |
| dealer-ui.js:38-48 `#dealer-description` etc. | Dealing phase | "Corta si quieres. Elige con cuál número tentar la suerte." | contextual prompt | stays (contextual) |

Menu data: game.js:33 `createGameMenu` (pad at 33), controls at 35, tips at 36.

## capis

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:57-63 `div.pk-hints.hints[data-pana-hint]` (CSS style.css:64,69,74) | Whole match | "A D Caminar", "W S / ↑ ↓ / ratón Apuntar", "Espacio / clic Mantén para cargar, suelta para disparar", "1–5 / Q E / Tab Cambiar de arma", "Enter Saltar · Z Ver todo el mapa" | instruction | Instrucciones page |
| index.html:54 `#weapon-note` (hud.js:43, weapons.js blurbs) | Weapon bar, selected weapon | e.g. "Rebota y explota a los 3 segundos: métela detrás de una loma o en un hueco." | contextual prompt | stays (contextual) |
| index.html:38 `#turn-note` (hud.js:70-71) | Turn phases | "¡Corre a cubrirte!", "¡Dispara ya!" | contextual prompt | stays (contextual) |
| index.html:30 `#seed-help` | Lobby | "Cada partida trae un mapa nuevo…" | lobby | Lobby |

Menu data: game.js:49 `createGameMenu`, pad at 50, controls at 52, tips at 55.

## carreritas

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:191-199 `div.keys.pk-hints[data-pana-hint]` (race-hud.js:7 `HINT_S`, 69 toggles `#race.hints`; CSS style.css:256-259,295,344,428,466; already forced hidden by style.css:524-525) | Countdown and first 6 s | "W Acelerar", "S Frenar", "A D Girar", "Shift Derrape", "Espacio Objeto adelante", "X Objeto atrás · control X", "Esc Pausa" | instruction | Instrucciones page |
| index.html:220 `small.p2-keys` (CSS style.css:291-292; hidden by 525) | Split screen | "Flechas · Shift der. derrapa · Enter objeto · Punto atrás · Coma cambia · Retroceso rescate" | instruction | Instrucciones page (player 2 section) |
| index.html:163 `#swap-item` `<kbd>` (CSS style.css:427) | Race | "Q" | instruction (keycap) | Instrucciones page |
| index.html:167-168 `#throw-front`, `#throw-back` `<kbd>` (CSS style.css:202,427) | Race | "Adelante Espacio", "Atrás X" | instruction (keycap) | Instrucciones page |
| index.html:158,161 `span.slot-key` (CSS style.css:190) | Race | "1", "2" | instruction (keycap) | Instrucciones page (low priority, also numbers the slots) |
| index.html:182 `#drift-hint` (game.js:1662-1665; CSS style.css:236,389) | While drifting | "Suelta: turbo" / "Derrape asistido" | contextual prompt | stays (contextual) |
| index.html:165 `#item-status` (game.js:1783-1784; items.js:725) | Item events | "Dos objetos: usa uno para abrir otra caja" | contextual prompt | stays (contextual) |
| index.html:150 `#coins` title | Hover only | "Cada moneda da +0,8% de velocidad…" | tooltip | stays |
| index.html:259-261 `.loading-tip` (loading.js:14-31 `TIPS`; game.js:840-848) | Loading screen | e.g. "Mantén el botón de derrape y gira…" | lobby | Lobby/loading (could also feed tips) |
| index.html:120,124 loadout `<kbd>` | Taller | "Q", "Esc" | lobby | Lobby |

Menu data: game.js:1092 `createGameMenu` with `pad.help` at 1092, controls at 1097, tips at 1099 (per-driver controls helper near 1197).

## chapita

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:62 `p.hint` (CSS style.css:66,85) | At bat | "Batea cuando el aro amarillo se cierre y se ponga verde. El palo va a la altura solo; W/S para elegirla tú." | instruction | Instrucciones page |
| index.html:48 `#kinds` `<kbd data-pana-hint>` | Pitching | "1", "2", "3" | instruction (keycap) | Instrucciones page |
| index.html:49 `#sides` `<kbd data-pana-hint>` | Pitching | "Q", "E" | instruction (keycap) | Instrucciones page |
| index.html:50 `#caps` `<kbd data-pana-hint>` | Pitching | "C" | instruction (keycap) | Instrucciones page |
| index.html:54 `#throw` `<kbd data-pana-hint>` | Pitching | "¡Lanza! Espacio" | instruction (keycap) | Instrucciones page |
| index.html:58 `#heights` `<kbd data-pana-hint>` | At bat | "W", "S" | instruction (keycap) | Instrucciones page |
| index.html:61 `#swing` `<kbd data-pana-hint>` | At bat | "¡Batea! Espacio" | instruction (keycap) | Instrucciones page |
| index.html:66 `#catch` `<kbd data-pana-hint>` | Catch chance | "¡Atrápala! Espacio" | instruction (keycap) | Instrucciones page |
| style.css:91 `[data-pana-hint] { display: none; }` | Small screens | n/a | rule | Remove with the keycaps |
| index.html:40 `#house-rules` (hud.js:44; CSS style.css:35-37,80) | Whole match | "Regla: {house rule}" | instruction (rules reminder) | Instrucciones page (active house rules) |
| index.html:60 `#bat-cue` (game.js:178-179,186) | At bat | "¡Ahora! · palo alto", "Mira el aro en el plato: batea cuando se cierre" | contextual prompt | stays (contextual) |
| index.html:41 `#matchup` (game.js:124) | Between pitches | matchup text | contextual prompt | stays (contextual) |
| index.html:26 `#hand` `<kbd data-pana-hint>` | Lobby | "Batear de zurdo Z" | lobby | Lobby |

Menu data: game.js:37 `createGameMenu` (pad at 37), controls at 39, tips at 41.

## cocina

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:42 `div.controls.pk-hints[data-pana-hint]` (CSS style.css:96,124,165,177) | Whole shift | "W A S D Moverte", "E Recoger / dejar", "Shift Apurarte" | instruction | Instrucciones page |
| index.html:41 `#held-next` (game.js:185) | Whole shift, follows what you hold | "Busca ingredientes para un pedido.", "Llévalos a una tabla de preparar." | contextual prompt | stays (contextual) |
| index.html:41 `#action` `<kbd>` + `#action-label` | Near a station | "E Acércate a una estación" / station action | contextual prompt | stays (contextual) |

Menu data: game.js:61 `createGameMenu`, pad at 62, controls at 66, tips at 67.

## criollas

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:48 `p.control-hint[data-pana-hint]` (CSS style.css:44,64,74) | Your throw | "Toca la cancha para apuntar · ← → dirección · Mantén Espacio: la fuerza sube y baja, suelta para lanzar" | instruction | Instrucciones page |
| index.html:45 `#shoot` `<kbd data-pana-hint>` | Your throw | "Espacio" | instruction (keycap) | Instrucciones page |
| index.html:35 `.side-label` `<kbd data-pana-hint>` (CSS style.css:62) | During play | "Cámara C" | instruction (keycap) | Instrucciones page |
| index.html:49 `#guide-note`, static branch game.js:149 | Normal difficulty, not aiming | "El blanco indica dónde frena sin choques. Mantén y suelta para ajustar la distancia." | instruction | Instrucciones page (keep the difficulty note) |
| `#guide-note` live branch game.js:190 | While aiming | "{n}% de fuerza", "Se va fuera: reduce la fuerza…" | contextual prompt | stays (contextual) |
| game.js:163 `#shoot` label | Your throw | "Mantén para lanzar" / "Suelta para lanzar" | contextual prompt | stays (contextual, button label) |

Menu data: game.js:44 `createGameMenu` (pad at 44), controls at 46, tips at 47.

## curiara

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:59 `#keys-hint.pk-hints.keyboard-hints[data-pana-hint]` (game.js:235; CSS style.css:83,100) | Whole race (paddler) | "W sostener: remo automático", "A D remar alternando", "D D girar a la izquierda", "S ciar", "Espacio salpicón" | instruction | Instrucciones page |
| index.html:60 `#helm-hint.pk-hints.keyboard-hints[data-pana-hint]` (game.js:235) | Whole race (popa) | "A D sostener: timón", "A D justo con la remada: ¡Ahora!", "S ciar", "Espacio salpicón" | instruction | Instrucciones page (popa section) |
| index.html:55 `#paddle-tip` default text, and `tipText` branches game.js:184, 185, 193 (CSS style.css:77,146) | Whole race when nothing else happens | "Alterna A y D. Rema cuando el anillo llegue a la zona dorada.", "Toca A y D para remar…", "Sostén A o D para el timón…", "Alterna A y D en la zona dorada del anillo, o sostén W y rema solo." | instruction | Instrucciones page |
| `#paddle-tip` situation branches game.js:175-192 (`tipText`, filled at 231) | Caimán, raudal, remolino, capsized, chapoteo, auto | e.g. "¡Caimán cruzando adelante!…", "Machacar frena la curiara…" | contextual prompt | stays (contextual) |
| index.html:51 `#next-key` (game.js:165,306) | Rhythm ring | "A", "A / D", "W" | contextual prompt | stays (contextual) |
| index.html:38 `div.pk-hints.lobby-hint[data-pana-hint]` (CSS style.css:34-35,100) | Lobby | "W sostener: remo automático", "A D remar alternando", "S ciar", "Espacio salpicón" | lobby | Instrucciones page or drop |

Menu data: game.js:48 `createGameMenu` (pad at 48), controls at 49, tips at 50.

## domino

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:59 `span.rack-keys[data-pana-hint]` (CSS style.css:82-83,171) | Whole hand | "1–0 ficha A B punta" | instruction | Instrucciones page |
| index.html:68 `#pass` `<kbd data-pana-hint>` | When you must pass | "Pasar P" | instruction (keycap) | Instrucciones page |
| index.html:70 `#hint` `<kbd data-pana-hint>` | Whole hand | "Pista H" | instruction (keycap) | Instrucciones page |
| index.html:58 `#instruction` (game.js:184) | Whole hand, follows state | "Elige dónde colocar tu ficha.", "Toca una ficha marcada para jugarla.", "Ve pensando tu próxima jugada." | contextual prompt | stays (contextual); "Toca una ficha marcada…" is the most instruction-like branch |
| index.html:62 `#turn-status` (game.js:178) | Turn | "¡Tu turno! · juega al {a} o al {b}" | contextual prompt | stays (contextual) |

Menu data: game.js:47 `createGameMenu`, pad at 48, controls at 52, tips at 53.

## embuste

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:67 `div.controls.pk-hints[data-pana-hint]` (CSS style.css:94-96,157,169,179) | Whole night | "W A S D Moverte", "E Usar · mantén para reparar", "R Reportar" | instruction | Instrucciones page |
| index.html:58-63 action buttons `<kbd>` (CSS style.css:179) | Action bar, enabled when usable | "R Reportar", "Q Envolver", "F Sabotaje", "C Disfraz", "V Al otro lado", "E Usar" | contextual prompt | stays (contextual) |
| index.html:75 `#task-hint` (game.js:467; tasks.js:246-250 `HINTS`) and per-task `.task-hint` status lines (tasks.js:60,110,133,158,183,199,233) | Inside an open task | e.g. "Mantén pulsado para subir el balde de la mina.", "Arrastra cada pedazo a su lugar." | contextual prompt | stays (contextual, the task's own goal) |
| index.html:55 `#ghost-note` | After being wrapped | "Atraviesas paredes y puedes seguir haciendo tareas…" | contextual prompt | stays (contextual) |
| index.html:54 `#hidden-copy` (game.js:381-382) | Hidden or disguised | "{spot}. Cruza al otro lado o sal con E." | contextual prompt | stays (contextual) |
| index.html:43 `#reveal-copy` (game.js:301-303) | Role reveal | "Mantén el campamento funcionando…" | contextual prompt | stays (contextual) |

Menu data: game.js:62 `createGameMenu` (pad at 62), controls at 65, tips at 66.

## escondidas

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:55 `div.controls.pk-hints[data-pana-hint]` (CSS style.css:95,113,119) | Whole round | "W A S D Moverte", "Ratón Mirar", "Shift Correr", "1–5 Cambiar", "V Verte", "Tab Tabla" | instruction | Instrucciones page |
| index.html:42 `p.lock-hint` (CSS style.css:171,178,185) | First person, pointer not captured | "Haz clic para mirar con el ratón · V para verte desde atrás" | contextual prompt (first half) / instruction (second half) | Keep "Haz clic para mirar con el ratón"; move "V para verte desde atrás" to Instrucciones page |
| index.html:50 `#disguise-tip` (game.js:200) | Hider | "Elige un objeto para camuflarte." / "Quédate quieto para camuflarte." | contextual prompt | stays (contextual) |
| index.html:50 `#revert` `<kbd>` | Disguised | "Volver a pana Q" | contextual prompt | stays (contextual) |
| index.html:53 `#action` `<kbd>` | Near a prop or hider | "E Copiar objeto cercano" | contextual prompt | stays (contextual) |

Menu data: game.js:88 `createGameMenu`, pad at 89, controls at 93, tips at 95.

## galope

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:52 `div.pk-hints.keyboard-hints[data-pana-hint]` (CSS style.css:68,80) | Whole race | "W ↑ avanzar", "A D girar", "S ↓ frenar", "Shift remate", "Espacio saltar", "R volver al camino" | instruction | Instrucciones page |
| index.html:46 `#jump-cue` / `#jump-key` (game.js:43) | Log ahead | "¡Tronco!" "Espacio para saltar" / "Toca Salto" | contextual prompt | stays (contextual) |
| index.html:50 `#riding-tip` (game.js:121) | Whole race, follows state | "¡El tronco! Salta un poco antes.", "Guarda fuerzas para el remate." | contextual prompt | stays (contextual) |
| index.html:35 `div.pk-hints.lobby-hint[data-pana-hint]` (CSS style.css:29-30,80) | Lobby | "WASD cabalgar", "Shift remate", "Espacio saltar" | lobby | Instrucciones page or drop |

Menu data: game.js:33 `createGameMenu` (pad at 33), controls at 34, no tips.

## lancha

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:56 `div.pk-hints.keyboard-hints[data-pana-hint]` (CSS style.css:73,88) | Whole race | "W sostener: acelerar", "A D girar", "S frenar y retroceder", "Espacio turbo" | instruction | Instrucciones page |
| index.html:52 `#drive-tip` default text and `driveTip` default branch game.js:126 (CSS style.css:69,123) | Race start / nothing else happening | "Sostén W para acelerar. No lo machaques: sostenido vas más rápido.", "Busca el chorro: el agua rápida llena el turbo." | instruction | Instrucciones page |
| `#drive-tip` situation branches (`driveTip`, game.js:112-125, filled at 162) | Stall, caimán, remolino, raudal, no throttle, turbo ready | e.g. "¡Turbo listo! Espacio en una recta." | contextual prompt | stays (contextual) |
| game.js:161 `#turbo-label` | Turbo full | "listo · Espacio" | contextual prompt | stays (contextual) |
| index.html:35 `div.pk-hints.lobby-hint[data-pana-hint]` (CSS style.css:25-26,88) | Lobby | "W sostener: acelerar", "A D girar", "Espacio turbo" | lobby | Instrucciones page or drop |

Menu data: game.js:42 `createGameMenu` (pad at 42), controls at 43, tips at 44.

## ludo

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:37 `p#roll-tip.roll-tip[data-pana-hint]` (CSS style.css:83,127,140; `aria-describedby` at index.html:36) | Whole match | "Mantén el botón o Espacio para agitar el dado y suelta para tirar, o arrástralo y suéltalo sobre la mesa." | instruction | Instrucciones page |
| index.html:40 `p.safe-legend` (CSS style.css:88-89,107,130,149) | Whole match | "Doble borde: seguro. Aquí no se come." | instruction (legend) | Instrucciones page |
| index.html:36 `#roll` `<kbd data-pana-hint>` | Whole match | "Espacio" | instruction (keycap) | Instrucciones page |
| index.html:41 `#details` `<kbd>` (CSS style.css:87,107) | Whole match | "Ver panas Shift" | instruction (keycap) | Instrucciones page |
| hud.js:55 piece button `<kbd>` | Whole match | "1"–"4" | instruction (keycap) | Instrucciones page |
| hud.js:44-46 `#turn`, `#event`, `#roll-label` | Turn | "¡Te toca tirar!", "Agita y suelta" | contextual prompt | stays (contextual) |

Menu data: game.js:25 `createGameMenu` (pad at 25), controls at 27, tips at 28.

## parapente

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:40 `p#tip.tip` (`tip()` game.js:68-78, filled at 121; CSS style.css:33,44,51) | Whole flight, follows state | "Estás en una térmica: gira cerrado con frenos (S + A o D) y sube.", "Rumbo a {place}. Con altura de sobra, el acelerador (W) gana tiempo." | contextual prompt | stays (contextual); key names at game.js:72,73,77 could be dropped |
| index.html:24 `#rules` | Lobby | "Cómo se vuela" | lobby | Lobby help button |

Menu data: game.js:29 `createGameMenu`, pad at 30, controls at 32, tips at 33.

## pintura (Pepazo)

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:37 `#control-hints.control-hints` (game.js:18 import, 53-56 `mountControlHints`, 326 `controlHints.show()`, 392 dispose; CSS style.css:11, hud-banderin.css:88,107) | First round start, once per session | "WASD caminar", "Ratón mirar", "Clic pintar", "Clic der. apuntar", "R recargar", "G granada" | instruction | Instrucciones page |
| index.html:39 `#spectate-hints.spectate-hints` (spectate-hud.js:9 import, 21-23 mount, 26 `done`, 58 show/hide; CSS style.css:79) | Spectating, once per session | "Q / E cambiar de pana", "Espacio cancha desde arriba" | instruction | Instrucciones page |
| index.html:38 `#spectate` buttons `.spectate-key` (CSS style.css:76) | Spectating | "Q", "E", "Espacio" chips on the spectate buttons | contextual prompt | stays (contextual) |
| index.html:35 `#reload-prompt` / `#reload-text` (combat-hud.js:14,59) | Empty or reloading | "Sin pepas · R para recargar" | contextual prompt | stays (contextual) |
| index.html:18 `p.instructions` (CSS style.css:14) | Lobby | "En primera persona: WASD para caminar · ratón para mirar · clic para pintar · R para recargar." | lobby | Instrucciones page or drop |

Menu data: game.js:84 `createGameMenu` (pad at 84), controls at 69 and tips at 70-77 passed at 89; the same `{ controls, tips }` go to `createRoomOptions` help at 78.

## poquer

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| none found | | | | |
| index.html:18 `#turn` (game.js:73,116-117) | Turn | "¡Tu turno! · {n} s" | contextual prompt | stays (contextual) |

Menu data: game.js:33 `createGameMenu` (pad at 33), controls at 36, tips at 37.

## qqsmp

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| none found | | | | |
| index.html:46-49 comodín button `title` attributes | Hover only | e.g. "Marca lo mismo que otro pana, sin ver qué puso" | tooltip | stays |

Menu data: game.js:36 `createGameMenu` (pad at 36), controls at 38, tips at 39.

## reliquia

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:54 `div.controls.pk-hints[data-pana-hint]` (CSS style.css:99) | Whole expedition | "E Agarrar", "Q Soltar", "G Lanzar", "R Arrastrar", "1–7 Gritar", "Tab Equipo" | instruction | Instrucciones page |
| index.html:50 hand slots `span.pk-slot-n` (game.js:164 touch relabel; CSS style.css:114) | Whole expedition | "Clic", "Clic der." | instruction (keycap) | Instrucciones page (keep slots) |
| index.html:46 `#prompt` `<kbd>` + `#prompt-label` | Aiming at something usable | "E Agarrar" | contextual prompt | stays (contextual) |
| index.html:57 `#downed-copy` (hud.js:148) | Downed | "Un pana puede levantarte (E) o arrastrarte al camión (R)." | contextual prompt | stays (contextual) |
| index.html:45 `#choice-votes` | Vote to leave | "1 · Nos vamos 2 · Una sala más" | contextual prompt | stays (contextual) |

Menu data: game.js:45 `createGameMenu`, pad at 46, controls at 49, tips at 52.

## stop

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:42 `#para` `<kbd data-pana-hint>` | Your wheel turn | "¡Para! Espacio" | instruction (keycap) | Instrucciones page |
| hud.js:40 `#wheel-line` | Wheel phase | "¡Te toca! Grítale a la rueda" | contextual prompt | stays (contextual) |
| game.js:100-103 `#sheet-note` | Writing phase | "Una sola letra no vale: escribe la palabra.", "¡Todo lleno! Grita ¡STOP!" | contextual prompt | stays (contextual) |

Menu data: game.js:34 `createGameMenu` (pad at 34), controls at 36, tips at 37.

## tambor

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:49 `#station-hint.hint` (hud.js:74,77; data songs.js:17-20 `hint`; CSS style.css:48) | Whole song as a drummer | "Espacio en el contratiempo", "← y → (o F y J), cada mano su cuero", "Mantén Espacio y suelta en el golpe", "Mantén Espacio en los momentos grandes", "← y → (o F y J): repite el golpe del MCP" | instruction | Instrucciones page (per station) |
| index.html:54 `#clap` `<kbd>` | In the crowd | "Aplaudir Espacio" | instruction (keycap) | Instrucciones page |
| index.html:55 `#want-in` `<kbd>` | In the crowd | "¡Quiero entrar! Q" | instruction (keycap) | Instrucciones page |
| hud.js:23 dicho buttons `<kbd>` | In the crowd | "1"–"n" | instruction (keycap) | Instrucciones page |
| index.html:56 `#jump` `<kbd>` | When you may enter | "¡Entro! E" | contextual prompt | stays (contextual) |
| index.html:42 `#call-hint` (hud.js:17 `callHint`, 60; data rules.js:25-30) | Dancer, on each MCP call | "← o → en el golpe", "Mantén Espacio dos tiempos", "Espera el llamado del MCP" | contextual prompt | stays (contextual, the call's input) |
| index.html:73-75 `#calibration` | Calibration dialog | "Ocho golpes. Toca Espacio o el botón justo cuando los oigas…" | lobby | Lobby/setup |

Menu data: game.js:34 `createGameMenu` (pad at 34), controls at 37, tips at 40.

## trifulca

| Element (file:line, id/class) | When shown | What it says (Spanish, quoted) | Kind | Where it moves |
|---|---|---|---|---|
| index.html:58-68 `#keys.keys` (hud.js:234-242 `keys()`, called from game.js:107; 285-288 lesson highlight; 290 visibility; CSS style.css:136-140,154,158; hud-banderin.css:56-63,111,120-123,128) | Whole fight | "J Golpe mantén: trompón", "K Cubrirse", "Espacio Esquivar", "L Agarrar", "I Patada", "U Barrida", "O Volteo", "T ¡Dale!", "WASD Moverte" | instruction | Instrucciones page |
| index.html:57 `p#role.role` control-list branches (`roleText` hud.js:246 fighter branch, 251-253; filled at 283, toggled at 291; CSS style.css:91-92,107; hud-banderin.css:77) | Intro and fight when `#keys` is hidden | "¡Prepárate! Golpe J · Cubrirse K · Esquivar Espacio · Agarrar L", "J golpe (mantén: trompón) · K cubrirse · Espacio esquivar · L agarrar · I patada · U barrida · O volteo" | instruction | Instrucciones page |
| `#role` other branches (hud.js:246 spectator, 248-250, 255) | Spectator, out, bench, after | "Eres el ring: J empuja pa' dentro…", "En la esquina: recuperas el aire…", "L: mano de caballero" | contextual prompt | stays (contextual) |
| index.html:56 `#prompt` (hud.js:216-231 `prompt()`) | Openings | "¡ESQUIVA! Espacio", "¡Quedó abierto! J" | contextual prompt | stays (contextual) |
| hud.js:72-90 `TIPS` / `coach()` into `#feed` | Practice alone, once per event | "Tip: si se cubre, agárralo con L…" | contextual prompt | stays (contextual); also good material for the page's tips |
| index.html:69-77 `#tutorial` (hud.js `LESSONS` from line 19, 188-212 `tutorialCard`) | Tutorial mode only | step cards with keys | contextual prompt (tutorial mode) | stays (contextual) |
| index.html:26 `#rules` | Lobby | "Tutorial: cómo se pelea" | lobby | Lobby |

Menu data: game.js:29 `createGameMenu` with `pad.help` at 29, controls at 32, tips at 35.

## Empty boxes in headless captures

Headless Chrome screenshots of Lancha, Galope, Curiara, Escondidas and Billar
sometimes show a flat box (dark, or pale blue in Billar) over the 3D view.
No DOM element is there: the page background shows through a patch of the
WebGL canvas that the capture did not composite, while the game's own frame
buffer holds the scene at those pixels. It is a capture artifact, not a HUD
panel. Real empty panels are caught by `engine/tests/hud-layout.browser.js`,
which fails on a visible box that paints a background or border with no text,
picture, canvas, control or painted child inside (colour swatches and
`role=img` count as content).
