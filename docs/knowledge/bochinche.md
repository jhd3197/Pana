# Bochinche

A six-player 3D platform fighter, adapted from Super Bash Folds. The combat
engine keeps 60 Hz fixed steps, directional ground/aerial attacks, double jump,
recovery specials, shields, dodges, grabs/throws, ledges, projectiles, twenty
items, stock matches, timed tiebreaks and sudden death. Empty seats get CPUs.
Three move styles share the player's saved Pana appearance. The platform
layout comes from Verdant Grove, rendered as real meshes under a perspective
camera on `createTableWorld({ fit: 'window', arena: false })`.

## Files and provenance

`public/combat/` contains maintained ES modules adapted from the source game's
MIT code. `SOURCE.md` records the source revision and adaptation boundaries;
`LICENSE-super-bash-folds` retains its license. No Vite, TypeScript runtime,
sprite atlas or new dependency is required. CC0 item icons appear on 3D boxes.
`rules.js` adapts the simulation to `LiveRoom`, `network.js` owns room hooks,
`controls.js` maps keyboard/touch to input frames, and `scene.js` renders panas.

## Network details

The host consumes each 50 ms room slice as three 60 Hz combat steps. Inputs
carry held actions and monotonically increasing press counters, so a quick tap
between room ticks is not lost. Presses are consumed once, not once per substep.
The shared room expires stale held inputs and handles reconnects and election.

A render snapshot alone cannot resume combat: attacks keep Sets/Maps of targets
already hit and timers use Infinity. The JSON checkpoint tags these values and
restores combat and CPU RNG prototypes. Tests compare the uninterrupted and
restored simulations through an active attack and hundreds of CPU frames.
A departing fighter becomes a CPU in the same slot; a late joiner takes that
slot with its existing damage and stocks. Joining does not restart a match.

The host sends full checkpoints at 20 Hz (size scales with fighter and item count).
This is casual host-authoritative play, without rollback or client prediction;
remote input responsiveness depends on round-trip latency.

## Proof

`npm test -- bochinche` covers input edges, choices, combat/blocking, jumps,
stocks, results, timer ties, deterministic restore and frame slicing.
`npm run test:browser -- bochinche` uses actual six-client keyboard input,
style changes, hits, KO/results, rematch, host departure and mobile touch.

## Notes for agents

Keep input counters through key releases. Never JSON-copy raw combat state:
Set, Map and Infinity would be lost. The imported engine is intentionally kept
separate from room wiring; update provenance when porting future upstream fixes.
Movement is on a side-view plane but every fighter, item and platform is a mesh.

The canvas CSS overrides the renderer's initial inline size so rotating a phone
updates its client rectangle. The scene then fits the new drawing buffer and
camera each frame. Touch play uses the shared landscape guard.

## Combat presentation

`/g/bochinche/lightning.html` is a local-only lightning practice lab, linked
from the lobby. It uses the existing arena and saved avatar, a fresh two-fighter
combat instance per cast, and `resolveAttackHit` for a fixed 12% strike. No room
connects and normal attacks are unchanged. Charge poses are snapshot-only;
they never create melee hitboxes. The baseline keeps damage/launch identical
while switching off presentation and combat hit-stop. Settings latch at cast.
The hit-stop slider specifies attacker frames (the engine adds one defender
frame); turning it off explicitly clears both. Slow motion scales the 60 Hz
accumulator. `scene.frame` accepts an optional before-draw camera hook for the
lab's decaying shake; the camera is reframed before every hook, avoiding drift.
Effects use bounded geometry and reduced motion disables shake and softens flash.
Lightning uses tapered soft ribbons with a white core and blue corona, plus
a procedural radial light texture. Midpoint subdivision keeps the main path
coherent; branches narrow to a tip. Independent random offsets and solid
cylinders made the earlier version look like purple scribbles. The shader
bypasses tone mapping so the white core remains bright on the daytime stage.
The lab does not implement chain damage or random critical hits.

`arena.js` builds the collision-aligned island and reuses the shared mango and
palm factories at game detail. Thin floor trim does not cast shadows: having
both a grass cap and a path cast into nearly coplanar receivers created diagonal
shadow acne. Full rock and tree geometry still casts onto the fighting lane.

`fighter-animation.js` reads startup/active/recovery frames for directional
poses; `scene.js` adds short swing arcs without exposing debug hitbox spheres.
`impact-effects.js` reuses 56 particle meshes, consumes each published frame
once and resets at a new round. Damage, shield and KO feedback therefore cannot
repeat when the lobby or a member update republishes the same combat frame.
Reduced-motion preference suppresses camera shake and HUD punch animations.
The camera eases its framing bounds to avoid abrupt zooms as fighters separate.

`fight-hud.js` keeps damage, stocks and shield separate, uses danger colors at
60% and 100%, and displays countdown, start and KO calls. Its DOM is built once;
player names are always assigned with textContent. The browser suite checks
real hit feedback, duplicate-snapshot suppression and the rotated mobile view.

The Pesado style uses the source Yeti move set (weight 130, run speed 585),
so it is heavier and slower than Equilibrado (103, 767). The earlier Cactus
choice weighed only 96 and did not match that label. Veloz remains Platformer
(weight 88, speed 852). Unit tests protect the ordering behind these labels.

A host catching up after a frame hitch calls update repeatedly before publishing.
Keeping only the final substep's events lost hits even though damage arrived.
Combat snapshots now retain up to 96 events from the last 120 simulation frames.
Sound, particles and announcements filter by the last displayed combat frame,
so the history survives catch-up and migration without replaying old effects.

## Free-for-all rules

The room admits six humans. The host chooses a minimum of 2–6 fighters
(default 6); CPUs fill empty seats. Human members always take priority over
that minimum. Mid-round arrivals replace CPUs with the same stocks and damage.
If a smaller round has no CPU seat, arrivals watch until the next round; room
members are reconciled at rematch and on return to the lobby.

Combat iterates all fighter pairs for overlap and clanks, all eligible enemies
for melee and held-item strikes, and collision candidates in distance order
for projectiles and thrown items. Consumed/reflected projectiles leave their
outer loop once, avoiding duplicate survival entries. CPU targeting chooses
the nearest living opponent. Slots remain stable after elimination/departure.
Timeout compares stocks across all fighters: tied leaders alone enter sudden
death, with other slots kept eliminated. A simultaneous last-stock KO chooses
among that frame's contenders, never somebody eliminated earlier.

The pre-game lobby uses the shared Carreritas side settings; style selection
is personal and stays with the roster. Six colors identify fighters in the
world and HUD; the camera follows all living fighters.

## Authored Venezuelan stages and attacks

The host selects La arboleda, Salto Ángel or Catatumbo through shared room
options. The latter two port the user-supplied standalone scene geometry,
textures and environmental animation. Artifact metres map to 30 simulation
units and .42 render units. Six-player capacity and saved panas remain intact.
The shared world owns the camera, renderer, loop and teardown; prototype
camera controls, HUD, renderer and bloom composer are not imported.

The Salto Ángel canoe follows an 11-second curve in authoritative fixed frames.
Grounded riders move by its delta before normal integration. Its deck stays
level so its visible top matches the horizontal collision surface. Catatumbo
warns for 96 frames before each 660-frame strike; the fixed spot sequence is
shared with the visual prototype. Strikes deal 18 damage near the dock and
respect invulnerability. Stage state is included in the existing checkpoint;
recreating authored scenery per round clears old warning and scorch state.

Prueba de golpes supplies the four match themes: neutral special Rayo (14),
side special Candela (12), down special Hielo (10 with escapable freeze), and
forward smash Jonrón (30 balanced, 26 fast, 34 heavy before charge scaling).
Up-special keeps each style's recovery. Prototype cinematic freezes become
short combat-frame hit-stop; the match camera never cuts away from opponents.
The authored attacks use normal hit resolution, shielding and network inputs.
Particles, charge meshes and announcements consume existing snapshots/events.
Reduced motion suppresses the storm lighting flash and existing impact shake.

`artifacts.test.js` covers canoe riders, hazard warning/impact and invulnerability,
checkpoint continuation, attack damage and ice escape. `arenas.browser.mjs`
opens two real clients on each arena and exercises movement and host handoff.

Los Roques extends the authored arenas with two solid shores, four elevated
platforms, a drifting raft and a bobbing fishing boat plus its cabin roof.
`roquesAt` uses combat frames; rider and ledge deltas update before integration.
The six authored spawns land on island/pier solids, not the gap between them.
The prototype's eight-player caption does not change the six-player room cap.
Water shader sampling converts the scaled world coordinates back to artifact
metres, keeping the depth texture aligned to the island geometry.

The Banderín HUD uses the shared portrait cache for each saved avatar, live
stock pips with accessible counts, and a winner portrait at results. Its color
tabs follow the world fighter colors. The room keeps shared side settings and
the current three styles; the HUD reference's mock specials/rewards are not
new gameplay rules.

## Shared scenery on authored stages

Los Roques uses canonical coconut palms (full detail near the fighting lane,
far detail on distant cays), six island casitas and coastal fishing props.
Salto Ángel uses ferns, heliconias and tree ferns; tall plants stay behind the
fighting plane and foreground ferns use reduced scale. Catatumbo uses shared
fish crates, a fishing-net rack, a keel-origin fishing boat and four mangroves.
The authored lighthouse balconies, floating platform boat, raft, roofs and
canoe retain their collision-matched geometry. These are decorative placements;
no combat platforms or hazards change.

`arena-assets.js` clones cached model materials per arena and retains shader
callbacks, so arena disposal does not dispose canonical cached materials or
lose foliage wind. The scene owns the factory geometry. Each authored frame
ticks the shared wind clock; the Catatumbo boat bobs around water minus .32m.

Salto Ángel's flocks use the shared scarlet macaw flight rig at low detail;
Los Roques' distant flamingos use the shared standing/feeding model. Bird
rig updates use absolute combat time and remain separate from static scenery.

Browser attack checks use synchronized damage after a reset, not a second
poll of the two-second event history: rendering delays can expire that history
after the attack-start wait even though the hit reached both clients.
