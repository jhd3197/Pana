# AGENTS.md — how to work in Pana

Pana is a hub of free multiplayer browser games, built largely by AI coding agents.
These are the rules every change follows. What a specific game, map or model needs
lives in `docs/knowledge/<topic>.md`: read the note for the area you touch.

The app lives in `Pana/` (server, web, games, engine, scripts, tests). Docs are in
`docs/`. Paths below are relative to `Pana/` unless they start with `docs/`.

## Architecture

- `server/` is the only backend. It serves the hub (`web/`), every game
  (`games/<game>/public/`), shared code (`/engine/*`), the API (`/api/*`) and rooms
  (`/colyseus/*`). Read `docs/ARCHITECTURE.md` before changing routing or rooms.
- Games live in `games/<game>/` with the file split in `docs/ARCHITECTURE.md`
  ("A game's files"): `game.json`, pure `rules.js` with `tests/rules.test.js`, a thin
  `network.js`, `scene.js`, and `game.js` for wiring. A game appears on the hub once
  `public/index.html` exists.
- **No build step. Ever.** Plain ES modules; Three.js and the Colyseus SDK from CDN.
- `engine/` is shared code. Extract into it when a second page needs something, not
  before. Models live in `engine/models/` and are registered in Pana Studio
  (`web/studio/catalog.js`, see `docs/knowledge/pana-studio.md`).
- Browser is the only platform. Friends join by opening a link: no install, no account.

## Shared pieces: use them, never rebuild them

| Need | Use | Notes |
|---|---|---|
| Look, fonts, HUD, lobby | `engine/kit.css` (`.pk-*`), `--pk-game` | `docs/knowledge/pana-kit.md` |
| Pause menu, settings, invite button | `engine/ui.js`, `engine/settings.js` | `docs/knowledge/pana-ui.md` |
| Room codes and invite links | `engine/invite.js` (`inviteUrl`, `roomFromUrl`, `newRoomCode`) | |
| Online rooms | `engine/net.js` (`HostRoom`, `joinRoom`), `server/src/room-kit.js` | `docs/knowledge/pana-net.md` |
| End-of-round screen | `.pk-results` + `engine/results.js` (`fillRoster`) | pana-kit.md, "Results screen" |
| Icons | `engine/icons.js` (SVG); never emoji or symbol glyphs | pana-kit.md, "Icons and colours" |
| Touch controls, orientation | `engine/touch.js` | pana-kit.md, "Touch controls" |
| The player's pana | `engine/avatar.js`, `engine/models/characters/pana/avatar-model.js` | `docs/knowledge/character-reference.md` |

Never write sockets, retries, member lists or host election in a game, a per-game
pause overlay, sound toggle or invite flow, or handle Escape in a game.

## Conventions

- Default port **8461** (env `PANA_PORT`). URLs: hub `/`, games `/g/<game>/`.
- Game folders are lowercase Spanish words. Player-facing text is Spanish
  (Venezuelan flavour welcome); code, comments and commits are English.
- Every game uses the player's own pana, not a faceless placeholder.
- A game's colours are named custom properties on its `body { --pk-game … }` rule;
  kit colours are `var(--pk-*)`. `--pk-game` matches `color` in `game.json`.
- `players: 1` in `game.json` means no rooms: no `network.js`, no `?room=` links.
- Keep dependencies minimal: `ws` and the Colyseus packages on the server only.
- `npm test` checks most of these (`tests/conventions.test.js`). When it fails, fix
  the code, not the test, unless the rule itself is changing.

## Checks

```powershell
.\dev.ps1                 # start the server (installs deps, resolves busy ports)
.\dev.ps1 check           # syntax check + unit and convention tests
.\dev.ps1 check -Browser  # ...plus every Playwright suite (needs Playwright)
.\dev.ps1 studio          # open Pana Studio on the running server
npm run test:browser -- domino   # only the suites whose path matches
```

Browser suites take `PANA_PLAYWRIGHT_PATH` (an external Playwright) and
`PANA_TEST_URL`; the runner starts a server if none answers. CI runs `check` and
`test` on every push to `dev`; every merge to `main` releases (`.github/workflows/release.yml`).

## When you finish a task

- `.\dev.ps1 check` passes. For a game you touched, its browser suites pass too.
- A change players, hosts or contributors will notice adds a line to
  `CHANGELOG.md` under `## Unreleased`, in the same commit: one bold sentence on
  what they can do now, then a line of detail. Group related work; never write a
  version or date by hand. Internal refactors may skip it.
- Multiplayer changes are proven with a real two-client suite, not a page load.
- Something non-obvious learned (a netcode trap, a tuning value, a deploy gotcha)
  goes in `docs/knowledge/<topic>.md`, the note for that area. Not in this file.
- Bigger work starts as a numbered plan in `docs/plans/` (`NN_kebab-name.md`:
  scope, files, proof). Update its status when done.
- Update this file only when a rule here changes.
