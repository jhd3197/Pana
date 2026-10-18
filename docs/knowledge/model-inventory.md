# Pana — current model inventory

Audited 2026-10-18. Generated from the real Studio registry plus a reviewed source ledger.

**437 Studio resources**, including **21 Fauna entries**, **50 vegetation entries**, **25 vehicles** and **27 maps**. **142 resources are preview-only.** The separate ledger identifies **31 active uncataloged model families**, **46 scene/effect families** and **9 dormant factories/hooks**. These numbers must not be added into a “unique 3D models” total: maps contain models, variants share geometry, and some ledger rows group multiple related props.

Scope: current production geometry in `engine/` and the four games, including Bululú minigames, gameplay props, embedded wardrobe options and map scenery. Individual meshes, geometry helpers, UI/SVG art, generated screenshots, dependency internals and historical deleted revisions are excluded. Catalog consumer labels identify games, not instance counts. Active uncataloged entries were traced to their placement sources; presence in source does not guarantee visibility from every camera. Legacy rows are retained explicitly instead of being presented as new content.

Canonical model sources now live in `Pana/engine/models/`, organized by domain. Shared definitions are plain metadata; Studio scene adapters stay in `web/studio/catalog/`. Old engine URLs are compatibility aliases, not additional assets. See [model library architecture](../../Pana/engine/models/README.md) for adding models and preserving ownership, animation and cache dependencies.

## Birds and fauna — resolved

The seven birds had not disappeared. They were missing from Studio and shared one primitive box-wing builder. This audit replaces that builder with three distinct shared models and registers a natural capybara, taking Fauna from six to ten entries (nine animal models plus the fish-school assembly). The old “toucan/seagull” comment described possible recolors; no dedicated current models existed for those birds.

| Map | Current fauna verified | Change |
| --- | --- | --- |
| Selva | 1 guacamaya + 1 chigüire | Replaced the generic bird and random dressed player-character animal. |
| Los Llanos | 4 corocoras + 3 chigüires; existing 3 horses, 8 chickens and 8 cows | Species-specific ibis; same canonical capybara factory as Selva. Farm animals retained. |
| Desierto | 2 soaring zamuros | Old unspecified brown birds now have a vulture silhouette. |
| Bululú board | 5 reef schools / 30 fish; beach crabs | Existing fish were already present; not copied as part of this audit. |
| Bululú circuit | 4 reef schools / 24 fish; beach crabs | Existing fish and coastal pack retained. |

Flight faces its travel direction, and all new animation rewinds using absolute time. Selva and Llanos share `wildCapybara`, which reuses `capybaraForm`; the natural animal is separate from the dressed Pana character. These are native Pana procedural models, with no new downloaded model or license dependency.

## What to build or update next

| Action | Work | Where | Why |
| --- | --- | --- | --- |
| Upgrade existing | Offshore sailboats and lighthouse | Bululú board | Most obvious remaining old silhouettes. Reuse the coast visual language; preserve bobbing and the night beam. |
| Expose existing | Bridge, cable system, grandstands, canal villas, diving school and fort | Studio | Eight useful landmark factories already exist. Give them safe standalone preview adapters before making duplicates. |
| Expose existing | Crate, coin, peel, die, cart, coconut and basket | Studio | Important gameplay props are invisible to the review workflow. |
| Upgrade existing | Atrapa mango tree and river rowboats | Atrapa / Selva / Llanos | Replace older block geometry while preserving gameplay dimensions. |
| Place existing | Welcome arch and signature statues | Plaza / Estadio entrances | Ten current resources are preview-only; place selected landmarks with route clearance before expanding the library. |
| Build new | Seagull and pelican | Both Bululú islands / harbor | No dedicated current models. Add perched and flying poses around docks. |
| Build new | Heron and small river turtle | Llanos wetlands | Adds waterside life distinct from flying ibis and grazing capybaras. |
| Build new | Toucan and butterflies | Selva | No actual toucan model despite old comments; add canopy and understory behavior. |
| Build new | Coral, sea fan, sponge and sea turtle | Bululú reefs | Fish already exist; reef habitat is the larger missing layer. |
| Build new | Nest, perch and shoreline feeding behavior | Fauna system | Habitat interaction would add more life than another recolor on a circle. |
| Build new | Spectators, mechanic and marshal | Estadio / race towns | Current stands and pits need people and activity. Reuse the Pana rig. |
| Build new | Pit tool cart, jack, cones and portable barriers | Estadio | Build a believable working paddock around existing garages. |
| Build new | Waste bins, drain covers, utility poles and traffic signs | Plaza / Cocina streets | Small everyday details fill gaps between the buildings. |
| Build new | Fishing baskets, anchor, mooring bollard and fish-drying table | Harbors | Complements the existing fishing boat, net rack and crates. |
| Improve behavior | Ambient perching/swimming routes | Shared environments | Add more varied animal routes. Cloud wind now uses absolute time across the shared sky. |

## Available but not placed

These already exist. Their absence from a map is a placement gap, not a missing-model request. Waterfall rocks were incorrectly labeled preview-only; they are used in Chi Chi and the catalog label is now corrected.

| Studio name | ID | Source |
| --- | --- | --- |
| Jaguar | jaguar | [jaguar.js](../../Pana/engine/models/fauna/jaguar.js) |
| Jaguar sentado | jaguar-sitting | [jaguar.js](../../Pana/engine/models/fauna/jaguar.js) |
| Jaguar negro | black-jaguar | [jaguar.js](../../Pana/engine/models/fauna/jaguar.js) |
| Mata de hojas anchas | garden-rosette | [garden-rosette.js](../../Pana/engine/models/vegetation/garden-rosette.js) |
| Enredadera colgante | trailing-vine | [trailing-vine.js](../../Pana/engine/models/vegetation/trailing-vine.js) |
| Trinitaria | trinitaria | [trinitaria.js](../../Pana/engine/models/vegetation/trinitaria.js) |
| Árbol seco | dead-tree | [dead-tree.js](../../Pana/engine/models/vegetation/dead-tree.js) |
| Árbol seco con barba de palo | dead-tree-leafy | [dead-tree.js](../../Pana/engine/models/vegetation/dead-tree.js) |
| Árbol de selva extendido | broadleaf-tree-spreading | [broadleaf-tree.js](../../Pana/engine/models/vegetation/broadleaf-tree.js) |
| Árbol de selva en pisos | broadleaf-tree-tiered | [broadleaf-tree.js](../../Pana/engine/models/vegetation/broadleaf-tree.js) |
| Árbol de copa redonda | broadleaf-tree-round | [broadleaf-tree.js](../../Pana/engine/models/vegetation/broadleaf-tree.js) |
| Árbol de selva alto | broadleaf-tree-tall | [broadleaf-tree.js](../../Pana/engine/models/vegetation/broadleaf-tree.js) |
| Ceiba portal | ceiba-gateway | [ceiba-gateway.js](../../Pana/engine/models/vegetation/ceiba-gateway.js) |
| Gigante de la selva | emergent-tree | [emergent-tree.js](../../Pana/engine/models/vegetation/emergent-tree.js) |
| Matapalo sobre ruinas | strangler-fig | [strangler-fig.js](../../Pana/engine/models/vegetation/strangler-fig.js) |
| Oreja de elefante | elephant-ear | [elephant-ear.js](../../Pana/engine/models/vegetation/elephant-ear.js) |
| Bromelia | bromeliad | [bromeliad.js](../../Pana/engine/models/vegetation/bromeliad.js) |
| Flor gigante | rafflesia | [rafflesia.js](../../Pana/engine/models/vegetation/rafflesia.js) |
| Hongos silvestres | wild-mushrooms | [wild-mushrooms.js](../../Pana/engine/models/vegetation/wild-mushrooms.js) |
| Roca con musgo | moss-rock | [moss-rock.js](../../Pana/engine/models/vegetation/moss-rock.js) |
| Hojarasca | forest-litter | [forest-litter.js](../../Pana/engine/models/vegetation/forest-litter.js) |
| Defensa vial de montaña | mountain-guardrail | [mountain.js](../../Pana/engine/models/props/mountain.js) |
| Puente colgante de montaña | mountain-suspension-bridge | [mountain.js](../../Pana/engine/models/props/mountain.js) |
| Estatua gigante de capibara | capybara-statue | [monuments.js](../../Pana/engine/models/props/monuments.js) |
| Estatua del mango de oro | golden-mango-statue | [monuments.js](../../Pana/engine/models/props/monuments.js) |
| Arco de bienvenida Pana | welcome-arch | [monuments.js](../../Pana/engine/models/props/monuments.js) |
| Asta con bandera Pana | pana-flagpole | [monuments.js](../../Pana/engine/models/props/monuments.js) |
| Fuente de los capibaras | capybara-fountain | [monuments.js](../../Pana/engine/models/props/monuments.js) |
| Puente de bambú | bamboo-bridge | [jungle.js](../../Pana/engine/models/props/jungle.js) |
| Arroyo en cascada | cascade-stream | [water-surface.js](../../Pana/engine/models/effects/water-surface.js) |
| Minero | gold-miner | [mine-miner.js](../../Pana/engine/models/props/mine-miner.js) |
| Vagoneta minera | mine-cart | [mine.js](../../Pana/engine/models/props/mine.js) |
| Vía minera con caballetes | mine-track | [mine.js](../../Pana/engine/models/props/mine.js) |
| Veta de oro | gold-vein | [mine.js](../../Pana/engine/models/props/mine.js) |
| Montón de mineral | ore-pile | [mine.js](../../Pana/engine/models/props/mine.js) |
| Caja minera | mine-crate | [mine.js](../../Pana/engine/models/props/mine.js) |
| Caja de dinamita | tnt-crate | [mine.js](../../Pana/engine/models/props/mine.js) |
| Barril minero | mine-barrel | [mine.js](../../Pana/engine/models/props/mine.js) |
| Farol de mina | mine-lantern | [mine.js](../../Pana/engine/models/props/mine.js) |
| Poste con farol | mine-lantern-post | [mine.js](../../Pana/engine/models/props/mine.js) |
| Guirnalda de bombillos | bulb-wire | [mine.js](../../Pana/engine/models/props/mine.js) |
| Escalera de mano | mine-ladder | [mine.js](../../Pana/engine/models/props/mine.js) |
| Escalera de tablas | mine-stairs | [mine.js](../../Pana/engine/models/props/mine.js) |
| Pico | mine-pickaxe | [mine.js](../../Pana/engine/models/props/mine.js) |
| Pala | mine-shovel | [mine.js](../../Pana/engine/models/props/mine.js) |
| Carretilla minera | mine-wheelbarrow | [mine.js](../../Pana/engine/models/props/mine.js) |
| Boca de mina | mine-portal | [mine.js](../../Pana/engine/models/props/mine.js) |
| Marco de entibado | mine-support | [mine.js](../../Pana/engine/models/props/mine.js) |
| Andamio de veta | mine-scaffold | [mine.js](../../Pana/engine/models/props/mine.js) |
| Caseta de mineros | miner-shack | [mine.js](../../Pana/engine/models/props/mine.js) |
| Mesa de pesaje de oro | assay-table | [mine.js](../../Pana/engine/models/props/mine.js) |
| Rueda hidráulica | water-wheel | [mine.js](../../Pana/engine/models/props/mine.js) |
| Molino de pisones | stamp-mill | [mine.js](../../Pana/engine/models/props/mine.js) |
| Torre de ascensor minero | lift-tower | [mine.js](../../Pana/engine/models/props/mine.js) |
| Portal de la mina de sal | mine-gate | [mine.js](../../Pana/engine/models/props/mine.js) |
| Lápida redondeada | grave-headstone | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Cruz celta | grave-celtic | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Obelisco funerario | grave-obelisk | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Losa sepulcral | grave-ledger | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Cruz de madera | grave-wooden | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Calabaza tallada | jack-o-lantern | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Calavera | skull | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Velas de tumba | grave-candles | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Ataúd cerrado | coffin | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Ataúd abierto | coffin-open | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Fosa abierta | open-grave | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Reja de hierro | iron-fence | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Pilar de piedra con urna | stone-pillar-urn | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Pilar de piedra con calavera | stone-pillar-skull | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Pilar de piedra con farol | stone-pillar-lantern | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Farol de hierro | cemetery-lantern | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Poste de farol | cemetery-lamp-post | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Mausoleo con puerta cerrada | mausoleum-dark | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Mausoleo con reja | mausoleum-barred | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Mausoleo con brillo verde | mausoleum-glow | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Portón del cementerio | cemetery-gate | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Capilla en ruinas | cemetery-chapel | [cemetery-chapel.js](../../Pana/engine/models/props/cemetery-chapel.js) |
| Mansión embrujada | crooked-mansion | [crooked-mansion.js](../../Pana/engine/models/props/crooked-mansion.js) |
| Espantapájaros | scarecrow | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Pozo de piedra | graveyard-well | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Pasarela del pantano | swamp-boardwalk | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Choza sobre pilotes | stilt-shack | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Bote de remos | rowboat | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Bote medio hundido | rowboat-sunk | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Fuego fatuo | wisp | [cemetery.js](../../Pana/engine/models/props/cemetery.js) |
| Torre prasat | prasat | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Torre prasat derrumbada | prasat-broken | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Rostro de Bayón | bayon-face | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Cabeza olmeca | olmec-head | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Columna de tambores | ruin-column | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Columna rota | ruin-column-broken | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Columna caída | fallen-column | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Escombros del templo | ruin-rubble | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Escalinata en ruinas | ruin-stairs | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Estela de glifos | stela | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Sello solar | sun-seal | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Pebetero de piedra | ruin-brazier | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Puente de tablas | plank-bridge | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Puente de tablas roto | plank-bridge-broken | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Pilar del abismo | rock-tower | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Enlosado del templo | ruin-paving | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Estalagmitas | stalagmites | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Portal de la selva | ruin-gate | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Piedra tallada antigua | carved-stele | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Fachada tallada en roca | rock-facade | [ruins.js](../../Pana/engine/models/props/ruins.js) |
| Fogata de expedición | expedition-campfire | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Carpa de expedición | expedition-tent | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Carpa de expedición verde oliva | expedition-tent-olive | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Farol de vidrio | glass-lantern | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Caja de suministros | supply-crate | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Barril con aros | hooped-barrel | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Saco de víveres | grain-sack | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Morral de expedición | expedition-backpack | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Cobija enrollada | rolled-blanket | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Tobo de campamento | camp-bucket | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Banco de campamento | camp-bench | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Herramientas en el tocón | camp-tools | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Ollas y cesta | camp-cookware | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Pila de suministros | supply-pile | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Mesa de investigación | investigation-table | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Refugio de radio | comm-shelter | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Depósito de suministros | storage-shelter | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Jeep de expedición | expedition-jeep | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Mirador de expedición | expedition-watchtower | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Puente de tablas | plank-footbridge | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Portal de troncos | log-gateway | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) |
| Neblina rastrera | ground-fog | [atmosphere.js](../../Pana/engine/models/effects/atmosphere.js) |
| Haz de luz con polvo | light-shaft | [atmosphere.js](../../Pana/engine/models/effects/atmosphere.js) |
| Tragaluz de cueva | skylight-beam | [atmosphere.js](../../Pana/engine/models/effects/atmosphere.js) |
| Charco de luz | glow-pool | [atmosphere.js](../../Pana/engine/models/effects/atmosphere.js) |
| Rayos entre el follaje | god-rays | [atmosphere.js](../../Pana/engine/models/effects/atmosphere.js) |
| Luna con halo | moon-disc | [atmosphere.js](../../Pana/engine/models/effects/atmosphere.js) |
| Luciérnagas | fireflies | [drifting-particles.js](../../Pana/engine/models/effects/drifting-particles.js) |
| Polen flotante | pollen-motes | [drifting-particles.js](../../Pana/engine/models/effects/drifting-particles.js) |
| Polvo de mina | mine-dust | [drifting-particles.js](../../Pana/engine/models/effects/drifting-particles.js) |
| Destellos dorados | gold-sparkles | [drifting-particles.js](../../Pana/engine/models/effects/drifting-particles.js) |
| Hojas que caen | falling-leaves | [drifting-particles.js](../../Pana/engine/models/effects/drifting-particles.js) |
| Chispas de fogata | ember-plume | [drifting-particles.js](../../Pana/engine/models/effects/drifting-particles.js) |
| Racimo de cristales | crystal-cluster | [crystals.js](../../Pana/engine/models/props/crystals.js) |
| Cristales del arcoíris | crystal-garden | [crystals.js](../../Pana/engine/models/props/crystals.js) |
| Cincuenta casas del pueblo | colonial-collection | [colonial-house-collection.js](../../Pana/engine/colonial-house-collection.js) |
| Calle de las flores | colonial-street | [colonial-street.js](../../Pana/engine/colonial-street.js) |

## Active models missing from individual Studio previews

| Resource / family | Current location | Source | Finding |
| --- | --- | --- | --- |
| Wooden sign | Bululú board/minigames; Derrape sectors | [wood-sign.js](../../Pana/engine/models/props/wood-sign.js#L6) | Active shared factory; many text variants, one model family. |
| Watchtower | Bululú board; No te caigas | [watchtower.js](../../Pana/engine/models/props/watchtower.js#L4) | Thatch/zinc options; distinct from the new lifeguard tower. |
| Venezuelan flagpole | Bululú board; No te caigas; Selva | [flags.js](../../Pana/engine/models/props/flags.js#L42) | Active animated flag. Pana branded pedestal is a separate catalog entry. |
| Displaced rock | Bululú board/minigames; Selva | [rock.js](../../Pana/engine/models/props/rock.js#L4) | Shared seeded rock, also embedded inside other models. |
| Offshore lighthouse (older) | Bululú board | [island-scenery.js](../../Pana/engine/island-scenery.js#L14) | One tower with a rotating night beam. Not the Costa lighthouse used on the race island; preserve daylight behavior when replacing. |
| Offshore sailboat (older) | Bululú board | [island-scenery.js](../../Pana/engine/island-scenery.js#L42) | Four box-hull sailboats still bob offshore. Not the new peñero. |
| Golden mango landmark tree | Bululú board | [island-environment.js](../../Pana/engine/island-environment.js#L39) | Special large fruit tree; separate construction from flora.mangoTree. |
| Original plaza church | Escondidas; Cocina; Plaza circuit | [plaza-buildings.js](../../Pana/engine/models/props/plaza-buildings.js#L158) | Active small bell tower/chapel, distinct from colonialChurch. |
| Summit terminal | Páramo | [world-landmarks.js](../../Pana/games/derrape/public/tracks/world-landmarks.js#L5) | Upper/lower terminals; separate from the catalog heritage cable-car station. |
| Aerial cable system and cabins | Páramo | [world-landmarks.js](../../Pana/games/derrape/public/tracks/world-landmarks.js#L19) | Six moving cabins, two cable curves; parameterized scene assembly. |
| Cable support tower | Páramo | [world-landmarks.js](../../Pana/games/derrape/public/tracks/world-landmarks.js#L39) | Terrain-dependent support height. |
| Diving school | Chi Chi | [world-landmarks.js](../../Pana/games/derrape/public/tracks/world-landmarks.js#L46) | Facade, dive tanks and diver flag. |
| Coastal fort | Chi Chi | [world-landmarks.js](../../Pana/games/derrape/public/tracks/world-landmarks.js#L63) | Lookout landmark on the mountain coast. |
| Maracaibo-inspired bridge | Plaza circuit | [world-landmarks.js](../../Pana/games/derrape/public/tracks/world-landmarks.js#L75) | Full driving bridge; use its actual road deck when previewing. |
| Grandstand | Estadio | [world-landmarks.js](../../Pana/games/derrape/public/tracks/world-landmarks.js#L95) | Eight stands with different dimensions/colors, covering the infield and outer sectors. |
| Canal villa | Plaza circuit | [world-landmarks.js](../../Pana/games/derrape/public/tracks/world-landmarks.js#L107) | Waterfront houses and balconies. |
| Small rowboat (older) | Selva; Llanos | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L447) | Two active river boats. Keep shallow-water footprint when upgrading. |
| Canal/dive-village boat | Plaza circuit; Chi Chi | [world-kit.js](../../Pana/games/derrape/public/tracks/world-kit.js#L105) | Cabin option; different builder from the coast peñero and island sailboats. |
| Faceted boulder | Páramo; Chi Chi; Desierto | [world-kit.js](../../Pana/games/derrape/public/tracks/world-kit.js#L115) | Instanced geological scatter, separate from props.rock. |
| Catch basket | Atrapa los mangos | [atrapa.js](../../Pana/games/bululu/public/minigames/atrapa.js#L19) | Held by players; needs a standalone preview adapter. |
| Coconut | Atrapa los mangos | [atrapa.js](../../Pana/games/bululu/public/minigames/atrapa.js#L31) | Falling hazard with three dark eyes. |
| Mango minigame tree (older) | Atrapa los mangos | [atrapa.js](../../Pana/games/bululu/public/minigames/atrapa.js#L40) | Old polygon canopy and random fruit placement. Modernize with shared flora while preserving catch lanes. |
| Board die | Bululú board | [board.js](../../Pana/games/bululu/public/board.js#L175) | Six face textures; game-driven roll animation. |
| Golden mango cart | Bululú board | [board.js](../../Pana/games/bululu/public/board.js#L203) | Cart, striped umbrella, chalkboard and reward beam. |
| Player token pedestal | Bululú board | [board.js](../../Pana/games/bululu/public/board.js#L541) | Colored base under shared character; not a new character sculpt. |
| Breakable supply crate | All eight Derrape races | [pickup-art.js](../../Pana/games/derrape/public/pickup-art.js#L11) | Gameplay crate is distinct from the Plaza disguise crate. |
| Collectible coin | All eight Derrape races | [pickup-art.js](../../Pana/games/derrape/public/pickup-art.js#L51) | Coin trails and pickups. |
| Mango peel | Derrape item use | [items.js](../../Pana/games/derrape/public/items.js#L76) | Three peel strips and seed; not the whole mango. |
| Kitchen sign | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js#L66) | Signs and flour-sack labels; text variants grouped. |
| Open pantry/fridge | Cocina | [scene.js](../../Pana/games/cocina/public/scene.js#L30) | Shelves with tomatoes, milk cartons and shared cheese. Assembly includes its food dressing. |
| Condiment bottles and flour sacks | Cocina | [scene.js](../../Pana/games/cocina/public/scene.js#L44) | Counter and floor dressing made inline; two prop types grouped as one set. |

## Scene assemblies, terrain, effects and embedded parts

| Resource / family | Current location | Source | Finding |
| --- | --- | --- | --- |
| Reliquia mine and temple | Reliquia; Studio map | [scene.js](../../Pana/games/reliquia/public/scene.js#L23) | Authored walkable mine, swept shared bridge, timed winches, crypt, relic chamber and return tunnel. Five expedition models are cataloged independently. |
| Mounted horse and riding tack | Galope, Bululú coleo; hub tile | [llanero-rider.js](../../Pana/engine/models/fauna/farm/llanero-rider.js#L9) | Shared horse and saved pana with game-local saddle, stirrups and reins; not a duplicate animal sculpt. |
| Horse course and distinct wetlands | Galope; Studio map | [scene.js](../../Pana/games/galope/public/scene.js#L21) | Shared terrain/water grid, clipped riding trail, irregular lagoon with island, winding estero, jump logs, start gantry and trail markers. Shared models counted separately. |
| Galope living Llanos landscape | Galope; Studio map | [landscape.js](../../Pana/games/galope/public/landscape.js#L15) | Hato gathering places, bank-connected canoe landing, moriche groves, green/dry grass, shore-only reeds and continuous far plain. All 13 new models have individual Studio previews. |
| Selva pyramid | Selva | [selva-world.js](../../Pana/games/derrape/public/tracks/selva-world.js#L70) | Stepped landmark outside the driving tunnel. |
| Road temple tunnel and portals | Selva | [selva-temple.js](../../Pana/games/derrape/public/tracks/selva-temple.js#L38) | Swept along the actual road; not the unused standalone temple entrance. |
| Selva plank crossing | Selva | [selva-world.js](../../Pana/games/derrape/public/tracks/selva-world.js#L208) | Road-warped planks, piers and flankBridge rails. Anchor spacing normalized by the audit. |
| Simple waterfall sheet | Selva | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L293) | Active older waterfall; separate from waterfallRocks in Chi Chi. |
| Pond and river wrappers | Selva | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L283) | waterPond/waterRibbon wrap the shared water surface. |
| Country grass tufts | Llanos; Desierto | [country-details.js](../../Pana/games/derrape/public/tracks/country-details.js#L4) | Instanced grass, absent from the 22 plant catalog entries. |
| Country entrance gantry | Llanos; Desierto | [country-details.js](../../Pana/games/derrape/public/tracks/country-details.js#L15) | Map-specific entrance text and width. |
| Country bridge crossings | Llanos; Desierto | [country-details.js](../../Pana/games/derrape/public/tracks/country-details.js#L24) | Road-conforming decks/rails; not standalone rope bridges. |
| Verge posts and dirt shoulders | Llanos; Desierto | [country-details.js](../../Pana/games/derrape/public/tracks/country-details.js#L39) | Route-generated posts, shoulders and tire ruts. |
| Llanos wetland landing | Llanos | [llanos-world.js](../../Pana/games/derrape/public/tracks/llanos-world.js#L120) | Dock planks and supports; capybaras now use shared wildlife. |
| Generic race edges | Multiple Derrape circuits | [world-kit.js](../../Pana/games/derrape/public/tracks/world-kit.js#L79) | Steel, timber and kerb variants, generated along the route. |
| Chevrons/start line/sector signs/ramps | Derrape | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L144) | Four route-generated furniture families; ramps depend on each track definition. |
| Race terrain and waterways | Derrape | [world-kit.js](../../Pana/games/derrape/public/tracks/world-kit.js#L28) | Terrain, sea and stream generators; each map supplies shape and palette. |
| Water surface system | Derrape | [water-surface.js](../../Pana/engine/models/effects/water-surface.js#L36) | Ocean, river, canal and pool configurations; not separate species/objects. |
| Bululú tide wash | Bululú circuit | [bululu-tide.js](../../Pana/games/derrape/public/tracks/bululu-tide.js#L20) | Animated surface tied to tire grip and wetness. |
| Board island terrain | Bululú board | [island-terrain.js](../../Pana/engine/island-terrain.js#L79) | Shoreline, beach, hills, river and path cuts. |
| Forested islet/ridge | Bululú board | [island-landscape.js](../../Pana/engine/island-landscape.js#L43) | Seeded neighboring islands and distant ridges. |
| Tepui and waterfall | Bululú board | [island-landscape.js](../../Pana/engine/island-landscape.js#L83) | Three mesas; one waterfall/mist landmark. Not the Selva waterfall. |
| Living sky and cloud layers | Derrape; Galope; Escondidas; Cocina; Bululú and minigames; Studio tours | [sky.js](../../Pana/engine/sky.js#L5) | One procedural sky draw, seeded cumulus and wisps, absolute-time wind and day/night tint. Scene-owned, outside scenery bounds. |
| Island dock and village light strings | Bululú board | [island-environment.js](../../Pana/engine/island-environment.js#L194) | Placement-specific geometry; not separate library factories. |
| Race-island piers | Bululú circuit | [bululu.js](../../Pana/games/derrape/public/tracks/bululu.js#L99) | Inline harbor planks and pilings. |
| Plaza streets, gardens and mirador | Plaza circuit | [plaza-town.js](../../Pana/games/derrape/public/tracks/plaza-town.js#L46) | Street surfaces, block gardens, lookout terrace and stairs; shared houses/trees counted separately. |
| Plaza waterfront canals and docks | Plaza circuit | [plaza-waterfront.js](../../Pana/games/derrape/public/tracks/plaza-waterfront.js#L23) | Canal network and moorings around canalVilla. |
| Continuous circuit surroundings | All eight Derrape races | [world-horizon.js](../../Pana/games/derrape/public/tracks/world-horizon.js#L15) | Exact grid-edge joins to coarser outer terrain; coastal water keeps its detailed near grid and gains a far apron. |
| Plaza outer neighborhoods | Plaza circuit | [plaza-outskirts.js](../../Pana/games/derrape/public/tracks/plaza-outskirts.js#L10) | Connected outer lanes, 51 additional houses, 26 planted courtyards and road-safe groves. Reuses existing house and plant factories. |
| Llanos pastures and gallery woodland | Llanos | [llanos-landscape.js](../../Pana/games/derrape/public/tracks/llanos-landscape.js#L9) | Four pastures, repeated ranch fences, harvest bales, morichal palms and distant ceiba groves. Existing animals retain their space. |
| Stadium venue grounds | Estadio | [stadium-grounds.js](../../Pana/games/derrape/public/tracks/stadium-grounds.js#L10) | Entrance, perimeter, concourse, planted parking and infields. Parked copies reuse real garage vehicles with no driver. |
| Football pitch and goals | Estadio | [estadio.js](../../Pana/games/derrape/public/tracks/estadio.js#L26) | Pitch stripes, markings and two goal frames. |
| Pit garages | Estadio | [estadio.js](../../Pana/games/derrape/public/tracks/estadio.js#L49) | Eight inline garage blocks and numbered signs. |
| Floodlights and scoreboard | Estadio | [estadio.js](../../Pana/games/derrape/public/tracks/estadio.js#L67) | Two inline landmark families. |
| Basketball court and banners | Estadio | [estadio.js](../../Pana/games/derrape/public/tracks/estadio.js#L81) | Court and sponsor panels; shared hoops already cataloged. |
| Chi Chi retaining walls and river bridges | Chi Chi | [chichi-village.js](../../Pana/games/derrape/public/tracks/chichi-village.js#L41) | Bridge geometry follows road/river. Retaining walls in chichi.js. |
| Bululú board tiles, paths, stairs and pins | Bululú board | [board.js](../../Pana/games/bululu/public/board.js#L62) | Tile-kind texture variants, raised supports, fork paths and waypoint sprites. |
| Sunny minigame stage | Both Bululú minigames | [stage.js](../../Pana/games/bululu/public/minigames/stage.js#L18) | Sky, ground, clouds and shared landscape props. |
| Raft and spinning striped log | No te caigas | [caigas.js](../../Pana/games/bululu/public/minigames/caigas.js#L46) | Player platforms, floats, central post, rotating obstacle and sandbars. |
| Minigame wave surface | No te caigas | [caigas.js](../../Pana/games/bululu/public/minigames/caigas.js#L39) | Older deformed plane, separate from the shared water shader. |
| Boost pad | Derrape | [items.js](../../Pana/games/derrape/public/items.js#L100) | Animated ground marker, separate from collectible item models. |
| Puffs, debris and speech bubbles | Bululú; Derrape | [fx.js](../../Pana/engine/fx.js#L303) | Particle/sprite effects, not scenery inventory counts. |
| Crate fragment bursts | Derrape | [fragments.js](../../Pana/games/derrape/public/fragments.js#L6) | Gameplay fragments reused from crate art. |
| Steam, fire and order dressing | Cocina | [scene.js](../../Pana/games/cocina/public/scene.js#L68) | Cooking state effects; recipes also have raw/prepared/cooked/burned variants. |
| Thermal steam and water details | Chi Chi; shared fountains/waterfalls | [thermal-steam.js](../../Pana/engine/models/effects/thermal-steam.js#L5) | Reusable steam, droplets and ripple systems; water details also in water-details.js. |
| Character accessories and expressions | All games; character editor | [avatar.js](../../Pana/engine/avatar.js#L23) | Eight non-empty hat options, three glasses options, five expression options and two non-empty extras. Some options share geometry/poses. Outfits are already cataloged; accessories and dizzy stars are embedded parts. |

## Older code with no current enabled placement

| Resource / family | Current location | Source | Finding |
| --- | --- | --- | --- |
| Old windmill | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L374) | Current Llanos uses ranch-props.waterWindmill. |
| Old arepa stand | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L404) | Current maps use streetFoodKiosk. |
| Generic dock | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L434) | Maps now build docks against their shore/deck. |
| Generic sailboat | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L459) | No production caller; internally uses rowboat, which remains active. |
| Generic plank/rope bridge | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L318) | Active crossings have road-specific decks or newer shared factories. |
| Distant mountain ring | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L478) | Current maps use their own terrain or island-landscape. |
| Old route landscape scatter | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L522) | Current worlds supply habitat-specific planting. |
| Tire-wall generator | Runtime hook only; current tracks disable walls | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L65) | Code is still wired conditionally; distinguish dormant configuration from dead code. |
| Fence-ring generator | Runtime hook only; no current track enables fence | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L101) | Do not remove without checking future track configuration. |

## Replaced models and compatibility aliases

| Resource / family | Current location | Source | Finding |
| --- | --- | --- | --- |
| Generic box-wing bird | Previously Selva/Llanos/Desierto | [track-kit.js](../../Pana/games/derrape/public/track-kit.js) | Removed in this audit; replaced by three wildlife factories. Old comments listed toucan/seagull, but those were not distinct current species. |
| Random dressed scenery capybara | Previously Selva | [track-kit.js](../../Pana/games/derrape/public/track-kit.js) | Removed in this audit; wildCapybara reuses canonical capybaraForm. Three Llanos animals now use the same factory. |
| Old box cow | Previously Llanos | [llanos-world.js](../../Pana/games/derrape/public/tracks/llanos-world.js) | Already replaced by hatoCow in 64bf025 before this audit; not a second current cow model. |
| Legacy playa track ID | Derrape URL alias | [tracks.js](../../Pana/games/derrape/public/tracks.js) | Resolves to bululu, not a ninth racing map. |
| Old game-local shared module paths | Bululú and Escondidas compatibility re-exports | [scenery.js](../../Pana/games/bululu/public/scenery.js) | Forward to engine modules; do not count aliases as duplicate assets. |

## Complete Studio registry

The following list is generated, not manually copied. “In use” is the catalog’s current declared consumer status; detailed native placement proof exists for the fauna and recent packs. Color/seed variants are not separate rows unless Studio explicitly registers them. The seated driver now declares Derrape and the forced chef preview declares Cocina; normal wardrobe options remain shared across games.

### Atmósfera (12)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Neblina rastrera · ground-fog | Preview only | [atmosphere.js](../../Pana/engine/models/effects/atmosphere.js) | groundFog |
| Haz de luz con polvo · light-shaft | Preview only | [atmosphere.js](../../Pana/engine/models/effects/atmosphere.js) | lightShaft |
| Tragaluz de cueva · skylight-beam | Preview only | [atmosphere.js](../../Pana/engine/models/effects/atmosphere.js) | skylightBeam |
| Charco de luz · glow-pool | Preview only | [atmosphere.js](../../Pana/engine/models/effects/atmosphere.js) | glowPool |
| Rayos entre el follaje · god-rays | Preview only | [atmosphere.js](../../Pana/engine/models/effects/atmosphere.js) | godRays |
| Luna con halo · moon-disc | Preview only | [atmosphere.js](../../Pana/engine/models/effects/atmosphere.js) | moonDisc |
| Luciérnagas · fireflies | Preview only | [drifting-particles.js](../../Pana/engine/models/effects/drifting-particles.js) | fireflies |
| Polen flotante · pollen-motes | Preview only | [drifting-particles.js](../../Pana/engine/models/effects/drifting-particles.js) | floatingMotes |
| Polvo de mina · mine-dust | Preview only | [drifting-particles.js](../../Pana/engine/models/effects/drifting-particles.js) | floatingMotes |
| Destellos dorados · gold-sparkles | Preview only | [drifting-particles.js](../../Pana/engine/models/effects/drifting-particles.js) | floatingMotes |
| Hojas que caen · falling-leaves | Preview only | [drifting-particles.js](../../Pana/engine/models/effects/drifting-particles.js) | fallingLeaves |
| Chispas de fogata · ember-plume | Preview only | [drifting-particles.js](../../Pana/engine/models/effects/drifting-particles.js) | emberPlume |

### Campamento (21)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Fogata de expedición · expedition-campfire | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | expeditionCampfire |
| Carpa de expedición · expedition-tent | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | expeditionTent |
| Carpa de expedición verde oliva · expedition-tent-olive | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | expeditionTent |
| Farol de vidrio · glass-lantern | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | glassLantern |
| Caja de suministros · supply-crate | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | supplyCrate |
| Barril con aros · hooped-barrel | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | hoopedBarrel |
| Saco de víveres · grain-sack | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | grainSack |
| Morral de expedición · expedition-backpack | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | expeditionBackpack |
| Cobija enrollada · rolled-blanket | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | rolledBlanket |
| Tobo de campamento · camp-bucket | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | campBucket |
| Banco de campamento · camp-bench | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | campBench |
| Herramientas en el tocón · camp-tools | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | campTools |
| Ollas y cesta · camp-cookware | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | campCookware |
| Pila de suministros · supply-pile | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | supplyPile |
| Mesa de investigación · investigation-table | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | investigationTable |
| Refugio de radio · comm-shelter | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | commShelter |
| Depósito de suministros · storage-shelter | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | storageShelter |
| Jeep de expedición · expedition-jeep | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | expeditionJeep |
| Mirador de expedición · expedition-watchtower | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | expeditionWatchtower |
| Puente de tablas · plank-footbridge | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | plankFootbridge |
| Portal de troncos · log-gateway | Preview only | [expedition-camp.js](../../Pana/engine/models/props/expedition-camp.js) | logGateway |

### Cementerio (30)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Lápida redondeada · grave-headstone | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | grave |
| Cruz celta · grave-celtic | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | grave |
| Obelisco funerario · grave-obelisk | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | grave |
| Losa sepulcral · grave-ledger | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | grave |
| Cruz de madera · grave-wooden | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | grave |
| Calabaza tallada · jack-o-lantern | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | pumpkin |
| Calavera · skull | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | skull |
| Velas de tumba · grave-candles | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | graveCandles |
| Ataúd cerrado · coffin | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | coffin |
| Ataúd abierto · coffin-open | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | coffin |
| Fosa abierta · open-grave | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | openGrave |
| Reja de hierro · iron-fence | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | ironFence |
| Pilar de piedra con urna · stone-pillar-urn | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | stonePillar |
| Pilar de piedra con calavera · stone-pillar-skull | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | stonePillar |
| Pilar de piedra con farol · stone-pillar-lantern | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | stonePillar |
| Farol de hierro · cemetery-lantern | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | cemeteryLantern |
| Poste de farol · cemetery-lamp-post | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | cemeteryLampPost |
| Mausoleo con puerta cerrada · mausoleum-dark | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | mausoleum |
| Mausoleo con reja · mausoleum-barred | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | mausoleum |
| Mausoleo con brillo verde · mausoleum-glow | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | mausoleum |
| Portón del cementerio · cemetery-gate | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | cemeteryGate |
| Capilla en ruinas · cemetery-chapel | Preview only | [cemetery-chapel.js](../../Pana/engine/models/props/cemetery-chapel.js) | cemeteryChapel |
| Mansión embrujada · crooked-mansion | Preview only | [crooked-mansion.js](../../Pana/engine/models/props/crooked-mansion.js) | crookedMansion |
| Espantapájaros · scarecrow | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | scarecrow |
| Pozo de piedra · graveyard-well | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | graveyardWell |
| Pasarela del pantano · swamp-boardwalk | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | boardwalk |
| Choza sobre pilotes · stilt-shack | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | stiltShack |
| Bote de remos · rowboat | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | rowboat |
| Bote medio hundido · rowboat-sunk | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | rowboat |
| Fuego fatuo · wisp | Preview only | [cemetery.js](../../Pana/engine/models/props/cemetery.js) | wisp |

### Costa (29)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Peñero de pesca · fishing-boat | Bululú, Derrape, Escondidas, ¡Pintura!, Billar, Caída | [coastal.js](../../Pana/engine/models/props/coastal.js) | fishingBoat |
| Faro costero · coastal-lighthouse | Derrape, Escondidas, ¡Pintura!, Billar, Caída | [coastal.js](../../Pana/engine/models/props/coastal.js) | coastalLighthouse |
| Torre de salvavidas · lifeguard-tower | Bululú, Derrape | [coastal.js](../../Pana/engine/models/props/coastal.js) | lifeguardTower |
| Cancha de voleibol de playa · beach-volleyball | Derrape | [coastal.js](../../Pana/engine/models/props/coastal.js) | beachVolleyball |
| Ducha de playa · beach-shower | Bululú, Derrape | [coastal.js](../../Pana/engine/models/props/coastal.js) | beachShower |
| Puesto de salvavidas · rescue-ring-stand | Bululú, Derrape | [coastal.js](../../Pana/engine/models/props/coastal.js) | rescueRingStand |
| Secadero de redes · fishing-net-rack | Bululú, Derrape, Escondidas, ¡Pintura!, Billar, Caída | [coastal.js](../../Pana/engine/models/props/coastal.js) | fishingNetRack |
| Cajas de pesca · fish-crates | Bululú, Derrape | [coastal.js](../../Pana/engine/models/props/coastal.js) | fishCrates |
| Boya de canal · channel-buoy | Bululú, Derrape | [coastal.js](../../Pana/engine/models/props/coastal.js) | channelBuoy |
| Cortina de cascada · waterfall-curtain | Derrape, Bululú | [waterfall.js](../../Pana/engine/models/effects/waterfall.js) | waterfall |
| Arroyo en cascada · cascade-stream | Preview only | [water-surface.js](../../Pana/engine/models/effects/water-surface.js) | cascadeStream |
| Poza de sal · salt-pool | Derrape | [saltworks.js](../../Pana/engine/models/props/saltworks.js) | saltPool |
| Montón de sal · salt-pile | Derrape | [saltworks.js](../../Pana/engine/models/props/saltworks.js) | saltPile |
| Compuerta salinera · sluice-gate | Derrape | [saltworks.js](../../Pana/engine/models/props/saltworks.js) | sluiceGate |
| Patio de cosecha de sal · salt-harvester | Derrape | [salt-harvester.js](../../Pana/engine/models/props/salt-harvester.js) | saltHarvester |
| Astillero de peñeros · boat-repair-yard | Derrape | [boat-yard.js](../../Pana/engine/models/props/boat-yard.js) | boatRepairYard |
| Lonja de pescado · fish-auction-canopy | Derrape | [fish-auction-canopy.js](../../Pana/engine/models/props/fish-auction-canopy.js) | fishAuctionCanopy |
| Pasarela salinera · salt-boardwalk | Derrape | [salt-boardwalk.js](../../Pana/engine/models/props/salt-boardwalk.js) | saltBoardwalk |
| Baliza de navegación · navigation-beacon | Derrape | [navigation-beacon.js](../../Pana/engine/models/props/navigation-beacon.js) | navigationBeacon |
| Estación de bombeo · water-pump-station | Derrape | [water-pump-station.js](../../Pana/engine/models/props/water-pump-station.js) | waterPumpStation |
| Casa Guipuzcoana · casa-guipuzcoana | Derrape, Caída, Dominó, Póquer | [casa-guipuzcoana.js](../../Pana/engine/models/props/casa-guipuzcoana.js) | casaGuipuzcoana |
| Fuerte San Carlos · san-carlos-fortress | Derrape, Caída, Dominó, Póquer | [san-carlos-fortress.js](../../Pana/engine/models/props/san-carlos-fortress.js) | sanCarlosFortress |
| Silos del puerto · port-silos | Derrape, Caída, Dominó, Póquer | [port-silos.js](../../Pana/engine/models/props/port-silos.js) | portSilos |
| Contenedor de carga · shipping-container | Derrape | [port-cargo.js](../../Pana/engine/models/props/port-cargo.js) | shippingContainer |
| Almacén del muelle · transit-warehouse | Derrape | [port-cargo.js](../../Pana/engine/models/props/port-cargo.js) | transitWarehouse |
| Bolardo del puerto · port-bollard | Derrape | [port-cargo.js](../../Pana/engine/models/props/port-cargo.js) | portBollard |
| Grúa del puerto · port-crane | Derrape | [port-crane.js](../../Pana/engine/models/props/port-crane.js) | portCrane |
| Buque portacontenedores · cargo-ship | Derrape | [cargo-ship.js](../../Pana/engine/models/props/cargo-ship.js) | cargoShip |
| Fortín de la costa · coastal-fortress | Derrape | [coastal-fort.js](../../Pana/engine/models/props/coastal-fort.js) | coastalFortress |

### Desierto (10)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Cardón gigante · giant-cactus | Derrape | [desert.js](../../Pana/engine/models/props/desert.js) | giantCactus |
| Módulo de duna · sand-dune | Derrape | [desert.js](../../Pana/engine/models/props/desert.js) | sandDune |
| Arco de roca del desierto · desert-rock-arch | Derrape | [desert.js](../../Pana/engine/models/props/desert.js) | desertRockArch |
| Gasolinera abandonada · abandoned-gas-station | Derrape | [desert.js](../../Pana/engine/models/props/desert.js) | abandonedGasStation |
| Camioneta oxidada · rusted-pickup | Derrape | [desert.js](../../Pana/engine/models/props/desert.js) | rustedPickup |
| Pila de cauchos · roadside-tire-pile | Derrape | [desert.js](../../Pana/engine/models/props/desert.js) | roadsideTirePile |
| Aguja de roca del cañón · canyon-spire | Derrape | [desert.js](../../Pana/engine/models/props/desert.js) | canyonSpire |
| Carreta de madera rota · broken-wagon | Derrape | [desert.js](../../Pana/engine/models/props/desert.js) | brokenWagon |
| Señal de peligro del desierto · desert-warning-sign | Derrape | [desert.js](../../Pana/engine/models/props/desert.js) | desertWarningSign |
| Pozo viejo del desierto · desert-well | Derrape | [desert.js](../../Pana/engine/models/props/desert.js) | desertWell |

### Emblemas (9)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Fuente de Plaza Pana · plaza-fountain | Escondidas, Cocina, Derrape, Billar, Póquer | [plaza-buildings.js](../../Pana/engine/models/props/plaza-buildings.js) | plazaFountain |
| Estatua gigante de capibara · capybara-statue | Preview only | [monuments.js](../../Pana/engine/models/props/monuments.js) | capybaraStatue |
| Estatua del mango de oro · golden-mango-statue | Preview only | [monuments.js](../../Pana/engine/models/props/monuments.js) | goldenMangoStatue |
| Arco de bienvenida Pana · welcome-arch | Preview only | [monuments.js](../../Pana/engine/models/props/monuments.js) | welcomeArch |
| Topiaria de capibara · capybara-topiary | Escondidas, Cocina, Derrape | [monuments.js](../../Pana/engine/models/props/monuments.js) | capybaraTopiary |
| Asta con bandera Pana · pana-flagpole | Preview only | [monuments.js](../../Pana/engine/models/props/monuments.js) | panaFlagpole |
| Monumento de la Copa Pana · trophy-monument | Derrape | [monuments.js](../../Pana/engine/models/props/monuments.js) | trophyMonument |
| Fuente de los capibaras · capybara-fountain | Preview only | [monuments.js](../../Pana/engine/models/props/monuments.js) | capybaraFountain |
| Kiosco de recuerdos Pana · souvenir-kiosk | Derrape | [monuments.js](../../Pana/engine/models/props/monuments.js) | souvenirKiosk |

### Fauna (21)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Flamenco de las salinas · flamingo | Derrape | [flamingo.js](../../Pana/engine/models/fauna/birds/flamingo.js) | flamingo |
| Tonina (delfín rosado) · tonina | Curiara | [tonina.js](../../Pana/engine/models/fauna/aquatic/tonina.js) | tonina |
| Babo · caiman | Curiara | [caiman.js](../../Pana/engine/models/fauna/caiman.js) | caiman |
| Mariposas morpho · morpho | Curiara | [morpho.js](../../Pana/engine/models/fauna/morpho.js) | morphoSwarm |
| Guacamaya roja · scarlet-macaw | Derrape | [scarlet-macaw.js](../../Pana/engine/models/fauna/birds/scarlet-macaw.js) | scarletMacaw |
| Corocora roja · scarlet-ibis | Derrape, Galope | [scarlet-ibis.js](../../Pana/engine/models/fauna/birds/scarlet-ibis.js) | scarletIbis |
| Zamuro planeador · soaring-vulture | Derrape | [soaring-vulture.js](../../Pana/engine/models/fauna/birds/soaring-vulture.js) | soaringVulture |
| Chigüire · wild-capybara | Derrape, Galope | [wild-capybara.js](../../Pana/engine/models/fauna/capybara/wild-capybara.js) | wildCapybara |
| Caballo llanero · llanero-horse | Derrape, Galope | [llanero-horse.js](../../Pana/engine/models/fauna/farm/llanero-horse.js) | llaneroHorse |
| Gallina de patio · yard-chicken | Derrape | [yard-chicken.js](../../Pana/engine/models/fauna/farm/yard-chicken.js) | yardChicken |
| Vaca del hato · hato-cow | Derrape, Galope | [hato-cow.js](../../Pana/engine/models/fauna/farm/hato-cow.js) | hatoCow |
| Pez de arrecife · reef-fish | Bululú, Derrape | [reef-fish.js](../../Pana/engine/models/fauna/aquatic/reef-fish.js) | reefFish |
| Cardumen costero · reef-fish-school | Bululú, Derrape | [reef-fish-school.js](../../Pana/engine/models/fauna/aquatic/reef-fish-school.js) | reefFishSchool |
| Iguana tomando sol · iguana | Bululú, Derrape, Curiara, Galope, Escondidas, Cocina | [iguana.js](../../Pana/engine/models/fauna/iguana.js) | iguana |
| Iguana en la rama · iguana-perch | Bululú, Curiara, Galope | [iguana.js](../../Pana/engine/models/fauna/iguana.js) | iguana |
| Iguana corriendo · iguana-run | Bululú | [iguana.js](../../Pana/engine/models/fauna/iguana.js) | iguana |
| Iguana dorada · iguana-golden | Bululú | [iguana.js](../../Pana/engine/models/fauna/iguana.js) | iguana |
| Cangrejo de playa · beach-crab | Bululú, Derrape | [beach-crab.js](../../Pana/engine/models/fauna/beach-crab.js) | beachCrab |
| Jaguar · jaguar | Preview only | [jaguar.js](../../Pana/engine/models/fauna/jaguar.js) | jaguar |
| Jaguar sentado · jaguar-sitting | Preview only | [jaguar.js](../../Pana/engine/models/fauna/jaguar.js) | jaguar |
| Jaguar negro · black-jaguar | Preview only | [jaguar.js](../../Pana/engine/models/fauna/jaguar.js) | jaguar |

### Llanos (10)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Casa de hato llanero · ranch-house | Derrape, Galope, Escondidas, ¡Pintura!, Billar, Caída | [ranch.js](../../Pana/engine/models/props/ranch.js) | llaneroRanchHouse |
| Portón de corral · corral-gate | Derrape, Galope | [ranch.js](../../Pana/engine/models/props/ranch.js) | corralGate |
| Paca de heno · hay-bale | Derrape, Galope, Escondidas, ¡Pintura!, Billar, Caída | [ranch.js](../../Pana/engine/models/props/ranch.js) | hayBale |
| Molino de agua · water-windmill | Derrape, Galope, Escondidas, ¡Pintura!, Billar, Caída | [ranch.js](../../Pana/engine/models/props/ranch.js) | waterWindmill |
| Caballeriza · horse-stable | Derrape, Galope, Escondidas, ¡Pintura!, Billar, Caída | [ranch.js](../../Pana/engine/models/props/ranch.js) | horseStable |
| Comedero de ganado · feeding-trough | Derrape, Galope, Escondidas, ¡Pintura!, Billar, Caída | [ranch.js](../../Pana/engine/models/props/ranch.js) | feedingTrough |
| Cerca de hato · ranch-fence | Derrape, Galope, Escondidas, ¡Pintura!, Billar, Caída | [ranch.js](../../Pana/engine/models/props/ranch.js) | ranchFence |
| Tractor viejo · old-tractor | Derrape, Galope, Escondidas, ¡Pintura!, Billar, Caída | [ranch.js](../../Pana/engine/models/props/ranch.js) | oldTractor |
| Módulo de charco de barro · mud-puddle | Derrape | [ranch.js](../../Pana/engine/models/props/ranch.js) | mudPuddle |
| Torre de agua del hato · ranch-water-tower | Derrape, Galope | [ranch.js](../../Pana/engine/models/props/ranch.js) | ranchWaterTower |

### Mapas (27)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Casa Guipuzcoana · table-guipuzcoana | Caída, Dominó, Póquer | [puerto-tables.js](../../Pana/engine/puerto-tables.js) | createPuertoTableEnvironment |
| Fuerte San Carlos · table-san-carlos | Caída, Dominó, Póquer | [puerto-tables.js](../../Pana/engine/puerto-tables.js) | createPuertoTableEnvironment |
| Cincuenta casas del pueblo · colonial-collection | Preview only | [colonial-house-collection.js](../../Pana/engine/colonial-house-collection.js) | createColonialHouseCollection |
| Calle de las flores · colonial-street | Preview only | [colonial-street.js](../../Pana/engine/colonial-street.js) | createColonialStreet |
| Puerto Coco · arena-puerto | Escondidas, Pepazo, Billar, Caída | [arenas.js](../../Pana/engine/arenas.js) | createArenaEnvironment |
| Hato del Sol · arena-hato | Escondidas, Pepazo, Billar, Caída | [arenas.js](../../Pana/engine/arenas.js) | createArenaEnvironment |
| Ruinas del Mango · arena-ruinas | Escondidas, Pepazo, Billar, Caída | [arenas.js](../../Pana/engine/arenas.js) | createArenaEnvironment |
| Reliquia · La mina del sol · reliquia | Reliquia | [scene.js](../../Pana/games/reliquia/public/scene.js) | createExpeditionWorld |
| ¡Embuste! · El campamento y el templo · embuste | ¡Embuste! | [scene.js](../../Pana/games/embuste/public/scene.js) | createCampWorld |
| Galope · La vuelta del estero · galope | Galope | [scene.js](../../Pana/games/galope/public/scene.js) | createCourse |
| Curiara · Río abajo · curiara | Curiara | [scene.js](../../Pana/games/curiara/public/scene.js) | createRiverWorld |
| Plaza Pana · plaza | Escondidas, Cocina, Derrape | [plaza.js](../../Pana/engine/plaza.js) | createPlazaEnvironment |
| Cocina de la plaza · cocina | Cocina | [scene.js](../../Pana/games/cocina/public/scene.js) | createKitchenScene |
| Isla Bululú · isla | Bululú | [board.js](../../Pana/games/bululu/public/board.js) | createBoard |
| Circuito · El Estadio · track-estadio | Derrape | [estadio.js](../../Pana/games/derrape/public/tracks/estadio.js) | makeTrack(definition).build |
| Circuito · Pana Desierto · track-desierto | Derrape | [desierto.js](../../Pana/games/derrape/public/tracks/desierto.js) | makeTrack(definition).build |
| Circuito · Los Llanos · track-llanos | Derrape | [llanos.js](../../Pana/games/derrape/public/tracks/llanos.js) | makeTrack(definition).build |
| Circuito · Chi Chi · track-chichi | Derrape | [chichi.js](../../Pana/games/derrape/public/tracks/chichi.js) | makeTrack(definition).build |
| Circuito · Pana Selva · track-selva | Derrape | [selva.js](../../Pana/games/derrape/public/tracks/selva.js) | makeTrack(definition).build |
| Circuito · Pana Páramo · track-paramo | Derrape | [paramo.js](../../Pana/games/derrape/public/tracks/paramo.js) | makeTrack(definition).build |
| Circuito · Plaza Pana · track-plaza | Derrape | [plaza.js](../../Pana/games/derrape/public/tracks/plaza.js) | makeTrack(definition).build |
| Circuito · Isla Bululú · track-bululu | Derrape | [bululu.js](../../Pana/games/derrape/public/tracks/bululu.js) | makeTrack(definition).build |
| Circuito · Salto del Tepuy · track-salto | Derrape | [salto.js](../../Pana/games/derrape/public/tracks/salto.js) | makeTrack(definition).build |
| Circuito · Delta de los Caños · track-delta | Derrape | [delta.js](../../Pana/games/derrape/public/tracks/delta.js) | makeTrack(definition).build |
| Circuito · Cuevas del Río · track-cuevas | Derrape | [cuevas.js](../../Pana/games/derrape/public/tracks/cuevas.js) | makeTrack(definition).build |
| Circuito · Salinas del Viento · track-salinas | Derrape | [salinas.js](../../Pana/games/derrape/public/tracks/salinas.js) | makeTrack(definition).build |
| Circuito · Puerto · track-puerto | Derrape | [puerto.js](../../Pana/games/derrape/public/tracks/puerto.js) | makeTrack(definition).build |

### Mina (27)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Minero · gold-miner | Preview only | [mine-miner.js](../../Pana/engine/models/props/mine-miner.js) | miner |
| Vagoneta minera · mine-cart | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | mineCart |
| Vía minera con caballetes · mine-track | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | mineTrack |
| Veta de oro · gold-vein | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | goldVein |
| Montón de mineral · ore-pile | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | orePile |
| Caja minera · mine-crate | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | mineCrate |
| Caja de dinamita · tnt-crate | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | mineCrate |
| Barril minero · mine-barrel | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | mineBarrel |
| Farol de mina · mine-lantern | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | mineLantern |
| Poste con farol · mine-lantern-post | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | mineLanternPost |
| Guirnalda de bombillos · bulb-wire | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | bulbWire |
| Escalera de mano · mine-ladder | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | mineLadder |
| Escalera de tablas · mine-stairs | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | mineStairs |
| Pico · mine-pickaxe | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | minePickaxe |
| Pala · mine-shovel | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | mineShovel |
| Carretilla minera · mine-wheelbarrow | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | mineWheelbarrow |
| Boca de mina · mine-portal | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | minePortal |
| Marco de entibado · mine-support | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | mineSupport |
| Andamio de veta · mine-scaffold | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | mineScaffold |
| Caseta de mineros · miner-shack | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | minerShack |
| Mesa de pesaje de oro · assay-table | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | assayTable |
| Rueda hidráulica · water-wheel | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | waterWheel |
| Molino de pisones · stamp-mill | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | stampMill |
| Torre de ascensor minero · lift-tower | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | liftTower |
| Portal de la mina de sal · mine-gate | Preview only | [mine.js](../../Pana/engine/models/props/mine.js) | mineGate |
| Racimo de cristales · crystal-cluster | Preview only | [crystals.js](../../Pana/engine/models/props/crystals.js) | crystalCluster |
| Cristales del arcoíris · crystal-garden | Preview only | [crystals.js](../../Pana/engine/models/props/crystals.js) | crystalGarden |

### Objetos (66)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Barril · barrel | Escondidas, Cocina, Derrape, Billar, Caída, ¡Embuste!, ¡Pintura! | [plaza.js](../../Pana/engine/models/props/plaza.js) | barrel |
| Caja · crate | Escondidas, Cocina, Derrape, Billar, Caída, ¡Embuste!, ¡Pintura! | [plaza.js](../../Pana/engine/models/props/plaza.js) | crate |
| Cava · cooler | Escondidas, Cocina, Derrape, Billar, Caída, ¡Embuste! | [plaza.js](../../Pana/engine/models/props/plaza.js) | cooler |
| Mata · planter | Escondidas, Cocina, Derrape, Billar, Caída | [plaza.js](../../Pana/engine/models/props/plaza.js) | planter |
| Banco · bench | Escondidas, Cocina, Derrape, Billar, Caída | [plaza.js](../../Pana/engine/models/props/plaza.js) | bench |
| Puesto de mercado · market-stall | Escondidas, Derrape, ¡Pintura!, Billar, Caída | [plaza.js](../../Pana/engine/models/props/plaza.js) | marketStall |
| Farol de plaza · street-lamp | Escondidas, Cocina, Derrape, Billar, Póquer, ¡Pintura! | [plaza.js](../../Pana/engine/models/props/plaza.js) | streetLamp |
| Casa del pueblo · house | Escondidas, Cocina, Derrape, Billar, Póquer, ¡Pintura! | [plaza-buildings.js](../../Pana/engine/models/props/plaza-buildings.js) | house |
| Casa con balcón · house-balcony | Escondidas, Cocina, Derrape, Billar, Póquer, ¡Pintura! | [plaza-buildings.js](../../Pana/engine/models/props/plaza-buildings.js) | house |
| Bodeguita del pueblo · house-shop | Escondidas, Cocina, Derrape, Billar, Póquer, ¡Pintura! | [plaza-buildings.js](../../Pana/engine/models/props/plaza-buildings.js) | house |
| Casa con terraza · house-terrace | Escondidas, Cocina, Derrape, Billar, Póquer, ¡Pintura! | [plaza-buildings.js](../../Pana/engine/models/props/plaza-buildings.js) | house |
| Mango · mango | Bululú, Derrape | [mango.js](../../Pana/engine/models/props/mango.js) | makeMango |
| Mango dorado · gold-mango | Bululú, Derrape | [mango.js](../../Pana/engine/models/props/mango.js) | makeMango |
| China (tirapiedras) · china | Bululú | [china.js](../../Pana/engine/models/props/china.js) | china |
| Casita de isla · casita | Bululú | [island-house.js](../../Pana/engine/models/props/island-house.js) | casita |
| Sombrilla de playa · beachShade | Bululú, Derrape | [beach.js](../../Pana/engine/models/props/beach.js) | beachShade |
| Rancho de playa · beachHut | Bululú, Derrape, Escondidas, ¡Pintura!, Billar, Caída | [beach.js](../../Pana/engine/models/props/beach.js) | beachHut |
| Tronco de playa · driftwood | Bululú, Derrape, Galope | [beach.js](../../Pana/engine/models/props/beach.js) | driftwood |
| Mazorca · corn | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js) | corn |
| Queso · cheese | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js) | cheese |
| Fregadero · sink | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js) | sink |
| Momia del templo · temple-mummy | Reliquia, ¡Embuste! | [reliquia.js](../../Pana/engine/models/props/reliquia.js) | mummy |
| Guardián del sol · sun-guardian | Reliquia, ¡Embuste! | [reliquia.js](../../Pana/engine/models/props/reliquia.js) | mummy |
| Reliquia del sol · sun-relic | Reliquia, ¡Embuste! | [reliquia.js](../../Pana/engine/models/props/reliquia.js) | sunRelic |
| Rueda del templo · expedition-winch | Reliquia, ¡Embuste! | [reliquia.js](../../Pana/engine/models/props/reliquia.js) | expeditionWinch |
| Farol de expedición · expedition-lantern | Reliquia, ¡Embuste! | [reliquia.js](../../Pana/engine/models/props/reliquia.js) | expeditionLantern |
| Campana del campamento · camp-bell | ¡Embuste! | [embuste.js](../../Pana/engine/models/props/embuste.js) | campBell |
| Radio de campaña · field-radio | ¡Embuste! | [embuste.js](../../Pana/engine/models/props/embuste.js) | radioSet |
| Compuerta del río · river-dam | ¡Embuste! | [embuste.js](../../Pana/engine/models/props/embuste.js) | damGate |
| Carpa de expedición · camp-tent | ¡Embuste! | [embuste.js](../../Pana/engine/models/props/embuste.js) | campTent |
| Vendas de momia · bandage-wrap | ¡Embuste! | [embuste.js](../../Pana/engine/models/props/embuste.js) | bandageWrap |
| Trampa de bejuco · vine-snare | ¡Embuste! | [embuste.js](../../Pana/engine/models/props/embuste.js) | vineSnare |
| Mesa de billar · pool-table | Billar | [pool.js](../../Pana/engine/models/props/pool.js) | createPoolTable |
| Bola de billar · pool-ball | Billar | [pool.js](../../Pana/engine/models/props/pool.js) | createPoolBall |
| Taco de billar · pool-cue | Billar | [pool.js](../../Pana/engine/models/props/pool.js) | createPoolCue |
| Mesa de póquer · poker-table | Póquer | [poker.js](../../Pana/engine/models/props/poker.js) | createPokerTable |
| Carta de póquer · poker-card | Póquer | [poker.js](../../Pana/engine/models/props/poker.js) | createPokerCard |
| Fichas de póquer · poker-chips | Póquer | [poker.js](../../Pana/engine/models/props/poker.js) | createPokerChips |
| Marcadora de pintura · paint-marker | ¡Pintura! | [paintball.js](../../Pana/engine/models/props/paintball.js) | createPaintMarker |
| Carretilla de carga · cargo-handcart | Derrape | [cargo-handcart.js](../../Pana/engine/models/props/cargo-handcart.js) | cargoHandcart |
| Casa amarilla · colonial-yellow | Derrape | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Casa azul con balcón · colonial-balcony | Derrape | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Casa de la trinitaria · colonial-crest | Derrape | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Casa larga del pueblo · colonial-long | Derrape | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Casa de la esquina · colonial-corner | Derrape | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Casa del portal · colonial-porch | Derrape | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Cancha de bolas criollas · criollas-court | Bolas Criollas, Bululú | [criollas.js](../../Pana/engine/models/props/criollas.js) | criollasCourt |
| Bola criolla · criolla-ball | Bolas Criollas, Bululú | [criollas.js](../../Pana/engine/models/props/criollas.js) | criollaBall |
| Arepa · food-arepa | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js) | food |
| Cachapa · food-cachapa | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js) | food |
| Tequeños · food-tequenos | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js) | food |
| Empanada · food-empanada | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js) | food |
| Estación · Arepa · station-supply | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js) | kitchenStation |
| Estación · Preparar · station-prep | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js) | kitchenStation |
| Estación · Cocinar · station-stove | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js) | kitchenStation |
| Estación · Pasar plato · station-counter | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js) | kitchenStation |
| Estación · Servir pedido · station-serve | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js) | kitchenStation |
| Estación · Descartar · station-trash | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js) | kitchenStation |
| Mesa de dominó · domino-table | Dominó, Caída | [table-model.js](../../Pana/games/domino/public/table-model.js) | createDominoTable |
| Silla de dominó · domino-chair | Dominó, Caída, Póquer | [table-model.js](../../Pana/games/domino/public/table-model.js) | createDominoChair |
| Ficha de dominó · domino-tile | Dominó | [table-model.js](../../Pana/games/domino/public/table-model.js) | createDominoTile |
| Carta española · caida-card | Caída | [spanish-cards.js](../../Pana/engine/models/props/spanish-cards.js) | createSpanishCard |
| Ficha de Caída · caida-score-token | Caída | [spanish-cards.js](../../Pana/engine/models/props/spanish-cards.js) | createScoreToken |
| Tablero de Ludo · ludo-board | Ludo | [board-model.js](../../Pana/games/ludo/public/board-model.js) | createLudoBoard |
| Ficha de Ludo · ludo-pawn | Ludo | [board-model.js](../../Pana/games/ludo/public/board-model.js) | createLudoPawn |
| Dado de Ludo · ludo-die | Ludo | [board-model.js](../../Pana/games/ludo/public/board-model.js) | createLudoDie |

### Personajes (3)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Pana original · pana | Bululú, Derrape, Escondidas, Cocina | [avatar-model.js](../../Pana/engine/models/characters/pana/avatar-model.js) | buildCharacter |
| Pana cocinero · pana-chef | Cocina | [avatar-model.js](../../Pana/engine/models/characters/pana/avatar-model.js) | buildCharacter |
| Pana conductor · pana-driver | Derrape | [avatar-model.js](../../Pana/engine/models/characters/pana/avatar-model.js) | buildCharacter |

### Pueblo (25)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Casa colonial colorida · colonial-house | Derrape | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | colonialHouse |
| Bodega de esquina · corner-bodega | Derrape | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | cornerBodega |
| Iglesia colonial pequeña · colonial-church | Derrape | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | colonialChurch |
| Parada de autobús · bus-stop-shelter | Derrape | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | busStopShelter |
| Puesto de arepas · street-food-kiosk | Cocina, Derrape, Billar, Póquer | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | streetFoodKiosk |
| Torre del reloj · plaza-clock-tower | Escondidas, Cocina, Derrape, Billar, Póquer | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | plazaClockTower |
| Aro de baloncesto · basketball-hoop | Derrape, ¡Pintura! | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | basketballHoop |
| Tanque de agua de azotea · rooftop-water-tank | Derrape | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | rooftopWaterTank |
| Farol de calle · streetlight-pole | Escondidas, Cocina, Derrape, Billar, Póquer | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | streetlightPole |
| Banco de parque · park-bench | Escondidas, Cocina, Derrape, Billar, Póquer, ¡Pintura! | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | parkBench |
| Glorieta musical · plaza-bandstand | Derrape | [plaza-bandstand.js](../../Pana/engine/models/props/plaza-bandstand.js) | plazaBandstand |
| Cauchera del circuito · tire-workshop | Derrape | [tire-workshop.js](../../Pana/engine/models/props/tire-workshop.js) | tireWorkshop |
| Carrito de helados · ice-cream-cart | Derrape | [ice-cream-cart.js](../../Pana/engine/models/props/ice-cream-cart.js) | iceCreamCart |
| Fuente de cerámica pintada · ceramic-fountain | Derrape | [ceramic-fountain.js](../../Pana/engine/models/props/ceramic-fountain.js) | ceramicFountain |
| Terraza de café · cafe-terrace | Derrape | [cafe-terrace.js](../../Pana/engine/models/props/cafe-terrace.js) | cafeTerrace |
| Patio con tendedero · laundry-courtyard | Derrape | [laundry-courtyard.js](../../Pana/engine/models/props/laundry-courtyard.js) | laundryCourtyard |
| Camión frutero · fruit-delivery-truck | Derrape | [fruit-delivery-truck.js](../../Pana/engine/models/props/fruit-delivery-truck.js) | fruitDeliveryTruck |
| Mural callejero · street-mural | Derrape | [street-mural.js](../../Pana/engine/models/props/street-mural.js) | streetMural |
| Racimo de globos · balloon-bunch | Derrape | [fiesta.js](../../Pana/engine/models/props/fiesta.js) | balloonBunch |
| Banderas de pluma · fiesta-flags | Derrape | [fiesta.js](../../Pana/engine/models/props/fiesta.js) | fiestaFlags |
| Guirnalda de banderines · bunting-line | Derrape | [fiesta.js](../../Pana/engine/models/props/fiesta.js) | buntingLine |
| Pancarta a cuadros · checkered-banner | Derrape | [fiesta.js](../../Pana/engine/models/props/fiesta.js) | checkeredBanner |
| Globo aerostático · hot-air-balloon | Derrape | [fiesta.js](../../Pana/engine/models/props/fiesta.js) | hotAirBalloon |
| Letrero de madera · wood-sign | Derrape | [wood-sign.js](../../Pana/engine/models/props/wood-sign.js) | woodSign |
| Pancarta pintada · sign-banner | Derrape | [wood-sign.js](../../Pana/engine/models/props/wood-sign.js) | signBanner |

### Páramo (10)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Cabaña de montaña · mountain-cabin | Derrape | [mountain.js](../../Pana/engine/models/props/mountain.js) | mountainCabin |
| Estación de teleférico · cable-car-station | Derrape | [mountain.js](../../Pana/engine/models/props/mountain.js) | cableCarStation |
| Módulo de acantilado rocoso · rocky-cliff | Derrape | [mountain.js](../../Pana/engine/models/props/mountain.js) | rockyCliff |
| Defensa vial de montaña · mountain-guardrail | Preview only | [mountain.js](../../Pana/engine/models/props/mountain.js) | mountainGuardrail |
| Mirador de piedra · stone-lookout | Derrape | [mountain.js](../../Pana/engine/models/props/mountain.js) | stoneLookout |
| Carpa de montaña · mountain-tent | Derrape | [mountain.js](../../Pana/engine/models/props/mountain.js) | mountainTent |
| Puente colgante de montaña · mountain-suspension-bridge | Preview only | [mountain.js](../../Pana/engine/models/props/mountain.js) | mountainSuspensionBridge |
| Señal de senderos · mountain-signpost | Derrape | [mountain.js](../../Pana/engine/models/props/mountain.js) | mountainSignpost |
| Arco de roca · rock-arch | Derrape | [mountain.js](../../Pana/engine/models/props/mountain.js) | rockArch |
| Caballete de madera · timber-trestle | Derrape | [mountain.js](../../Pana/engine/models/props/mountain.js) | timberTrestle |

### Ruinas (25)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Torre prasat · prasat | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | prasat |
| Torre prasat derrumbada · prasat-broken | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | prasat |
| Rostro de Bayón · bayon-face | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | bayonFace |
| Cabeza olmeca · olmec-head | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | olmecHead |
| Columna de tambores · ruin-column | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | ruinColumn |
| Columna rota · ruin-column-broken | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | ruinColumn |
| Columna caída · fallen-column | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | fallenColumn |
| Escombros del templo · ruin-rubble | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | ruinRubble |
| Escalinata en ruinas · ruin-stairs | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | ruinStairs |
| Estela de glifos · stela | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | stela |
| Sello solar · sun-seal | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | sunSeal |
| Pebetero de piedra · ruin-brazier | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | brazier |
| Puente de tablas · plank-bridge | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | plankBridge |
| Puente de tablas roto · plank-bridge-broken | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | plankBridge |
| Pilar del abismo · rock-tower | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | rockTower |
| Enlosado del templo · ruin-paving | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | ruinPaving |
| Estalagmitas · stalagmites | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | stalagmites |
| Portal de la selva · ruin-gate | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | ruinGate |
| Piedra tallada antigua · carved-stele | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | carvedStele |
| Fachada tallada en roca · rock-facade | Preview only | [ruins.js](../../Pana/engine/models/props/ruins.js) | rockFacade |
| Jaguar de piedra · jaguar-statue | Derrape | [jaguar-stone.js](../../Pana/engine/models/props/jaguar-stone.js) | jaguarStatue |
| Relieve del jaguar · jaguar-relief | Derrape | [jaguar-stone.js](../../Pana/engine/models/props/jaguar-stone.js) | jaguarRelief |
| Portal maya cubierto de selva · maya-portal | Derrape | [maya-temple.js](../../Pana/engine/models/props/maya-temple.js) | mayaPortal |
| Pirámide escalonada · stepped-pyramid | Derrape | [maya-temple.js](../../Pana/engine/models/props/maya-temple.js) | steppedPyramid |
| Cenote · cenote | Derrape | [maya-temple.js](../../Pana/engine/models/props/maya-temple.js) | cenote |

### Selva (14)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Entrada del templo de piedra · temple-entrance | Reliquia, ¡Embuste!, Escondidas, ¡Pintura!, Billar, Caída | [jungle.js](../../Pana/engine/models/props/jungle.js) | templeEntrance |
| Puente colgante de cuerdas · rope-bridge | Reliquia, ¡Embuste! | [jungle.js](../../Pana/engine/models/props/jungle.js) | ropeBridge |
| Cascada entre rocas · waterfall-rocks | Derrape, ¡Embuste! | [jungle.js](../../Pana/engine/models/props/jungle.js) | waterfallRocks |
| Arco de piedra con enredaderas · vine-arch | Derrape, ¡Embuste!, Escondidas, ¡Pintura!, Billar, Caída | [jungle.js](../../Pana/engine/models/props/jungle.js) | vineArch |
| Puente de bambú · bamboo-bridge | Preview only | [jungle.js](../../Pana/engine/models/props/jungle.js) | bambooBridge |
| Tótem de piedra antiguo · stone-totem | Derrape, Reliquia, ¡Embuste!, Escondidas, ¡Pintura!, Billar, Caída | [jungle.js](../../Pana/engine/models/props/jungle.js) | stoneTotem |
| Tronco hueco · hollow-log | Derrape, ¡Embuste! | [jungle.js](../../Pana/engine/models/props/jungle.js) | hollowLog |
| Laja del Escudo Guayanés · laja-rock | Curiara | [amazonas.js](../../Pana/engine/models/props/amazonas.js) | lajaRock |
| Tronco del igapó · igapo-trunk | Curiara | [amazonas.js](../../Pana/engine/models/props/amazonas.js) | igapoTrunk |
| Churuata · churuata | Curiara | [amazonas.js](../../Pana/engine/models/props/amazonas.js) | churuata |
| Arco de moriche · finish-arch | Curiara | [amazonas.js](../../Pana/engine/models/props/amazonas.js) | finishArch |
| Muelle con techo de moriche · moriche-dock | Curiara | [amazonas.js](../../Pana/engine/models/props/amazonas.js) | moricheDock |
| Estalactitas del río · stalactite-cluster | Derrape | [caves.js](../../Pana/engine/models/props/caves.js) | stalactiteCluster |
| Cortina de raíces · root-curtain | Derrape | [caves.js](../../Pana/engine/models/props/caves.js) | rootCurtain |

### Termales (5)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Poza termal · hot-spring-pool | Derrape | [thermal.js](../../Pana/engine/models/props/thermal.js) | hotSpringPool |
| Fumarola · steam-vent | Derrape | [thermal.js](../../Pana/engine/models/props/thermal.js) | steamVent |
| Terrazas minerales · mineral-terraces | Derrape | [thermal.js](../../Pana/engine/models/props/thermal.js) | mineralTerraces |
| Casa de las termas · thermal-bathhouse | Derrape | [thermal.js](../../Pana/engine/models/props/thermal.js) | thermalBathhouse |
| Mirador de Chi Chi · thermal-lookout | Derrape | [thermal.js](../../Pana/engine/models/props/thermal.js) | thermalLookout |

### Vegetación (50)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Mata de hojas anchas · garden-rosette | Preview only | [garden-rosette.js](../../Pana/engine/models/vegetation/garden-rosette.js) | gardenRosette |
| Enredadera colgante · trailing-vine | Preview only | [trailing-vine.js](../../Pana/engine/models/vegetation/trailing-vine.js) | trailingVine |
| Trinitaria · trinitaria | Preview only | [trinitaria.js](../../Pana/engine/models/vegetation/trinitaria.js) | trinitaria |
| Palma moriche · moriche | Galope | [moriche.js](../../Pana/engine/models/vegetation/moriche.js) | moriche |
| Paja de sabana · savanna-grass | Galope, Derrape | [savanna-grass.js](../../Pana/engine/models/vegetation/savanna-grass.js) | savannaGrass |
| Cocotero · palm | Bululú, Derrape, Escondidas, Cocina, Reliquia, Billar, Póquer, ¡Pintura!, Caída | [palm.js](../../Pana/engine/models/vegetation/palm.js) | palm |
| Árbol de mango · mangoTree | Bululú, Derrape, Escondidas, Cocina, Galope, Billar, Póquer, ¡Pintura!, Caída | [mango-tree.js](../../Pana/engine/models/vegetation/mango-tree.js) | mangoTree |
| Ceiba · ceiba | Bululú, Derrape | [ceiba.js](../../Pana/engine/models/vegetation/ceiba.js) | ceiba |
| Pino caribe · pine | Bululú | [pine.js](../../Pana/engine/models/vegetation/pine.js) | pine |
| Mata de cambur · banana | Bululú, Derrape | [banana.js](../../Pana/engine/models/vegetation/banana.js) | banana |
| Arbusto · bush | Bululú, Derrape, Escondidas, Cocina, Billar, Póquer | [bush.js](../../Pana/engine/models/vegetation/bush.js) | bush |
| Araguaney · araguaney | Derrape, ¡Pintura! | [araguaney.js](../../Pana/engine/models/vegetation/araguaney.js) | araguaney |
| Apamate · apamate | Derrape | [araguaney.js](../../Pana/engine/models/vegetation/araguaney.js) | araguaney |
| Bucare en flor · bucare | Derrape | [araguaney.js](../../Pana/engine/models/vegetation/araguaney.js) | araguaney |
| Bambú · bamboo | Derrape, Escondidas, ¡Pintura!, Billar, Caída | [bamboo.js](../../Pana/engine/models/vegetation/bamboo.js) | bamboo |
| Helecho · fern | Derrape, Reliquia, Escondidas, ¡Pintura!, Billar, Caída | [fern.js](../../Pana/engine/models/vegetation/fern.js) | fern |
| Monstera · monstera | Derrape | [monstera.js](../../Pana/engine/models/vegetation/monstera.js) | monstera |
| Heliconia · heliconia | Derrape | [heliconia.js](../../Pana/engine/models/vegetation/heliconia.js) | heliconia |
| Cardón · cactus | Derrape | [cactus.js](../../Pana/engine/models/vegetation/cactus.js) | cactus |
| Mangle · mangrove | Derrape | [mangrove.js](../../Pana/engine/models/vegetation/mangrove.js) | mangrove |
| Lechosa · papaya | Bululú, Derrape | [papaya.js](../../Pana/engine/models/vegetation/papaya.js) | papaya |
| Agave · agave | Derrape | [agave.js](../../Pana/engine/models/vegetation/agave.js) | agave |
| Nenúfar · waterLily | Derrape, Galope | [water-lily.js](../../Pana/engine/models/vegetation/water-lily.js) | waterLily |
| Cayena · hibiscus | Bululú, Derrape | [hibiscus.js](../../Pana/engine/models/vegetation/hibiscus.js) | hibiscus |
| Juncos · reeds | Derrape, Galope | [reeds.js](../../Pana/engine/models/vegetation/reeds.js) | reeds |
| Caucho de raíces · jungleGiant | Derrape | [jungle-giant.js](../../Pana/engine/models/vegetation/jungle-giant.js) | jungleGiant |
| Arbusto tropical grande · tropicalBush | Derrape | [tropical-bush.js](../../Pana/engine/models/vegetation/tropical-bush.js) | tropicalBush |
| Frailejón · frailejon | Derrape | [frailejon.js](../../Pana/engine/models/vegetation/frailejon.js) | frailejon |
| Pino de montaña · mountainPine | Derrape | [mountain-pine.js](../../Pana/engine/models/vegetation/mountain-pine.js) | mountainPine |
| Árbol seco · dead-tree | Preview only | [dead-tree.js](../../Pana/engine/models/vegetation/dead-tree.js) | deadTree |
| Árbol seco con barba de palo · dead-tree-leafy | Preview only | [dead-tree.js](../../Pana/engine/models/vegetation/dead-tree.js) | deadTree |
| Árbol de selva extendido · broadleaf-tree-spreading | Preview only | [broadleaf-tree.js](../../Pana/engine/models/vegetation/broadleaf-tree.js) | broadleafTree |
| Árbol de selva en pisos · broadleaf-tree-tiered | Preview only | [broadleaf-tree.js](../../Pana/engine/models/vegetation/broadleaf-tree.js) | broadleafTree |
| Árbol de copa redonda · broadleaf-tree-round | Preview only | [broadleaf-tree.js](../../Pana/engine/models/vegetation/broadleaf-tree.js) | broadleafTree |
| Árbol de selva alto · broadleaf-tree-tall | Preview only | [broadleaf-tree.js](../../Pana/engine/models/vegetation/broadleaf-tree.js) | broadleafTree |
| Ceiba portal · ceiba-gateway | Preview only | [ceiba-gateway.js](../../Pana/engine/models/vegetation/ceiba-gateway.js) | ceibaGateway |
| Gigante de la selva · emergent-tree | Preview only | [emergent-tree.js](../../Pana/engine/models/vegetation/emergent-tree.js) | emergentTree |
| Matapalo sobre ruinas · strangler-fig | Preview only | [strangler-fig.js](../../Pana/engine/models/vegetation/strangler-fig.js) | stranglerFig |
| Oreja de elefante · elephant-ear | Preview only | [elephant-ear.js](../../Pana/engine/models/vegetation/elephant-ear.js) | elephantEar |
| Bromelia · bromeliad | Preview only | [bromeliad.js](../../Pana/engine/models/vegetation/bromeliad.js) | bromeliad |
| Flor gigante · rafflesia | Preview only | [rafflesia.js](../../Pana/engine/models/vegetation/rafflesia.js) | rafflesia |
| Hongos silvestres · wild-mushrooms | Preview only | [wild-mushrooms.js](../../Pana/engine/models/vegetation/wild-mushrooms.js) | wildMushrooms |
| Roca con musgo · moss-rock | Preview only | [moss-rock.js](../../Pana/engine/models/vegetation/moss-rock.js) | mossRock |
| Hojarasca · forest-litter | Preview only | [forest-litter.js](../../Pana/engine/models/vegetation/forest-litter.js) | forestLitter |
| Samán · saman | Derrape | [saman.js](../../Pana/engine/models/vegetation/saman.js) | saman |
| Yagrumo · yagrumo | Derrape | [selva-trees.js](../../Pana/engine/models/vegetation/selva-trees.js) | yagrumo |
| Cacao · cacao | Derrape | [selva-trees.js](../../Pana/engine/models/vegetation/selva-trees.js) | cacao |
| Palma zancona · zancona | Derrape | [selva-palms.js](../../Pana/engine/models/vegetation/selva-palms.js) | zancona |
| Palma manaca · manaca | Derrape | [selva-palms.js](../../Pana/engine/models/vegetation/selva-palms.js) | manaca |
| Helecho arborescente · tree-fern | Derrape | [selva-palms.js](../../Pana/engine/models/vegetation/selva-palms.js) | treeFern |

### Vehículos (25)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| El Chamo · car-chamo | Derrape, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.chamo |
| La Lancha · car-lancha | Derrape, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.lancha |
| El Machito · car-machito | Derrape, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.machito |
| La Bala · car-bala | Derrape, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.bala |
| El Toro · car-toro | Derrape, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.toro |
| La Familiar · car-familiar | Derrape, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.familiar |
| La Rumbera · car-rumbera | Derrape, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.rumbera |
| El Montañero · car-montanero | Derrape, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.montanero |
| La Pulga · car-escarabajo | Derrape, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.escarabajo |
| El Caprichoso · car-sedan | Derrape, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.sedan |
| El Por Puesto · car-buseta | Derrape, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.buseta |
| El Burro · car-pickup | Derrape, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.pickup |
| El Chigüire · car-jeep | Derrape, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.jeep |
| La Chispa · car-hatch | Derrape, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.hatch |
| El Tepuy · car-rustico | Derrape, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.rustico |
| La Reina · car-malibu | Derrape, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.malibu |
| Curiara de carrera · racing-curiara | Curiara, Bululú | [curiara.js](../../Pana/engine/models/vehicles/curiara.js) | createCanoe |
| Cauchos de calle · wheel-calle | Derrape | [wheel-definitions.js](../../Pana/games/derrape/public/wheel-definitions.js) | makeWheel |
| Slicks de pista · wheel-slick | Derrape | [wheel-definitions.js](../../Pana/games/derrape/public/wheel-definitions.js) | makeWheel |
| Cauchos de barro · wheel-barro | Derrape | [wheel-definitions.js](../../Pana/games/derrape/public/wheel-definitions.js) | makeWheel |
| Llantas de palo · wheel-palo | Derrape | [wheel-definitions.js](../../Pana/games/derrape/public/wheel-definitions.js) | makeWheel |
| Cauchos de lluvia · wheel-lluvia | Derrape | [wheel-definitions.js](../../Pana/games/derrape/public/wheel-definitions.js) | makeWheel |
| Clásicas · wheel-clasicas | Derrape | [wheel-definitions.js](../../Pana/games/derrape/public/wheel-definitions.js) | makeWheel |
| Rines ligeros · wheel-ligeras | Derrape | [wheel-definitions.js](../../Pana/games/derrape/public/wheel-definitions.js) | makeWheel |
| Todoterreno · wheel-todoterreno | Derrape | [wheel-definitions.js](../../Pana/games/derrape/public/wheel-definitions.js) | makeWheel |

### Vestuario (5)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Franela · outfit-shirt | Bululú, Derrape, Escondidas, Cocina | [model.js](../../Pana/engine/models/characters/pana/model.js) | buildSoftCharacter |
| Delantal y gorro · outfit-chef | Bululú, Derrape, Escondidas, Cocina | [model.js](../../Pana/engine/models/characters/pana/model.js) | buildSoftCharacter |
| Suéter y gorra · outfit-hoodie | Bululú, Derrape, Escondidas, Cocina | [model.js](../../Pana/engine/models/characters/pana/model.js) | buildSoftCharacter |
| Camisa tropical · outfit-tropical | Bululú, Derrape, Escondidas, Cocina | [model.js](../../Pana/engine/models/characters/pana/model.js) | buildSoftCharacter |
| Conjunto deportivo · outfit-sport | Bululú, Derrape, Escondidas, Cocina | [model.js](../../Pana/engine/models/characters/pana/model.js) | buildSoftCharacter |

### Vida llanera (13)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Caney de palma · ranch-caney | Galope | [llano-life.js](../../Pana/engine/models/props/llano-life.js) | ranchCaney |
| Chinchorro del hato · chinchorro | Galope | [llano-life.js](../../Pana/engine/models/props/llano-life.js) | chinchorro |
| Montura en caballete · saddle-stand | Galope | [llano-life.js](../../Pana/engine/models/props/llano-life.js) | saddleStand |
| Palenque de caballos · hitching-rail | Galope | [llano-life.js](../../Pana/engine/models/props/llano-life.js) | hitchingRail |
| Fogón de campamento · campfire | Galope, ¡Embuste! | [llano-life.js](../../Pana/engine/models/props/llano-life.js) | campfire |
| Mesa de café del hato · coffee-table | Galope, ¡Embuste! | [llano-life.js](../../Pana/engine/models/props/llano-life.js) | coffeeTable |
| Curiara del estero · river-canoe | Galope, ¡Embuste! | [llano-life.js](../../Pana/engine/models/props/llano-life.js) | riverCanoe |
| Embarcadero del estero · wetland-landing | Galope, ¡Embuste! | [llano-life.js](../../Pana/engine/models/props/llano-life.js) | wetlandLanding |
| Cerca inundada · flooded-fence | Galope | [llano-life.js](../../Pana/engine/models/props/llano-life.js) | floodedFence |
| Señal de sendero llanero · llano-trail-sign | Galope | [llano-life.js](../../Pana/engine/models/props/llano-life.js) | trailSign |
| Termitero de sabana · termite-mound | Galope | [llano-life.js](../../Pana/engine/models/props/llano-life.js) | termiteMound |
| Casa palafito · palafito-house | Derrape | [delta.js](../../Pana/engine/models/props/delta.js) | palafitoHouse |
| Cobertizo del embarcadero · landing-shelter | Derrape, Galope | [delta.js](../../Pana/engine/models/props/delta.js) | landingShelter |

## Keep this inventory current

Run `node Pana/scripts/audit-inventory.browser.js` with `PANA_PLAYWRIGHT_PATH` pointing to an available Playwright package and the local server running. The script exports this Markdown report and `model-inventory.json`, verifies every source anchor, and reads all catalog entries. Review `Pana/scripts/inventory-notes.js` when moving/removing geometry: anchor checks catch stale locations but do not automatically discover new inline models or prove call-graph reachability.

Run `node Pana/engine/tests/wildlife.browser.js` for geometry ownership, finite bounds, timeline rewind, flight heading, all seven birds/four capybaras, terrain/road clearance and native-map screenshots. `art/studio/wildlife/` holds the local proof. The audit does not delete dormant factories or silently replace older map assemblies.
