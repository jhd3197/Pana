# Bolas Criollas

`/g/criollas/` is a casual 3D team game for 1–6 humans with bots in the other
seats. `/g/bululu/?play=criollas` practices the six-way minigame. Both use
`engine/bolas-criollas.js` (pure physics) and `engine/bolas-world.js` (presentation).
The clay court and striped balls are owned-resource factories in
`engine/models/props/criollas.js`, registered as `criollas-court` and `criolla-ball`.

## House rules

Full game: seats 0/2/4 are red, 1/3/5 green. Four balls each by default, twelve
per team; the host can select two per pana for a shorter hand. The
losing team throws; teammates alternate whenever possible. When that team has
no balls, the other finishes. Count each winning-team ball closer than the
best opponent. Surface gaps within 5 mm tie. Choose 12 or 24 points in the lobby.
The host advances hands and starts rematches; there is no turn timeout.

The mingo is automatically placed each hand. Only arrime and boche rastrero
are implemented: the boche has 1.32 times the launch speed. Crossing the chalk
boundary retires a ball; an out-of-bounds mingo voids the hand. These are explicit
house rules, not a tournament implementation. Terminology and basic scoring
were checked against the federation's
[published rules](https://bcdevenezuela.blogspot.com/2011/06/reglamento-de-juego-de-bolas-criollas.html).
The older source has different competition targets; the selectable targets,
automated mingo and compact court are deliberate adaptations.

Bululú: six individuals, two balls each, shared mingo and simultaneous throws.
Arrow X adjusts angle, Z adjusts power, jump throws. Each pana has a 2.5 s
cooldown; input closes after 30 s and the last balls settle before results.
The runner's 38 s maximum leaves time for that final throw. The closest surface
gap wins, including ties within 5 mm. HUD scores express proximity; actual
winners use unrounded distances. Mingo out yields no winners. Bots and all
gameplay randomness use Bululú's seeded stream, separate from world geometry.

Bot tuning: fixed per-seat aim offsets and launch order produced wins of
87/15/100/0 across 200 all-bot rounds. Seed each bot's aim variation and first
throw time instead; the same sample gives 54/52/56/43 (ties count for each
winner). Never tie a bot's accuracy profile permanently to its seat.

## Place, cameras and difficulty

The host picks the place (any shared arena, `state.mapId`) and the difficulty
in the lobby; before connecting, the lobby edits the local table. A local game
(`state.local`, set by practice) may change difficulty any time; online, only
between hands. The world swaps its venue from the state handler in game.js,
not from the frame loop: background pages may not draw, and a peer must still
end up on the host's map.

Room target and difficulty use the shared segmented controls. “Más ajustes”
sets balls per player; only the host can change this before play. Those choices
survive practice, start and host migration. Team rotation scans all remaining
seats rather than assuming a single partner; exhausted players are skipped.
The shared individual-mode court centers/spaces all six actors within 6.3 m,
matching Bululú's throw origins.

Cameras: `calce` (default) stands over the thrower's right shoulder and leans
toward the rolling ball; `arriba` looks straight down with the long axis across
a wide screen (court bunting hides there); `cancha` is the old wide framing,
still used for the lobby and by Bululú via `fit()`. The choice is remembered in
`localStorage['pana:criollas:view']`; C cycles it.

Guides: Normal draws the line to the stopping point with a ring. Fácil plays
the throw out on a copy of the pitch (`previewThrow`, same fixed steps) and
draws the real path with rest rings for every ball it moves; it is recomputed
only when the aim changes. Difícil and Experto draw 40% and 14% of the line.

Bots: `botThrow` uses `BOT_ERROR` (metres from the mingo per difficulty) for
bots on a team without a human; a human's teammates always play Normal.
Difícil and Experto bots throw a boche through a rival ball within .35 m of the
mingo when their own best ball is more than .8 m away. Bots arrime to a point
just short of the mingo on the thrower's side: aiming at its centre made the
sharpest bots knock it away and score worse than Normal ones.
`botShot` without `error` is Bululú's tuned bot, unchanged.

## Physics and room recovery

Coordinates are metres, +Y up, +Z toward the calce at Z=9.8. The court is 11×24 m.
Playing balls have radius .25, mingo .14, rolling deceleration 2.8 m/s². The
exaggerated ball size keeps it legible. Integration uses 1/120 s steps and
average pre/post-drag velocity, so an unobstructed arrime stops at the same
position as its guide. Equal playing balls exchange impulses with restitution
.72; the mingo has one third of their mass. No physics runs in rendering.

`CriollasRoom` extends `TableRoom`; the shared relay caps the room at six seats.
Snapshots during motion run at 20 Hz and include all velocities, remaining
balls, turn, teammate rotation, scores and bot timer. Actions include a revision
and must come from the current player (or host for lobby/results). Handoff
restores the snapshot, including a rolling throw; at most one snapshot interval
can visually roll back. Departures become bots. New arrivals take a bot's slot
and its remaining balls. Room seat IDs remain separate from game slots.

Practice pauses in the shared menu; online simulation continues. Touch controls
use `holdButton`; the camera fits the actual canvas rectangle and turns sideways
on wide screens. Do not bind this inset renderer with `bindRenderer`, whose
viewport-wide resize overrides the canvas size: use `onSettings` and resize to
the container. Camera picking intersects the court plane.

## Proof

`./dev.ps1 check` checks physics, scoring, rejected actions, bot completion and
Bululú deterministic simulation. `npm run test:browser -- criollas` runs both
games' real two-client tests, including remote seat input, full-game recovery,
capacity, final scoring, rematch, desktop, touch, pause and saved avatars.
`npm run test:browser -- bululu` also runs the full existing Bululú regression.
Screenshots are local under ignored `art/criollas/`.

Use a fresh explicitly loopback-bound port if necessary: on this machine an
unrelated process bound to 127.0.0.1:8474 answered instead of Pana listening on
0.0.0.0:8474. `PANA_HOST=127.0.0.1`, `PANA_PORT=18461` avoids ambiguous listeners;
verify `/api/health` before interpreting game load failures.

The lobby uses the shared grouped avatar roster: red seats 0/2/4 and green seats 1/3/5. Panas can swap their own card with another human or bot; the host can arrange anyone. Revisioned swap actions are valid only in the lobby. The players array remains the authority for teams and turn order, so starting and host migration preserve the selected arrangement.

Restablecer returns the venue, difficulty and rule values to their defaults in one revisioned options action.
