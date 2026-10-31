# Pana — current model inventory

Audited 2026-10-30. Generated from the real Studio registry plus a reviewed source ledger.

**634 Studio resources**, including **25 Fauna entries**, **50 vegetation entries**, **32 vehicles** and **43 maps**. **142 resources are preview-only.** The separate ledger identifies **30 active uncataloged model families**, **46 scene/effect families** and **9 dormant factories/hooks**. These numbers must not be added into a “unique 3D models” total: maps contain models, variants share geometry, and some ledger rows group multiple related props.

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
| Cincuenta casas del pueblo | colonial-collection | [colonial-house-collection.js](../../Pana/engine/worlds/colonial-house-collection.js) |
| Calle de las flores | colonial-street | [colonial-street.js](../../Pana/engine/worlds/colonial-street.js) |

## Active models missing from individual Studio previews

| Resource / family | Current location | Source | Finding |
| --- | --- | --- | --- |
| Wooden sign | Bululú board/minigames; Carreritas sectors | [wood-sign.js](../../Pana/engine/models/props/wood-sign.js#L6) | Active shared factory; many text variants, one model family. |
| Watchtower | Bululú board; No te caigas | [watchtower.js](../../Pana/engine/models/props/watchtower.js#L4) | Thatch/zinc options; distinct from the new lifeguard tower. |
| Venezuelan flagpole | Bululú board; No te caigas; Selva | [flags.js](../../Pana/engine/models/props/flags.js#L42) | Active animated flag. Pana branded pedestal is a separate catalog entry. |
| Displaced rock | Bululú board/minigames; Selva | [rock.js](../../Pana/engine/models/props/rock.js#L4) | Shared seeded rock, also embedded inside other models. |
| Offshore lighthouse (older) | Bululú board | [island-scenery.js](../../Pana/engine/worlds/island-scenery.js#L14) | One tower with a rotating night beam. Not the Costa lighthouse used on the race island; preserve daylight behavior when replacing. |
| Offshore sailboat (older) | Bululú board | [island-scenery.js](../../Pana/engine/worlds/island-scenery.js#L42) | Four box-hull sailboats still bob offshore. Not the new peñero. |
| Golden mango landmark tree | Bululú board | [island-environment.js](../../Pana/engine/worlds/island-environment.js#L39) | Special large fruit tree; separate construction from flora.mangoTree. |
| Original plaza church | Escondidas; Cocina; Plaza circuit | [plaza-buildings.js](../../Pana/engine/models/props/plaza-buildings.js#L45) | Active small bell tower/chapel, distinct from colonialChurch. |
| Summit terminal | Páramo | [world-landmarks.js](../../Pana/games/carreritas/public/tracks/world-landmarks.js#L6) | Upper/lower terminals; separate from the catalog heritage cable-car station. |
| Aerial cable system and cabins | Páramo | [world-landmarks.js](../../Pana/games/carreritas/public/tracks/world-landmarks.js#L20) | Six moving cabins, two cable curves; parameterized scene assembly. |
| Cable support tower | Páramo | [world-landmarks.js](../../Pana/games/carreritas/public/tracks/world-landmarks.js#L40) | Terrain-dependent support height. |
| Diving school | Chi Chi | [world-landmarks.js](../../Pana/games/carreritas/public/tracks/world-landmarks.js#L47) | Facade, dive tanks and diver flag. |
| Coastal fort | Chi Chi | [world-landmarks.js](../../Pana/games/carreritas/public/tracks/world-landmarks.js#L64) | Lookout landmark on the mountain coast. |
| Maracaibo-inspired bridge | Plaza circuit | [world-landmarks.js](../../Pana/games/carreritas/public/tracks/world-landmarks.js#L76) | Full driving bridge; use its actual road deck when previewing. |
| Grandstand | Estadio | [world-landmarks.js](../../Pana/games/carreritas/public/tracks/world-landmarks.js#L96) | Eight stands with different dimensions/colors, covering the infield and outer sectors. |
| Canal villa | Plaza circuit | [world-landmarks.js](../../Pana/games/carreritas/public/tracks/world-landmarks.js#L110) | Waterfront houses and balconies. |
| Small rowboat (older) | Selva; Llanos | [track-kit.js](../../Pana/games/carreritas/public/track-kit.js#L459) | Two active river boats. Keep shallow-water footprint when upgrading. |
| Canal/dive-village boat | Plaza circuit; Chi Chi | [world-kit.js](../../Pana/games/carreritas/public/tracks/world-kit.js#L109) | Cabin option; different builder from the coast peñero and island sailboats. |
| Faceted boulder | Páramo; Chi Chi; Desierto | [world-kit.js](../../Pana/games/carreritas/public/tracks/world-kit.js#L119) | Instanced geological scatter, separate from props.rock. |
| Catch basket | Atrapa los mangos | [atrapa.js](../../Pana/games/bululu/public/minigames/atrapa.js#L23) | Held by players; needs a standalone preview adapter. |
| Coconut | Atrapa los mangos | [atrapa.js](../../Pana/games/bululu/public/minigames/atrapa.js#L35) | Falling hazard with three dark eyes. |
| Board die | Bululú board | [board.js](../../Pana/games/bululu/public/board.js#L175) | Six face textures; game-driven roll animation. |
| Golden mango cart | Bululú board | [board.js](../../Pana/games/bululu/public/board.js#L203) | Cart, striped umbrella, chalkboard and reward beam. |
| Player token pedestal | Bululú board | [board.js](../../Pana/games/bululu/public/board.js#L541) | Colored base under shared character; not a new character sculpt. |
| Breakable supply crate | All eight Carreritas races | [pickup-art.js](../../Pana/games/carreritas/public/pickup-art.js#L13) | Gameplay crate is distinct from the Plaza disguise crate. |
| Collectible coin | All eight Carreritas races | [pickup-art.js](../../Pana/games/carreritas/public/pickup-art.js#L56) | Coin trails and pickups. |
| Mango peel | Carreritas item use | [items.js](../../Pana/games/carreritas/public/items.js#L88) | Three peel strips and seed; not the whole mango. |
| Kitchen sign | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js#L66) | Signs and flour-sack labels; text variants grouped. |
| Open pantry/fridge | Cocina | [scene.js](../../Pana/games/cocina/public/scene.js#L31) | Shelves with tomatoes, milk cartons and shared cheese. Assembly includes its food dressing. |
| Condiment bottles and flour sacks | Cocina | [scene.js](../../Pana/games/cocina/public/scene.js#L45) | Counter and floor dressing made inline; two prop types grouped as one set. |

## Scene assemblies, terrain, effects and embedded parts

| Resource / family | Current location | Source | Finding |
| --- | --- | --- | --- |
| Reliquia mine and temple | Reliquia; Studio map | [scene.js](../../Pana/games/reliquia/public/scene.js#L54) | Camp with the truck plus floors dealt from a seeded room deck; enclosed ruin galleries from the shared ruinShell, library props only. Treasure, artifact and tool models are cataloged in reliquia-treasure.js. |
| Mounted horse and riding tack | Galope, Bululú coleo; hub tile | [llanero-rider.js](../../Pana/engine/models/fauna/farm/llanero-rider.js#L9) | Shared horse and saved pana with game-local saddle, stirrups and reins; not a duplicate animal sculpt. |
| Horse course and distinct wetlands | Galope; Studio map | [scene.js](../../Pana/games/galope/public/scene.js#L22) | Shared terrain/water grid, clipped riding trail, irregular lagoon with island, winding estero, jump logs, start gantry and trail markers. Shared models counted separately. |
| Galope living Llanos landscape | Galope; Studio map | [landscape.js](../../Pana/games/galope/public/landscape.js#L16) | Hato gathering places, bank-connected canoe landing, moriche groves, green/dry grass, shore-only reeds and continuous far plain. All 13 new models have individual Studio previews. |
| Selva pyramid | Selva | [selva-world.js](../../Pana/games/carreritas/public/tracks/selva-world.js#L70) | Stepped landmark outside the driving tunnel. |
| Road temple tunnel and portals | Selva | [selva-temple.js](../../Pana/games/carreritas/public/tracks/selva-temple.js#L38) | Swept along the actual road; not the unused standalone temple entrance. |
| Selva plank crossing | Selva | [selva-world.js](../../Pana/games/carreritas/public/tracks/selva-world.js#L208) | Road-warped planks, piers and flankBridge rails. Anchor spacing normalized by the audit. |
| Simple waterfall sheet | Selva | [track-kit.js](../../Pana/games/carreritas/public/track-kit.js#L305) | Active older waterfall; separate from waterfallRocks in Chi Chi. |
| Pond and river wrappers | Selva | [track-kit.js](../../Pana/games/carreritas/public/track-kit.js#L295) | waterPond/waterRibbon wrap the shared water surface. |
| Country grass tufts | Llanos; Desierto | [country-details.js](../../Pana/games/carreritas/public/tracks/country-details.js#L6) | Instanced grass, absent from the 22 plant catalog entries. |
| Country entrance gantry | Llanos; Desierto | [country-details.js](../../Pana/games/carreritas/public/tracks/country-details.js#L17) | Map-specific entrance text and width. |
| Country bridge crossings | Llanos; Desierto | [country-details.js](../../Pana/games/carreritas/public/tracks/country-details.js#L26) | Road-conforming decks/rails; not standalone rope bridges. |
| Verge posts and dirt shoulders | Llanos; Desierto | [country-details.js](../../Pana/games/carreritas/public/tracks/country-details.js#L42) | Route-generated posts, shoulders and tire ruts. |
| Llanos wetland landing | Llanos | [llanos-world.js](../../Pana/games/carreritas/public/tracks/llanos-world.js#L126) | Dock planks and supports; capybaras now use shared wildlife. |
| Generic race edges | Multiple Carreritas circuits | [world-kit.js](../../Pana/games/carreritas/public/tracks/world-kit.js#L83) | Steel, timber and kerb variants, generated along the route. |
| Chevrons/start line/sector signs/ramps | Carreritas | [track-kit.js](../../Pana/games/carreritas/public/track-kit.js#L144) | Four route-generated furniture families; ramps depend on each track definition. |
| Race terrain and waterways | Carreritas | [world-kit.js](../../Pana/games/carreritas/public/tracks/world-kit.js#L31) | Terrain, sea and stream generators; each map supplies shape and palette. |
| Water surface system | Carreritas | [water-surface.js](../../Pana/engine/models/effects/water-surface.js#L36) | Ocean, river, canal and pool configurations; not separate species/objects. |
| Bululú tide wash | Bululú circuit | [bululu-tide.js](../../Pana/games/carreritas/public/tracks/bululu-tide.js#L20) | Animated surface tied to tire grip and wetness. |
| Board island terrain | Bululú board | [island-terrain.js](../../Pana/engine/worlds/island-terrain.js#L79) | Shoreline, beach, hills, river and path cuts. |
| Forested islet/ridge | Bululú board | [island-landscape.js](../../Pana/engine/worlds/island-landscape.js#L43) | Seeded neighboring islands and distant ridges. |
| Tepui and waterfall | Bululú board | [island-landscape.js](../../Pana/engine/worlds/island-landscape.js#L83) | Three mesas; one waterfall/mist landmark. Not the Selva waterfall. |
| Living sky and cloud layers | Carreritas; Galope; Escondidas; Cocina; Bululú and minigames; Studio tours | [sky.js](../../Pana/engine/worlds/sky.js#L7) | One procedural sky draw, seeded cumulus and wisps, absolute-time wind and day/night tint. Scene-owned, outside scenery bounds. |
| Island dock and village light strings | Bululú board | [island-environment.js](../../Pana/engine/worlds/island-environment.js#L194) | Placement-specific geometry; not separate library factories. |
| Race-island piers | Bululú circuit | [bululu.js](../../Pana/games/carreritas/public/tracks/bululu.js#L114) | Inline harbor planks and pilings. |
| Plaza streets, gardens and mirador | Plaza circuit | [plaza-town.js](../../Pana/games/carreritas/public/tracks/plaza-town.js#L49) | Street surfaces, block gardens, lookout terrace and stairs; shared houses/trees counted separately. |
| Plaza waterfront canals and docks | Plaza circuit | [plaza-waterfront.js](../../Pana/games/carreritas/public/tracks/plaza-waterfront.js#L23) | Canal network and moorings around canalVilla. |
| Continuous circuit surroundings | All eight Carreritas races | [world-horizon.js](../../Pana/engine/worlds/coastal/world-horizon.js#L15) | Exact grid-edge joins to coarser outer terrain; coastal water keeps its detailed near grid and gains a far apron. |
| Plaza outer neighborhoods | Plaza circuit | [plaza-outskirts.js](../../Pana/games/carreritas/public/tracks/plaza-outskirts.js#L10) | Connected outer lanes, 51 additional houses, 26 planted courtyards and road-safe groves. Reuses existing house and plant factories. |
| Llanos pastures and gallery woodland | Llanos | [llanos-landscape.js](../../Pana/games/carreritas/public/tracks/llanos-landscape.js#L10) | Four pastures, repeated ranch fences, harvest bales, morichal palms and distant ceiba groves. Existing animals retain their space. |
| Stadium venue grounds | Estadio | [stadium-grounds.js](../../Pana/games/carreritas/public/tracks/stadium-grounds.js#L11) | Entrance, perimeter, concourse, planted parking and infields. Parked copies reuse real garage vehicles with no driver. |
| Football pitch and goals | Estadio | [estadio.js](../../Pana/games/carreritas/public/tracks/estadio.js#L33) | Pitch stripes, markings and two goal frames. |
| Pit garages | Estadio | [estadio.js](../../Pana/games/carreritas/public/tracks/estadio.js#L56) | Eight inline garage blocks and numbered signs. |
| Floodlights and scoreboard | Estadio | [estadio.js](../../Pana/games/carreritas/public/tracks/estadio.js#L74) | Two inline landmark families. |
| Basketball court and banners | Estadio | [estadio.js](../../Pana/games/carreritas/public/tracks/estadio.js#L88) | Court and sponsor panels; shared hoops already cataloged. |
| Chi Chi retaining walls and river bridges | Chi Chi | [chichi-village.js](../../Pana/games/carreritas/public/tracks/chichi-village.js#L41) | Bridge geometry follows road/river. Retaining walls in chichi.js. |
| Bululú board tiles, paths, stairs and pins | Bululú board | [board.js](../../Pana/games/bululu/public/board.js#L62) | Tile-kind texture variants, raised supports, fork paths and waypoint sprites. |
| Sunny minigame stage | Both Bululú minigames | [stage.js](../../Pana/games/bululu/public/minigames/stage.js#L19) | Sky, ground, clouds and shared landscape props. |
| Raft and spinning striped log | No te caigas | [caigas.js](../../Pana/games/bululu/public/minigames/caigas.js#L48) | Player platforms, floats, central post, rotating obstacle and sandbars. |
| Minigame wave surface | No te caigas | [caigas.js](../../Pana/games/bululu/public/minigames/caigas.js#L41) | Older deformed plane, separate from the shared water shader. |
| Boost pad | Carreritas | [items.js](../../Pana/games/carreritas/public/items.js#L112) | Animated ground marker, separate from collectible item models. |
| Puffs, debris and speech bubbles | Bululú; Carreritas | [fx.js](../../Pana/engine/fx.js#L395) | Particle/sprite effects, not scenery inventory counts. |
| Crate fragment bursts | Carreritas | [fragments.js](../../Pana/games/carreritas/public/fragments.js#L6) | Gameplay fragments reused from crate art. |
| Steam, fire and order dressing | Cocina | [scene.js](../../Pana/games/cocina/public/scene.js#L70) | Cooking state effects; recipes also have raw/prepared/cooked/burned variants. |
| Thermal steam and water details | Chi Chi; shared fountains/waterfalls | [thermal-steam.js](../../Pana/engine/models/effects/thermal-steam.js#L5) | Reusable steam, droplets and ripple systems; water details also in water-details.js. |
| Character accessories and expressions | All games; character editor | [avatar.js](../../Pana/engine/avatar.js#L25) | Eight non-empty hat options, three glasses options, five expression options and two non-empty extras. Some options share geometry/poses. Outfits are already cataloged; accessories and dizzy stars are embedded parts. |

## Older code with no current enabled placement

| Resource / family | Current location | Source | Finding |
| --- | --- | --- | --- |
| Old windmill | No current production callsite | [track-kit.js](../../Pana/games/carreritas/public/track-kit.js#L386) | Current Llanos uses ranch-props.waterWindmill. |
| Old arepa stand | No current production callsite | [track-kit.js](../../Pana/games/carreritas/public/track-kit.js#L416) | Current maps use streetFoodKiosk. |
| Generic dock | No current production callsite | [track-kit.js](../../Pana/games/carreritas/public/track-kit.js#L446) | Maps now build docks against their shore/deck. |
| Generic sailboat | No current production callsite | [track-kit.js](../../Pana/games/carreritas/public/track-kit.js#L471) | No production caller; internally uses rowboat, which remains active. |
| Generic plank/rope bridge | No current production callsite | [track-kit.js](../../Pana/games/carreritas/public/track-kit.js#L330) | Active crossings have road-specific decks or newer shared factories. |
| Distant mountain ring | No current production callsite | [track-kit.js](../../Pana/games/carreritas/public/track-kit.js#L490) | Current maps use their own terrain or island-landscape. |
| Old route landscape scatter | No current production callsite | [track-kit.js](../../Pana/games/carreritas/public/track-kit.js#L534) | Current worlds supply habitat-specific planting. |
| Tire-wall generator | Runtime hook only; current tracks disable walls | [track-kit.js](../../Pana/games/carreritas/public/track-kit.js#L65) | Code is still wired conditionally; distinguish dormant configuration from dead code. |
| Fence-ring generator | Runtime hook only; no current track enables fence | [track-kit.js](../../Pana/games/carreritas/public/track-kit.js#L101) | Do not remove without checking future track configuration. |

## Replaced models and compatibility aliases

| Resource / family | Current location | Source | Finding |
| --- | --- | --- | --- |
| Generic box-wing bird | Previously Selva/Llanos/Desierto | [track-kit.js](../../Pana/games/carreritas/public/track-kit.js) | Removed in this audit; replaced by three wildlife factories. Old comments listed toucan/seagull, but those were not distinct current species. |
| Random dressed scenery capybara | Previously Selva | [track-kit.js](../../Pana/games/carreritas/public/track-kit.js) | Removed in this audit; wildCapybara reuses canonical capybaraForm. Three Llanos animals now use the same factory. |
| Old box cow | Previously Llanos | [llanos-world.js](../../Pana/games/carreritas/public/tracks/llanos-world.js) | Already replaced by hatoCow in 64bf025 before this audit; not a second current cow model. |
| Legacy playa track ID | Carreritas URL alias | [tracks.js](../../Pana/games/carreritas/public/tracks.js) | Resolves to bululu, not a ninth racing map. |
| Mango minigame tree (older) | Atrapa los mangos | [atrapa.js](../../Pana/games/bululu/public/minigames/atrapa.js) | Its polygon canopy was replaced by the shared mangoTree factory. |
| Old game-local shared module paths | Bululú and Escondidas compatibility re-exports | [scenery.js](../../Pana/games/bululu/public/scenery.js) | Forward to engine modules; do not count aliases as duplicate assets. |

## Complete Studio registry

The following list is generated, not manually copied. “In use” is the catalog’s current declared consumer status; detailed native placement proof exists for the fauna and recent packs. Color/seed variants are not separate rows unless Studio explicitly registers them. The seated driver now declares Carreritas and the forced chef preview declares Cocina; normal wardrobe options remain shared across games.

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

### Costa (32)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Peñero de pesca · fishing-boat | Bululú, Carreritas, Escondidas, ¡Pintura!, Billar, Caída, Bochinche | [coastal.js](../../Pana/engine/models/props/coastal.js) | fishingBoat |
| Faro costero · coastal-lighthouse | Carreritas, Escondidas, ¡Pintura!, Billar, Caída | [coastal.js](../../Pana/engine/models/props/coastal.js) | coastalLighthouse |
| Torre de salvavidas · lifeguard-tower | Bululú, Carreritas | [coastal.js](../../Pana/engine/models/props/coastal.js) | lifeguardTower |
| Cancha de voleibol de playa · beach-volleyball | Carreritas | [coastal.js](../../Pana/engine/models/props/coastal.js) | beachVolleyball |
| Ducha de playa · beach-shower | Bululú, Carreritas | [coastal.js](../../Pana/engine/models/props/coastal.js) | beachShower |
| Puesto de salvavidas · rescue-ring-stand | Bululú, Carreritas | [coastal.js](../../Pana/engine/models/props/coastal.js) | rescueRingStand |
| Secadero de redes · fishing-net-rack | Bululú, Carreritas, Escondidas, ¡Pintura!, Billar, Caída, Bochinche | [coastal.js](../../Pana/engine/models/props/coastal.js) | fishingNetRack |
| Cajas de pesca · fish-crates | Bululú, Carreritas, Bochinche | [coastal.js](../../Pana/engine/models/props/coastal.js) | fishCrates |
| Boya de canal · channel-buoy | Bululú, Carreritas | [coastal.js](../../Pana/engine/models/props/coastal.js) | channelBuoy |
| Cortina de cascada · waterfall-curtain | Carreritas, Bululú | [waterfall.js](../../Pana/engine/models/effects/waterfall.js) | waterfall |
| Arroyo en cascada · cascade-stream | Preview only | [water-surface.js](../../Pana/engine/models/effects/water-surface.js) | cascadeStream |
| Poza de sal · salt-pool | Carreritas | [saltworks.js](../../Pana/engine/models/props/saltworks.js) | saltPool |
| Montón de sal · salt-pile | Carreritas | [saltworks.js](../../Pana/engine/models/props/saltworks.js) | saltPile |
| Compuerta salinera · sluice-gate | Carreritas | [saltworks.js](../../Pana/engine/models/props/saltworks.js) | sluiceGate |
| Patio de cosecha de sal · salt-harvester | Carreritas | [salt-harvester.js](../../Pana/engine/models/props/salt-harvester.js) | saltHarvester |
| Astillero de peñeros · boat-repair-yard | Carreritas | [boat-yard.js](../../Pana/engine/models/props/boat-yard.js) | boatRepairYard |
| Lonja de pescado · fish-auction-canopy | Carreritas | [fish-auction-canopy.js](../../Pana/engine/models/props/fish-auction-canopy.js) | fishAuctionCanopy |
| Pasarela salinera · salt-boardwalk | Carreritas | [salt-boardwalk.js](../../Pana/engine/models/props/salt-boardwalk.js) | saltBoardwalk |
| Baliza de navegación · navigation-beacon | Carreritas | [navigation-beacon.js](../../Pana/engine/models/props/navigation-beacon.js) | navigationBeacon |
| Estación de bombeo · water-pump-station | Carreritas | [water-pump-station.js](../../Pana/engine/models/props/water-pump-station.js) | waterPumpStation |
| Casa Guipuzcoana · casa-guipuzcoana | Carreritas, Caída, Dominó, Póquer | [casa-guipuzcoana.js](../../Pana/engine/models/props/casa-guipuzcoana.js) | casaGuipuzcoana |
| Fuerte San Carlos · san-carlos-fortress | Carreritas, Caída, Dominó, Póquer | [san-carlos-fortress.js](../../Pana/engine/models/props/san-carlos-fortress.js) | sanCarlosFortress |
| Silos del puerto · port-silos | Carreritas, Caída, Dominó, Póquer | [port-silos.js](../../Pana/engine/models/props/port-silos.js) | portSilos |
| Contenedor de carga · shipping-container | Carreritas | [port-cargo.js](../../Pana/engine/models/props/port-cargo.js) | shippingContainer |
| Almacén del muelle · transit-warehouse | Carreritas | [port-cargo.js](../../Pana/engine/models/props/port-cargo.js) | transitWarehouse |
| Bolardo del puerto · port-bollard | Carreritas | [port-cargo.js](../../Pana/engine/models/props/port-cargo.js) | portBollard |
| Grúa del puerto · port-crane | Carreritas | [port-crane.js](../../Pana/engine/models/props/port-crane.js) | portCrane |
| Grúa pórtico del patio · yard-gantry | Pepazo | [port-crane.js](../../Pana/engine/models/props/port-crane.js) | yardGantry |
| Galpón de acero · steel-shed | Pepazo | [port-cargo.js](../../Pana/engine/models/props/port-cargo.js) | steelShed |
| Tambor de aceite · oil-drum | Pepazo | [port-cargo.js](../../Pana/engine/models/props/port-cargo.js) | oilDrum |
| Buque portacontenedores · cargo-ship | Carreritas | [cargo-ship.js](../../Pana/engine/models/props/cargo-ship.js) | cargoShip |
| Fortín de la costa · coastal-fortress | Carreritas | [coastal-fort.js](../../Pana/engine/models/props/coastal-fort.js) | coastalFortress |

### Desierto (10)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Cardón gigante · giant-cactus | Carreritas | [desert.js](../../Pana/engine/models/props/desert.js) | giantCactus |
| Módulo de duna · sand-dune | Carreritas | [desert.js](../../Pana/engine/models/props/desert.js) | sandDune |
| Arco de roca del desierto · desert-rock-arch | Carreritas | [desert.js](../../Pana/engine/models/props/desert.js) | desertRockArch |
| Gasolinera abandonada · abandoned-gas-station | Carreritas | [desert.js](../../Pana/engine/models/props/desert.js) | abandonedGasStation |
| Camioneta oxidada · rusted-pickup | Carreritas | [desert.js](../../Pana/engine/models/props/desert.js) | rustedPickup |
| Pila de cauchos · roadside-tire-pile | Carreritas | [desert.js](../../Pana/engine/models/props/desert.js) | roadsideTirePile |
| Aguja de roca del cañón · canyon-spire | Carreritas | [desert.js](../../Pana/engine/models/props/desert.js) | canyonSpire |
| Carreta de madera rota · broken-wagon | Carreritas | [desert.js](../../Pana/engine/models/props/desert.js) | brokenWagon |
| Señal de peligro del desierto · desert-warning-sign | Carreritas | [desert.js](../../Pana/engine/models/props/desert.js) | desertWarningSign |
| Pozo viejo del desierto · desert-well | Carreritas | [desert.js](../../Pana/engine/models/props/desert.js) | desertWell |

### Emblemas (9)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Fuente de Plaza Pana · plaza-fountain | Escondidas, Cocina, Carreritas, Billar, Póquer | [plaza-buildings.js](../../Pana/engine/models/props/plaza-buildings.js) | plazaFountain |
| Estatua gigante de capibara · capybara-statue | Preview only | [monuments.js](../../Pana/engine/models/props/monuments.js) | capybaraStatue |
| Estatua del mango de oro · golden-mango-statue | Preview only | [monuments.js](../../Pana/engine/models/props/monuments.js) | goldenMangoStatue |
| Arco de bienvenida Pana · welcome-arch | Preview only | [monuments.js](../../Pana/engine/models/props/monuments.js) | welcomeArch |
| Topiaria de capibara · capybara-topiary | Escondidas, Cocina, Carreritas | [monuments.js](../../Pana/engine/models/props/monuments.js) | capybaraTopiary |
| Asta con bandera Pana · pana-flagpole | Preview only | [monuments.js](../../Pana/engine/models/props/monuments.js) | panaFlagpole |
| Monumento de la Copa Pana · trophy-monument | Carreritas | [monuments.js](../../Pana/engine/models/props/monuments.js) | trophyMonument |
| Fuente de los capibaras · capybara-fountain | Preview only | [monuments.js](../../Pana/engine/models/props/monuments.js) | capybaraFountain |
| Kiosco de recuerdos Pana · souvenir-kiosk | Carreritas | [monuments.js](../../Pana/engine/models/props/monuments.js) | souvenirKiosk |

### Fauna (25)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Flamenco de las salinas · flamingo | Carreritas, Bochinche | [flamingo.js](../../Pana/engine/models/fauna/birds/flamingo.js) | flamingo |
| Tonina (delfín rosado) · tonina | Curiara | [tonina.js](../../Pana/engine/models/fauna/aquatic/tonina.js) | tonina |
| Babo · caiman | Curiara | [caiman.js](../../Pana/engine/models/fauna/caiman.js) | caiman |
| Mariposas morpho · morpho | Curiara | [morpho.js](../../Pana/engine/models/fauna/morpho.js) | morphoSwarm |
| Guacamaya roja · scarlet-macaw | Carreritas, Bochinche | [scarlet-macaw.js](../../Pana/engine/models/fauna/birds/scarlet-macaw.js) | scarletMacaw |
| Corocora roja · scarlet-ibis | Carreritas, Galope | [scarlet-ibis.js](../../Pana/engine/models/fauna/birds/scarlet-ibis.js) | scarletIbis |
| Zamuro planeador · soaring-vulture | Carreritas | [soaring-vulture.js](../../Pana/engine/models/fauna/birds/soaring-vulture.js) | soaringVulture |
| Chigüire · wild-capybara | Carreritas, Galope | [wild-capybara.js](../../Pana/engine/models/fauna/capybara/wild-capybara.js) | wildCapybara |
| Caballo llanero · llanero-horse | Carreritas, Galope | [llanero-horse.js](../../Pana/engine/models/fauna/farm/llanero-horse.js) | llaneroHorse |
| Gallina de patio · yard-chicken | Carreritas | [yard-chicken.js](../../Pana/engine/models/fauna/farm/yard-chicken.js) | yardChicken |
| Vaca del hato · hato-cow | Carreritas, Galope | [hato-cow.js](../../Pana/engine/models/fauna/farm/hato-cow.js) | hatoCow |
| Pez de arrecife · reef-fish | Bululú, Carreritas | [reef-fish.js](../../Pana/engine/models/fauna/aquatic/reef-fish.js) | reefFish |
| Cardumen costero · reef-fish-school | Bululú, Carreritas | [reef-fish-school.js](../../Pana/engine/models/fauna/aquatic/reef-fish-school.js) | reefFishSchool |
| Iguana tomando sol · iguana | Bululú, Carreritas, Curiara, Galope, Escondidas, Cocina | [iguana.js](../../Pana/engine/models/fauna/iguana.js) | iguana |
| Iguana en la rama · iguana-perch | Bululú, Curiara, Galope | [iguana.js](../../Pana/engine/models/fauna/iguana.js) | iguana |
| Iguana corriendo · iguana-run | Bululú | [iguana.js](../../Pana/engine/models/fauna/iguana.js) | iguana |
| Iguana dorada · iguana-golden | Bululú | [iguana.js](../../Pana/engine/models/fauna/iguana.js) | iguana |
| Cangrejo de playa · beach-crab | Bululú, Carreritas | [beach-crab.js](../../Pana/engine/models/fauna/beach-crab.js) | beachCrab |
| Jaguar · jaguar | Preview only | [jaguar.js](../../Pana/engine/models/fauna/jaguar.js) | jaguar |
| Jaguar sentado · jaguar-sitting | Preview only | [jaguar.js](../../Pana/engine/models/fauna/jaguar.js) | jaguar |
| Jaguar negro · black-jaguar | Preview only | [jaguar.js](../../Pana/engine/models/fauna/jaguar.js) | jaguar |
| Jaguar de oro maldito · gold-jaguar | Reliquia | [jaguar.js](../../Pana/engine/models/fauna/jaguar.js) | jaguar |
| Guácharo · guacharo | Reliquia | [cave-creatures.js](../../Pana/engine/models/fauna/cave-creatures.js) | guacharo |
| Araña de la cueva · cave-spider | Reliquia | [cave-creatures.js](../../Pana/engine/models/fauna/cave-creatures.js) | caveSpider |
| Cuaima · cuaima | Reliquia | [cave-creatures.js](../../Pana/engine/models/fauna/cave-creatures.js) | cuaima |

### Llanos (10)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Casa de hato llanero · ranch-house | Carreritas, Galope, Escondidas, ¡Pintura!, Billar, Caída | [ranch.js](../../Pana/engine/models/props/ranch.js) | llaneroRanchHouse |
| Portón de corral · corral-gate | Carreritas, Galope | [ranch.js](../../Pana/engine/models/props/ranch.js) | corralGate |
| Paca de heno · hay-bale | Carreritas, Galope, Escondidas, ¡Pintura!, Billar, Caída | [ranch.js](../../Pana/engine/models/props/ranch.js) | hayBale |
| Molino de agua · water-windmill | Carreritas, Galope, Escondidas, ¡Pintura!, Billar, Caída | [ranch.js](../../Pana/engine/models/props/ranch.js) | waterWindmill |
| Caballeriza · horse-stable | Carreritas, Galope, Escondidas, ¡Pintura!, Billar, Caída | [ranch.js](../../Pana/engine/models/props/ranch.js) | horseStable |
| Comedero de ganado · feeding-trough | Carreritas, Galope, Escondidas, ¡Pintura!, Billar, Caída | [ranch.js](../../Pana/engine/models/props/ranch.js) | feedingTrough |
| Cerca de hato · ranch-fence | Carreritas, Galope, Escondidas, ¡Pintura!, Billar, Caída | [ranch.js](../../Pana/engine/models/props/ranch.js) | ranchFence |
| Tractor viejo · old-tractor | Carreritas, Galope, Escondidas, ¡Pintura!, Billar, Caída | [ranch.js](../../Pana/engine/models/props/ranch.js) | oldTractor |
| Módulo de charco de barro · mud-puddle | Carreritas | [ranch.js](../../Pana/engine/models/props/ranch.js) | mudPuddle |
| Torre de agua del hato · ranch-water-tower | Carreritas, Galope | [ranch.js](../../Pana/engine/models/props/ranch.js) | ranchWaterTower |

### Mapas (43)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Casa Guipuzcoana · table-guipuzcoana | Caída, Dominó, Póquer | [puerto-tables.js](../../Pana/engine/worlds/puerto-tables.js) | createPuertoTableEnvironment |
| Fuerte San Carlos · table-san-carlos | Caída, Dominó, Póquer | [puerto-tables.js](../../Pana/engine/worlds/puerto-tables.js) | createPuertoTableEnvironment |
| Cincuenta casas del pueblo · colonial-collection | Preview only | [colonial-house-collection.js](../../Pana/engine/worlds/colonial-house-collection.js) | createColonialHouseCollection |
| Calle de las flores · colonial-street | Preview only | [colonial-street.js](../../Pana/engine/worlds/colonial-street.js) | createColonialStreet |
| Puerto Coco · arena-puerto | Escondidas, Pepazo, Billar, Caída | [arenas.js](../../Pana/engine/worlds/arenas.js) | createArenaEnvironment |
| Hato del Sol · arena-hato | Escondidas, Pepazo, Billar, Caída | [arenas.js](../../Pana/engine/worlds/arenas.js) | createArenaEnvironment |
| Ruinas del Mango · arena-ruinas | Escondidas, Pepazo, Billar, Caída | [arenas.js](../../Pana/engine/worlds/arenas.js) | createArenaEnvironment |
| Reliquia · La mina del sol · reliquia | Reliquia | [scene.js](../../Pana/games/reliquia/public/scene.js) | createExpeditionWorld |
| ¡Embuste! · El campamento y el templo · embuste | ¡Embuste! | [scene.js](../../Pana/games/embuste/public/scene.js) | createCampWorld |
| Galope · La vuelta del estero · galope | Galope | [scene.js](../../Pana/games/galope/public/scene.js) | createCourse |
| Curiara · Río abajo · curiara | Curiara | [scene.js](../../Pana/engine/river/scene.js) | createRiverWorld |
| Lancha · Sipapo y Orinoco · lancha | Lancha | [scene.js](../../Pana/engine/river/scene.js) | createRiverWorld |
| Plaza Pana · plaza | Escondidas, Cocina, Carreritas | [plaza.js](../../Pana/engine/worlds/plaza.js) | createPlazaEnvironment |
| Cocina de la plaza · cocina | Cocina | [scene.js](../../Pana/games/cocina/public/scene.js) | createKitchenScene |
| Isla Bululú · isla | Bululú | [board.js](../../Pana/games/bululu/public/board.js) | createBoard |
| Circuito · El Estadio · track-estadio | Carreritas | [estadio.js](../../Pana/games/carreritas/public/tracks/estadio.js) | makeTrack(definition).build |
| Circuito · Pana Desierto · track-desierto | Carreritas | [desierto.js](../../Pana/games/carreritas/public/tracks/desierto.js) | makeTrack(definition).build |
| Circuito · Los Llanos · track-llanos | Carreritas | [llanos.js](../../Pana/games/carreritas/public/tracks/llanos.js) | makeTrack(definition).build |
| Circuito · Chi Chi · track-chichi | Carreritas | [chichi.js](../../Pana/games/carreritas/public/tracks/chichi.js) | makeTrack(definition).build |
| Circuito · Pana Selva · track-selva | Carreritas | [selva.js](../../Pana/games/carreritas/public/tracks/selva.js) | makeTrack(definition).build |
| Circuito · Pana Páramo · track-paramo | Carreritas | [paramo.js](../../Pana/games/carreritas/public/tracks/paramo.js) | makeTrack(definition).build |
| Circuito · Plaza Pana · track-plaza | Carreritas | [plaza.js](../../Pana/games/carreritas/public/tracks/plaza.js) | makeTrack(definition).build |
| Circuito · Isla Bululú · track-bululu | Carreritas | [bululu.js](../../Pana/games/carreritas/public/tracks/bululu.js) | makeTrack(definition).build |
| Circuito · Salto del Tepuy · track-salto | Carreritas | [salto.js](../../Pana/games/carreritas/public/tracks/salto.js) | makeTrack(definition).build |
| Circuito · Delta de los Caños · track-delta | Carreritas | [delta.js](../../Pana/games/carreritas/public/tracks/delta.js) | makeTrack(definition).build |
| Circuito · Cuevas del Río · track-cuevas | Carreritas | [cuevas.js](../../Pana/games/carreritas/public/tracks/cuevas.js) | makeTrack(definition).build |
| Circuito · Salinas del Viento · track-salinas | Carreritas | [salinas.js](../../Pana/games/carreritas/public/tracks/salinas.js) | makeTrack(definition).build |
| Circuito · Puerto · track-puerto | Carreritas | [puerto.js](../../Pana/games/carreritas/public/tracks/puerto.js) | makeTrack(definition).build |
| Circuito · Bahía de Cata · track-cata | Carreritas | [cata.js](../../Pana/games/carreritas/public/tracks/cata.js) | makeTrack(definition).build |
| Circuito · Choroní · track-choroni | Carreritas | [choroni.js](../../Pana/games/carreritas/public/tracks/choroni.js) | makeTrack(definition).build |
| Circuito · Chuao · La quebrada · track-chuao | Carreritas | [chuao.js](../../Pana/games/carreritas/public/tracks/chuao.js) | makeTrack(definition).build |
| Circuito · Colonia Tovar · track-tovar | Carreritas | [tovar.js](../../Pana/games/carreritas/public/tracks/tovar.js) | makeTrack(definition).build |
| Circuito · Galipán de noche · track-galipan | Carreritas, Parapente | [galipan.js](../../Pana/games/carreritas/public/tracks/galipan.js) | makeTrack(definition).build |
| Circuito · Maracaibo · El puente · track-maracaibo | Carreritas | [maracaibo.js](../../Pana/games/carreritas/public/tracks/maracaibo.js) | makeTrack(definition).build |
| Circuito · Isla Margarita · track-margarita | Carreritas | [margarita.js](../../Pana/games/carreritas/public/tracks/margarita.js) | makeTrack(definition).build |
| Circuito · Sarisariñama · track-sarisarinama | Carreritas | [sarisarinama.js](../../Pana/games/carreritas/public/tracks/sarisarinama.js) | makeTrack(definition).build |
| Circuito · Gran Sabana · track-sabana | Carreritas | [sabana.js](../../Pana/games/carreritas/public/tracks/sabana.js) | makeTrack(definition).build |
| Circuito · Cosmos · track-cosmos | Carreritas | [cosmos.js](../../Pana/games/carreritas/public/tracks/cosmos.js) | makeTrack(definition).build |
| Circuito · Mérida · track-merida | Carreritas | [merida.js](../../Pana/games/carreritas/public/tracks/merida.js) | makeTrack(definition).build |
| Circuito · Arrecife · track-arrecife | Carreritas | [arrecife.js](../../Pana/games/carreritas/public/tracks/arrecife.js) | makeTrack(definition).build |
| Circuito · Volcán · track-volcan | Carreritas | [volcan.js](../../Pana/games/carreritas/public/tracks/volcan.js) | makeTrack(definition).build |
| Circuito · Nubes · track-nubes | Carreritas | [nubes.js](../../Pana/games/carreritas/public/tracks/nubes.js) | makeTrack(definition).build |
| Circuito · Dulce · track-dulce | Carreritas | [dulce.js](../../Pana/games/carreritas/public/tracks/dulce.js) | makeTrack(definition).build |

### Mina (30)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Montacargas · lift-cage | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | liftCage |
| Pozo del montacargas · lift-shaft | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | liftShaft |
| Montacargas de carga · cargo-lift | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | cargoLift |
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

### Objetos (216)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Barril · barrel | Escondidas, Cocina, Carreritas, Billar, Caída, ¡Embuste!, ¡Pintura! | [plaza.js](../../Pana/engine/models/props/plaza.js) | barrel |
| Caja · crate | Escondidas, Cocina, Carreritas, Billar, Caída, ¡Embuste!, ¡Pintura! | [plaza.js](../../Pana/engine/models/props/plaza.js) | crate |
| Cava · cooler | Escondidas, Cocina, Carreritas, Billar, Caída, ¡Embuste! | [plaza.js](../../Pana/engine/models/props/plaza.js) | cooler |
| Mata · planter | Escondidas, Cocina, Carreritas, Billar, Caída | [plaza.js](../../Pana/engine/models/props/plaza.js) | planter |
| Banco · bench | Escondidas, Cocina, Carreritas, Billar, Caída | [plaza.js](../../Pana/engine/models/props/plaza.js) | bench |
| Puesto de mercado · market-stall | Escondidas, Carreritas, ¡Pintura!, Billar, Caída | [plaza.js](../../Pana/engine/models/props/plaza.js) | marketStall |
| Farol de plaza · street-lamp | Escondidas, Cocina, Carreritas, Billar, Póquer, ¡Pintura! | [plaza.js](../../Pana/engine/models/props/plaza.js) | streetLamp |
| Casa del pueblo · house | Escondidas, Cocina, Carreritas, Billar, Póquer, ¡Pintura! | [plaza-buildings.js](../../Pana/engine/models/props/plaza-buildings.js) | house |
| Casa con balcón · house-balcony | Escondidas, Cocina, Carreritas, Billar, Póquer, ¡Pintura! | [plaza-buildings.js](../../Pana/engine/models/props/plaza-buildings.js) | house |
| Bodeguita del pueblo · house-shop | Escondidas, Cocina, Carreritas, Billar, Póquer, ¡Pintura! | [plaza-buildings.js](../../Pana/engine/models/props/plaza-buildings.js) | house |
| Casa con terraza · house-terrace | Escondidas, Cocina, Carreritas, Billar, Póquer, ¡Pintura! | [plaza-buildings.js](../../Pana/engine/models/props/plaza-buildings.js) | house |
| Mango · mango | Bululú, Carreritas | [mango.js](../../Pana/engine/models/props/mango.js) | makeMango |
| Mango dorado · gold-mango | Bululú, Carreritas | [mango.js](../../Pana/engine/models/props/mango.js) | makeMango |
| China (tirapiedras) · china | Bululú | [china.js](../../Pana/engine/models/props/china.js) | china |
| Casita de isla · casita | Bululú, Bochinche | [island-house.js](../../Pana/engine/models/props/island-house.js) | casita |
| Sombrilla de playa · beachShade | Bululú, Carreritas | [beach.js](../../Pana/engine/models/props/beach.js) | beachShade |
| Rancho de playa · beachHut | Bululú, Carreritas, Escondidas, ¡Pintura!, Billar, Caída | [beach.js](../../Pana/engine/models/props/beach.js) | beachHut |
| Tronco de playa · driftwood | Bululú, Carreritas, Galope | [beach.js](../../Pana/engine/models/props/beach.js) | driftwood |
| Mazorca · corn | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js) | corn |
| Queso · cheese | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js) | cheese |
| Fregadero · sink | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js) | sink |
| Momia del templo · temple-mummy | Reliquia, ¡Embuste! | [reliquia.js](../../Pana/engine/models/props/reliquia.js) | mummy |
| Guardián del sol · sun-guardian | Reliquia, ¡Embuste! | [reliquia.js](../../Pana/engine/models/props/reliquia.js) | mummy |
| Reliquia del sol · sun-relic | Reliquia, ¡Embuste! | [reliquia.js](../../Pana/engine/models/props/reliquia.js) | sunRelic |
| Rueda del templo · expedition-winch | Reliquia, ¡Embuste! | [reliquia.js](../../Pana/engine/models/props/reliquia.js) | expeditionWinch |
| Farol de expedición · expedition-lantern | Reliquia, ¡Embuste! | [reliquia.js](../../Pana/engine/models/props/reliquia.js) | expeditionLantern |
| Monedas de oro · coin-pile | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | coinPile |
| Esmeralda · emerald | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | emerald |
| Perla de Cubagua · cubagua-pearl | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | pearl |
| Copa de oro · gold-cup | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | goldCup |
| Máscara de oro · gold-mask | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | goldMask |
| Ídolo tallado · carved-idol | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | carvedIdol |
| Disco del sol · sun-disk | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | sunDisk |
| Cofre de esmeraldas · emerald-chest | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | emeraldChest |
| Tambor ceremonial · ceremonial-drum | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | ceremonialDrum |
| Espejo maldito · cursed-mirror | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | cursedMirror |
| Altar de cacao y oro · cacao-altar | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | cacaoAltar |
| Máscara de los ecos · echo-mask | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | echoMask |
| Alpargatas del mensajero · messenger-sandals | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | messengerSandals |
| Corona del sol · sun-crown | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | sunCrown |
| Ídolo que se ríe · laughing-idol | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | laughingIdol |
| Botella de miche · miche-bottle | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | micheBottle |
| Brújula torcida · crooked-compass | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | crookedCompass |
| Moneda de la suerte · lucky-coin | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | luckyCoin |
| Corazón de jaguar · jaguar-heart | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | jaguarHeart |
| Machete · expedition-machete | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | machete |
| Botiquín · botiquin | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | botiquin |
| Cofre del templo · treasure-chest | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | treasureChest |
| Losa trampa · trap-plate | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | trapPlate |
| Boca de dardos · dart-head | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | dartHead |
| Sello de la escalera · stair-seal | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | stairSeal |
| Jaguar de oro · gold-jaguar-statue | Reliquia | [jaguar-stone.js](../../Pana/engine/models/props/jaguar-stone.js) | jaguarStatue |
| Rapel de la bajada · rappel-rig | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | rappelRig |
| Cuerda de subida · climb-rope | Reliquia | [reliquia-treasure.js](../../Pana/engine/models/props/reliquia-treasure.js) | climbRope |
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
| Cacho de cuero · cacho | ¿Quién empieza? | [cacho.js](../../Pana/engine/models/props/cacho.js) | createCacho |
| Dado del cacho · cacho-die | ¿Quién empieza? | [cacho.js](../../Pana/engine/models/props/cacho.js) | createCachoDie |
| Moneda cara o sello · moneda | ¿Quién empieza? | [cacho.js](../../Pana/engine/models/props/cacho.js) | createMoneda |
| La Chispa · paint-chispa | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| El Trueno · paint-trueno | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| Las Gemelas · paint-gemelas | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| El Cohetón · paint-coheton | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| La Lejana · paint-lejana | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| La Bazuca · paint-bazuca | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| La Metra · paint-metra | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| La Licuadora · paint-licuadora | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| La China · paint-china | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| El Tambor · paint-tambor | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| La Corneta · paint-corneta | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| La Fumigadora · paint-fumigadora | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| El Llanero · paint-llanero | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| La Pulga · paint-pulga | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| La Parrandera · paint-parrandera | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| El Tuqueque · paint-tuqueque | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| El Zamuro · paint-zamuro | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| La Culebrona · paint-culebrona | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintKit |
| Cohete de La Bazuca · paint-cohete-bazuca | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintRocket |
| El Acolchado · paint-acolchado | Pepazo | [paintball-kit.js](../../Pana/engine/models/props/paintball-kit.js) | createPaintVest |
| Marcadora de pintura · paint-marker | ¡Pintura! | [paintball.js](../../Pana/engine/models/props/paintball.js) | createPaintMarker |
| Toldo de equipo · team-canopy | Pepazo | [paintball.js](../../Pana/engine/models/props/paintball.js) | teamCanopy |
| Sacos de arena · sandbag-wall | Pepazo | [paintball.js](../../Pana/engine/models/props/paintball.js) | sandbagWall |
| Carretilla de carga · cargo-handcart | Carreritas | [cargo-handcart.js](../../Pana/engine/models/props/cargo-handcart.js) | cargoHandcart |
| Casa amarilla · colonial-yellow | Carreritas | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Casa azul con balcón · colonial-balcony | Carreritas | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Casa de la trinitaria · colonial-crest | Carreritas | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Casa larga del pueblo · colonial-long | Carreritas | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Casa de la esquina · colonial-corner | Carreritas | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Casa del portal · colonial-porch | Carreritas | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Cancha de bolas criollas · criollas-court | Bolas Criollas, Bululú | [criollas.js](../../Pana/engine/models/props/criollas.js) | criollasCourt |
| Bola criolla · criolla-ball | Bolas Criollas, Bululú | [criollas.js](../../Pana/engine/models/props/criollas.js) | criollaBall |
| Bunker de paletas · pallet-bunker | ¡Pintura! | [glow-paintball.js](../../Pana/engine/models/props/glow-paintball.js) | palletBunker |
| Inflable lata · inflatable-can | ¡Pintura! | [glow-paintball.js](../../Pana/engine/models/props/glow-paintball.js) | inflatableBunker |
| Inflable dorito · inflatable-dorito | ¡Pintura! | [glow-paintball.js](../../Pana/engine/models/props/glow-paintball.js) | inflatableBunker |
| Inflable culebra · inflatable-snake | ¡Pintura! | [glow-paintball.js](../../Pana/engine/models/props/glow-paintball.js) | inflatableBunker |
| Inflable ladrillo · inflatable-brick | ¡Pintura! | [glow-paintball.js](../../Pana/engine/models/props/glow-paintball.js) | inflatableBunker |
| Tubo de plástico · tube-bunker | ¡Pintura! | [glow-paintball.js](../../Pana/engine/models/props/glow-paintball.js) | tubeBunker |
| Torre de reflectores · floodlight-mast | ¡Pintura! | [glow-paintball.js](../../Pana/engine/models/props/glow-paintball.js) | floodlightMast |
| Manguera LED · led-rope | ¡Pintura! | [glow-paintball.js](../../Pana/engine/models/props/glow-paintball.js) | ledRope |
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
| Ludo · Chócala · ludo-highfive | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMotionPreview |
| Ludo · Resbalón · ludo-slip | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMotionPreview |
| Ludo · Rodar · ludo-rollbarrel | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMotionPreview |
| Ludo · Moonwalk · ludo-moonwalk | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMotionPreview |
| Ludo · Resorte · ludo-spring | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMotionPreview |
| Ludo · Esquivar · ludo-dodge | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMotionPreview |
| Ludo · Caballito · ludo-piggy | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMotionPreview |
| Ludo · Paraguas · ludo-umbrella | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMotionPreview |
| Ludo · Túnel · ludo-tunnel | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMotionPreview |
| Ludo · Chicle · ludo-gum | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMotionPreview |
| Ludo · Inicio de partida · ludo-intro | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMomentPreview |
| Ludo · Tu turno · ludo-turn | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMomentPreview |
| Ludo · Dado en suspenso · ludo-suspense | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMomentPreview |
| Ludo · Casilla segura · ludo-safe | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMomentPreview |
| Ludo · Bloqueo · ludo-block | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMomentPreview |
| Ludo · Salto de rana · ludo-leap | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMomentPreview |
| Ludo · Recta final · ludo-sprint | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMomentPreview |
| Ludo · ¡Casi! · ludo-nearmiss | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMomentPreview |
| Ludo · Sin movimientos · ludo-nomoves | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMomentPreview |
| Ludo · A dormir · ludo-sleep | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMomentPreview |
| Ludo · Podio · ludo-podium | Ludo | [studio-preview.js](../../Pana/games/ludo/public/studio-preview.js) | createLudoMomentPreview |
| Tarima del concurso · qqsmp-stage | ¿Quién quiere ser mi pana? | [studio-set.js](../../Pana/games/qqsmp/public/studio-set.js) | createQuizStage |
| Podio del concurso · qqsmp-podium | ¿Quién quiere ser mi pana? | [studio-set.js](../../Pana/games/qqsmp/public/studio-set.js) | createQuizPodium |
| Atril del animador · qqsmp-host-desk | ¿Quién quiere ser mi pana? | [studio-set.js](../../Pana/games/qqsmp/public/studio-set.js) | createHostDesk |
| Pantalla del concurso · qqsmp-screen | ¿Quién quiere ser mi pana? | [studio-set.js](../../Pana/games/qqsmp/public/studio-set.js) | createQuizScreen |
| Reflector · qqsmp-spotlight | ¿Quién quiere ser mi pana? | [studio-set.js](../../Pana/games/qqsmp/public/studio-set.js) | createStageSpotlight |
| Culo e' puya · tambor-culo-e-puya | La Rueda de Tambor | [rueda-set.js](../../Pana/games/tambor/public/rueda-set.js) | createCuloEPuya |
| Juego de culo e' puya · tambor-culo-e-puya-set | La Rueda de Tambor | [rueda-set.js](../../Pana/games/tambor/public/rueda-set.js) | createCuloEPuyaSet |
| Tambor largo con horqueta · tambor-mina | La Rueda de Tambor | [rueda-set.js](../../Pana/games/tambor/public/rueda-set.js) | createMina |
| Charrasca · tambor-charrasca | La Rueda de Tambor | [rueda-set.js](../../Pana/games/tambor/public/rueda-set.js) | createCharrasca |
| Maraca · tambor-maraca | La Rueda de Tambor | [rueda-set.js](../../Pana/games/tambor/public/rueda-set.js) | createMaraca |
| Maracas · tambor-maracas | La Rueda de Tambor | [rueda-set.js](../../Pana/games/tambor/public/rueda-set.js) | createMaracas |
| Caracol · tambor-caracol | La Rueda de Tambor | [rueda-set.js](../../Pana/games/tambor/public/rueda-set.js) | createCaracol |
| Pañuelo · tambor-panuelo | La Rueda de Tambor | [rueda-set.js](../../Pana/games/tambor/public/rueda-set.js) | createPanuelo |
| Nube de violín · tambor-violin | La Rueda de Tambor | [rueda-set.js](../../Pana/games/tambor/public/rueda-set.js) | createViolinCloud |
| La casita rosada · tambor-casita-rosada | La Rueda de Tambor | [rueda-set.js](../../Pana/games/tambor/public/rueda-set.js) | createPinkShack |
| Bombillos · tambor-bombillos | La Rueda de Tambor | [rueda-set.js](../../Pana/games/tambor/public/rueda-set.js) | createStringLights |
| Mural del malecón · tambor-mural | La Rueda de Tambor | [rueda-set.js](../../Pana/games/tambor/public/rueda-set.js) | createMural |
| Rueda de conchas · tambor-rueda | La Rueda de Tambor | [rueda-set.js](../../Pana/games/tambor/public/rueda-set.js) | createRuedaRing |
| Mesa redonda de ¡Stop! · stop-table | ¡Stop! | [studio-set.js](../../Pana/games/stop/public/studio-set.js) | createStopTable |
| Rueda de letras · stop-letter-wheel | ¡Stop! | [studio-set.js](../../Pana/games/stop/public/studio-set.js) | createLetterWheel |
| Libreta de rayas · stop-notebook | ¡Stop! | [studio-set.js](../../Pana/games/stop/public/studio-set.js) | createNotebook |
| Lápiz · stop-pencil | ¡Stop! | [studio-set.js](../../Pana/games/stop/public/studio-set.js) | createPencil |
| Muro de palabras · stop-slang-wall | ¡Stop! | [studio-set.js](../../Pana/games/stop/public/studio-set.js) | createSlangWall |
| Chapita · chapita-cap | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createChapita |
| Chapita doblada · chapita-cap-doblada | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createChapita |
| Chapita de oro · chapita-cap-oro | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createChapita |
| Palo de escoba · chapita-palo | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createPalo |
| Palo con teipe · chapita-palo-teipe | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createPalo |
| Palo tricolor · chapita-palo-tricolor | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createPalo |
| Palo dorado · chapita-palo-dorado | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createPalo |
| La ventana de la señora · chapita-ventana | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createSenoraWindow |
| Calle del barrio (piso) · chapita-calle | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createStreetGround |
| Cancha del bloque (piso) · chapita-cancha | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createBlockCourt |
| Cerca de ciclón · chapita-cerca | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createChainFence |
| Gradas · chapita-gradas | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createBleachers |
| Superbloque · chapita-superbloque | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createSuperbloque |
| Tuyuyo · chapita-tuyuyo | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createTuyuyo |
| Palo partido · chapita-palo-partido | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createPaloPartido |
| Pelota · chapita-pelota | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createPelota |
| Bate de madera · chapita-bate | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createBate |
| Perro callejero · chapita-perro | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createPerro |
| Alcantarilla · chapita-alcantarilla | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createAlcantarilla |
| Periódico El Barrio · chapita-periodico | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createPeriodico |
| Bola de paja · chapita-bola-de-paja | Chapita | [studio-set.js](../../Pana/games/chapita/public/studio-set.js) | createBolaDePaja |
| Chapita · Lanzar y batear · chapita-jugada-hit | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · Solo batear · chapita-jugada-swing | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · Swing fallido · chapita-jugada-miss | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · Helicóptero · chapita-jugada-helicopter | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · Solo lanzar · chapita-jugada-pitch | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · Discusión · chapita-jugada-argue | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · Palo zafado · chapita-jugada-slip | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · Bumerán · chapita-jugada-boomerang | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · Chapazo · chapita-jugada-bean | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · La ventana · chapita-jugada-window | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · Atrapada · chapita-jugada-catch | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · Palo partido · chapita-jugada-broken | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · Jonrón · chapita-jugada-home | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · El perro · chapita-jugada-dog | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · Pa'l techo · chapita-jugada-roof | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · Alcantarilla · chapita-jugada-drain | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · Pinball · chapita-jugada-pinball | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · El abuelo · chapita-jugada-grandpa | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · ¡Carro! · chapita-jugada-car | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · ¡A comer! · chapita-jugada-dinner | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Chapita · Celebración · chapita-jugada-dance | Chapita | [studio-preview.js](../../Pana/games/chapita/public/studio-preview.js) | createChapitaJugadaPreview |
| Guante de boxeo · trifulca-guante | Trifulca | [set.js](../../Pana/games/trifulca/public/set.js) | boxingGlove |
| Guante de boxeo azul · trifulca-guante-azul | Trifulca | [set.js](../../Pana/games/trifulca/public/set.js) | boxingGlove |
| Casco de moto abierto · trifulca-casco | Trifulca | [set.js](../../Pana/games/trifulca/public/set.js) | motoHelmet |
| Chancleta · trifulca-chancleta | Trifulca | [set.js](../../Pana/games/trifulca/public/set.js) | chancleta |
| Ring bajo toldo · trifulca-ring | Trifulca | [set.js](../../Pana/games/trifulca/public/set.js) | tentRing |
| El Ávila · trifulca-avila | Trifulca | [set.js](../../Pana/games/trifulca/public/set.js) | avilaRidge |

### Personajes (3)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Pana original · pana | Bululú, Carreritas, Escondidas, Cocina | [avatar-model.js](../../Pana/engine/models/characters/pana/avatar-model.js) | buildCharacter |
| Pana cocinero · pana-chef | Cocina | [avatar-model.js](../../Pana/engine/models/characters/pana/avatar-model.js) | buildCharacter |
| Pana conductor · pana-driver | Carreritas | [avatar-model.js](../../Pana/engine/models/characters/pana/avatar-model.js) | buildCharacter |

### Pueblo (34)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Casa colonial colorida · colonial-house | Carreritas | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | colonialHouse |
| Bodega de esquina · corner-bodega | Carreritas | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | cornerBodega |
| Iglesia colonial pequeña · colonial-church | Carreritas | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | colonialChurch |
| Parada de autobús · bus-stop-shelter | Carreritas | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | busStopShelter |
| Puesto de arepas · street-food-kiosk | Cocina, Carreritas, Billar, Póquer | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | streetFoodKiosk |
| Torre del reloj · plaza-clock-tower | Escondidas, Cocina, Carreritas, Billar, Póquer | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | plazaClockTower |
| Aro de baloncesto · basketball-hoop | Carreritas, ¡Pintura! | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | basketballHoop |
| Tanque de agua de azotea · rooftop-water-tank | Carreritas | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | rooftopWaterTank |
| Farol de calle · streetlight-pole | Escondidas, Cocina, Carreritas, Billar, Póquer | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | streetlightPole |
| Banco de parque · park-bench | Escondidas, Cocina, Carreritas, Billar, Póquer, ¡Pintura! | [pueblo.js](../../Pana/engine/models/props/pueblo.js) | parkBench |
| Glorieta musical · plaza-bandstand | Carreritas | [plaza-bandstand.js](../../Pana/engine/models/props/plaza-bandstand.js) | plazaBandstand |
| Cauchera del circuito · tire-workshop | Carreritas | [tire-workshop.js](../../Pana/engine/models/props/tire-workshop.js) | tireWorkshop |
| Carrito de helados · ice-cream-cart | Carreritas | [ice-cream-cart.js](../../Pana/engine/models/props/ice-cream-cart.js) | iceCreamCart |
| Fuente de cerámica pintada · ceramic-fountain | Carreritas | [ceramic-fountain.js](../../Pana/engine/models/props/ceramic-fountain.js) | ceramicFountain |
| Terraza de café · cafe-terrace | Carreritas | [cafe-terrace.js](../../Pana/engine/models/props/cafe-terrace.js) | cafeTerrace |
| Patio con tendedero · laundry-courtyard | Carreritas | [laundry-courtyard.js](../../Pana/engine/models/props/laundry-courtyard.js) | laundryCourtyard |
| Camión frutero · fruit-delivery-truck | Carreritas | [fruit-delivery-truck.js](../../Pana/engine/models/props/fruit-delivery-truck.js) | fruitDeliveryTruck |
| Mural callejero · street-mural | Carreritas | [street-mural.js](../../Pana/engine/models/props/street-mural.js) | streetMural |
| Racimo de globos · balloon-bunch | Carreritas | [fiesta.js](../../Pana/engine/models/props/fiesta.js) | balloonBunch |
| Banderas de pluma · fiesta-flags | Carreritas | [fiesta.js](../../Pana/engine/models/props/fiesta.js) | fiestaFlags |
| Guirnalda de banderines · bunting-line | Carreritas | [fiesta.js](../../Pana/engine/models/props/fiesta.js) | buntingLine |
| Pancarta a cuadros · checkered-banner | Carreritas | [fiesta.js](../../Pana/engine/models/props/fiesta.js) | checkeredBanner |
| Globo aerostático · hot-air-balloon | Carreritas | [fiesta.js](../../Pana/engine/models/props/fiesta.js) | hotAirBalloon |
| Letrero de madera · wood-sign | Carreritas | [wood-sign.js](../../Pana/engine/models/props/wood-sign.js) | woodSign |
| Pancarta pintada · sign-banner | Carreritas | [wood-sign.js](../../Pana/engine/models/props/wood-sign.js) | signBanner |
| Delineador de carretera · reflector-post | Carreritas | [wood-sign.js](../../Pana/engine/models/props/wood-sign.js) | reflectorPost |
| Moto estacionada · parked-moto | Trifulca | [barrio.js](../../Pana/engine/models/props/barrio.js) | parkedMoto |
| Esquina de los cables · cable-pole | Trifulca | [barrio.js](../../Pana/engine/models/props/barrio.js) | cablePole |
| Cables entre postes · cable-span | Trifulca | [barrio.js](../../Pana/engine/models/props/barrio.js) | cableSpan |
| Pila de cajas de verdura · produce-crates | Trifulca | [barrio.js](../../Pana/engine/models/props/barrio.js) | produceCrates |
| Carretilla de mercado · market-hand-truck | Trifulca | [barrio.js](../../Pana/engine/models/props/barrio.js) | marketHandTruck |
| Silla plástica · plastic-chair | ¡Stop!, Trifulca | [barrio.js](../../Pana/engine/models/props/barrio.js) | plasticChair |
| Gradas de madera · wooden-stands | Trifulca | [barrio.js](../../Pana/engine/models/props/barrio.js) | woodenStands |
| Puente sobre el lago · lake-bridge | Trifulca | [barrio.js](../../Pana/engine/models/props/barrio.js) | lakeBridge |

### Páramo (10)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Cabaña de montaña · mountain-cabin | Carreritas | [mountain.js](../../Pana/engine/models/props/mountain.js) | mountainCabin |
| Estación de teleférico · cable-car-station | Carreritas | [mountain.js](../../Pana/engine/models/props/mountain.js) | cableCarStation |
| Módulo de acantilado rocoso · rocky-cliff | Carreritas | [mountain.js](../../Pana/engine/models/props/mountain.js) | rockyCliff |
| Defensa vial de montaña · mountain-guardrail | Preview only | [mountain.js](../../Pana/engine/models/props/mountain.js) | mountainGuardrail |
| Mirador de piedra · stone-lookout | Carreritas | [mountain.js](../../Pana/engine/models/props/mountain.js) | stoneLookout |
| Carpa de montaña · mountain-tent | Carreritas | [mountain.js](../../Pana/engine/models/props/mountain.js) | mountainTent |
| Puente colgante de montaña · mountain-suspension-bridge | Preview only | [mountain.js](../../Pana/engine/models/props/mountain.js) | mountainSuspensionBridge |
| Señal de senderos · mountain-signpost | Carreritas | [mountain.js](../../Pana/engine/models/props/mountain.js) | mountainSignpost |
| Arco de roca · rock-arch | Carreritas | [mountain.js](../../Pana/engine/models/props/mountain.js) | rockArch |
| Caballete de madera · timber-trestle | Carreritas | [mountain.js](../../Pana/engine/models/props/mountain.js) | timberTrestle |

### Ruinas (26)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Galería en ruinas · ruin-gallery | Reliquia | [reliquia-ruins.js](../../Pana/engine/models/props/reliquia-ruins.js) | ruinGallery |
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
| Jaguar de piedra · jaguar-statue | Carreritas | [jaguar-stone.js](../../Pana/engine/models/props/jaguar-stone.js) | jaguarStatue |
| Relieve del jaguar · jaguar-relief | Carreritas | [jaguar-stone.js](../../Pana/engine/models/props/jaguar-stone.js) | jaguarRelief |
| Portal maya cubierto de selva · maya-portal | Carreritas | [maya-temple.js](../../Pana/engine/models/props/maya-temple.js) | mayaPortal |
| Pirámide escalonada · stepped-pyramid | Carreritas | [maya-temple.js](../../Pana/engine/models/props/maya-temple.js) | steppedPyramid |
| Cenote · cenote | Carreritas | [maya-temple.js](../../Pana/engine/models/props/maya-temple.js) | cenote |

### Selva (14)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Entrada del templo de piedra · temple-entrance | Reliquia, ¡Embuste!, Escondidas, ¡Pintura!, Billar, Caída | [jungle.js](../../Pana/engine/models/props/jungle.js) | templeEntrance |
| Puente colgante de cuerdas · rope-bridge | Reliquia, ¡Embuste! | [jungle.js](../../Pana/engine/models/props/jungle.js) | ropeBridge |
| Cascada entre rocas · waterfall-rocks | Carreritas, ¡Embuste! | [jungle.js](../../Pana/engine/models/props/jungle.js) | waterfallRocks |
| Arco de piedra con enredaderas · vine-arch | Carreritas, ¡Embuste!, Escondidas, ¡Pintura!, Billar, Caída | [jungle.js](../../Pana/engine/models/props/jungle.js) | vineArch |
| Puente de bambú · bamboo-bridge | Preview only | [jungle.js](../../Pana/engine/models/props/jungle.js) | bambooBridge |
| Tótem de piedra antiguo · stone-totem | Carreritas, Reliquia, ¡Embuste!, Escondidas, ¡Pintura!, Billar, Caída | [jungle.js](../../Pana/engine/models/props/jungle.js) | stoneTotem |
| Tronco hueco · hollow-log | Carreritas, ¡Embuste! | [jungle.js](../../Pana/engine/models/props/jungle.js) | hollowLog |
| Laja del Escudo Guayanés · laja-rock | Curiara | [amazonas.js](../../Pana/engine/models/props/amazonas.js) | lajaRock |
| Tronco del igapó · igapo-trunk | Curiara | [amazonas.js](../../Pana/engine/models/props/amazonas.js) | igapoTrunk |
| Churuata · churuata | Curiara | [amazonas.js](../../Pana/engine/models/props/amazonas.js) | churuata |
| Arco de moriche · finish-arch | Curiara | [amazonas.js](../../Pana/engine/models/props/amazonas.js) | finishArch |
| Muelle con techo de moriche · moriche-dock | Curiara | [amazonas.js](../../Pana/engine/models/props/amazonas.js) | moricheDock |
| Estalactitas del río · stalactite-cluster | Carreritas | [caves.js](../../Pana/engine/models/props/caves.js) | stalactiteCluster |
| Cortina de raíces · root-curtain | Carreritas | [caves.js](../../Pana/engine/models/props/caves.js) | rootCurtain |

### Termales (5)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Poza termal · hot-spring-pool | Carreritas | [thermal.js](../../Pana/engine/models/props/thermal.js) | hotSpringPool |
| Fumarola · steam-vent | Carreritas | [thermal.js](../../Pana/engine/models/props/thermal.js) | steamVent |
| Terrazas minerales · mineral-terraces | Carreritas | [thermal.js](../../Pana/engine/models/props/thermal.js) | mineralTerraces |
| Casa de las termas · thermal-bathhouse | Carreritas | [thermal.js](../../Pana/engine/models/props/thermal.js) | thermalBathhouse |
| Mirador de Chi Chi · thermal-lookout | Carreritas | [thermal.js](../../Pana/engine/models/props/thermal.js) | thermalLookout |

### Vegetación (50)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Mata de hojas anchas · garden-rosette | Preview only | [garden-rosette.js](../../Pana/engine/models/vegetation/garden-rosette.js) | gardenRosette |
| Enredadera colgante · trailing-vine | Preview only | [trailing-vine.js](../../Pana/engine/models/vegetation/trailing-vine.js) | trailingVine |
| Trinitaria · trinitaria | Preview only | [trinitaria.js](../../Pana/engine/models/vegetation/trinitaria.js) | trinitaria |
| Palma moriche · moriche | Galope | [moriche.js](../../Pana/engine/models/vegetation/moriche.js) | moriche |
| Paja de sabana · savanna-grass | Galope, Carreritas | [savanna-grass.js](../../Pana/engine/models/vegetation/savanna-grass.js) | savannaGrass |
| Cocotero · palm | Bululú, Carreritas, Escondidas, Cocina, Reliquia, Billar, Póquer, ¡Pintura!, Caída, Bochinche | [palm.js](../../Pana/engine/models/vegetation/palm.js) | palm |
| Árbol de mango · mangoTree | Bululú, Carreritas, Escondidas, Cocina, Galope, Billar, Póquer, ¡Pintura!, Caída | [mango-tree.js](../../Pana/engine/models/vegetation/mango-tree.js) | mangoTree |
| Ceiba · ceiba | Bululú, Carreritas | [ceiba.js](../../Pana/engine/models/vegetation/ceiba.js) | ceiba |
| Pino caribe · pine | Bululú | [pine.js](../../Pana/engine/models/vegetation/pine.js) | pine |
| Mata de cambur · banana | Bululú, Carreritas | [banana.js](../../Pana/engine/models/vegetation/banana.js) | banana |
| Arbusto · bush | Bululú, Carreritas, Escondidas, Cocina, Billar, Póquer | [bush.js](../../Pana/engine/models/vegetation/bush.js) | bush |
| Araguaney · araguaney | Carreritas, ¡Pintura! | [araguaney.js](../../Pana/engine/models/vegetation/araguaney.js) | araguaney |
| Apamate · apamate | Carreritas | [araguaney.js](../../Pana/engine/models/vegetation/araguaney.js) | araguaney |
| Bucare en flor · bucare | Carreritas | [araguaney.js](../../Pana/engine/models/vegetation/araguaney.js) | araguaney |
| Bambú · bamboo | Carreritas, Escondidas, ¡Pintura!, Billar, Caída | [bamboo.js](../../Pana/engine/models/vegetation/bamboo.js) | bamboo |
| Helecho · fern | Carreritas, Reliquia, Escondidas, ¡Pintura!, Billar, Caída, Bochinche | [fern.js](../../Pana/engine/models/vegetation/fern.js) | fern |
| Monstera · monstera | Carreritas | [monstera.js](../../Pana/engine/models/vegetation/monstera.js) | monstera |
| Heliconia · heliconia | Carreritas, Bochinche | [heliconia.js](../../Pana/engine/models/vegetation/heliconia.js) | heliconia |
| Cardón · cactus | Carreritas | [cactus.js](../../Pana/engine/models/vegetation/cactus.js) | cactus |
| Mangle · mangrove | Carreritas, Bochinche | [mangrove.js](../../Pana/engine/models/vegetation/mangrove.js) | mangrove |
| Lechosa · papaya | Bululú, Carreritas | [papaya.js](../../Pana/engine/models/vegetation/papaya.js) | papaya |
| Agave · agave | Carreritas | [agave.js](../../Pana/engine/models/vegetation/agave.js) | agave |
| Nenúfar · waterLily | Carreritas, Galope | [water-lily.js](../../Pana/engine/models/vegetation/water-lily.js) | waterLily |
| Cayena · hibiscus | Bululú, Carreritas | [hibiscus.js](../../Pana/engine/models/vegetation/hibiscus.js) | hibiscus |
| Juncos · reeds | Carreritas, Galope | [reeds.js](../../Pana/engine/models/vegetation/reeds.js) | reeds |
| Caucho de raíces · jungleGiant | Carreritas | [jungle-giant.js](../../Pana/engine/models/vegetation/jungle-giant.js) | jungleGiant |
| Arbusto tropical grande · tropicalBush | Carreritas | [tropical-bush.js](../../Pana/engine/models/vegetation/tropical-bush.js) | tropicalBush |
| Frailejón · frailejon | Carreritas | [frailejon.js](../../Pana/engine/models/vegetation/frailejon.js) | frailejon |
| Pino de montaña · mountainPine | Carreritas | [mountain-pine.js](../../Pana/engine/models/vegetation/mountain-pine.js) | mountainPine |
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
| Samán · saman | Carreritas | [saman.js](../../Pana/engine/models/vegetation/saman.js) | saman |
| Yagrumo · yagrumo | Carreritas | [selva-trees.js](../../Pana/engine/models/vegetation/selva-trees.js) | yagrumo |
| Cacao · cacao | Carreritas | [selva-trees.js](../../Pana/engine/models/vegetation/selva-trees.js) | cacao |
| Palma zancona · zancona | Carreritas | [selva-palms.js](../../Pana/engine/models/vegetation/selva-palms.js) | zancona |
| Palma manaca · manaca | Carreritas | [selva-palms.js](../../Pana/engine/models/vegetation/selva-palms.js) | manaca |
| Helecho arborescente · tree-fern | Carreritas, Bochinche | [selva-palms.js](../../Pana/engine/models/vegetation/selva-palms.js) | treeFern |

### Vehículos (32)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| El Chamo · car-chamo | Carreritas, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.chamo |
| La Lancha · car-lancha | Carreritas, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.lancha |
| El Machito · car-machito | Carreritas, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.machito |
| La Bala · car-bala | Carreritas, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.bala |
| El Toro · car-toro | Carreritas, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.toro |
| La Familiar · car-familiar | Carreritas, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.familiar |
| La Rumbera · car-rumbera | Carreritas, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.rumbera |
| El Montañero · car-montanero | Carreritas, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.montanero |
| La Pulga · car-escarabajo | Carreritas, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.escarabajo |
| El Caprichoso · car-sedan | Carreritas, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.sedan |
| El Por Puesto · car-buseta | Carreritas, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.buseta |
| El Burro · car-pickup | Carreritas, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.pickup |
| El Chigüire · car-jeep | Carreritas, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.jeep |
| La Chispa · car-hatch | Carreritas, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.hatch |
| El Tepuy · car-rustico | Carreritas, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.rustico |
| La Reina · car-malibu | Carreritas, Bululú | [cars.js](../../Pana/engine/models/vehicles/cars.js) | CAR_BUILDERS.malibu |
| Curiara de carrera · racing-curiara | Curiara, Bululú | [curiara.js](../../Pana/engine/models/vehicles/curiara.js) | createCanoe |
| Lancha de carrera · racing-lancha | Lancha | [lancha.js](../../Pana/engine/models/vehicles/lancha.js) | createLancha |
| Avioneta · racing-avioneta | Carreritas | [avioneta.js](../../Pana/engine/models/vehicles/avioneta.js) | createAvioneta |
| Curiara (kit) · kit-curiara | Carreritas | [lancha.js](../../Pana/engine/models/vehicles/lancha.js) | createCuriaraRacer |
| El Rayo (kit) · kit-rayo | Carreritas | [lancha.js](../../Pana/engine/models/vehicles/lancha.js) | createRayo |
| Guacamaya (kit) · kit-guacamaya | Carreritas | [avioneta.js](../../Pana/engine/models/vehicles/avioneta.js) | createGuacamaya |
| Turpial (kit) · kit-turpial | Carreritas | [avioneta.js](../../Pana/engine/models/vehicles/avioneta.js) | createTurpial |
| Parapente · racing-parapente | Parapente | [parapente.js](../../Pana/engine/models/vehicles/parapente.js) | createParapente |
| Cauchos de calle · wheel-calle | Carreritas | [wheel-definitions.js](../../Pana/games/carreritas/public/wheel-definitions.js) | makeWheel |
| Slicks de pista · wheel-slick | Carreritas | [wheel-definitions.js](../../Pana/games/carreritas/public/wheel-definitions.js) | makeWheel |
| Cauchos de barro · wheel-barro | Carreritas | [wheel-definitions.js](../../Pana/games/carreritas/public/wheel-definitions.js) | makeWheel |
| Llantas de palo · wheel-palo | Carreritas | [wheel-definitions.js](../../Pana/games/carreritas/public/wheel-definitions.js) | makeWheel |
| Cauchos de lluvia · wheel-lluvia | Carreritas | [wheel-definitions.js](../../Pana/games/carreritas/public/wheel-definitions.js) | makeWheel |
| Clásicas · wheel-clasicas | Carreritas | [wheel-definitions.js](../../Pana/games/carreritas/public/wheel-definitions.js) | makeWheel |
| Rines ligeros · wheel-ligeras | Carreritas | [wheel-definitions.js](../../Pana/games/carreritas/public/wheel-definitions.js) | makeWheel |
| Todoterreno · wheel-todoterreno | Carreritas | [wheel-definitions.js](../../Pana/games/carreritas/public/wheel-definitions.js) | makeWheel |

### Vestuario (6)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Mi pana · Accesorios · pana-guardarropa | Bululú, Carreritas, Escondidas, Cocina | [accessories.js](../../Pana/engine/models/characters/pana/accessories.js) | createAccessories |
| Franela · outfit-shirt | Bululú, Carreritas, Escondidas, Cocina | [model.js](../../Pana/engine/models/characters/pana/model.js) | buildSoftCharacter |
| Delantal y gorro · outfit-chef | Bululú, Carreritas, Escondidas, Cocina | [model.js](../../Pana/engine/models/characters/pana/model.js) | buildSoftCharacter |
| Suéter y gorra · outfit-hoodie | Bululú, Carreritas, Escondidas, Cocina | [model.js](../../Pana/engine/models/characters/pana/model.js) | buildSoftCharacter |
| Camisa tropical · outfit-tropical | Bululú, Carreritas, Escondidas, Cocina | [model.js](../../Pana/engine/models/characters/pana/model.js) | buildSoftCharacter |
| Conjunto deportivo · outfit-sport | Bululú, Carreritas, Escondidas, Cocina | [model.js](../../Pana/engine/models/characters/pana/model.js) | buildSoftCharacter |

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
| Casa palafito · palafito-house | Carreritas | [delta.js](../../Pana/engine/models/props/delta.js) | palafitoHouse |
| Cobertizo del embarcadero · landing-shelter | Carreritas, Galope | [delta.js](../../Pana/engine/models/props/delta.js) | landingShelter |

## Keep this inventory current

Run `npm run inventory` (`node Pana/scripts/model-inventory.js`); it starts its own server. The script exports this Markdown report and `model-inventory.json`, verifies every source anchor, and reads all catalog entries. Review `Pana/scripts/inventory-notes.js` when moving/removing geometry: anchor checks catch stale locations but do not automatically discover new inline models or prove call-graph reachability.

Run `npm run test:browser -- wildlife` for geometry ownership, finite bounds, timeline rewind, flight heading, all seven birds/four capybaras, terrain/road clearance and native-map screenshots. `art/studio/wildlife/` holds the local proof. The audit does not delete dormant factories or silently replace older map assemblies.
