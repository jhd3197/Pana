# Carreritas loadouts and race presentation

`parts.js` owns the composed car, boat and plane tunes and the D–S nivel formula.
`kitTunes()` stores car/boat/plane tunes on each racer; gates switch the active
tune and restore the car tune on land. Boat and plane body IDs and sanitized
parts travel in cosmetics. Real vessel constructors also render the showroom.
The default hull now loses 20% additional speed at a shore impact, so heavier
vessel tunes settle at the bank instead of carrying the old car's rebound.

The race nivel averages only the pieces used by that track. Lightweight
`kitPieces` metadata makes this accurate before scenery loads; `trackPieces`
also accepts the built world through its `def` field. Weight is a
trade-off and contributes no points. The workshop displays neutral weight
changes; the grid, results and pennant read the same composed kit level.
Profile v3 retains v2 receipt keys and purchases, including migrated old saves.

`race-screens.js` presents the grid before `net.loaded()`: players can inspect
kits and confirm readiness, or the preview advances after ten seconds.
Autoplay and reconnects to a started race skip this preview. The room still
owns the actual countdown. Kit-copy actions save a wishlist for the next
workshop visit; color copying buys the known paint and saves it for the next
kit without changing the running room's frozen loadouts.

Measured race metrics use the simulation clock, local/replicated velocity,
lap crossings, drift distance and changes in the actual standing order. No
presentation values are invented. Unavailable lap times show a dash. The
results board keeps shared `fillRoster` semantics and adds comparison columns.

`cup-rewards.js` settles earnings once before any animation. It stores the
collected coins, podium/cup prizes, record and defeated higher-level rivals.
The lap-record flag survives the first finish notification until online cup
settlement. Skipping or replaying cash-in never awards money again.

`cash-scene.js` is loaded only on collection. It uses a perspective camera,
the actual race `crateArt`/`coinArt`, canonical mango meshes and the player's
pana. The seven-second sequence builds a coin pile, flips coins into mangos,
bumps the crate and counts the wallet up. Enter/tap skips; reduced motion
shows the completed 3D scene. Each ceremony disposes its renderer and owned
geometries. Shared cached model materials are never disposed.

Rescue birds also own geometry: removing their groups is insufficient.
`clearRace` disposes those meshes while retaining shared cached materials;
the rescue browser suite verifies disposal when returning to the garage.

Browser proof: shop purchases/previews and repeat collection, menu-flow's two
clients carrying a boat kit into the race, transform gates, cup-local and
cup-lifetime. `resultClick` follows the real cash-in flow before a rematch.
