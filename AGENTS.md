# AGENTS.md — how to work in Pana

Pana is a hub of free multiplayer **3D** browser games, built largely by AI coding
agents. These are the rules every change follows. What a specific game, map or
model needs lives in `docs/knowledge/<topic>.md`: read the note for the area you
touch.

The app lives in `Pana/` (server, web, games, engine, scripts, tests). Docs are in
`docs/`. Paths below are relative to `Pana/` unless they start with `docs/`.

## Every game is 3D

- The playable view is a Three.js scene with a **perspective camera** and the
  player's own pana in the world. Board, card and table pieces are meshes on a
  table, never DOM elements or a Canvas 2D drawing. A request that doesn't say
  "2D" means 3D, and there is no "flat first, 3D later" version.
- Table games (cards, dice, boards, pool) stand on `engine/worlds/table-world.js`: the
  plaza, sky, sun, a framed camera and seated panas. Games where panas move use
  the same stage (`fit: 'window'`) or a world from `engine/models/`.
- Canvas 2D is only for overlays: a minimap, a texture painted onto a mesh.
  An isometric (orthographic) camera needs a reason in `tests/conventions.test.js`.
- `tests/conventions.test.js` and `engine/tests/all-games.browser.js` (a WebGL
  canvas, no errors, for every game) enforce this.

## Starting a new game

Always start from the scaffold, never from an empty folder or a copy of a game:

```powershell
.\dev.ps1 new-game trompo -Kind table   # turn-based at a table → TableRoom
.\dev.ps1 new-game trompo -Kind live    # panas moving in real time → LiveRoom
# options: -Players 2..8 -Name "Trompo" -Color "#ff8a3d"; or npm run new-game -- trompo --kind live
```

It creates a playable 3D game (rules with tests, room, scene, wiring, a
two-client browser suite, a knowledge note) that already passes every check.
Replace the scaffold's rules and scene with the real game; keep the structure.
Then add the game to `README.md`, `docs/knowledge/README.md` and `CHANGELOG.md`.

## Architecture

- `server/` is the only backend. It serves the hub (`web/`), every game
  (`games/<game>/public/`), shared code (`/engine/*`), the API (`/api/*`) and rooms
  (`/colyseus/*`). Read `docs/ARCHITECTURE.md` before changing routing or rooms.
- Games live in `games/<game>/` with the file split in `docs/ARCHITECTURE.md`
  ("A game's files"): `game.json`, pure `rules.js` with `tests/rules.test.js`, a thin
  `network.js`, `scene.js`, and `game.js` for wiring (at most 600 lines). A game
  appears on the hub once `public/index.html` exists.
- **No build step. Ever.** Plain ES modules; Three.js and the Colyseus SDK from CDN.
- `engine/` is shared code. Extract into it when a second page needs something, not
  before; when a second game copies code, move it to `engine/` in that change.
  Models live in `engine/models/` and are registered in Pana Studio
  (`web/studio/catalog.js`, see `docs/knowledge/pana-studio.md`).
- Browser is the only platform. Friends join by opening a link: no install, no account.

## Shared pieces: use them, never rebuild them

| Need | Use | Notes |
|---|---|---|
| Look, fonts, HUD, loading | `engine/kit.css` (`.pk-*`), `--pk-game` | `docs/knowledge/pana-kit.md` |
| Lobby before the game | `engine/game-entry.js` (`data-pana-entry`) | `docs/knowledge/launcher.md` |
| Loading, loops, teardown, room code in the URL | `engine/game-shell.js` (`bootGame`, `roomCode`) | |
| Table stage, camera framing | `engine/worlds/table-world.js` (`createTableWorld`) | |
| Pause menu, settings, invite button | `engine/ui.js`, `engine/settings.js` | `docs/knowledge/pana-ui.md` |
| Room codes and invite links | `engine/invite.js` (`inviteUrl`, `roomFromUrl`, `newRoomCode`) | |
| Turn-based online room | `engine/table-room.js` (`TableRoom`) | `docs/knowledge/pana-net.md` |
| Real-time online room | `engine/live-room.js` (`LiveRoom`, `elapsedClock`, `axis`; `predict` for your own character) | `docs/knowledge/pana-net.md` |
| Anything else online | `engine/net.js` (`HostRoom`, `joinRoom`), `server/src/room-kit.js` | `docs/knowledge/pana-net.md` |
| Seeded randomness, noise, clamp/lerp/pick | `engine/random.js` (`rng`, `draw`, `fbm2`, `clamp`, `lerp`, `pick`) | no Three.js: safe in `rules.js`; import it by relative path from code a server room loads |
| End-of-round screen | `.pk-results` + `engine/results.js` (`fillRoster`) | pana-kit.md, "Results screen" |
| Status toast | `engine/hud.js` (`createToast`) | reads how the element hides from its markup |
| Icons | `engine/icons.js` (SVG); never emoji or symbol glyphs | pana-kit.md, "Icons and colours" |
| Touch controls, orientation | `engine/touch.js` | pana-kit.md, "Touch controls" |
| The player's pana | `engine/avatar.js`, `engine/models/characters/pana/avatar-model.js` | `docs/knowledge/character-reference.md` |
| Browser suites | `tests/browser-kit.js` (`launch`, `openGame`, `waitPrepared`, `waitFor`) | |

Never write sockets, retries, member lists or host election in a game, a per-game
pause overlay, sound toggle or invite flow, or handle Escape in a game. Never set
`maxClients` in a room: `game.json` `players` is the cap.

## Conventions

- Every pre-game menu uses the Carreritas side-settings layout from
  `engine/game-entry.js` and `engine/sala.js`; keep game-specific controls,
  teams and start permissions within this shared shell. In-game HUDs remain
  game-specific.

- Default port **8461** (env `PANA_PORT`). URLs: hub `/`, games `/g/<game>/`.
- Game folders are lowercase Spanish words. Player-facing text is Spanish
  (Venezuelan flavour welcome); code, comments and commits are English.
- Every game uses the player's own pana, not a faceless placeholder.
- A game's colours are named custom properties on its `body { --pk-game … }` rule;
  kit colours are `var(--pk-*)`. `--pk-game` matches `color` in `game.json`.
- `players: 1` in `game.json` means no rooms: no `network.js`, no `?room=` links.
- Keep dependencies minimal: the Colyseus packages on the server only.
- Served images stay under 600 KB (JPEG or WebP for illustrations).
- `npm test` checks most of these (`tests/conventions.test.js`). When it fails, fix
  the code, not the test, unless the rule itself is changing.
- When you add something every game must do (a call, a file, a markup hook), add
  a conventions test for it and update `scripts/templates/` in the same commit.
  Otherwise the next game is built without it.

## Checks

```powershell
.\dev.ps1                 # start the server (installs deps, resolves busy ports)
.\dev.ps1 check           # syntax check + unit and convention tests
.\dev.ps1 check -Help     # the cheat sheet: which check to run for a change
.\dev.ps1 check -Browser domino   # ...plus the Playwright suites matching "domino"
.\dev.ps1 studio          # open Pana Studio on the running server
npm test -- carreritas         # only unit tests whose path contains "carreritas" (seconds)
npm test -- feats rules        # union of several filters
npm run test:browser -- all-games  # every game prepares a 3D scene without errors
npm run shots -- carreritas --track chuao --at gate-60  # screenshots from the real loop, seconds
npm run shots -- carreritas --track sabana --menu      # menu art: <id>.webp + thumb + sources.json
npm run budget -- carreritas       # first-load modules and game.js lines vs their caps
npm run test:browser -- --changed  # only the suites for what changed since dev
npm run test:browser -- carreritas --baseline  # failures rerun on the merge-base: regression or pre-existing
npm run new-track -- morrocoy --name "Morrocoy"     # new Carreritas circuit, registered everywhere (--dry-run first)
npm run new-game -- <id>           # a new game from the templates
npm run launcher-art -- <id> <image> --row Mesa  # hub art, both JPEGs, registered
npm run tidy                       # worktrees and branches already in dev (--apply removes)
```

A pre-commit hook (`.githooks/`, installed by `npm install`) runs the fast gate
in about two seconds: syntax of the staged scripts, the conventions test (the
game.js and first-load caps, conflict markers, the changelog lint) and the
changelog test. Check `npm run budget` before adding to a game near its caps.

Browser failures that already happen on unchanged code are listed in
`Pana/tests/known-failures.json` with the text they fail on; the runner reports
those as KNOWN. Add one only after `--baseline` shows it pre-existing.

Run the narrowest check that covers the change: `npm test -- <word>` takes
seconds, the full `npm test` several minutes, and browser suites minutes EACH —
always filter them (`-- carreritas`, `--changed`). Never run the whole browser set
locally; CI does that nightly. `.\dev.ps1 check -Help` prints the same cheat
sheet from the CLI.

A suite only reruns when something it can touch changed: the runner hashes the
suite, every game it opens, the engine modules and assets those load, the server
and the lockfile (`Pana/scripts/suite-fingerprint.js`), and skips a suite whose
hash already passed (`cached` in the output, kept in the ignored
`Pana/tests/.browser-passes.json`; CI keeps it between runs). `--fresh` runs
everything anyway; the nightly full run does.

Playwright is a dev dependency: `npm install` is all browser suites need, so
don't search the disk for one or set `PANA_PLAYWRIGHT_PATH`. The runner starts
its own fresh server on a free port, so a stale server on :8461 can never answer
for new code; set `PANA_TEST_URL` only to test a server you started yourself.
Suites run several at a time against one server (each makes its own room),
slowest first by `Pana/tests/browser-timings.json`; a failure reruns once at half
the concurrency and is reported as flaky if it then passes. More than about
one suite per eight CPU threads overloads software WebGL and makes suites time
out. Refresh the timings with `--record`
after adding or speeding up suites. CI runs `check`, `test` and the all-games
smoke everywhere, plus the `--changed` suites on every push to `dev`: the suites a
change touches within a ~20 min optional-suite budget (`Pana/scripts/changed-suites.js`; docs,
images and unit tests need none). Mandatory suites can exceed that budget; CI
spreads changed suites across eight serial runners. Actions → Tests accepts
`changed_base` to rerun a migration from its original base without selecting the
full nightly set. PRs into `main` run only `check`, `test` and the
smoke, since each commit already passed on `dev`. Every suite runs nightly on `dev`
in four `--shard k/4` jobs, or by hand from Actions → Tests; it is never a merge
gate. Every merge to `main` releases (`.github/workflows/release.yml`), then the
workflow merges main back into dev with `node Pana/scripts/changelog.js
sync-main`, which resolves the changelog itself; run it by hand if it warns.

Browser suites wait on game state (`window.PANA_PREPARED`, a phase, a revision,
an event), never on wall-clock time: no new `waitForTimeout`, positions and
heights compared with a tolerance, low quality forced (`tests/browser-kit.js`).

## When you finish a task

- `.\dev.ps1 check` passes. For a game you touched, its browser suites pass too.
- A change under `engine/` or `server/`, or one touching more than one game, also
  runs the browser suites of every game it reaches plus `all-games`; say which
  in the commit body. Shared code changes are where regressions come from.
- A change players, hosts or contributors will notice adds a line to
  `CHANGELOG.md` under `## Unreleased`, in the same commit: one bold sentence on
  what they can do now, then a line of detail. Group related work; never write a
  version or date by hand. Internal refactors may skip it.
- Multiplayer changes are proven with a real two-client suite, not a page load.
- Something non-obvious learned (a netcode trap, a tuning value, a deploy gotcha)
  goes in `docs/knowledge/<topic>.md`, the note for that area. Not in this file.
  State the result inline; never cite a local plan, log or `art/` file there.
- Bigger work starts as a numbered local plan in `docs/plans/` (`NN_kebab-name.md`:
  scope, files, proof). Update its status when done. Plans stay on disk only and
  must not be tracked in Git or published to GitHub. Never stage, commit or
  force-add ignored plans, including when committing the work they describe.
  Only an explicit user request to track a specific plan overrides this rule.
  Scratch scripts and logs go to the system temp folder, not `docs/plans/`.
- Update this file only when a rule here changes.

## Commits

- Work on the current branch (`dev`); never create branches unless asked.
- Subject: imperative, at most 50 characters (hard limit 72), no trailing period,
  no `feat:`/`fix:` prefixes. A release-worthy feature adds a `Release: minor`
  line at the end of the body (release.yml reads it).
- Body only when needed, wrapped at 72 characters: why, not a list of files.
- One concern per commit. A bug found in another game gets its own commit.
  Never commit generated output (`graphify-out/`, QA screenshots, logs).
