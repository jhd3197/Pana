# Derrape illustrated menu

`public/menu-flow.js` arranges the existing garage controls into four pages:
Panas, Copa, Taller and Parrilla (internal IDs welcome, track, car, ready).
`game.js` still owns setup, car tuning, saved
profile, race loading and Colyseus authority. The menu never creates a room,
simulates a race or writes setup independently. Back/next changes only the
visible page; returning from a race or cancelling loading opens Ready.

## Artwork

`public/images/menu/sources.json` maps the supplied PNG names to optimized
WebP files. Original PNGs are local in the sibling `pana-photos/generated`
folder; they are not needed to serve the game. These are prepared assets,
not a build step or a new runtime dependency. Circuit thumbnails are 320px;
the selected/loading illustration is 960px. All 29 files total about 3.2 MB,
but thumbnail requests are lazy and touch/reduced-motion devices skip the
four 1600px parallax layers.

The complete street-race image is the initial and failure fallback. The four
layers have the same canvas and cover transform, and replace it only after
all decode successfully. Movement follows mouse position without an animation
loop. Reduced motion immediately restores the complete image. Missing artwork
never gates Play or loading progress. Map illustrations are thematic previews;
the small route canvas still draws actual track geometry.
The initial HTML also shows the complete festival illustration while game
modules load; `createMenuFlow` removes that shared-kit loading screen when the
controls, car/wheel thumbnails and compiled garage shaders are ready. The
`prepared` promise rejects into a visible retry action rather than removing the
loading screen early. It does not invent a startup percentage. Cup cards use
four real stage IDs from `cup-definitions.js`, not duplicated route data.

## Integration traps

- `createMenuFlow` runs after the existing controls and handlers are created;
  it moves the actual elements rather than cloning them. Keep IDs stable.
  Replacing mode-button labels must preserve the trophy and legacy badges that
  the initial `renderSetup` has already restored from the player's profile.
- `refresh` is read-only: calling `renderSetup` from it would recurse through
  `selectTrack`. Refresh after car, route, setup and room changes.
- Cup stage buttons preview individual tracks. Ready shows the cup's first
  stage because a new cup always starts there, regardless of the preview.
- Track browsing uses route metadata and never constructs 3D scenery. The
  garage's WebGL render is skipped while illustrated menu pages cover it.
- Keep Play in the fixed footer. Ready options and the roster scroll separately
  on short phones, while the primary action remains reachable.
  The online welcome page also reserves footer space when revisiting Panas.
- Earlier garage CSS hides `.steps` and positions tools with `bottom` on
  phones. `menu.css` explicitly restores the step navigation and resets that
  bottom offset. Scope menu rules so the race HUD is unaffected.
- Browser suites use `tests/menu-helpers.js` to navigate visible step buttons.
  Do not force clicks on hidden controls or add a debug-only alternate menu.

Proof: `tests/menu-flow.browser.js` covers artwork, local/split play, all maps
and cups, customization, keyboard, phone layouts, reduced motion, failed image
requests, loading retry and two actual clients with host/guest restrictions.
Existing loading, modes, cup and online suites retain their gameplay assertions.

## Taller parts and the v2 car kit

- Cars are built on `engine/models/vehicles/car-kit.js` v2: a filleted side
  profile (`roundedPath`) with arches cut from `axle`/`archR`/`sill`, two
  tapered side slabs plus a center tub (`shellBody`), `extrudeX` for any
  extruded part and cached rounded boxes (`RB`/`rbox`). `shellBody` returns a
  fit (`noseZ`, `tailZ`, `topOf`, `halfW`); `cabin` adds `fit.roof`,
  `fit.belt` and `fit.cabin`. The fit already includes the tub's 0.03 bevel:
  extrusion bevels grow the outline, so a decal placed on the raw profile is
  buried under the paint.
- `car-parts.js` dresses any fitted car from a render config: spoiler (pato,
  gt, rally), roof cargo (barra, cava, maletas, cornetas; a pickup's bed or an
  open car's deck via `fit.cargo`), decals, stripes, a turbo hood scoop and the
  paint finish. `'fabrica'` keeps the builder's stock part; builders skip
  their stock spoiler/roof/decal/stripes/finish when a slot asks for another.
- Wheels are lathe tires with tread blocks and a rim face (cinco, acero, disco,
  malla, turbo, palo). Every rim part shares one metal material look so
  `batchRacer` merges a wheel into 2–3 draws; per-car race meshes stayed at
  173–184 after batching (was 173–184), body triangles grew from ~2–4k to
  ~6–10k against a 137k driver. A wheel bigger than the car's own lifts the
  body (`rig` `lift` group) because `chassis.position.y` is the suspension.
- `parts.js` is shared by the garage, race and room. Parts change the tune
  only through `composeTune(tune, wheelProfile, partsProfile(parts))`, kept
  within ±6% (`shop.test.js` enforces 0.97–1.07 per part). Mass now comes from
  the composed tune in contacts, so cargo really pushes harder.
- Equipped parts live per car in `wallet.parts`, the cauchos in
  `wallet.wheel` (migrated once from `derrape:wheels`, which is still
  mirrored). `cleanCosmetics` adds `parts` only when some are set, so older
  rooms and the cup ledger see the same three-field cosmetics as before.
- Debug pages opened with `?manual` never re-render the garage, so a
  screenshot there shows the first frame; use `?debug` alone to see a change.
