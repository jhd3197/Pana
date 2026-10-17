# Derrape illustrated menu

`public/menu-flow.js` arranges the existing garage controls into four pages:
panas, car, circuit and ready. `game.js` still owns setup, car tuning, saved
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
controls are ready. It does not invent a startup percentage.

## Integration traps

- `createMenuFlow` runs after the existing controls and handlers are created;
  it moves the actual elements rather than cloning them. Keep IDs stable.
- `refresh` is read-only: calling `renderSetup` from it would recurse through
  `selectTrack`. Refresh after car, route, setup and room changes.
- Cup stage buttons preview individual tracks. Ready shows the cup's first
  stage because a new cup always starts there, regardless of the preview.
- Track browsing uses route metadata and never constructs 3D scenery. The
  garage's WebGL render is skipped while illustrated menu pages cover it.
- Keep Play in the fixed footer. Ready options and the roster scroll separately
  on short phones, while the primary action remains reachable.
- Earlier garage CSS hides `.steps` and positions tools with `bottom` on
  phones. `menu.css` explicitly restores the step navigation and resets that
  bottom offset. Scope menu rules so the race HUD is unaffected.
- Browser suites use `tests/menu-helpers.js` to navigate visible step buttons.
  Do not force clicks on hidden controls or add a debug-only alternate menu.

Proof: `tests/menu-flow.browser.js` covers artwork, local/split play, all maps
and cups, customization, keyboard, phone layouts, reduced motion, failed image
requests, loading retry and two actual clients with host/guest restrictions.
Existing loading, modes, cup and online suites retain their gameplay assertions.
