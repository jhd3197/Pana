# Pana — current model inventory

Audited 2026-10-15. Generated from the real Studio registry plus a reviewed source ledger.

**154 Studio resources**, including **10 Fauna entries**, **22 vegetation entries**, **8 vehicles** and **11 maps**. **10 resources are preview-only.** The separate ledger identifies **31 active uncataloged model families**, **38 scene/effect families** and **9 dormant factories/hooks**. These numbers must not be added into a “unique 3D models” total: maps contain models, variants share geometry, and some ledger rows group multiple related props.

Scope: current production geometry in `engine/` and the four games, including Bululú minigames, gameplay props, embedded wardrobe options and map scenery. Individual meshes, geometry helpers, UI/SVG art, generated screenshots, dependency internals and historical deleted revisions are excluded. Catalog consumer labels identify games, not instance counts. Active uncataloged entries were traced to their placement sources; presence in source does not guarantee visibility from every camera. Legacy rows are retained explicitly instead of being presented as new content.

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
| Improve behavior | Deterministic offshore clouds and ambient perching/swimming routes | Shared environments | Make Studio pause/scrub match game motion across older scenery. |

## Available but not placed

These already exist. Their absence from a map is a placement gap, not a missing-model request. Waterfall rocks were incorrectly labeled preview-only; they are used in Chi Chi and the catalog label is now corrected.

| Studio name | ID | Source |
| --- | --- | --- |
| Defensa vial de montaña | mountain-guardrail | [mountain-props.js](../../Pana/engine/mountain-props.js) |
| Puente colgante de montaña | mountain-suspension-bridge | [mountain-props.js](../../Pana/engine/mountain-props.js) |
| Estatua gigante de capibara | capybara-statue | [landmarks.js](../../Pana/engine/landmarks.js) |
| Estatua del mango de oro | golden-mango-statue | [landmarks.js](../../Pana/engine/landmarks.js) |
| Arco de bienvenida Pana | welcome-arch | [landmarks.js](../../Pana/engine/landmarks.js) |
| Asta con bandera Pana | pana-flagpole | [landmarks.js](../../Pana/engine/landmarks.js) |
| Fuente de los capibaras | capybara-fountain | [landmarks.js](../../Pana/engine/landmarks.js) |
| Entrada del templo de piedra | temple-entrance | [jungle-props.js](../../Pana/engine/jungle-props.js) |
| Puente colgante de cuerdas | rope-bridge | [jungle-props.js](../../Pana/engine/jungle-props.js) |
| Puente de bambú | bamboo-bridge | [jungle-props.js](../../Pana/engine/jungle-props.js) |

## Active models missing from individual Studio previews

| Resource / family | Current location | Source | Finding |
| --- | --- | --- | --- |
| Wooden sign | Bululú board/minigames; Derrape sectors | [props.js](../../Pana/engine/props.js#L141) | Active shared factory; many text variants, one model family. |
| Watchtower | Bululú board; No te caigas | [props.js](../../Pana/engine/props.js#L188) | Thatch/zinc options; distinct from the new lifeguard tower. |
| Venezuelan flagpole | Bululú board; No te caigas; Selva | [props.js](../../Pana/engine/props.js#L220) | Active animated flag. Pana branded pedestal is a separate catalog entry. |
| Displaced rock | Bululú board/minigames; Selva | [props.js](../../Pana/engine/props.js#L251) | Shared seeded rock, also embedded inside other models. |
| Offshore lighthouse (older) | Bululú board | [island-scenery.js](../../Pana/engine/island-scenery.js#L13) | One tower with a rotating night beam. Not the Costa lighthouse used on the race island; preserve daylight behavior when replacing. |
| Offshore sailboat (older) | Bululú board | [island-scenery.js](../../Pana/engine/island-scenery.js#L41) | Four box-hull sailboats still bob offshore. Not the new peñero. |
| Golden mango landmark tree | Bululú board | [island-environment.js](../../Pana/engine/island-environment.js#L21) | Special large fruit tree; separate construction from flora.mangoTree. |
| Original plaza church | Escondidas; Cocina; Plaza circuit | [plaza.js](../../Pana/engine/plaza.js#L54) | Active small bell tower/chapel, distinct from colonialChurch. |
| Summit terminal | Páramo | [world-landmarks.js](../../Pana/games/derrape/public/tracks/world-landmarks.js#L5) | Upper/lower terminals; separate from the catalog heritage cable-car station. |
| Aerial cable system and cabins | Páramo | [world-landmarks.js](../../Pana/games/derrape/public/tracks/world-landmarks.js#L19) | Six moving cabins, two cable curves; parameterized scene assembly. |
| Cable support tower | Páramo | [world-landmarks.js](../../Pana/games/derrape/public/tracks/world-landmarks.js#L39) | Terrain-dependent support height. |
| Diving school | Chi Chi | [world-landmarks.js](../../Pana/games/derrape/public/tracks/world-landmarks.js#L46) | Facade, dive tanks and diver flag. |
| Coastal fort | Chi Chi | [world-landmarks.js](../../Pana/games/derrape/public/tracks/world-landmarks.js#L63) | Lookout landmark on the mountain coast. |
| Maracaibo-inspired bridge | Plaza circuit | [world-landmarks.js](../../Pana/games/derrape/public/tracks/world-landmarks.js#L75) | Full driving bridge; use its actual road deck when previewing. |
| Grandstand | Estadio | [world-landmarks.js](../../Pana/games/derrape/public/tracks/world-landmarks.js#L95) | Six stands with different dimensions/colors. |
| Canal villa | Plaza circuit | [world-landmarks.js](../../Pana/games/derrape/public/tracks/world-landmarks.js#L107) | Waterfront houses and balconies. |
| Small rowboat (older) | Selva; Llanos | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L423) | Two active river boats. Keep shallow-water footprint when upgrading. |
| Canal/dive-village boat | Plaza circuit; Chi Chi | [world-kit.js](../../Pana/games/derrape/public/tracks/world-kit.js#L97) | Cabin option; different builder from the coast peñero and island sailboats. |
| Faceted boulder | Páramo; Chi Chi; Desierto | [world-kit.js](../../Pana/games/derrape/public/tracks/world-kit.js#L107) | Instanced geological scatter, separate from props.rock. |
| Catch basket | Atrapa los mangos | [atrapa.js](../../Pana/games/bululu/public/minigames/atrapa.js#L16) | Held by players; needs a standalone preview adapter. |
| Coconut | Atrapa los mangos | [atrapa.js](../../Pana/games/bululu/public/minigames/atrapa.js#L28) | Falling hazard with three dark eyes. |
| Mango minigame tree (older) | Atrapa los mangos | [atrapa.js](../../Pana/games/bululu/public/minigames/atrapa.js#L37) | Old polygon canopy and random fruit placement. Modernize with shared flora while preserving catch lanes. |
| Board die | Bululú board | [board.js](../../Pana/games/bululu/public/board.js#L171) | Six face textures; game-driven roll animation. |
| Golden mango cart | Bululú board | [board.js](../../Pana/games/bululu/public/board.js#L199) | Cart, striped umbrella, chalkboard and reward beam. |
| Player token pedestal | Bululú board | [board.js](../../Pana/games/bululu/public/board.js#L495) | Colored base under shared character; not a new character sculpt. |
| Breakable supply crate | All eight Derrape races | [pickup-art.js](../../Pana/games/derrape/public/pickup-art.js#L11) | Gameplay crate is distinct from the Plaza disguise crate. |
| Collectible coin | All eight Derrape races | [pickup-art.js](../../Pana/games/derrape/public/pickup-art.js#L51) | Coin trails and pickups. |
| Mango peel | Derrape item use | [items.js](../../Pana/games/derrape/public/items.js#L47) | Three peel strips and seed; not the whole mango. |
| Kitchen sign | Cocina | [kitchen-props.js](../../Pana/engine/kitchen-props.js#L66) | Signs and flour-sack labels; text variants grouped. |
| Open pantry/fridge | Cocina | [scene.js](../../Pana/games/cocina/public/scene.js#L27) | Shelves with tomatoes, milk cartons and shared cheese. Assembly includes its food dressing. |
| Condiment bottles and flour sacks | Cocina | [scene.js](../../Pana/games/cocina/public/scene.js#L41) | Counter and floor dressing made inline; two prop types grouped as one set. |

## Scene assemblies, terrain, effects and embedded parts

| Resource / family | Current location | Source | Finding |
| --- | --- | --- | --- |
| Selva pyramid | Selva | [selva-world.js](../../Pana/games/derrape/public/tracks/selva-world.js#L52) | Stepped landmark outside the driving tunnel. |
| Road temple tunnel and portals | Selva | [selva-temple.js](../../Pana/games/derrape/public/tracks/selva-temple.js#L88) | Swept along the actual road; not the unused standalone temple entrance. |
| Selva plank crossing | Selva | [selva-world.js](../../Pana/games/derrape/public/tracks/selva-world.js#L144) | Road-warped planks, piers and flankBridge rails. Anchor spacing normalized by the audit. |
| Simple waterfall sheet | Selva | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L269) | Active older waterfall; separate from waterfallRocks in Chi Chi. |
| Pond and river wrappers | Selva | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L259) | waterPond/waterRibbon wrap the shared water surface. |
| Country grass tufts | Llanos; Desierto | [country-details.js](../../Pana/games/derrape/public/tracks/country-details.js#L4) | Instanced grass, absent from the 22 plant catalog entries. |
| Country entrance gantry | Llanos; Desierto | [country-details.js](../../Pana/games/derrape/public/tracks/country-details.js#L15) | Map-specific entrance text and width. |
| Country bridge crossings | Llanos; Desierto | [country-details.js](../../Pana/games/derrape/public/tracks/country-details.js#L24) | Road-conforming decks/rails; not standalone rope bridges. |
| Verge posts and dirt shoulders | Llanos; Desierto | [country-details.js](../../Pana/games/derrape/public/tracks/country-details.js#L39) | Route-generated posts, shoulders and tire ruts. |
| Llanos wetland landing | Llanos | [llanos-world.js](../../Pana/games/derrape/public/tracks/llanos-world.js#L103) | Dock planks and supports; capybaras now use shared wildlife. |
| Generic race edges | Multiple Derrape circuits | [world-kit.js](../../Pana/games/derrape/public/tracks/world-kit.js#L77) | Steel, timber and kerb variants, generated along the route. |
| Chevrons/start line/sector signs/ramps | Derrape | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L139) | Four route-generated furniture families; ramps depend on each track definition. |
| Race terrain and waterways | Derrape | [world-kit.js](../../Pana/games/derrape/public/tracks/world-kit.js#L34) | Terrain, sea and stream generators; each map supplies shape and palette. |
| Water surface system | Derrape | [water-surface.js](../../Pana/engine/water-surface.js#L18) | Ocean, river, canal and pool configurations; not separate species/objects. |
| Bululú tide wash | Bululú circuit | [bululu-tide.js](../../Pana/games/derrape/public/tracks/bululu-tide.js#L20) | Animated surface tied to tire grip and wetness. |
| Board island terrain | Bululú board | [island-terrain.js](../../Pana/engine/island-terrain.js#L97) | Shoreline, beach, hills, river and path cuts. |
| Forested islet/ridge | Bululú board | [island-landscape.js](../../Pana/engine/island-landscape.js#L40) | Seeded neighboring islands and distant ridges. |
| Tepui and waterfall | Bululú board | [island-landscape.js](../../Pana/engine/island-landscape.js#L115) | Three mesas; one waterfall/mist landmark. Not the Selva waterfall. |
| Drifting cloud bank | Bululú board | [island-scenery.js](../../Pana/engine/island-scenery.js#L167) | Sixteen cloud sprites; animation still accumulates dt and should gain deterministic scrubbing. |
| Island dock and village light strings | Bululú board | [island-environment.js](../../Pana/engine/island-environment.js#L163) | Placement-specific geometry; not separate library factories. |
| Race-island piers | Bululú circuit | [bululu.js](../../Pana/games/derrape/public/tracks/bululu.js#L85) | Inline harbor planks and pilings. |
| Plaza streets, gardens and mirador | Plaza circuit | [plaza-town.js](../../Pana/games/derrape/public/tracks/plaza-town.js#L30) | Street surfaces, block gardens, lookout terrace and stairs; shared houses/trees counted separately. |
| Plaza waterfront canals and docks | Plaza circuit | [plaza-waterfront.js](../../Pana/games/derrape/public/tracks/plaza-waterfront.js#L18) | Canal network and moorings around canalVilla. |
| Football pitch and goals | Estadio | [estadio.js](../../Pana/games/derrape/public/tracks/estadio.js#L21) | Pitch stripes, markings and two goal frames. |
| Pit garages | Estadio | [estadio.js](../../Pana/games/derrape/public/tracks/estadio.js#L44) | Eight inline garage blocks and numbered signs. |
| Floodlights and scoreboard | Estadio | [estadio.js](../../Pana/games/derrape/public/tracks/estadio.js#L54) | Two inline landmark families. |
| Basketball court and banners | Estadio | [estadio.js](../../Pana/games/derrape/public/tracks/estadio.js#L68) | Court and sponsor panels; shared hoops already cataloged. |
| Chi Chi retaining walls and river bridges | Chi Chi | [chichi-village.js](../../Pana/games/derrape/public/tracks/chichi-village.js#L41) | Bridge geometry follows road/river. Retaining walls in chichi.js. |
| Bululú board tiles, paths, stairs and pins | Bululú board | [board.js](../../Pana/games/bululu/public/board.js#L58) | Tile-kind texture variants, raised supports, fork paths and waypoint sprites. |
| Sunny minigame stage | Both Bululú minigames | [stage.js](../../Pana/games/bululu/public/minigames/stage.js#L14) | Sky, ground, clouds and shared landscape props. |
| Raft and spinning striped log | No te caigas | [caigas.js](../../Pana/games/bululu/public/minigames/caigas.js#L42) | Player platforms, floats, central post, rotating obstacle and sandbars. |
| Minigame wave surface | No te caigas | [caigas.js](../../Pana/games/bululu/public/minigames/caigas.js#L35) | Older deformed plane, separate from the shared water shader. |
| Boost pad | Derrape | [items.js](../../Pana/games/derrape/public/items.js#L71) | Animated ground marker, separate from collectible item models. |
| Puffs, debris and speech bubbles | Bululú; Derrape | [fx.js](../../Pana/engine/fx.js#L203) | Particle/sprite effects, not scenery inventory counts. |
| Crate fragment bursts | Derrape | [fragments.js](../../Pana/games/derrape/public/fragments.js#L6) | Gameplay fragments reused from crate art. |
| Steam, fire and order dressing | Cocina | [scene.js](../../Pana/games/cocina/public/scene.js#L65) | Cooking state effects; recipes also have raw/prepared/cooked/burned variants. |
| Thermal steam and water details | Chi Chi; shared fountains/waterfalls | [thermal-steam.js](../../Pana/engine/thermal-steam.js#L5) | Reusable steam, droplets and ripple systems; water details also in water-details.js. |
| Character accessories and expressions | All games; character editor | [avatar.js](../../Pana/engine/avatar.js#L23) | Eight non-empty hat options, three glasses options, five expression options and two non-empty extras. Some options share geometry/poses. Outfits are already cataloged; accessories and dizzy stars are embedded parts. |

## Older code with no current enabled placement

| Resource / family | Current location | Source | Finding |
| --- | --- | --- | --- |
| Old windmill | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L350) | Current Llanos uses ranch-props.waterWindmill. |
| Old arepa stand | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L380) | Current maps use streetFoodKiosk. |
| Generic dock | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L410) | Maps now build docks against their shore/deck. |
| Generic sailboat | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L435) | No production caller; internally uses rowboat, which remains active. |
| Generic plank/rope bridge | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L294) | Active crossings have road-specific decks or newer shared factories. |
| Distant mountain ring | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L454) | Current maps use their own terrain or island-landscape. |
| Old route landscape scatter | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L488) | Current worlds supply habitat-specific planting. |
| Tire-wall generator | Runtime hook only; current tracks disable walls | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L60) | Code is still wired conditionally; distinguish dormant configuration from dead code. |
| Fence-ring generator | Runtime hook only; no current track enables fence | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L96) | Do not remove without checking future track configuration. |

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

### Costa (9)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Peñero de pesca · fishing-boat | Bululú, Derrape | [coastal-props.js](../../Pana/engine/coastal-props.js) | fishingBoat |
| Faro costero · coastal-lighthouse | Derrape | [coastal-props.js](../../Pana/engine/coastal-props.js) | coastalLighthouse |
| Torre de salvavidas · lifeguard-tower | Bululú, Derrape | [coastal-props.js](../../Pana/engine/coastal-props.js) | lifeguardTower |
| Cancha de voleibol de playa · beach-volleyball | Derrape | [coastal-props.js](../../Pana/engine/coastal-props.js) | beachVolleyball |
| Ducha de playa · beach-shower | Bululú, Derrape | [coastal-props.js](../../Pana/engine/coastal-props.js) | beachShower |
| Puesto de salvavidas · rescue-ring-stand | Bululú, Derrape | [coastal-props.js](../../Pana/engine/coastal-props.js) | rescueRingStand |
| Secadero de redes · fishing-net-rack | Bululú, Derrape | [coastal-props.js](../../Pana/engine/coastal-props.js) | fishingNetRack |
| Cajas de pesca · fish-crates | Bululú, Derrape | [coastal-props.js](../../Pana/engine/coastal-props.js) | fishCrates |
| Boya de canal · channel-buoy | Bululú, Derrape | [coastal-props.js](../../Pana/engine/coastal-props.js) | channelBuoy |

### Desierto (10)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Cardón gigante · giant-cactus | Derrape | [desert-props.js](../../Pana/engine/desert-props.js) | giantCactus |
| Módulo de duna · sand-dune | Derrape | [desert-props.js](../../Pana/engine/desert-props.js) | sandDune |
| Arco de roca del desierto · desert-rock-arch | Derrape | [desert-props.js](../../Pana/engine/desert-props.js) | desertRockArch |
| Gasolinera abandonada · abandoned-gas-station | Derrape | [desert-props.js](../../Pana/engine/desert-props.js) | abandonedGasStation |
| Camioneta oxidada · rusted-pickup | Derrape | [desert-props.js](../../Pana/engine/desert-props.js) | rustedPickup |
| Pila de cauchos · roadside-tire-pile | Derrape | [desert-props.js](../../Pana/engine/desert-props.js) | roadsideTirePile |
| Aguja de roca del cañón · canyon-spire | Derrape | [desert-props.js](../../Pana/engine/desert-props.js) | canyonSpire |
| Carreta de madera rota · broken-wagon | Derrape | [desert-props.js](../../Pana/engine/desert-props.js) | brokenWagon |
| Señal de peligro del desierto · desert-warning-sign | Derrape | [desert-props.js](../../Pana/engine/desert-props.js) | desertWarningSign |
| Pozo viejo del desierto · desert-well | Derrape | [desert-props.js](../../Pana/engine/desert-props.js) | desertWell |

### Emblemas (9)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Estatua gigante de capibara · capybara-statue | Preview only | [landmarks.js](../../Pana/engine/landmarks.js) | capybaraStatue |
| Estatua del mango de oro · golden-mango-statue | Preview only | [landmarks.js](../../Pana/engine/landmarks.js) | goldenMangoStatue |
| Fuente de Plaza Pana · plaza-fountain | Escondidas, Cocina, Derrape | [plaza.js](../../Pana/engine/plaza.js) | plazaFountain |
| Arco de bienvenida Pana · welcome-arch | Preview only | [landmarks.js](../../Pana/engine/landmarks.js) | welcomeArch |
| Topiaria de capibara · capybara-topiary | Escondidas, Cocina, Derrape | [landmarks.js](../../Pana/engine/landmarks.js) | capybaraTopiary |
| Asta con bandera Pana · pana-flagpole | Preview only | [landmarks.js](../../Pana/engine/landmarks.js) | panaFlagpole |
| Monumento de la Copa Pana · trophy-monument | Derrape | [landmarks.js](../../Pana/engine/landmarks.js) | trophyMonument |
| Fuente de los capibaras · capybara-fountain | Preview only | [landmarks.js](../../Pana/engine/landmarks.js) | capybaraFountain |
| Kiosco de recuerdos Pana · souvenir-kiosk | Derrape | [landmarks.js](../../Pana/engine/landmarks.js) | souvenirKiosk |

### Fauna (10)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Guacamaya roja · scarlet-macaw | Derrape | [wildlife.js](../../Pana/engine/wildlife.js) | scarletMacaw |
| Corocora roja · scarlet-ibis | Derrape | [wildlife.js](../../Pana/engine/wildlife.js) | scarletIbis |
| Zamuro planeador · soaring-vulture | Derrape | [wildlife.js](../../Pana/engine/wildlife.js) | soaringVulture |
| Chigüire · wild-capybara | Derrape | [wildlife.js](../../Pana/engine/wildlife.js) | wildCapybara |
| Caballo llanero · llanero-horse | Derrape | [farm-animals.js](../../Pana/engine/farm-animals.js) | llaneroHorse |
| Gallina de patio · yard-chicken | Derrape | [farm-animals.js](../../Pana/engine/farm-animals.js) | yardChicken |
| Vaca del hato · hato-cow | Derrape | [farm-animals.js](../../Pana/engine/farm-animals.js) | hatoCow |
| Pez de arrecife · reef-fish | Bululú, Derrape | [reef-fish.js](../../Pana/engine/reef-fish.js) | reefFish |
| Cardumen costero · reef-fish-school | Bululú, Derrape | [reef-fish.js](../../Pana/engine/reef-fish.js) | reefFishSchool |
| Cangrejo de playa · beach-crab | Bululú, Derrape | [coastal-props.js](../../Pana/engine/coastal-props.js) | beachCrab |

### Llanos (10)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Casa de hato llanero · ranch-house | Derrape | [ranch-props.js](../../Pana/engine/ranch-props.js) | llaneroRanchHouse |
| Portón de corral · corral-gate | Derrape | [ranch-props.js](../../Pana/engine/ranch-props.js) | corralGate |
| Paca de heno · hay-bale | Derrape | [ranch-props.js](../../Pana/engine/ranch-props.js) | hayBale |
| Molino de agua · water-windmill | Derrape | [ranch-props.js](../../Pana/engine/ranch-props.js) | waterWindmill |
| Caballeriza · horse-stable | Derrape | [ranch-props.js](../../Pana/engine/ranch-props.js) | horseStable |
| Comedero de ganado · feeding-trough | Derrape | [ranch-props.js](../../Pana/engine/ranch-props.js) | feedingTrough |
| Cerca de hato · ranch-fence | Derrape | [ranch-props.js](../../Pana/engine/ranch-props.js) | ranchFence |
| Tractor viejo · old-tractor | Derrape | [ranch-props.js](../../Pana/engine/ranch-props.js) | oldTractor |
| Módulo de charco de barro · mud-puddle | Derrape | [ranch-props.js](../../Pana/engine/ranch-props.js) | mudPuddle |
| Torre de agua del hato · ranch-water-tower | Derrape | [ranch-props.js](../../Pana/engine/ranch-props.js) | ranchWaterTower |

### Mapas (11)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
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

### Objetos (27)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Barril · barrel | Escondidas, Cocina, Derrape | [plaza-props.js](../../Pana/engine/plaza-props.js) | barrel |
| Caja · crate | Escondidas, Cocina, Derrape | [plaza-props.js](../../Pana/engine/plaza-props.js) | crate |
| Cava · cooler | Escondidas, Cocina, Derrape | [plaza-props.js](../../Pana/engine/plaza-props.js) | cooler |
| Mata · planter | Escondidas, Cocina, Derrape | [plaza-props.js](../../Pana/engine/plaza-props.js) | planter |
| Banco · bench | Escondidas, Cocina, Derrape | [plaza-props.js](../../Pana/engine/plaza-props.js) | bench |
| Puesto de mercado · market-stall | Escondidas, Derrape | [plaza-props.js](../../Pana/engine/plaza-props.js) | marketStall |
| Farol de plaza · street-lamp | Escondidas, Cocina, Derrape | [plaza-props.js](../../Pana/engine/plaza-props.js) | streetLamp |
| Casa del pueblo · house | Escondidas, Cocina, Derrape | [plaza.js](../../Pana/engine/plaza.js) | house |
| Mango · mango | Bululú, Derrape | [props.js](../../Pana/engine/props.js) | makeMango |
| Mango dorado · gold-mango | Bululú, Derrape | [props.js](../../Pana/engine/props.js) | makeMango |
| Casita de isla · casita | Bululú | [flora.js](../../Pana/engine/flora.js) | casita |
| Sombrilla de playa · beachShade | Bululú, Derrape | [beach-props.js](../../Pana/engine/beach-props.js) | beachShade |
| Rancho de playa · beachHut | Bululú, Derrape | [beach-props.js](../../Pana/engine/beach-props.js) | beachHut |
| Tronco de playa · driftwood | Bululú, Derrape | [beach-props.js](../../Pana/engine/beach-props.js) | driftwood |
| Arepa · food-arepa | Cocina | [kitchen-props.js](../../Pana/engine/kitchen-props.js) | food |
| Cachapa · food-cachapa | Cocina | [kitchen-props.js](../../Pana/engine/kitchen-props.js) | food |
| Tequeños · food-tequenos | Cocina | [kitchen-props.js](../../Pana/engine/kitchen-props.js) | food |
| Empanada · food-empanada | Cocina | [kitchen-props.js](../../Pana/engine/kitchen-props.js) | food |
| Mazorca · corn | Cocina | [kitchen-props.js](../../Pana/engine/kitchen-props.js) | corn |
| Queso · cheese | Cocina | [kitchen-props.js](../../Pana/engine/kitchen-props.js) | cheese |
| Fregadero · sink | Cocina | [kitchen-props.js](../../Pana/engine/kitchen-props.js) | sink |
| Estación · Arepa · station-supply | Cocina | [kitchen-props.js](../../Pana/engine/kitchen-props.js) | kitchenStation |
| Estación · Preparar · station-prep | Cocina | [kitchen-props.js](../../Pana/engine/kitchen-props.js) | kitchenStation |
| Estación · Cocinar · station-stove | Cocina | [kitchen-props.js](../../Pana/engine/kitchen-props.js) | kitchenStation |
| Estación · Pasar plato · station-counter | Cocina | [kitchen-props.js](../../Pana/engine/kitchen-props.js) | kitchenStation |
| Estación · Servir pedido · station-serve | Cocina | [kitchen-props.js](../../Pana/engine/kitchen-props.js) | kitchenStation |
| Estación · Descartar · station-trash | Cocina | [kitchen-props.js](../../Pana/engine/kitchen-props.js) | kitchenStation |

### Personajes (3)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Pana original · pana | Bululú, Derrape, Escondidas, Cocina | [character.js](../../Pana/engine/character.js) | buildCharacter |
| Pana cocinero · pana-chef | Cocina | [character.js](../../Pana/engine/character.js) | buildCharacter |
| Pana conductor · pana-driver | Derrape | [character.js](../../Pana/engine/character.js) | buildCharacter |

### Pueblo (10)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Casa colonial colorida · colonial-house | Derrape | [pueblo-props.js](../../Pana/engine/pueblo-props.js) | colonialHouse |
| Bodega de esquina · corner-bodega | Derrape | [pueblo-props.js](../../Pana/engine/pueblo-props.js) | cornerBodega |
| Iglesia colonial pequeña · colonial-church | Derrape | [pueblo-props.js](../../Pana/engine/pueblo-props.js) | colonialChurch |
| Parada de autobús · bus-stop-shelter | Derrape | [pueblo-props.js](../../Pana/engine/pueblo-props.js) | busStopShelter |
| Puesto de arepas · street-food-kiosk | Cocina, Derrape | [pueblo-props.js](../../Pana/engine/pueblo-props.js) | streetFoodKiosk |
| Torre del reloj · plaza-clock-tower | Escondidas, Cocina, Derrape | [pueblo-props.js](../../Pana/engine/pueblo-props.js) | plazaClockTower |
| Aro de baloncesto · basketball-hoop | Derrape | [pueblo-props.js](../../Pana/engine/pueblo-props.js) | basketballHoop |
| Tanque de agua de azotea · rooftop-water-tank | Derrape | [pueblo-props.js](../../Pana/engine/pueblo-props.js) | rooftopWaterTank |
| Farol de calle · streetlight-pole | Escondidas, Cocina, Derrape | [pueblo-props.js](../../Pana/engine/pueblo-props.js) | streetlightPole |
| Banco de parque · park-bench | Escondidas, Cocina, Derrape | [pueblo-props.js](../../Pana/engine/pueblo-props.js) | parkBench |

### Páramo (8)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Cabaña de montaña · mountain-cabin | Derrape | [mountain-props.js](../../Pana/engine/mountain-props.js) | mountainCabin |
| Estación de teleférico · cable-car-station | Derrape | [mountain-props.js](../../Pana/engine/mountain-props.js) | cableCarStation |
| Módulo de acantilado rocoso · rocky-cliff | Derrape | [mountain-props.js](../../Pana/engine/mountain-props.js) | rockyCliff |
| Defensa vial de montaña · mountain-guardrail | Preview only | [mountain-props.js](../../Pana/engine/mountain-props.js) | mountainGuardrail |
| Mirador de piedra · stone-lookout | Derrape | [mountain-props.js](../../Pana/engine/mountain-props.js) | stoneLookout |
| Carpa de montaña · mountain-tent | Derrape | [mountain-props.js](../../Pana/engine/mountain-props.js) | mountainTent |
| Puente colgante de montaña · mountain-suspension-bridge | Preview only | [mountain-props.js](../../Pana/engine/mountain-props.js) | mountainSuspensionBridge |
| Señal de senderos · mountain-signpost | Derrape | [mountain-props.js](../../Pana/engine/mountain-props.js) | mountainSignpost |

### Selva (7)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Entrada del templo de piedra · temple-entrance | Preview only | [jungle-props.js](../../Pana/engine/jungle-props.js) | templeEntrance |
| Puente colgante de cuerdas · rope-bridge | Preview only | [jungle-props.js](../../Pana/engine/jungle-props.js) | ropeBridge |
| Cascada entre rocas · waterfall-rocks | Derrape | [jungle-props.js](../../Pana/engine/jungle-props.js) | waterfallRocks |
| Arco de piedra con enredaderas · vine-arch | Derrape | [jungle-props.js](../../Pana/engine/jungle-props.js) | vineArch |
| Puente de bambú · bamboo-bridge | Preview only | [jungle-props.js](../../Pana/engine/jungle-props.js) | bambooBridge |
| Tótem de piedra antiguo · stone-totem | Derrape | [jungle-props.js](../../Pana/engine/jungle-props.js) | stoneTotem |
| Tronco hueco · hollow-log | Derrape | [jungle-props.js](../../Pana/engine/jungle-props.js) | hollowLog |

### Termales (5)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Poza termal · hot-spring-pool | Derrape | [thermal-props.js](../../Pana/engine/thermal-props.js) | hotSpringPool |
| Fumarola · steam-vent | Derrape | [thermal-props.js](../../Pana/engine/thermal-props.js) | steamVent |
| Terrazas minerales · mineral-terraces | Derrape | [thermal-props.js](../../Pana/engine/thermal-props.js) | mineralTerraces |
| Casa de las termas · thermal-bathhouse | Derrape | [thermal-props.js](../../Pana/engine/thermal-props.js) | thermalBathhouse |
| Mirador de Chi Chi · thermal-lookout | Derrape | [thermal-props.js](../../Pana/engine/thermal-props.js) | thermalLookout |

### Vegetación (22)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Palmera · palm | Bululú, Derrape, Escondidas, Cocina | [flora.js](../../Pana/engine/flora.js) | palm |
| Árbol de mango · mangoTree | Bululú, Derrape, Escondidas, Cocina | [flora.js](../../Pana/engine/flora.js) | mangoTree |
| Ceiba · ceiba | Bululú, Derrape | [flora.js](../../Pana/engine/flora.js) | ceiba |
| Pino · pine | Bululú | [flora.js](../../Pana/engine/flora.js) | pine |
| Mata de cambur · banana | Bululú, Derrape | [flora.js](../../Pana/engine/flora.js) | banana |
| Arbusto · bush | Bululú, Derrape, Escondidas, Cocina | [flora.js](../../Pana/engine/flora.js) | bush |
| Araguaney · araguaney | Derrape | [flora.js](../../Pana/engine/flora.js) | araguaney |
| Bambú · bamboo | Derrape | [flora.js](../../Pana/engine/flora.js) | bamboo |
| Helecho · fern | Derrape | [flora.js](../../Pana/engine/flora.js) | fern |
| Monstera · monstera | Derrape | [flora.js](../../Pana/engine/flora.js) | monstera |
| Heliconia · heliconia | Derrape | [flora.js](../../Pana/engine/flora.js) | heliconia |
| Cardón · cactus | Derrape | [flora.js](../../Pana/engine/flora.js) | cactus |
| Mangle · mangrove | Derrape | [flora.js](../../Pana/engine/flora.js) | mangrove |
| Lechosa · papaya | Bululú, Derrape | [flora.js](../../Pana/engine/flora.js) | papaya |
| Agave · agave | Derrape | [flora.js](../../Pana/engine/flora.js) | agave |
| Nenúfar · waterLily | Derrape | [flora.js](../../Pana/engine/flora.js) | waterLily |
| Cayena · hibiscus | Bululú, Derrape | [flora.js](../../Pana/engine/flora.js) | hibiscus |
| Juncos · reeds | Derrape | [flora.js](../../Pana/engine/flora.js) | reeds |
| Árbol gigante de la selva · jungleGiant | Derrape | [flora.js](../../Pana/engine/flora.js) | jungleGiant |
| Arbusto tropical grande · tropicalBush | Derrape | [flora.js](../../Pana/engine/flora.js) | tropicalBush |
| Frailejón · frailejon | Derrape | [flora.js](../../Pana/engine/flora.js) | frailejon |
| Pino de montaña · mountainPine | Derrape | [flora.js](../../Pana/engine/flora.js) | mountainPine |

### Vehículos (8)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| El Chamo · car-chamo | Derrape | [cars.js](../../Pana/games/derrape/public/cars.js) | CARS.find(c => c.id === 'chamo').build |
| La Lancha · car-lancha | Derrape | [cars.js](../../Pana/games/derrape/public/cars.js) | CARS.find(c => c.id === 'lancha').build |
| El Machito · car-machito | Derrape | [cars.js](../../Pana/games/derrape/public/cars.js) | CARS.find(c => c.id === 'machito').build |
| La Bala · car-bala | Derrape | [cars.js](../../Pana/games/derrape/public/cars.js) | CARS.find(c => c.id === 'bala').build |
| El Toro · car-toro | Derrape | [cars.js](../../Pana/games/derrape/public/cars.js) | CARS.find(c => c.id === 'toro').build |
| La Familiar · car-familiar | Derrape | [cars.js](../../Pana/games/derrape/public/cars.js) | CARS.find(c => c.id === 'familiar').build |
| La Rumbera · car-rumbera | Derrape | [cars.js](../../Pana/games/derrape/public/cars.js) | CARS.find(c => c.id === 'rumbera').build |
| El Montañero · car-montanero | Derrape | [cars.js](../../Pana/games/derrape/public/cars.js) | CARS.find(c => c.id === 'montanero').build |

### Vestuario (5)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Franela · outfit-shirt | Bululú, Derrape, Escondidas, Cocina | [model.js](../../Pana/engine/soft-character/model.js) | buildSoftCharacter |
| Delantal y gorro · outfit-chef | Bululú, Derrape, Escondidas, Cocina | [model.js](../../Pana/engine/soft-character/model.js) | buildSoftCharacter |
| Suéter y gorra · outfit-hoodie | Bululú, Derrape, Escondidas, Cocina | [model.js](../../Pana/engine/soft-character/model.js) | buildSoftCharacter |
| Camisa tropical · outfit-tropical | Bululú, Derrape, Escondidas, Cocina | [model.js](../../Pana/engine/soft-character/model.js) | buildSoftCharacter |
| Conjunto deportivo · outfit-sport | Bululú, Derrape, Escondidas, Cocina | [model.js](../../Pana/engine/soft-character/model.js) | buildSoftCharacter |

## Keep this inventory current

Run `node Pana/scripts/audit-inventory.browser.js` with `PANA_PLAYWRIGHT_PATH` pointing to an available Playwright package and the local server running. The script exports this Markdown report and `model-inventory.json`, verifies every source anchor, and reads all catalog entries. Review `Pana/scripts/inventory-notes.js` when moving/removing geometry: anchor checks catch stale locations but do not automatically discover new inline models or prove call-graph reachability.

Run `node Pana/engine/tests/wildlife.browser.js` for geometry ownership, finite bounds, timeline rewind, flight heading, all seven birds/four capybaras, terrain/road clearance and native-map screenshots. `art/studio/wildlife/` holds the local proof. The audit does not delete dormant factories or silently replace older map assemblies.
