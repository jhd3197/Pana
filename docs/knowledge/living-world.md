# Living skies and pueblo

`Pana/engine/sky.js` owns the outdoor sky used by Derrape's eight circuits,
Galope, Escondidas, Cocina, the Bululú board/minigames and Studio circuit tours.
It renders a gradient, sun glow, seeded cloud banks and high wisps in one draw.
The vertex shader ignores camera translation and projects at far depth; camera
travel cannot leave a finite dome. `depthWrite:false`, no fog and display-referred
color keep it behind the world and consistent across game/Studio exposures.

`update(seconds, daylight)` uses absolute time. `setPalette()` accepts horizon,
skyTop, skySeed, cloudCover, sunDirection and sunDisc. Update the live material's
uniforms because Studio clones materials. Bululú retains its existing sun, moon,
stars and day/night light cycle, so its shader sun disc is disabled. The atmosphere
receives the board's absolute time for cloud drift. Scene owners add skies;
environment builders and static batches do not. Studio tours allocate one on
entry and dispose it on overview, asset change or page cleanup.

`models/props/plaza-buildings.js#house` has four deterministic styles: tile-roof
home, arched balcony, awning shopfront, and pergola roof terrace. Dimensions stay
within the original frontage/depth envelope and y=0 remains the ground. Styles
are individually discoverable in Studio. The plaza uses different seeds on its
two sides, and the race town mixes twelve color/height/style prototypes. Painted
parts become vertex colors before batching, preserving appearance with fewer
materials. Arches use simple extrusions and balcony bars use square profiles.

Plaza bunting is one live subdivided mesh. The cable/top vertices remain fixed;
only cloth below them moves. Updating directly from time makes backward scrubbing
and pauses reproducible without inserting animated geometry into static batches.

## Validation

- `npm run check`
- `node Pana/engine/tests/living-world.browser.js`: real WebGL, deterministic
  wind, fixed cable attachments, cloud rewind/camera translation, material cloning,
  house bounds, Galope desktop/mobile and Bululú day/night.
- `node Pana/games/derrape/tests/plaza.browser.js <playwright-package>`: road
  clearance, foundations, finite geometry, rendering budgets, actual race views.
- `node Pana/web/studio/tests/track-tour.browser.js <playwright-package>`:
  route playback, pause/scrub/copy, overview/asset cleanup, mobile and warm cache.
- Model architecture Node/browser suites and regenerated inventory.

The old town test's 2.2 M triangle / 900 draw budget predates the Pueblo/coastal
rollout and already failed on the previous commit. A browser build with the
previous three Plaza sources served directly from `git show HEAD:<path>` measured
5,278,588 triangles and 1,383 meshes. This pass measures 3,728,954 triangles and
1,024 overview draws (29% and 26% reductions). The complete-town guard is now
4 M triangles / 1,100 overview draws for that pass. The later
[circuit surroundings pass](circuit-surroundings.md) adds authored outskirts and
sets its expanded-town guard to 4.6 M / 1,300. Route/grounding thresholds remain unchanged.

Screenshots are generated under ignored `art/living-world/`, `art/studio/plaza/`
and `art/studio/tours/`.
