# Shared party maps

`engine/arena-layouts.js` owns the plain registry for Plaza Pana, Puerto Coco,
Hato del Sol and Ruinas del Mango. The three new maps use a 36 × 36 m court.
`engine/arenas.js` builds their scenery from canonical library models. Studio
registers `arena-puerto`, `arena-hato` and `arena-ruinas` through that same factory.

## Variants and collision

- **Hunt:** cover and all five familiar disguise types. `createHuntLayout`
  closes collision, sight and navigation over one immutable definition.
  A lazy 1 m navigation grid checks each edge at .2 m intervals, so a connected
  pair of grid nodes cannot send a seeker through the corner of a prop.
- **Paint:** identical major cover, without the small disguise objects inside
  the court. Server movement, swept shots, bots, touch auto-aim and camera
  obstruction all read the selected map. The original `COVER`/`SPAWNS` remain
  the Plaza default; new maps use eight clear perimeter spawns.
- **Table:** removes obstacles whose full footprint reaches the central 10 m
  radius. Billar and Caída keep their own equipment, scale, camera and rules.
  Large scenery stays outside the court, with no tabletop or seated-player
  obstruction. The old plaza retains each game's existing scale.

Perimeter landmarks reserve their actual `Box3` footprint outside ±22 m,
not merely their origin outside ±18 m. Temple stairs extend well forward of
the origin; placing the origin outside the court alone can obstruct play and
force Paintball's camera inside the pana at the northern spawn. The browser
proof checks every map's eight spawn cameras as well as the scenery bounds.

Do not make a mutable global "current map": Pintura runs many rooms in one
Node process. Definitions are shared, but `mapId` is part of each simulation.
Escondidas' legacy plaza layout remains available for Cocina and existing tests.
Escondidas gameplay derives a new prop layout from a host-owned round seed;
its `scene.js` supplies `props: []` to the shared environment and batches the
generated objects separately. The shared builders' default prop arrangement
and Studio previews stay fixed. `createHuntLayout(id, definition)` accepts that
generated definition so rendering, collision, sight and navigation agree.
See [escondidas.md](escondidas.md) for clearance and snapshot requirements.
New arrivals also pass their lobby position through the selected map's
`safeSpot`: the old fixed position at (-4, 13) is inside Hato's southern hay.

## Room and lifecycle contract

Map choice is a validated host-only lobby action. Escondidas and Billar carry
`mapId` in host snapshots; Caída uses its existing configure/revision/sequence
path; Pintura validates choices in its server room. Late joiners receive the
current map. Practice preserves the selected map. Host changes preserve it,
including Escondidas' existing restart-to-lobby behavior. Rematches keep it.

`createMapPicker` uses the shared kit, an associated label and a native select;
all peers see its current value and guests cannot change it. The visible scene
is the preview. Choosing a map rebuilds only the environment, leaving cameras,
actors and game equipment intact. Animated water, boats and the windmill stay
outside static batches; their animation uses absolute time. New maps clone
shared factory materials before disposal and release geometry/textures on swap.

## Proof

`engine/tests/arena-layouts.test.js` checks spawn and disguise clearance, connected
navigation, collision, swept shots, independent rooms and map authorization.
`engine/tests/shared-arenas.browser.js` uses real pairs of clients for all four
games, every new map, guest rejection, running-game rejection, late arrivals,
host changes and mobile layouts. It also checks finite geometry, central table
clearance, two complete construct/dispose cycles and Studio's actual factories.
Screenshots are ignored under `art/shared-maps/`. Run the four games' original
browser suites as gameplay regressions too.
Keep generated test room codes and suffixes within the invite kit's 24-character
limit, or a supposedly separate phone/practice room can join the live match.

## Puerto landmark tables

`TABLE_ARENAS`, `validTableArena` and `tableArenaInfo` add Casa Guipuzcoana and
Fuerte San Carlos to Caída, Dominó and Póquer. Keep these separate from `ARENAS`:
these architectural interiors have no hunt/paint collision layout. The picker
opts into landmarks explicitly; Billar retains its existing settings.
`engine/puerto-tables.js` and Studio share the original prototype model factories.
See `puerto-circuit.md` for scale, central clearance and texture ownership.

Dominó includes `mapId` in its host snapshots and sequence/revision-checked lobby
map action. Póquer's server validates a host-only lobby map message and publishes
`mapId` with each player's private view. Both preserve the chosen world in
practice. `engine/tests/puerto-tables.browser.js` proves both landmarks in all
three games with real pairs, guest rejection, host migration and late arrivals.
