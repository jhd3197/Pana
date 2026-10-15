# Graph Report - Pana  (2026-10-15)

## Corpus Check
- 172 files · ~285,884 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1397 nodes · 3763 edges · 82 communities (65 shown, 17 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 97 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `25d90d79`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- mesh
- M
- chichi.js
- soft-character/model.js
- studio/studio.js
- landmarks.js
- pana.js
- escondidas/public/game.js
- character/studio.js
- bululu/public/game.js
- cocina/public/game.js
- island-landscape.js
- items.js
- derrape/public/game.js
- selva-world.js
- index.js
- rng
- engine/plaza-layout.js
- board.js
- island-environment.js
- jungle-props.js
- cocina/public/rules.js
- takeTurn
- updateRace
- hub.js
- engine/flora.js
- tracks.js
- KitchenRoom
- HuntRoom
- atrapa.js
- fx.js
- stepCar
- HuntRound
- Kitchen
- dev.ps1
- cocina/tests/browser.mjs
- package.json
- escondidas/tests/browser.mjs
- main
- AGENTS.md — how to work in Pana
- water-surface.js
- updateMini
- frame
- mix.browser.js
- wardrobe.browser.js
- engine/
- ui.browser.js
- hop
- chichi.browser.js
- items.browser.js
- maps.browser.js
- venezuela.browser.js
- water.browser.js
- expressions.browser.js
- foundation.browser.js
- proportions.browser.js
- character/tests/studio.browser.js
- cache.browser.js
- landmarks.browser.js
- rural.browser.js
- settlements.browser.js
- selva-driving.browser.js
- shoulders.browser.js
- studio/tests/studio.browser.js
- cloth-front.browser.js
- props.browser.js
- vegetation.browser.js
- loading.browser.js
- plaza.browser.js
- selva.browser.js

## God Nodes (most connected - your core abstractions)
1. `mesh()` - 117 edges
2. `M()` - 98 edges
3. `box()` - 75 edges
4. `finish()` - 49 edges
5. `rng()` - 49 edges
6. `M()` - 48 edges
7. `tube()` - 47 edges
8. `mesh()` - 41 edges
9. `box()` - 33 edges
10. `rounded()` - 32 edges

## Surprising Connections (you probably didn't know these)
- `thermalSanctuary()` --indirect_call--> `object()`  [INFERRED]
  games/derrape/public/tracks/chichi-thermal.js → web/studio/catalog.js
- `createBoard()` --indirect_call--> `landMask()`  [INFERRED]
  games/bululu/public/board.js → engine/island-terrain.js
- `bambooBridge()` --indirect_call--> `mat()`  [INFERRED]
  engine/jungle-props.js → games/derrape/public/items.js
- `plinth()` --indirect_call--> `mat()`  [INFERRED]
  engine/landmarks.js → games/derrape/public/items.js
- `bodyShell()` --indirect_call--> `crown()`  [INFERRED]
  games/derrape/public/car-kit.js → engine/soft-character/action-outfits.js

## Import Cycles
- None detected.

## Communities (82 total, 17 thin omitted)

### Community 0 - "mesh"
Cohesion: 0.07
Nodes (126): archFrame(), archPanel(), archShape(), curve(), finish(), palette, railing(), rounded() (+118 more)

### Community 1 - "M"
Cohesion: 0.09
Nodes (80): batchParts(), bevelBox(), bodyShell(), bothSides(), box(), cabin(), canvasMat(), CHROME() (+72 more)

### Community 2 - "chichi.js"
Cohesion: 0.09
Nodes (70): placeOnTrack(), baseHeight(), environment(), roadHeight(), ROUTE, scenery(), tidalCrossing(), tideFront() (+62 more)

### Community 3 - "soft-character/model.js"
Cohesion: 0.10
Nodes (52): backwardCap(), capShape(), createActionDetails(), crown(), floralTexture(), apronDepth(), chefBadge(), createChefOutfit() (+44 more)

### Community 4 - "studio/studio.js"
Cohesion: 0.07
Nodes (47): openDatabase(), transaction(), assetContext(), ASSETS, CATEGORIES, object(), shared, sourcePath() (+39 more)

### Community 5 - "landmarks.js"
Cohesion: 0.10
Nodes (46): COLORS, DEFAULT_AVATAR, FURS, loadAvatar(), normalizeAvatar(), OPTIONS, PALETTE, pick() (+38 more)

### Community 6 - "pana.js"
Cohesion: 0.07
Nodes (45): church(), createPlaza(), createPlazaEnvironment(), fountain(), house(), lettering(), plazaFountain(), bindRenderer() (+37 more)

### Community 7 - "escondidas/public/game.js"
Cohesion: 0.06
Nodes (39): mount(), act(), actorRing, actors, avatar, camera, code, DEBUG (+31 more)

### Community 8 - "character/studio.js"
Cohesion: 0.06
Nodes (34): camera, canvas, changeWardrobe(), clock, contact, controls, ctx, dialog (+26 more)

### Community 9 - "bululu/public/game.js"
Cohesion: 0.05
Nodes (37): actionWaiters, AUTO, board, boardCam, boardScene, boardView, cam, clock (+29 more)

### Community 10 - "cocina/public/game.js"
Cohesion: 0.07
Nodes (34): mount(), actorLabel(), actors, artCamera, artRenderer, artScene, avatar, camera (+26 more)

### Community 11 - "island-landscape.js"
Cohesion: 0.11
Nodes (31): addForest(), createIslet(), createTepui(), deep, forest, grass, landMaterial, mistTexture() (+23 more)

### Community 12 - "items.js"
Cohesion: 0.11
Nodes (23): FragmentBurst, showItem(), activeItem(), addItem(), canBlock(), coinMultiplier(), consumeItem(), isMango() (+15 more)

### Community 13 - "derrape/public/game.js"
Cohesion: 0.07
Nodes (28): AUTO, cards, clearRace(), clock, DEBUG, garage, GARAGE_CAM, GARAGE_TARGET (+20 more)

### Community 14 - "selva-world.js"
Cohesion: 0.14
Nodes (27): jungleDriving(), JUNGLE_ADDITIONS, jungleFlora(), jungleHeight(), jungleRidgeHeight(), RIVER, RIVER_SAMPLES, riverCurve (+19 more)

### Community 15 - "index.js"
Cohesion: 0.12
Nodes (16): handleApi(), listGames(), sendJson(), createRequestHandler(), gamePublicDir(), files, config, rootDir (+8 more)

### Community 16 - "rng"
Cohesion: 0.24
Nodes (27): agave(), araguaney(), bamboo(), bark, cactus(), cactusColumn(), cushion(), finish() (+19 more)

### Community 17 - "engine/plaza-layout.js"
Cohesion: 0.17
Nodes (19): PLAZA_PROPS, propDefinition(), blocked(), BLOCKERS, BOUNDS, clearSight(), links, MAP_PROPS (+11 more)

### Community 18 - "board.js"
Cohesion: 0.12
Nodes (20): createAtmosphere(), glowTexture(), SKY_MODES, buildStand(), coin(), createBoard(), createDie(), createToken() (+12 more)

### Community 19 - "island-environment.js"
Cohesion: 0.18
Nodes (22): beachHut(), beachShade(), cream, driftwood(), wood, banana(), foliage(), palm() (+14 more)

### Community 20 - "jungle-props.js"
Cohesion: 0.21
Nodes (23): taperedStem(), fern(), bambooBridge(), boulder(), box(), creeper(), DARK, finish() (+15 more)

### Community 21 - "cocina/public/rules.js"
Cohesion: 0.19
Nodes (15): stars(), updateUI(), blocked(), BOUNDS, distance(), edges, move(), nearestStation() (+7 more)

### Community 22 - "takeTurn"
Cohesion: 0.25
Nodes (21): ask(), chooseRoute(), escapeHtml(), give(), intro(), isHuman(), landOn(), moveStand() (+13 more)

### Community 23 - "updateRace"
Cohesion: 0.13
Nodes (18): applyPalette(), buildMinimap(), collideCars(), collidePair(), crash(), drawMinimap(), finish(), finishTrack() (+10 more)

### Community 24 - "hub.js"
Cohesion: 0.18
Nodes (19): el(), featured, gameCard(), games, gamesEl, gameUrl(), helloName, loadGames() (+11 more)

### Community 25 - "engine/flora.js"
Cohesion: 0.20
Nodes (14): leafBlade(), bark, bladeMat, branch(), bush(), ceiba(), crownGeo, frondMats (+6 more)

### Community 26 - "tracks.js"
Cohesion: 0.20
Nodes (17): aiInput(), beginTrack(), buildTrack(), offsetOf(), paramOf(), pointAt(), selectTrack(), switchTrack() (+9 more)

### Community 27 - "KitchenRoom"
Cohesion: 0.22
Nodes (4): interact(), place(), step(), KitchenRoom

### Community 28 - "HuntRoom"
Cohesion: 0.21
Nodes (3): place(), step(), HuntRoom

### Community 29 - "atrapa.js"
Cohesion: 0.35
Nodes (11): basket(), create(), mangoTree(), aiTiming(), create(), wrap(), animateActor(), makeActors() (+3 more)

### Community 30 - "fx.js"
Cohesion: 0.14
Nodes (4): Debris, puffGeo, Puffs, sound

### Community 31 - "stepCar"
Cohesion: 0.22
Nodes (12): garageHonk(), groundAt(), honk(), pick(), placeRacer(), progressOf(), say(), stepCar() (+4 more)

### Community 33 - "Kitchen"
Cohesion: 0.29
Nodes (4): clone(), Kitchen, SPAWNS, fresh()

### Community 34 - "dev.ps1"
Cohesion: 0.22
Nodes (4): Ensure-Packages(), Resolve-DevPort(), Start-PanaServer(), Test-PortFree()

### Community 35 - "cocina/tests/browser.mjs"
Cohesion: 0.20
Nodes (5): { chromium }, errors, require, sockets, { WebSocket }

### Community 36 - "package.json"
Cohesion: 0.20
Nodes (9): dependencies, ws, description, main, name, private, type, version (+1 more)

### Community 37 - "escondidas/tests/browser.mjs"
Cohesion: 0.22
Nodes (5): { chromium }, errors, require, sockets, { WebSocket }

### Community 38 - "main"
Cohesion: 0.39
Nodes (8): focus(), main(), makePortraits(), overview(), ranks(), results(), setPlank(), standings()

### Community 39 - "AGENTS.md — how to work in Pana"
Cohesion: 0.33
Nodes (5): AGENTS.md — how to work in Pana, Architecture, Conventions, Dev workflow (Windows), When you finish a task

### Community 40 - "water-surface.js"
Cohesion: 0.47
Nodes (3): riverSurface(), waterPool(), waterSurface()

### Community 41 - "updateMini"
Cohesion: 0.40
Nodes (6): fastForward(), frame(), minigameInput(), setTimer(), stepJobs(), updateMini()

### Community 42 - "frame"
Cohesion: 0.33
Nodes (5): mount(), CARS, frame(), updateGarage(), updateGarageCamera()

### Community 43 - "mix.browser.js"
Cohesion: 0.33
Nodes (5): { chromium }, errors, garments, hats, require

### Community 44 - "wardrobe.browser.js"
Cohesion: 0.40
Nodes (4): { chromium }, errors, outfits, require

### Community 45 - "engine/"
Cohesion: 0.50
Nodes (3): engine/, Reusing the plaza kit, Reusing whole worlds

### Community 47 - "hop"
Cohesion: 0.67
Nodes (4): ease(), hop(), layoutTokens(), restSpot()

### Community 49 - "items.browser.js"
Cohesion: 0.50
Nodes (3): { chromium }, errors, require

### Community 50 - "maps.browser.js"
Cohesion: 0.50
Nodes (3): { chromium }, errors, require

### Community 51 - "venezuela.browser.js"
Cohesion: 0.50
Nodes (3): {chromium}, errors, results

### Community 53 - "expressions.browser.js"
Cohesion: 0.50
Nodes (3): { chromium }, errors, require

### Community 54 - "foundation.browser.js"
Cohesion: 0.50
Nodes (3): { chromium }, errors, require

### Community 55 - "proportions.browser.js"
Cohesion: 0.50
Nodes (3): { chromium }, errors, require

### Community 56 - "character/tests/studio.browser.js"
Cohesion: 0.50
Nodes (3): { chromium }, errors, require

## Knowledge Gaps
- **357 isolated node(s):** `PALETTE`, `COLORS`, `OPTIONS`, `DEFAULT_AVATAR`, `wood` (+352 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `h()` connect `pana.js` to `M`, `landmarks.js`, `frame`, `board.js`, `jungle-props.js`, `atrapa.js`?**
  _High betweenness centrality (0.159) - this node is a cross-community bridge._
- **Why does `mat()` connect `items.js` to `chichi.js`, `island-environment.js`, `jungle-props.js`, `landmarks.js`?**
  _High betweenness centrality (0.149) - this node is a cross-community bridge._
- **Why does `mesh()` connect `mesh` to `landmarks.js`, `rng`, `island-environment.js`, `jungle-props.js`, `engine/flora.js`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **What connects `PALETTE`, `COLORS`, `OPTIONS` to the rest of the system?**
  _357 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `mesh` be split into smaller, more focused modules?**
  _Cohesion score 0.06891369686560755 - nodes in this community are weakly interconnected._
- **Should `M` be split into smaller, more focused modules?**
  _Cohesion score 0.08846584546472565 - nodes in this community are weakly interconnected._
- **Should `chichi.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08700410396716826 - nodes in this community are weakly interconnected._