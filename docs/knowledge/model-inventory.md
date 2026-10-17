# Pana — current model inventory

Audited 2026-10-17. Generated from the real Studio registry plus a reviewed source ledger.

**257 Studio resources**, including **18 Fauna entries**, **27 vegetation entries**, **14 vehicles** and **24 maps**. **19 resources are preview-only.** The separate ledger identifies **31 active uncataloged model families**, **46 scene/effect families** and **9 dormant factories/hooks**. These numbers must not be added into a “unique 3D models” total: maps contain models, variants share geometry, and some ledger rows group multiple related props.

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
| Mata de hojas anchas | garden-rosette | [garden-rosette.js](../../Pana/engine/models/vegetation/garden-rosette.js) |
| Enredadera colgante | trailing-vine | [trailing-vine.js](../../Pana/engine/models/vegetation/trailing-vine.js) |
| Trinitaria | trinitaria | [trinitaria.js](../../Pana/engine/models/vegetation/trinitaria.js) |
| Defensa vial de montaña | mountain-guardrail | [mountain.js](../../Pana/engine/models/props/mountain.js) |
| Puente colgante de montaña | mountain-suspension-bridge | [mountain.js](../../Pana/engine/models/props/mountain.js) |
| Estatua gigante de capibara | capybara-statue | [monuments.js](../../Pana/engine/models/props/monuments.js) |
| Estatua del mango de oro | golden-mango-statue | [monuments.js](../../Pana/engine/models/props/monuments.js) |
| Arco de bienvenida Pana | welcome-arch | [monuments.js](../../Pana/engine/models/props/monuments.js) |
| Asta con bandera Pana | pana-flagpole | [monuments.js](../../Pana/engine/models/props/monuments.js) |
| Fuente de los capibaras | capybara-fountain | [monuments.js](../../Pana/engine/models/props/monuments.js) |
| Puente de bambú | bamboo-bridge | [jungle.js](../../Pana/engine/models/props/jungle.js) |
| Casa amarilla | colonial-yellow | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) |
| Casa azul con balcón | colonial-balcony | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) |
| Casa de la trinitaria | colonial-crest | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) |
| Casa larga del pueblo | colonial-long | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) |
| Casa de la esquina | colonial-corner | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) |
| Casa del portal | colonial-porch | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) |
| Cincuenta casas del pueblo | colonial-collection | [colonial-house-collection.js](../../Pana/engine/colonial-house-collection.js) |
| Calle de las flores | colonial-street | [colonial-street.js](../../Pana/engine/colonial-street.js) |

## Active models missing from individual Studio previews

| Resource / family | Current location | Source | Finding |
| --- | --- | --- | --- |
| Wooden sign | Bululú board/minigames; Derrape sectors | [wood-sign.js](../../Pana/engine/models/props/wood-sign.js#L4) | Active shared factory; many text variants, one model family. |
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
| Small rowboat (older) | Selva; Llanos | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L432) | Two active river boats. Keep shallow-water footprint when upgrading. |
| Canal/dive-village boat | Plaza circuit; Chi Chi | [world-kit.js](../../Pana/games/derrape/public/tracks/world-kit.js#L96) | Cabin option; different builder from the coast peñero and island sailboats. |
| Faceted boulder | Páramo; Chi Chi; Desierto | [world-kit.js](../../Pana/games/derrape/public/tracks/world-kit.js#L106) | Instanced geological scatter, separate from props.rock. |
| Catch basket | Atrapa los mangos | [atrapa.js](../../Pana/games/bululu/public/minigames/atrapa.js#L19) | Held by players; needs a standalone preview adapter. |
| Coconut | Atrapa los mangos | [atrapa.js](../../Pana/games/bululu/public/minigames/atrapa.js#L31) | Falling hazard with three dark eyes. |
| Mango minigame tree (older) | Atrapa los mangos | [atrapa.js](../../Pana/games/bululu/public/minigames/atrapa.js#L40) | Old polygon canopy and random fruit placement. Modernize with shared flora while preserving catch lanes. |
| Board die | Bululú board | [board.js](../../Pana/games/bululu/public/board.js#L173) | Six face textures; game-driven roll animation. |
| Golden mango cart | Bululú board | [board.js](../../Pana/games/bululu/public/board.js#L201) | Cart, striped umbrella, chalkboard and reward beam. |
| Player token pedestal | Bululú board | [board.js](../../Pana/games/bululu/public/board.js#L515) | Colored base under shared character; not a new character sculpt. |
| Breakable supply crate | All eight Derrape races | [pickup-art.js](../../Pana/games/derrape/public/pickup-art.js#L11) | Gameplay crate is distinct from the Plaza disguise crate. |
| Collectible coin | All eight Derrape races | [pickup-art.js](../../Pana/games/derrape/public/pickup-art.js#L51) | Coin trails and pickups. |
| Mango peel | Derrape item use | [items.js](../../Pana/games/derrape/public/items.js#L76) | Three peel strips and seed; not the whole mango. |
| Kitchen sign | Cocina | [kitchen.js](../../Pana/engine/models/props/kitchen.js#L66) | Signs and flour-sack labels; text variants grouped. |
| Open pantry/fridge | Cocina | [scene.js](../../Pana/games/cocina/public/scene.js#L27) | Shelves with tomatoes, milk cartons and shared cheese. Assembly includes its food dressing. |
| Condiment bottles and flour sacks | Cocina | [scene.js](../../Pana/games/cocina/public/scene.js#L41) | Counter and floor dressing made inline; two prop types grouped as one set. |

## Scene assemblies, terrain, effects and embedded parts

| Resource / family | Current location | Source | Finding |
| --- | --- | --- | --- |
| Reliquia mine and temple | Reliquia; Studio map | [scene.js](../../Pana/games/reliquia/public/scene.js#L22) | Authored walkable mine, swept shared bridge, timed winches, crypt, relic chamber and return tunnel. Five expedition models are cataloged independently. |
| Mounted horse and riding tack | Galope, Bululú coleo; hub tile | [llanero-rider.js](../../Pana/engine/models/fauna/farm/llanero-rider.js#L9) | Shared horse and saved pana with game-local saddle, stirrups and reins; not a duplicate animal sculpt. |
| Horse course and distinct wetlands | Galope; Studio map | [scene.js](../../Pana/games/galope/public/scene.js#L20) | Shared terrain/water grid, clipped riding trail, irregular lagoon with island, winding estero, jump logs, start gantry and trail markers. Shared models counted separately. |
| Galope living Llanos landscape | Galope; Studio map | [landscape.js](../../Pana/games/galope/public/landscape.js#L15) | Hato gathering places, bank-connected canoe landing, moriche groves, green/dry grass, shore-only reeds and continuous far plain. All 13 new models have individual Studio previews. |
| Selva pyramid | Selva | [selva-world.js](../../Pana/games/derrape/public/tracks/selva-world.js#L55) | Stepped landmark outside the driving tunnel. |
| Road temple tunnel and portals | Selva | [selva-temple.js](../../Pana/games/derrape/public/tracks/selva-temple.js#L88) | Swept along the actual road; not the unused standalone temple entrance. |
| Selva plank crossing | Selva | [selva-world.js](../../Pana/games/derrape/public/tracks/selva-world.js#L149) | Road-warped planks, piers and flankBridge rails. Anchor spacing normalized by the audit. |
| Simple waterfall sheet | Selva | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L278) | Active older waterfall; separate from waterfallRocks in Chi Chi. |
| Pond and river wrappers | Selva | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L268) | waterPond/waterRibbon wrap the shared water surface. |
| Country grass tufts | Llanos; Desierto | [country-details.js](../../Pana/games/derrape/public/tracks/country-details.js#L4) | Instanced grass, absent from the 22 plant catalog entries. |
| Country entrance gantry | Llanos; Desierto | [country-details.js](../../Pana/games/derrape/public/tracks/country-details.js#L15) | Map-specific entrance text and width. |
| Country bridge crossings | Llanos; Desierto | [country-details.js](../../Pana/games/derrape/public/tracks/country-details.js#L24) | Road-conforming decks/rails; not standalone rope bridges. |
| Verge posts and dirt shoulders | Llanos; Desierto | [country-details.js](../../Pana/games/derrape/public/tracks/country-details.js#L39) | Route-generated posts, shoulders and tire ruts. |
| Llanos wetland landing | Llanos | [llanos-world.js](../../Pana/games/derrape/public/tracks/llanos-world.js#L117) | Dock planks and supports; capybaras now use shared wildlife. |
| Generic race edges | Multiple Derrape circuits | [world-kit.js](../../Pana/games/derrape/public/tracks/world-kit.js#L75) | Steel, timber and kerb variants, generated along the route. |
| Chevrons/start line/sector signs/ramps | Derrape | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L144) | Four route-generated furniture families; ramps depend on each track definition. |
| Race terrain and waterways | Derrape | [world-kit.js](../../Pana/games/derrape/public/tracks/world-kit.js#L25) | Terrain, sea and stream generators; each map supplies shape and palette. |
| Water surface system | Derrape | [water-surface.js](../../Pana/engine/models/effects/water-surface.js#L33) | Ocean, river, canal and pool configurations; not separate species/objects. |
| Bululú tide wash | Bululú circuit | [bululu-tide.js](../../Pana/games/derrape/public/tracks/bululu-tide.js#L20) | Animated surface tied to tire grip and wetness. |
| Board island terrain | Bululú board | [island-terrain.js](../../Pana/engine/island-terrain.js#L97) | Shoreline, beach, hills, river and path cuts. |
| Forested islet/ridge | Bululú board | [island-landscape.js](../../Pana/engine/island-landscape.js#L43) | Seeded neighboring islands and distant ridges. |
| Tepui and waterfall | Bululú board | [island-landscape.js](../../Pana/engine/island-landscape.js#L83) | Three mesas; one waterfall/mist landmark. Not the Selva waterfall. |
| Living sky and cloud layers | Derrape; Galope; Escondidas; Cocina; Bululú and minigames; Studio tours | [sky.js](../../Pana/engine/sky.js#L5) | One procedural sky draw, seeded cumulus and wisps, absolute-time wind and day/night tint. Scene-owned, outside scenery bounds. |
| Island dock and village light strings | Bululú board | [island-environment.js](../../Pana/engine/island-environment.js#L194) | Placement-specific geometry; not separate library factories. |
| Race-island piers | Bululú circuit | [bululu.js](../../Pana/games/derrape/public/tracks/bululu.js#L98) | Inline harbor planks and pilings. |
| Plaza streets, gardens and mirador | Plaza circuit | [plaza-town.js](../../Pana/games/derrape/public/tracks/plaza-town.js#L43) | Street surfaces, block gardens, lookout terrace and stairs; shared houses/trees counted separately. |
| Plaza waterfront canals and docks | Plaza circuit | [plaza-waterfront.js](../../Pana/games/derrape/public/tracks/plaza-waterfront.js#L23) | Canal network and moorings around canalVilla. |
| Continuous circuit surroundings | All eight Derrape races | [world-horizon.js](../../Pana/games/derrape/public/tracks/world-horizon.js#L14) | Exact grid-edge joins to coarser outer terrain; coastal water keeps its detailed near grid and gains a far apron. |
| Plaza outer neighborhoods | Plaza circuit | [plaza-outskirts.js](../../Pana/games/derrape/public/tracks/plaza-outskirts.js#L10) | Connected outer lanes, 51 additional houses, 26 planted courtyards and road-safe groves. Reuses existing house and plant factories. |
| Llanos pastures and gallery woodland | Llanos | [llanos-landscape.js](../../Pana/games/derrape/public/tracks/llanos-landscape.js#L9) | Four pastures, repeated ranch fences, harvest bales, morichal palms and distant ceiba groves. Existing animals retain their space. |
| Stadium venue grounds | Estadio | [stadium-grounds.js](../../Pana/games/derrape/public/tracks/stadium-grounds.js#L10) | Entrance, perimeter, concourse, planted parking and infields. Parked copies reuse real garage vehicles with no driver. |
| Football pitch and goals | Estadio | [estadio.js](../../Pana/games/derrape/public/tracks/estadio.js#L25) | Pitch stripes, markings and two goal frames. |
| Pit garages | Estadio | [estadio.js](../../Pana/games/derrape/public/tracks/estadio.js#L48) | Eight inline garage blocks and numbered signs. |
| Floodlights and scoreboard | Estadio | [estadio.js](../../Pana/games/derrape/public/tracks/estadio.js#L66) | Two inline landmark families. |
| Basketball court and banners | Estadio | [estadio.js](../../Pana/games/derrape/public/tracks/estadio.js#L80) | Court and sponsor panels; shared hoops already cataloged. |
| Chi Chi retaining walls and river bridges | Chi Chi | [chichi-village.js](../../Pana/games/derrape/public/tracks/chichi-village.js#L41) | Bridge geometry follows road/river. Retaining walls in chichi.js. |
| Bululú board tiles, paths, stairs and pins | Bululú board | [board.js](../../Pana/games/bululu/public/board.js#L60) | Tile-kind texture variants, raised supports, fork paths and waypoint sprites. |
| Sunny minigame stage | Both Bululú minigames | [stage.js](../../Pana/games/bululu/public/minigames/stage.js#L18) | Sky, ground, clouds and shared landscape props. |
| Raft and spinning striped log | No te caigas | [caigas.js](../../Pana/games/bululu/public/minigames/caigas.js#L46) | Player platforms, floats, central post, rotating obstacle and sandbars. |
| Minigame wave surface | No te caigas | [caigas.js](../../Pana/games/bululu/public/minigames/caigas.js#L39) | Older deformed plane, separate from the shared water shader. |
| Boost pad | Derrape | [items.js](../../Pana/games/derrape/public/items.js#L100) | Animated ground marker, separate from collectible item models. |
| Puffs, debris and speech bubbles | Bululú; Derrape | [fx.js](../../Pana/engine/fx.js#L286) | Particle/sprite effects, not scenery inventory counts. |
| Crate fragment bursts | Derrape | [fragments.js](../../Pana/games/derrape/public/fragments.js#L6) | Gameplay fragments reused from crate art. |
| Steam, fire and order dressing | Cocina | [scene.js](../../Pana/games/cocina/public/scene.js#L65) | Cooking state effects; recipes also have raw/prepared/cooked/burned variants. |
| Thermal steam and water details | Chi Chi; shared fountains/waterfalls | [thermal-steam.js](../../Pana/engine/models/effects/thermal-steam.js#L5) | Reusable steam, droplets and ripple systems; water details also in water-details.js. |
| Character accessories and expressions | All games; character editor | [avatar.js](../../Pana/engine/avatar.js#L23) | Eight non-empty hat options, three glasses options, five expression options and two non-empty extras. Some options share geometry/poses. Outfits are already cataloged; accessories and dizzy stars are embedded parts. |

## Older code with no current enabled placement

| Resource / family | Current location | Source | Finding |
| --- | --- | --- | --- |
| Old windmill | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L359) | Current Llanos uses ranch-props.waterWindmill. |
| Old arepa stand | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L389) | Current maps use streetFoodKiosk. |
| Generic dock | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L419) | Maps now build docks against their shore/deck. |
| Generic sailboat | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L444) | No production caller; internally uses rowboat, which remains active. |
| Generic plank/rope bridge | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L303) | Active crossings have road-specific decks or newer shared factories. |
| Distant mountain ring | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L463) | Current maps use their own terrain or island-landscape. |
| Old route landscape scatter | No current production callsite | [track-kit.js](../../Pana/games/derrape/public/track-kit.js#L507) | Current worlds supply habitat-specific planting. |
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

### Costa (18)

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
| Montón de sal · salt-pile | Derrape | [saltworks.js](../../Pana/engine/models/props/saltworks.js) | saltPile |
| Compuerta salinera · sluice-gate | Derrape | [saltworks.js](../../Pana/engine/models/props/saltworks.js) | sluiceGate |
| Patio de cosecha de sal · salt-harvester | Derrape | [salt-harvester.js](../../Pana/engine/models/props/salt-harvester.js) | saltHarvester |
| Astillero de peñeros · boat-repair-yard | Derrape | [boat-yard.js](../../Pana/engine/models/props/boat-yard.js) | boatRepairYard |
| Lonja de pescado · fish-auction-canopy | Derrape | [fish-auction-canopy.js](../../Pana/engine/models/props/fish-auction-canopy.js) | fishAuctionCanopy |
| Pasarela salinera · salt-boardwalk | Derrape | [salt-boardwalk.js](../../Pana/engine/models/props/salt-boardwalk.js) | saltBoardwalk |
| Baliza de navegación · navigation-beacon | Derrape | [navigation-beacon.js](../../Pana/engine/models/props/navigation-beacon.js) | navigationBeacon |
| Estación de bombeo · water-pump-station | Derrape | [water-pump-station.js](../../Pana/engine/models/props/water-pump-station.js) | waterPumpStation |

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

### Fauna (18)

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

### Mapas (24)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Cincuenta casas del pueblo · colonial-collection | Preview only | [colonial-house-collection.js](../../Pana/engine/colonial-house-collection.js) | createColonialHouseCollection |
| Calle de las flores · colonial-street | Preview only | [colonial-street.js](../../Pana/engine/colonial-street.js) | createColonialStreet |
| Puerto Coco · arena-puerto | Escondidas, ¡Pintura!, Billar, Caída | [arenas.js](../../Pana/engine/arenas.js) | createArenaEnvironment |
| Hato del Sol · arena-hato | Escondidas, ¡Pintura!, Billar, Caída | [arenas.js](../../Pana/engine/arenas.js) | createArenaEnvironment |
| Ruinas del Mango · arena-ruinas | Escondidas, ¡Pintura!, Billar, Caída | [arenas.js](../../Pana/engine/arenas.js) | createArenaEnvironment |
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

### Objetos (61)

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
| Casa amarilla · colonial-yellow | Preview only | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Casa azul con balcón · colonial-balcony | Preview only | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Casa de la trinitaria · colonial-crest | Preview only | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Casa larga del pueblo · colonial-long | Preview only | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Casa de la esquina · colonial-corner | Preview only | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
| Casa del portal · colonial-porch | Preview only | [colonial-house.js](../../Pana/engine/models/props/colonial-house.js) | colonialHouse |
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

### Personajes (3)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Pana original · pana | Bululú, Derrape, Escondidas, Cocina | [avatar-model.js](../../Pana/engine/models/characters/pana/avatar-model.js) | buildCharacter |
| Pana cocinero · pana-chef | Cocina | [avatar-model.js](../../Pana/engine/models/characters/pana/avatar-model.js) | buildCharacter |
| Pana conductor · pana-driver | Derrape | [avatar-model.js](../../Pana/engine/models/characters/pana/avatar-model.js) | buildCharacter |

### Pueblo (18)

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

### Páramo (8)

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

### Vegetación (27)

| Name / ID | Status / games | Source | Constructor |
| --- | --- | --- | --- |
| Mata de hojas anchas · garden-rosette | Preview only | [garden-rosette.js](../../Pana/engine/models/vegetation/garden-rosette.js) | gardenRosette |
| Enredadera colgante · trailing-vine | Preview only | [trailing-vine.js](../../Pana/engine/models/vegetation/trailing-vine.js) | trailingVine |
| Trinitaria · trinitaria | Preview only | [trinitaria.js](../../Pana/engine/models/vegetation/trinitaria.js) | trinitaria |
| Palma moriche · moriche | Galope | [moriche.js](../../Pana/engine/models/vegetation/moriche.js) | moriche |
| Paja de sabana · savanna-grass | Galope | [savanna-grass.js](../../Pana/engine/models/vegetation/savanna-grass.js) | savannaGrass |
| Palmera · palm | Bululú, Derrape, Escondidas, Cocina, Reliquia, Billar, Póquer, ¡Pintura!, Caída | [palm.js](../../Pana/engine/models/vegetation/palm.js) | palm |
| Árbol de mango · mangoTree | Bululú, Derrape, Escondidas, Cocina, Galope, Billar, Póquer, ¡Pintura!, Caída | [mango-tree.js](../../Pana/engine/models/vegetation/mango-tree.js) | mangoTree |
| Ceiba · ceiba | Bululú, Derrape | [ceiba.js](../../Pana/engine/models/vegetation/ceiba.js) | ceiba |
| Pino · pine | Bululú | [pine.js](../../Pana/engine/models/vegetation/pine.js) | pine |
| Mata de cambur · banana | Bululú, Derrape | [banana.js](../../Pana/engine/models/vegetation/banana.js) | banana |
| Arbusto · bush | Bululú, Derrape, Escondidas, Cocina, Billar, Póquer | [bush.js](../../Pana/engine/models/vegetation/bush.js) | bush |
| Araguaney · araguaney | Derrape, ¡Pintura! | [araguaney.js](../../Pana/engine/models/vegetation/araguaney.js) | araguaney |
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
| Árbol gigante de la selva · jungleGiant | Derrape | [jungle-giant.js](../../Pana/engine/models/vegetation/jungle-giant.js) | jungleGiant |
| Arbusto tropical grande · tropicalBush | Derrape | [tropical-bush.js](../../Pana/engine/models/vegetation/tropical-bush.js) | tropicalBush |
| Frailejón · frailejon | Derrape | [frailejon.js](../../Pana/engine/models/vegetation/frailejon.js) | frailejon |
| Pino de montaña · mountainPine | Derrape | [mountain-pine.js](../../Pana/engine/models/vegetation/mountain-pine.js) | mountainPine |

### Vehículos (14)

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
| Curiara de carrera · racing-curiara | Curiara, Bululú | [curiara.js](../../Pana/engine/models/vehicles/curiara.js) | createCanoe |
| Cauchos de calle · wheel-calle | Derrape | [wheel-definitions.js](../../Pana/games/derrape/public/wheel-definitions.js) | makeWheel |
| Slicks de pista · wheel-slick | Derrape | [wheel-definitions.js](../../Pana/games/derrape/public/wheel-definitions.js) | makeWheel |
| Cauchos de barro · wheel-barro | Derrape | [wheel-definitions.js](../../Pana/games/derrape/public/wheel-definitions.js) | makeWheel |
| Llantas de palo · wheel-palo | Derrape | [wheel-definitions.js](../../Pana/games/derrape/public/wheel-definitions.js) | makeWheel |
| Cauchos de lluvia · wheel-lluvia | Derrape | [wheel-definitions.js](../../Pana/games/derrape/public/wheel-definitions.js) | makeWheel |

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
