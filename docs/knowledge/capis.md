# Capis a Pintazos

Turn-based paint artillery between capybaras: two teams of three capis on a
Llanos riverbank, one player against the machine (`players: 1`, offline, no
room and no `network.js`). Each turn a capi walks, jumps, aims and fires La
Bazuca de pintura; the shell flies with the wind, digs a crater, paints the
ground and the capis near it and knocks them back. A capi with 100 % paint, or
one that falls into the river, is out. The last team standing wins.

## How it is built

The play is 2D (side-on), drawn as a 2.5D side view so it is still a 3D game
(AGENTS.md): a perspective camera looks at the plane the capis move in.

- **Ground** is `engine/play/terrain-mask.js`: a 800 × 400 grid (one cell is
  0.1 world units, the map is 80 × 40) of solid/air cells with a paint layer.
  It is drawn by `engine/play/terrain-material.js` (`createTerrain`): the
  cells go into two field textures (`fieldRGBA`), repainted only for the
  columns a blast or a splash changed, and one Lambert-based shader colours
  everything from world position, so nothing tiles and no cell shows:
  - the silhouette is the coverage blurred [1 6 15 20 15 6 1] and cut at 0.5
    with a little noise, anti-aliased (alpha to coverage with MSAA, else a
    discard at 0.5), so slopes, craters and caves are smooth curves;
  - depth below the surface is a vertical signed distance averaged along x
    over neighbours on the same surface (no stair steps on gentle slopes, a
    cliff stays sharp), stored in quarter cells, so it saturates 3.2 below;
  - soil darkens with height under `deepFrom` (14) and carries wavy strata
    that follow the surface, a few clay bands, mottling, flecks, pebbles and
    a few small stones (lit from the top left with a shadow under), roots
    under grassy tops; rock (`rockAt`, read through a noise warp so the map's
    boxes don't show) has wavy layers and branching cracks; the beach and the
    sandbar (tops under `water + 2.4`) are sand, thicker towards the water,
    with grain, bedding lines, light grains and a wet band near the water;
  - grass is a band 0.2–0.33 deep with a bright lip, a soft dark edge under
    it, and short rounded tufts (up to `tuft` 0.3 units, about the paws)
    drawn in the air on the front face only; crater floors (`grassAt` false)
    are bare damp topsoil;
  - soft occlusion from a wide coverage (11 cells) below 0.5 deep and under
    overhangs; paint has a crisp wet edge (the stain is blurred [1 2 1] so
    drops and streaks end round).
  The slab is three draws: the front face at z = 0.55, a wall extruded from
  the smooth outline (`coverageContour`, normals from the coverage gradient)
  back to z = -2.6, grass on its top faces and darker towards the back
  (rebuilt only when a cell changes between solid and air, about 4 k
  triangles), and the back wall. The nine stacked alpha-tested planes and
  their grass blades in the air (the wall of sawtooth spikes) are gone.
  `PALETTE` in scene.js holds the colours. If the shader fails to compile,
  `renderer.debug.onShaderError` swaps the ground to a plain earth colour cut
  out by the coverage (`fallback()`); other materials only log.
- **The back wall**: the same shader with `uBack`, from the starting ground
  plus the map's `hollow` cells (the caves and the cliff's notch), darker
  (×0.3–0.4), no tufts and no paint. A crater reads as a dent with a dark back
  instead of a hole onto the sky, and a cave has a back. Overhangs and the
  arch stay open.
- **Capis, shells, the aim arrow and the dashed arc** move at z = 1, in front of
  the slab, so a capi in a crater stays visible.
- **The capis are panas**: `buildCharacter` from `avatar-model.js` at ×0.8
  (1.7 units tall: the 1.4 body disc plus the head). Our lead capi (team 0,
  slot 0) wears the player's saved look (`loadAvatar`, wardrobe included); the
  other five are `randomAvatar` seeded per capi, in their team's shirt colour, so
  the same panas show on every load. Every capi wears a team-colour bandana
  (one torus geometry and two materials shared by all six). The rival's paint
  tints the coat and clothes by `paint` %. The six are built once and reused for
  every match (a pana costs ~100 ms to build).
- **La Bazuca** is Pepazo's (`engine/models/props/paintball-kit.js`),
  `bakePaintKit` once per team colour (one draw per folded finish, at most 6;
  the browser suite checks it) and `.clone()`d into each
  capi. It is a child of the capi's root, not of the body, so it stays exactly in
  the side plane while the body turns 22° towards the camera (`TURN_IN`) to show
  the face. It pivots at `RULES.shoulder` (0.9 above the feet), scaled ×0.6 and
  slid along its axis so the warhead's tip is exactly `RULES.muzzle` (1.1) from
  the pivot: `muzzle()` in rules.js is the visible tip, and the browser suite
  checks it within 0.03. The in-flight shell is Pepazo's `createPaintRocket`
  (×2.2), turned along its velocity, with smoke and paint drops behind.
- **Poses** come from `public/poses.js` (pure, tested): `aiming` (only the capi
  on its turn raises the barrel, at its `aim`), `barrelPose` (else carried low,
  −0.3 rad and 0.28 below the shoulder), `bodyPose` (`idle walk rise fall cheer
  sulk splat sink`). The scene adds its own timers: a hit flinches (squash,
  wobble, mouth open, leaning back, a splash of the rival's paint), a shot
  recoils (`createRecoil`: the barrel slides back and climbs, the capi is pushed
  back, the camera kicks), idle breathes and flicks an ear now and then, a win
  hops with the bazuca overhead, a capi painted out topples onto its back with
  its paws up and dizzy stars, one in the river spins as it sinks. The arms are
  set after `avatar.update`: near paw on the rear grip, far paw on the front grip.
- **Far capis are one draw** (`engine/models/core/rig-lod.js`). A full capi,
  pana and La Bazuca, is about 55 draws and 56 k triangles, so the six made
  the whole-map view (Z) cost 420 draws and 411 k triangles when the capybara
  model gave way to the studio pana. Each capi builds a far copy once: every
  visible mesh merged into one `SkinnedMesh` bound to the pivots that move
  (`turn`, body, head, both arms, both legs, the launcher's `kick`), welded at
  0.06 (6.4 k triangles), with one vertex-coloured material. `chooseFar`
  (`lod-band.js`) swaps it in beyond 55 units from the camera and back under
  47; the play view is 31 to 40 away, the whole map about 80, so play and
  close-ups keep the full pana. The rival's paint tints the far copy through
  its material (colour × (1 − p) plus the paint as emissive). Measured at
  1280 × 800, low quality, headless: whole map in a match 420 → 93 draws and
  411 k → 113 k triangles, the lobby's whole-map camera 411 → 87 draws and
  408 k → 111 k; the play view stays at 227–232 draws, the close-up at 69–76.
  The lobby stops live rendering (`engine/game-load.js`) after the frame
  drawn while the scene prepares, which is at play width (before `ready`
  sets the whole-map view), so the still lobby picture shows full-detail
  capis (229 → 224 draws).
- **Charge cue**: a drop of the team's paint swells and glows at the barrel's tip
  while the shot charges; the shot flashes there (a soft glow and a streak
  along the barrel on the shared glow texture) with sparks, paint and smoke.
- **Effects** are pooled: four `engine/play/spray.js` pools (paint and water
  drops, clods of earth, sparks, rings on the river), one draw each while
  something flies and none when idle, plus the shared `Puffs` and
  `blast-fx`. The shell sheds smoke (`fx.trail`) and paint drops that fall in
  their own arcs. A blast is the flash, fireball and a shock ring standing
  towards the camera (`boom({ front: true })`), 64 drops of paint and white,
  33 clods in topsoil, earth, grass and rock colours, sparks, paint smoke and a
  pale dust cloud; drops and clods stick where they land on the ground (a
  flattened blob that soaks in) and ring the water where they fall in. The
  blast shakes the camera by `shakeAt(distance to the view, 1.35, 36)`. A hit
  bursts the rival's paint over the capi (more drops the more paint). A shell
  or a capi in the river throws up a crown of drops, three rings and mist, and
  the camera holds on the water a moment.
- **Paint on the ground runs**: `explode` adds `drips` (terrain-mask.js) after
  the splash: nine seeded streaks run down from the bottom of the stain through
  the earth, each ending in a drop, and six blobs land on the ground past the
  rim. Seeded by the shot count and the impact, so the bot, tests and the
  screen agree; they are real stain (a blob on a slope is slick).
- **Walking** is `engine/play/side-walker.js`; **flight** is
  `engine/play/ballistic.js`. The bot, the aim preview and the match share the
  same flight, so the preview is the real path.
- **The map** (`public/map-rules.js`) is a heightfield from `fbm2` with a fixed
  seed (2026) plus carved and filled shapes, west to east (`FEATURES`): a long
  sandy beach into the river (never steeper than a capi climbs), our plateau
  with a boulder (spawns 13, 19, 25), the west caño under a thin rock arch, El
  Tepuyito in the middle (a rock tower, top 22.6, with an overhanging cap, on
  a climbable mound), a cave dug into the mound from each side with a thin
  wall between them (one shot opens it), the east caño under an overhanging
  lip, the rivals' plateau with its boulder (55, 61, 67), a rock cliff whose
  foot the river has notched, and a sandbar just above the water past it.
  Mirrored spawns; the tower stops a flat shot across the middle (tested), so
  a team lobs over it or digs. In 2D any tunnel straight through a hill cuts
  off everything above it, which is why the caves stop at a wall: an earlier
  through-tunnel left the tower floating. Same ground on every load.
- **The world behind** (`public/backdrop.js`), a late afternoon: the sky is
  graded in its shader by the elevation of the view ray, not the world height
  (cream at the horizon, gold, soft teal, blue by about 25°), with a warm
  bloom towards the sun, so the play view and the whole map both show the
  gradient; the fog is the same warm haze. The sun hangs low in the west (a
  disc and an additive glow), nine instanced low-poly clouds drifting, three lower ranges of
  hills paler with distance in a warm fog, the savanna in front of them
  fading from olive grass to the haze with darker patches and bushes in its
  shader (at play zoom the camera looks down about 9°, so this plain, not the
  sky, fills the back of the view: it was the flat yellow-green), the river (a standard material
  whose shader adds moving ripple bands and a glint path under the sun, calmer
  near the camera), foam strips where the bank meets the water (one instanced
  mesh, re-laid when a blast reaches the water line), morichales (18 palms on
  one instanced prototype) and three palms that sway (the two far ones at
  `lite` detail without fruit), instanced reeds (`reeds({ detail: 'low' })`,
  less than half the triangles) and
  rocks by the banks and on the sandbar, two flocks of corocoras
  (`birdFlock`, three draws), and the player's own pana on a dock by the
  west bank. It bounces on a good shot, wobbles when one of ours is hit and
  goes dizzy on a loss. Light: a warm hemisphere, a low warm sun from the
  front left and a warm rim light from behind.

## Files

- `public/rules.js`: the match (pure): teams, turn order, timers, wind,
  firing, blasts, damage, knockback, water, the winner.
- `public/map-rules.js`: the Llanos riverbank and the spawn points.
- `public/bot.js`: the machine's capis (pure, tested).
- `public/options.js`: turn time and the machine's level, through the shared
  room panel even offline.
- `public/poses.js`: which pose each capi shows and where its barrel points (pure).
- `public/scene.js`, `public/backdrop.js`: the 3D view.
- `public/hud.js`: turn and clock, wind, both teams' paint bars, name tags,
  results.
- `public/game.js`: wiring (keys, mouse, touch, the shot charge, sounds).
- `tests/rules.test.js`, `tests/capis.browser.js`.
- Cover art: `web/images/launcher/capis.jpg` (hero, kept under 100 KB so it stays in Git) and`capis-card.jpg` (hub tile), registered in `web/launcher-art.js`. `public/card.js` is now only the fallback live card.

## Rules and tuning (`RULES` in `rules.js`)

| Value | Now | Notes |
|---|---|---|
| Turn time | 35 s (30, 35, 45) | lobby choice |
| Retreat after the shot lands | 3 s | the shooter may still walk and jump |
| Settle | up to 5 s | waits for sliding and flying capis |
| Muzzle speed at full charge | 30 units/s | `shotPower` from `shot-charge.js` |
| Muzzle | 1.1 from the shoulder pivot, 0.9 above the feet | the shell never starts inside its own capi at any aim (tested) |
| Gravity / wind force | 18 / 7 units/s² | `FLIGHT` in `ballistic.js`; wind is −1..1, drawn per turn from the match seed, shown ×10 |
| Crater radius | 3.5 | paint reaches 5.2 |
| Paint on a direct hit | 50 % | falls to 25 % at the edge of reach (crater + body radius) |
| Knockback | 13 units/s | 30 % at the edge, aimed away from the blast and slightly up |
| Capi body | radius 0.7 | walks 2.4 units/s, jumps 7.2 up and 2.8 forward |
| Max climb (bare ground) | 52° | steeper is a wall |
| Painted ground | slides above 12° | paint ≥ 0.25 under the feet; uphill on paint the feet only paddle (25 % speed) |
| Water line | y = 4.2 | feet below it: out |

Turns alternate teams; inside a team they rotate to the next capi still in.
Firing is refused once the clock reaches zero, so neither a player nor the bot
can shoot late.

## The machine (`bot.js`)

On its turn it picks the nearest rival, walks towards it for up to 2 s when it
is more than 34 units away, then searches angles −0.2..1.4 rad and powers
0.2..1 (about 1 000 simulated flights, ~12 ms) for the shot that lands closest,
penalising landings in the water or next to its own capis. The difficulty's
`aimError` (from `engine/play/difficulty.js`) is scaled ×3 for the angle and
×1.6 for the power. It turns the barrel at a player's speed, waits 0.9–2.2 s,
and fires; with under 2 s left it fires at once. With no shot that lands
within 25 units it fires a default lob, so it never stalls.

## Controls

| Keyboard and mouse | Touch | Does |
|---|---|---|
| A D / ← → | left and right buttons | walk |
| W S / ↑ ↓, or move the mouse | aim buttons | aim (the mouse also turns the capi) |
| hold Space or the left button, release | hold ¡Pinta! | charge and fire |
| Enter (or J) | jump button | jump |
| Z | Mapa | whole-map view |

Space is the fire key, so jump is Enter. Escape is the shared pause menu.

## Sound

All from `engine/sfx.js`, no music: `shot('bazuca')`; a blast layers `boom`,
`splat`, `debris` (earth raining back, .3 s later) and `patter` (drops landing,
.45 s), quieter and muffled (`boom({ far })`) the farther it is from the view
(`world.hearing(x, y)`); `squeak` and a small `splat` (a capi is hit), `boing`
(jump), `land('grass')`, `splash` with a `patter` of drops (a shell or a capi
in the river), `chime` (turn starts), `tick` (last 5 s), `sting(win)`.

## Draw calls

Headless, 1280 × 800, low quality (`?debug`, a fresh match):

| View | Before the map and effects pass | Before the terrain pass | After the terrain pass |
|---|---|---|---|
| Play view | 224 draws, 210 k triangles | 229 draws, 339 k triangles | 221 draws, 297 k triangles |
| Whole map (Z) | 90 draws, 111 k triangles | 86 draws, 219 k triangles | 77 draws, 175 k triangles |
| Lobby (still frame) | 224 draws, 212 k triangles | 229 draws, 341 k triangles | 221 draws, 298 k triangles |
| Close-up (`closeUp = 12`) | | 196 draws, 338 k triangles | 189 draws, 296 k triangles |

The terrain pass replaced ten ground planes with three draws (front, extruded
wall of about 4 k triangles, back wall) and cut the shore reeds (85 k → 39 k
triangles for the 20 clumps, `detail: 'low'`) and the two far palms (9.7 k → 8.1 k for the three). Mid-blast the play
view adds at most the four spray pools (drops, clods, sparks, rings); a blast
on our plateau measured 159 draws and 275 k triangles in its first frames.
A blast repaints the field textures for the columns it touched and, if cells
changed, rebuilds the outline (a full-map marching squares, a few ms).

## Known gaps (milestone one)

- One map and one weapon. No team or player-vs-player online yet.
- The drips and blobs keep the cell grid's shapes under the blur: at the
  closest zoom a streak still reads as two or three cells wide.
- The tufts stand only on the front face; the extruded top behind it is
  shaded grass, not blades.
- A capi pushed against a crater wall can lose most of its knockback (the walker
  bounces off at 30 %), so it seldom flies far from inside a crater.
- The paws on the grips are set by hand-tuned angles, not inverse kinematics:
  at steep aims (above about 1 rad) the far paw drifts off the front grip.
- The warhead stays in the launcher after the shot (the batched model is one
  mesh per finish); it is not reloaded visibly.
- Aiming up, the barrel on the near shoulder crosses the face.
- Teammates of the lead capi do not use the player's look; there is no way to
  dress them yet.
- Far capis lose the face's small motions (blinks, ear flicks, the open
  mouth) and the dizzy stars; at whole-map size none of it reads.

## Proof

`npm test -- capis` (map and its landmarks, the tower blocking a flat shot,
turns, clock, blast, damage, water, winner, bot) and
`npm test -- terrain-mask ballistic side-walker lod-band` for the engine pieces
(drips, the painter's options, the shader fields with no steps on a gentle
staircase, and the outline's normals included).
`npm run test:browser -- capis` checks that all six capis are the studio pana
with a team bandana and a batched La Bazuca, that only the capi on its turn
raises it and that its tip is the rules' muzzle, that the capi on its turn is
the full pana in the play view while in the whole-map view every capi is one
draw and the frame stays under 140 draws; it starts from the lobby, walks with D, holds and
releases Space, waits for the crater and the paint, the machine's turn and
shot, then a win, the results card and the way back to the lobby.
