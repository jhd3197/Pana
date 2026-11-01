# Capis a Pintazos

Turn-based paint artillery between capybaras: two teams of three capis on a
stretch of the Llanos generated for each match (hills, a cave mountain,
islands and bridges, a valley, a tepuy), one player against the machine
(`players: 1`, offline, no room and no `network.js`). Each turn a capi walks,
jumps, aims and fires La Bazuca de pintura; the shell flies with the wind,
digs a crater, paints the ground and the capis near it and knocks them back. A
capi with 100 % paint, or one that falls into the water, is out. The last team
standing wins (or, after 60 turns, the one with more capis standing).

## How it is built

The play is 2D (side-on), drawn as a 2.5D side view so it is still a 3D game
(AGENTS.md): a perspective camera looks at the plane the capis move in.

- **Ground** is `engine/play/terrain-mask.js`: a grid of solid/air cells with
  a paint layer, one cell 0.1 world units: 1000 × 460 (small map, 100 × 46),
  1400 × 520 (medium, 140 × 52) or 1800 × 580 (large, 180 × 58).
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
  - the soil is a profile of strata like a road cut through volcanic ash
    (`strataPalette(seed, kind)` in map-rules.js; the shader's rules are in
    `docs/SHARED-ENGINE.md`, "Strata"): a dark crumbly topsoil 0.35–0.6 deep
    with a fringe of roots and fine rootlets hanging from the grass, then runs
    of seven bands (pale ash with laminae, orange-brown clay with small
    cracks, whitish pumice gravel full of speckles and pebbles, mottled ochre,
    crumbly loam) every 3.8–5.6 units, darker towards the base from 4 units
    down. Contacts wave (low and high frequency), bands swell and pinch along
    x, some contacts grade and some carry a thin dotted iron or pale seam.
    The bands drape over the land by `fold` (0.3–0.55 of the depth under the
    starting top smoothed over 12 and 2 units; the rest is level), so they
    fold over hills and stay continuous across a cliff;
  - everything about the profile (bands, topsoil, roots, grass cover) is read
    from the ground at `reset()`, so a crater cuts through the same bands
    with no popping or stretching; its new face is darker and charred at the
    edge where the coverage is lower than at the start, fading over about
    0.5 units, the walls of the extruded slab a little less;
  - the palette per kind: cerros warm ochre and brown, cuevas greyer with
    pale bands, islas sandy with rust, valle redder clay, terrazas brick reds
    and whites (suave like cerros); the seed shifts warmth and lightness a
    few percent and picks `period`, `fold`, `tilt` and the noise `phase`;
  - rock (`rockAt`: the mesas, the tepuy, bridges, ledges and the end cliffs
    only; the old level rock stripes gave way to the strata) is read through
    a noise warp so the map's boxes don't show, has wavy layers and
    branching cracks and takes a little of the band's colour; the beach and
    the sandbar (tops under `water + 2.4`) are sand, thicker towards the
    water, with grain, bedding lines, light grains and a wet band near it;
  - grass is a band 0.2–0.33 deep with a bright lip, a soft dark edge under
    it, and short rounded tufts (up to `tuft` 0.3 units, about the paws)
    drawn in the air on the front face only; cave floors (`grassAt` false)
    are bare damp topsoil, a crater's floor shows the bands;
  - soft occlusion from a wide coverage (11 cells) below 0.5 deep and under
    overhangs; paint has a crisp wet edge (the stain is blurred [1 2 1] so
    drops and streaks end round).
  The slab is three draws: the front face at z = 0.55, a wall extruded from
  the smooth outline (`coverageContour`, normals from the coverage gradient,
  kept in 64-column bands so a blast re-traces only the bands it touched)
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
- **The map** (`public/map-rules.js`) is generated for every match from a
  seed (1–99 999) and a size (`MAP_SIZES`: small 100, medium 140, large 180
  wide), pure and deterministic: `generateMap(seed, size)` returns the same
  cells, spawns and plan in the browser, in Node and on any future server,
  which only needs the seed. See "Map generation" below.
- **The world behind** (`public/backdrop.js`), a late afternoon: the sky is
  graded in its shader by the elevation of the view ray, not the world height
  (cream at the horizon, gold, soft teal, blue by about 25°), with a warm
  bloom towards the sun, so the play view and the whole map both show the
  gradient; the fog is the same warm haze, starting past the ground (the
  scene moves `fog.near` with the camera distance, so the whole-map view of a
  180-wide map is not hazy). The sun hangs low in the west (a
  disc and an additive glow), nine instanced low-poly clouds drifting, three lower ranges of
  hills paler with distance in a warm fog, the savanna in front of them
  fading from olive grass to the haze with darker patches and bushes in its
  shader (at play zoom the camera looks down about 9°, so this plain, not the
  sky, fills the back of the view: it was the flat yellow-green), the river (a standard material
  whose shader adds moving ripple bands and a glint path under the sun, calmer
  near the camera), foam strips where the bank meets the water (one instanced
  mesh, re-laid when a blast reaches the water line), morichales (groves of
  three or four palms on one instanced prototype, spread along the map's
  width) and three palms that sway (the two far ones past each end at `lite`
  detail without fruit, the near one by the island or a bank), instanced
  reeds (`reeds({ detail: 'low' })`) and rocks at every shore of the map (read
  from the water line of the ground), two flocks of corocoras (`birdFlock`,
  three draws, routes scaled to the map), and the player's own pana on a dock
  by the west bank. Everything is laid out from the map: `backdrop.setMap(map,
  mask)` rebuilds the map's scenery for a new map, and the scene rebuilds the
  ground textures when a map of another size arrives. It bounces on a good shot, wobbles when one of ours is hit and
  goes dizzy on a loss. Light: a warm hemisphere, a low warm sun from the
  front left and a warm rim light from behind.

## Files

- `public/rules.js`: the match (pure): teams, turn order, timers, wind,
  firing, blasts, damage, knockback, water, the winner.
- `public/map-rules.js`: the map generator (plan, ground, spawns, checks,
  `rockAt` and `grassAt` for the painter).
- `engine/play/terrain-gen.js`: the generic pieces (seeded streams, bumps,
  floating-piece removal, walk spans, `walkTo`, sky exposure, headroom, the
  floor graph, cover, relief).
- `public/bot.js`: the machine's capis (pure, tested).
- `public/options.js`: turn time, the machine's level and the map size,
  through the shared room panel even offline.
- `public/poses.js`: which pose each capi shows and where its barrel points (pure).
- `public/scene.js`, `public/backdrop.js`: the 3D view.
- `public/hud.js`: turn and clock, wind, both teams' paint bars, name tags,
  results.
- `public/game.js`: wiring (keys, mouse, touch, the shot charge, sounds).
- `tests/rules.test.js`, `tests/map-rules.test.js` (the generated maps over
  many seeds), `tests/map-matches.test.js` (bot-against-bot matches),
  `tests/capis.browser.js`.
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
| Map | small 100 × 46, medium 140 × 52 (default), large 180 × 58 | lobby choice; seed 1–99 999 |

Turns alternate teams; inside a team they rotate to the next capi still in.
Firing is refused once the clock reaches zero, so neither a player nor the bot
can shoot late.

## The machine (`bot.js`)

On its turn it first picks a target (`pickTarget`): every rival gets a quick
search from where the bot stands (angles −0.2..1.4 rad every 0.1, powers
0.2..1 every 0.05, about 290 real flights with the wind) and a score: how far
the best landing misses, plus 0.03 a unit of distance (a long lob is harder to
land), minus 1 for a rival already at 50 % paint. A miss under `FEASIBLE`
(2.5) counts; the best score is the target and the bot does not walk. With no
feasible shot at anyone it takes the nearest rival and, while that rival is
more than 34 units away (`RANGE`), walks towards it for up to 45 % of the turn,
then looks again from where it got. Before each step (five times a second) it
runs its own next two seconds of walking through the real walker (`safeWalk`)
and stops if that ends in the water: a steep bank or a painted slope carries
a capi further than a look at the ground ahead suggests. Stuck against a bump
it hops once, only if the hop lands dry. Then the fine search (every 0.05 rad
and 0.025 power, about 1 000 flights, ~12 ms) at the target, penalising
landings in the water or next to its own capis. The whole choice costs about
25 ms once a turn. The difficulty's `aimError` (from
`engine/play/difficulty.js`) is scaled ×3 for the angle and ×1.6 for the
power, as before: the choice of target makes it smarter, not more accurate. It
turns the barrel at a player's speed, waits 0.9–2.2 s, and fires; with under
2 s left it fires at once. With no shot that lands at all it fires a default
lob; one that only lands far still goes towards the rival, so it never stalls.

**The turn limit.** Two teams that cannot get at each other (three capis
stuck in a crater, the last rival out of range) would play forever, so after
`RULES.turnLimit` (60) turns the match ends: the team with more capis standing
wins, then the one with less paint, else a draw (`byCount`, `endedBy:
'turns'`, a toast and its own line on the results card). In 80 bot-against-bot
matches 4 end there, all on terrazas and cuevas maps.

## Map generation

`generateMap(seed, size)` in `public/map-rules.js`; the generic pieces are in
`engine/play/terrain-gen.js`.

- **Land across the whole map.** The sea is only under it: at both ends (a
  beach or a cliff with a notch and a sandbar, each end its own), in a pond, or
  between islands. Between the front capis the top surface is dry on every
  kind but `islas` (95 % of the width is dry land, median). Each end falls to
  the sea over `fall` units, lengthened where the land is high so the slope
  stays walkable (0.85).
- **Five kinds** (`KINDS`, picked once per seed by `capis-kind:<seed>:<size>`,
  so a re-roll keeps the kind; odds 24/20/18/20/18 %), shown in the lobby and
  the HUD next to the number ("Mapa #12345 · Islas con puentes"):
  - `cerros` (Cerros): rolling ground (base 15–19, `fbm2` ±3–5.5, three to
    six gaussian hills) with one or two mesas at least 22 from the middle (a
    small map: one at most, lower), their steep face towards the middle, often
    overhung by the cap, often a cave at its foot; sometimes a pond near the
    middle under a natural bridge.
  - `cuevas` (Montaña de cuevas): a broad massif over the middle (half-width
    0.27–0.31 of the map, 12–15 over the lowland, a broad peak and a craggy
    crest), sheer rock faces overhung by the crest's lip, and a tunnel through
    its foot from lowland to lowland, rising 1.8–3.4 inside, with one or two
    rooms. The front capis start on the crest; the back ones in the lowlands
    walk through the tunnel.
  - `islas` (Islas con puentes): three to five islands (by size) at different
    heights (13–28, steps of up to ±5), undercut by the sea, each joined to
    the next by a rock bridge (arched or nearly flat) whose top is flush with
    both islands.
  - `valle` (Valle con laguna): two high sides (12–17 over the floor) with
    sheer, rocky cliffs, a natural arch from rim to rim across the valley, a
    pond on its floor and often a ledge on a cliff. The floor is a pit: a capi
    knocked down there stays (and can still shoot); the arch is the way across.
  - `terrazas` (Terrazas del tepuy): a stepped tepuy near the middle, two to
    four shelves and risers (about 40°) on each side, each side its own.
  - `suave` (Lomas suaves) is the last attempt only: mirrored gentle hills
    with a knoll in the middle, which always passes.
  Plus caves dug into the slopes that fall towards the shores, only past each
  team's back capi (dug after the spawns are chosen).
- **Why the way across is plain ground.** Seen from the side, anything that
  overhangs the only way (a cave mouth, a ledge, a cap) is a wall for a walker
  going one way, and a tunnel through a hill always cuts its top off from the
  ground (in 2D the cells above a tunnel are a separate piece). So between the
  teams there are only slopes a capi walks both ways, bridges and arches over
  water or a pit, and tunnels whose mouths open at the foot of sheer faces
  nobody could climb anyway. Overhangs and dead-end caves stand off that way.
  `dropFloating` still removes specks; a big piece is allowed only as the roof
  of a tunnel (one per tunnel, over 4 000 cells).
- **Spawns**, not mirrored: every standable spot (dry, not steep, half the sky
  open, earth at least 3 deep under it, outside the kind's `keepOut`, e.g. the
  valley) at least `INNER` (14.5 / 16 / 18) from the middle. The front capis
  are the pair of spots near each side's first whose heights match best; then
  team 0's back and middle capis (`SPREAD` 0.4 of the half map, `GAP` 5 / 7 /
  8 apart, leaning by the seed) and team 1's trio whose mean height matches
  theirs best.
- **Measured, then re-rolled.** `measure` reads, per spawn, height, open sky,
  cover towards the rivals (`coverToward`), room to walk and distance to the
  nearest rival; builds the floor graph (`floorGraph`) for the walk from each
  front capi to the other's and back (with and without hops), the floors each
  capi can reach, and whether every cave, tunnel and room is reachable; and
  for each capi whether a coarse search finds a shot at a rival in range. A
  map is turned down (`check`) when something floats, a team has no three
  spots (`cramped`), a spawn has under 6 units to walk (`boxed-in`), it is
  `bland` (interest under 3.2), a team cannot walk or hop to the other
  (`apart`), a cave is shut, the teams differ by more than `FAIR` (mean
  height 2.6, front capis' height 3.2, sky 0.2, cover 0.3, distance to the
  nearest rival 6, walk there over walk back 1.6, capis with a shot 1), a
  team has no shot, the front capis cannot hit each other with no wind, or a
  capi can neither walk to within 32 of a rival nor hit one (`walled-in`).
  The next attempt of the same seed (`capis-map:<seed>:<size>:<attempt>`) is
  built instead; the tenth is `suave`.
- **Interest** (`interestOf`): relief / 8 + 8 × the share of columns with more
  than one floor + 2 × bumpiness + 0.6 a landmark (mesa, tunnel, room, cave,
  bridge, arch, ledge, pond, knoll). A flat field scores about 1; medians by
  kind: cuevas 11, islas 7.5, valle 6.7, cerros 6, terrazas 5.5.
- **Numbers over 300 seeds a size**: 25–50 ms a map in Node (1.5–1.8 attempts
  a map, 31–36 % of seeds re-roll at least once, one small seed in 300 falls
  back to `suave`); front capis' heights differ by 0.1 (median), 1.7 (p90),
  3.2 at most; team means by 0.37 / 1.83 / 2.6; 98 % of maps are walkable
  both ways without a hop.
- **Replay**: the lobby shows the map the match will use, its number and
  kind, with "Otro mapa" and a number field in "Más ajustes"; the HUD shows
  them under the teams; starting a match writes `?seed=…&size=…` into the
  address, so a reload or a shared link replays it; the results card has
  "Revancha en este mapa". A future server only needs to send `{ seed, size }`.

## Controls

| Keyboard and mouse | Touch | Does |
|---|---|---|
| A D / ← → | left and right buttons | walk |
| W S / ↑ ↓, or move the mouse | aim buttons | aim (the mouse also turns the capi) |
| hold Space or the left button, release | hold ¡Pinta! | charge and fire |
| Enter (or J) | jump button | jump |
| Z | Mapa | whole-map view (the whole width, bottom a little under the water, sky above) |

Space is the fire key, so jump is Enter. Escape is the shared pause menu.

## Sound

All from `engine/sfx.js`, no music: `shot('bazuca')`; a blast layers `boom`,
`splat`, `debris` (earth raining back, .3 s later) and `patter` (drops landing,
.45 s), quieter and muffled (`boom({ far })`) the farther it is from the view
(`world.hearing(x, y)`); `squeak` and a small `splat` (a capi is hit), `boing`
(jump), `land('grass')`, `splash` with a `patter` of drops (a shell or a capi
in the river), `chime` (turn starts), `tick` (last 5 s), `sting(win)`.

## Draw calls

Headless, 1280 × 800, low quality (`?debug`, a fresh match, clock and wind frozen):

| View | Before the map and effects pass | Before the terrain pass | After the terrain pass (fixed 80-wide map) | Generated maps |
|---|---|---|---|---|
| Play view | 224 draws, 210 k triangles | 229 draws, 339 k triangles | 221 draws, 297 k triangles | 130–134 draws, 222–242 k (medium, large); 186, 262 k (small) |
| Whole map (Z) | 90 draws, 111 k triangles | 86 draws, 219 k triangles | 77 draws, 175 k triangles | 77 draws, 178–202 k on every size |
| Lobby (still frame) | 224 draws, 212 k triangles | 229 draws, 341 k triangles | 221 draws, 298 k triangles | 130–132 draws, 224–244 k; 186, 264 k (small) |
| Close-up (`closeUp = 12`) | | 196 draws, 338 k triangles | 189 draws, 296 k triangles | |

The generated maps are measured on seeds 6, 16, 33 (medium), 3, 9 (large)
and 5 (small). The play view costs less than before because the capis stand
farther apart: fewer full-detail panas are in frame (on a small map two or
three are). The scenery grows with the width but stays instanced (groves of
moriches 21–36 instances, 14–17 reed clumps).

The connected maps (headless, 1280 × 720, medium quality; seeds 100, 101,
103, 104, 107 medium, 504 small, 502 large, one of each kind): whole map 77
draws on every one; play view 70–134 draws (191 on the small map, where more
full-detail panas are in frame), as before: the ground is still three draws
whatever its shape.

The strata pass changed only the ground's shader and two small textures: the
whole map stays at 77 draws and the medium play view at 134 (1280 × 720,
medium quality), the same as before it.

The terrain pass replaced ten ground planes with three draws (front, extruded
wall of about 4 k triangles, back wall) and cut the shore reeds (85 k → 39 k
triangles for the 20 clumps, `detail: 'low'`) and the two far palms (9.7 k → 8.1 k for the three). Mid-blast the play
view adds at most the four spray pools (drops, clods, sparks, rings).

**A blast's repaint.** `fieldRGBA` for the columns the blast touched (with its
drips, about 15 units) and, if cells changed, the outline. On the bigger grids
this first took 43–62 ms in the browser (the outline was re-traced over the
whole map). Now the outline is kept in 64-column bands and only the touched
bands are re-traced; the coverage blur runs on a copy of the band with
running sums, and the vertical distance skips rows of open sky or deep ground
(the bytes are identical). Node, median of six blasts: 9.9 ms field and
1.8 ms outline on a medium map (the old 80-wide map: 18.1 and 12.6); in the
headless browser 11–20 ms after the first blast (28–35 ms cold). A new match
paints the whole field once: 60–90 ms small, 110–130 medium, 170–180 large.
The four RGBA field textures take 11.6 MB on a medium map and 16.7 MB on a
large one (5.1 MB before).

## Known gaps

- One weapon. No team or player-vs-player online yet (the map is ready for
  it: a room only needs to share `{ seed, size }`).
- The way between the teams has no overhangs and no cave mouths (see "Why
  the way across is plain ground"): caves, ledges and caps stand off it, and
  the tops of the `cuevas` massif above its tunnel mouths and of the `valle`
  floor are reached only by the front capis' crest or a blast.
- The bot hops once when stuck and never plans a route with hops, through a
  tunnel on purpose or back up a slope: it walks straight towards its target.
- About 5 % of bot matches on `terrazas` and `cuevas` end at the turn limit
  (a capi stuck in a deep crater out of everyone's range).
- Fairness is measured at the start only: a crater can change who has the
  high ground, as it should.
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

`npm test -- capis` (the generated maps over 300 seeds a size: deterministic
bytes, every kind on every size with its landmark, land across the map, dry
spawns with headroom and room to walk, nothing floating but tunnel roofs, the
teams walking (or hopping) to each other both ways, every cave reachable,
interest, fairness by measure, the mirrored fallback always passing,
generation time, re-rolls, kinds and fairness as diagnostics; 80
bot-against-bot matches that must all finish with no stuck turn; each kind's
landmark, a lob between the front capis on every kind, the turn limit, turns,
clock, blast, damage, water, winner, the bot's choice of target),
`npm test -- terrain-gen side-walker` and
`npm test -- terrain-mask ballistic side-walker lod-band` for the engine pieces
(drips, the painter's options, the shader fields with no steps on a gentle
staircase, and the outline's normals included).
`npm run test:browser -- capis` (on `?seed=6`) checks the lobby shows the
seed's map, that a large size rebuilds it at 180 wide and back, that the
match is played on it with its number in the HUD and the address, and that
all six capis are the studio pana
with a team bandana and a batched La Bazuca, that only the capi on its turn
raises it and that its tip is the rules' muzzle, that the capi on its turn is
the full pana in the play view while in the whole-map view every capi is one
draw and the frame stays under 140 draws; it starts from the lobby, walks with D, holds and
releases Space, waits for the crater and the paint, the machine's turn and
shot, then a win, the results card, a rematch on the same map and the way
back to the lobby with a new one.
