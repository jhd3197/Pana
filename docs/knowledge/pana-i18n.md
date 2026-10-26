# Languages (Idioma)

Pana speaks Spanish and English. Spanish is the source: every player-facing
phrase is written in Spanish in the code, and **the Spanish text itself is the
key**. English lives in flat dictionaries that map Spanish to English. The same
phrase in two places is translated once.

## How it works

- `Pana/engine/i18n.js` picks the language: the address (`?pana-language=en`),
  then the saved choice (Ajustes → Idioma, `language` in `pana:settings`),
  then the browser's languages, then Spanish. Automated browsers
  (`navigator.webdriver`) stay in Spanish unless the address names a language,
  so every suite, `npm run shots` and `npm run perf` keep their Spanish text.
- The dictionary loads with top-level `await` before any module that imports
  `i18n.js` runs, so `loc()` works at module level (constant tables).
- In any language but Spanish, a `MutationObserver` translates every text node
  and the `title`, `aria-label`, `placeholder`, `alt`, `aria-description` and
  `data-tip` attributes whose whole text (spaces collapsed) is a key. Static
  markup needs nothing. In Spanish nothing runs: the default page is byte for
  byte what it was.
- `translate="no"` (or `node.translate = false`) keeps a subtree as it is: game
  names, player names, chat, codes.
- A language change applies on the next load. The hub and `/ajustes.html`
  reload at once; a game shows a "Recargar ahora" note, because a reload
  restarts the match.

## Writing text

```js
import { loc, locn, locKey, formatList, formatNumber } from '/engine/i18n.js';
el.textContent = loc('Seguir jugando');
el.textContent = loc('Panas en la sala · {n} / {max}', { n, max });  // never `${}`
el.textContent = locn(fichas, '{n} ficha', '{n} fichas');             // plurals
el.textContent = loc('Esperando a {names}.', { names: formatList(names) });
```

- The names are `loc`/`locn`/`locKey`, not `t()`: 340 files use `t` for time.
- A sentence is one key. Never build one from pieces (`'S' + 'ale'`,
  `` `${note}: s` ``, `' en local'` appended): the order changes between
  languages. Write the whole sentence with `{placeholders}`.
- Text drawn on a canvas, put in `aria-label` by code, compared with
  `textContent`, or written into CSS `content` goes through `loc()`: the
  observer only sees the DOM.
- One Spanish word with two meanings: `loc('Mano', { $ctx: 'tambor' })` (key
  `tambor::Mano`).
- Inside `engine/` and in code a server room loads (`rules.js`, `options.js`,
  `server/`), import `i18n.js` by a relative path, like `random.js`.

## Multiplayer: keys on the wire, text on the screen

Most games simulate on the host and send state to everyone, and each client
may use a different language. **Never put `loc()` output into room state,
messages or anything another client reads.** Put the Spanish source there,
marked with `locKey()` so it is collected, plus its variables, and translate
where it is shown:

```js
// rules.js / host / server
state.notice = { text: locKey('{name} pasó'), vars: { name: player.name } };
// scene.js / game.js, on every client
noticeNode.textContent = loc(state.notice.text, state.notice.vars);
```

A constant sentence can travel as a plain string and be shown with
`loc(received)`. The engine's `quien-empieza` note is `locKey()` text for this
reason; billar, domino and ludo pass it through `loc()`.

## What stays Spanish

These are content, not interface, and stay Spanish in every language. Mark a
file that holds only such content `// i18n-ignore-file: <why>` and a single
line `// i18n-ignore`:

- Game names (Carreritas, Dominó…) and `game.json` `name`/`tileName`. Hub tiles,
  the lobby title, the loading cover and the pause menu mark them `translate="no"`.
- Venezuelan dichos (`engine/play/frases.js`), NPC barks built from them, and
  pre-recorded or text-to-speech narration (QQSMP, Tambor).
- Trivia questions (QQSMP) and word-game content checked against Spanish words
  (Stop answers). Stop's category names are interface and are translated.
- World signage painted in the 3D world, track, map and place names.
- Anything a player typed.

## Files and tools

- `Pana/engine/locales/en.json`: phrases of the engine and the hub, and any
  phrase two games share.
- `Pana/games/<id>/public/locales/en.json`: the rest of that game, including
  its `game.json` description (the hub reads it translated from
  `/api/games?lang=en`). A game may also hold its own translation of a shared
  phrase; it wins in that game.
- Plural entries are `{ "one": "…", "other": "…" }`; the Spanish key is the
  singular form.

```powershell
npm run i18n                          # per file: phrases and how many are translated
npm run i18n -- literals --game domino --show   # Spanish literals not in loc()
npm run i18n -- wrap <file…>          # wraps clear ones in loc(); lists the rest
npm run i18n -- sync --game domino    # writes the game's file ("" = to translate)
npm run i18n -- todo --game domino    # what is left, as JSON
npm run i18n -- fill <file.json> --game domino  # copies translations in
npm run i18n -- sync                  # full: promotes phrases two games share
npm run i18n -- check                 # missing, orphan or {placeholder} mismatches
```

`wrap` is a starting point. Read its diff: it skips selectors, class names and
shaders, but a Spanish-looking id or event name can still slip in. It never
wraps template literals with `${}`; those are rewritten by hand with
placeholders.

## English style

- Short, friendly, plain. Exclamations keep their energy: `¡A jugar!` → `Let's play!`.
- `pana` is the player's capybara: `Tu pana` → `Your pana`. People are
  `friends` or `players`: `Invitar panas` → `Invite friends`.
- Foods, places and Venezuelan things keep their names (arepas, tequeños,
  Plaza Pana, the Llanos). Slang is rendered by meaning, not word for word.
- Keep `{placeholders}` exactly; `check` fails when they differ.

## Notes for agents

- Every new player-facing phrase goes through `loc()`/`locn()` or sits in
  markup, and gets its English in the same change: `npm run i18n -- sync`, fill
  the `""` entries, `npm run i18n -- check`.
- Try a page in English with `?pana-language=en`.
- The conventions test fails when a file gains Spanish literals outside
  `loc()` (`Pana/tests/i18n-literals.json` holds today's count per file, which
  only goes down), and when a locale file has missing or orphan phrases.
