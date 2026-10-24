# Shared capybara and character editor

Large front/three-quarter reference PNGs ship in the `shared-character` asset
pack at their original URLs. Restore editable originals with
`node Pana/scripts/asset-packs.js --restore shared-character`; see `asset-packs.md`.

## Mi pana wardrobe

The player editor at `/personaje` uses `web/character/editor.js` and
`editor.css`. The hub's Mi pana links and legacy `/#mi-pana` address open it.
The older sculpt inspection tools remain at `/character/reference.html`; the
geometry/pose browser suites target that contributor page.

`engine/wardrobe.js` defines the data-only item slots and normalization.
`avatarToWardrobe()` migrates old avatars; `wardrobeToAvatar()` keeps the old
fields as fallbacks and adds the normalized `wardrobe` object. Both travel in
`pana:avatar`, which games, portraits, rooms and the hosted profile already read.
Only colors belonging to the selected items enter the saved avatar: retaining
every historic swatch can exceed the room's 2048-character avatar envelope and
truncate JSON. Imported PANA2 codes pass through the same normalization.
The editor keeps recognized inactive item colors in its session history, so
switching hats or clothes preserves earlier color choices. Its draft is scoped
to the account and saved-avatar baseline, survives a trip to the tienda, and
does not replace a newer saved profile from another device.

`accessories.js` attaches the supplied editor's geometry to the existing sculpt.
Games build only selected accessories; the editor builds variants for live
preview. `wardrobe-look.js` applies the same slots and colors in both contexts.
Print replacements dispose their previous geometry. Accessory disposal removes
its roots before releasing materials. Register the pack as `pana-guardarropa`
in the Studio character catalog.

The editor saves to the game avatar only on **Guardar para jugar**. Hovering,
trying a preset, importing a code and undo/redo do not equip the saved player.
The optional `window.PanaWardrobe` adapter lets the hosted gateway supply
ownership, mango prices and account persistence; public Pana has no economy or
account dependency. Hosted saves validate ownership on the server before updating
local storage. The store's Usar/Probar links select a slot through `?slot=&item=`.

`web/tests/creator.browser.js` covers migration, save/reload, malformed codes,
all accessory geometry with the game profile, mobile layout and a real two-client
Colyseus wardrobe round trip. `engine/tests/wardrobe.test.js` bounds imported
data and verifies legacy and multiplayer compatibility.

The sculpt inspection page lives at `/character/reference.html`, inside Pana Studio. Its UI
remains in `Pana/web/character/`, while the shared sculpt lives in
`Pana/engine/models/characters/pana/`. It uses the existing Three.js **0.186.1** CDN
import map and static web server. The explicit “Usar en los juegos” action
saves the wardrobe to the existing avatar schema; `engine/models/characters/pana/avatar-model.js`
adapts this same sculpt for every game. See `pana-studio.md` for the catalog.

## Scope and reuse

The two single-character PNGs supplied by the user are checked into
`web/character/references/`. The front view sets the proportions; the
three-quarter view sets muzzle projection and silhouette. This is a procedural
interpretation, not a recovered mesh from the image. The fine fur, phoneme-based
lip sync, fingers and production costume range are still future work.

```js
import { buildSoftCharacter } from '/engine/models/characters/pana/model.js';

const pana = buildSoftCharacter({ outfit: 'shirt', color: '#ee3024' });
scene.add(pana.group);
pana.setPose('walk'); // idle, wave, walk, run, carry
pana.update(deltaSeconds);
pana.setColor('#3479cb');
pana.setOutfit('chef'); // shirt, chef, hoodie, tropical, sport
pana.setGarment('shirt'); // change clothing, keeping the chef hat
pana.setHeadwear('cap'); // none, cap, chef, band
pana.setHeadwearColor('#7da941'); // independent of clothing color
pana.setWristbands(true); // optional; color follows the clothing
pana.setGlasses('round'); // none, round, sun; independent of the outfit
pana.setExpression('talk'); // natural (default), smile, talk, laugh
// For a still preview while animation is paused:
pana.setExpression('natural', { immediate: true });
pana.resetPose(); // settle the body even when updates are paused
pana.dispose(); // remove and release owned geometries/materials/texture/skeleton
```

Model origin is at the feet, forward is +Z, height is approximately 3.6 units.
`group`, `body`, `neck`, `head`, `arms`, `legs`, `armL`, `armR` and `carry` are
available. `scale` is an optional construction argument. Games should use
`buildCharacter(avatar, options)` from `/engine/models/characters/pana/avatar-model.js` for the avatar
schema, game scale, seated drivers, carrying and legacy accessories. That
adapter selects the reduced game tessellation profile; the editor retains
full detail. Old `/character/` model URLs re-export the shared implementations.

The wardrobe owns connected skinned tops, their collars and separate cuff
bindings. `garment.js` builds a quad cage with neck, hem and two sleeve openings,
then performs three Catmull–Clark subdivisions on positions and skin weights.
Arm pivots are bones; small shoulder-lift bones keep high waves from folding
the shirt below the head. Future outfits should attach to
these existing body/arm/head pivots and preserve the sculpt. Switching the
current wardrobe only changes visibility and material color; it allocates no
additional geometry. Each character owns its own resources.

The first 16 latitude bands of each arm are covered by short sleeves and are
excluded from that arm's draw range in shirt/tropical mode; the hoodie covers
25 bands. Chef, sports and tropical now show the continuous fuller body instead
of the original separate body, neck and arm surfaces. Their original mesh draw
ranges remain ready for switching back; visibility prevents duplicate surfaces.

## Fuller exposed body

`foundation.js` uses the approved franela's broad chest and shoulder proportions
as the basis for a continuous fur sculpt. It smoothly unions the torso, neck,
arms and thighs before skinning them to the existing hip/leg/arm bones.
This avoids a skin-colored shirt's visible cuff and hem joins. The original
franela and hoodie keep their previous geometry and underlying body.

Build the exposed body in an extended-arm bind pose, then restore the shared
relaxed arm rotations. Unioning arms against the belly in the relaxed pose welds
the forearms to the flanks, producing a long web when waving; weight tweaks alone
cannot repair that topology. The extended pose retains a defined underarm while
the torso stays full. Sample an anisotropic field and inverse-scale its normals.
The apron fit uses a temporary copy skinned into the relaxed pose, then disposes
that copy; it must not sample the extended bind-pose geometry.

Chef, Deportivo and Tropical share this body. Garment fitting projects the sports
jersey and tropical shirt outside the new surface once at construction; it also
fits collars, cuffs and hems. Blend arm influence continuously when fitting the
sleeves. Waist vertices must follow the torso rather than projecting around the
nearby hands. Headwear, expressions and clothing colors remain independent.

Paw colors and arm weights use ownership relative to the whole torso-and-leg
field; comparing only against the upper torso can incorrectly color thighs brown
and assign their vertices to an arm. The new body has its own skeleton/resources
but preserves the existing body group and limb identities. It is prebuilt and
reused when switching clothes, then released through normal model disposal.

## Chef outfit and eyewear

`chef.js` adds a curved cotton apron, pocket, chef emblems, neck strap, waist
strap and back bow, plus a white toque with a continuous lobed crown. The apron
attaches to the body and the hat to the existing head. Clothing color changes
the apron and straps; the white hat has a separate emblem color. `glasses.js` supplies round frames
and sunglasses, attached to the same head so they follow its movement. Their
bridge arches above the muzzle; the temples wrap around the head to the ears.

The apron and pocket use a precomputed depth grid from the fuller body, with
bicubic interpolation for continuous surface normals. The front waist strap
sits behind the apron, and neck straps fit the new chest. Closely layered apron
surfaces use material lighting without shadow-map self-shadowing artifacts.

The public studio offers Franela, Chef, Suéter, Tropical and Deportivo presets,
followed by independent clothing, headwear, eyewear and wristband controls. The
`base` outfit remains an internal inspection option with no UI control. All
outfits support every accessory choice. `setOutfit()` applies a complete preset;
`setGarment()` changes only the clothing. A preset coordinates its hat color with
its clothing and sets wristbands for Deportivo; it preserves eyewear. Construction
options also accept `headwear`, `headwearColor`, `wristbands` and `glasses` overrides.
Each outfit remembers its own color during the session; hoodie and tropical
default to blue, the others to red. Headwear colors are remembered independently
per hat. The cap, hood, sports headband and wristbands have separate materials so
changing one slot cannot recolor another. Sports clothing colors affect the trim,
preserving the ivory jersey and gold crown. Wristband color follows the clothing.
Reset restores all clothing and headwear colors, selects a red shirt and removes
all accessories. Choices are session-only until “Usar en los juegos” is clicked.
Costume/accessory geometry is created
once and reused, and released by the character's normal disposal path.

`action-outfits.js` supplies the hoodie pocket, drawstrings, lowered hood and
backward cap; the tropical print, folded collar and buttons; and the sports
headband, wristbands and crown. `garment.js` accepts a style: hoodie adds longer
sleeves with extra transition rings, tropical lowers the neckline, and sport
keeps the armholes open. Default shirt geometry and weighting are unchanged.
The hoodie lifts some cloth below the shoulder during waves to soften the
underarm fold. Headwear follows the head; wristbands follow the arm bones. Two
prebuilt wristband fits accommodate bare arms and the hoodie's long cuffs; switch
their visibility with the garment rather than reallocating geometry.

Pockets and emblems sample a small depth grid from each finished garment once,
then interpolate that grid instead of repeatedly raycasting during animation.
The tropical flower print is a reusable CanvasTexture repainted on color change,
so the flowers stay ivory. The cap's panel indices are sorted into two contiguous
material groups; grouping every surface cell separately causes excessive draw
calls. The wardrobe disposes the print texture along with its garment skeletons.

All outfits use one camera framing with room for the tallest current hat.
Wardrobe changes never move the camera or target, preserving body size and the
user's custom zoom/orbit. Desktop leaves room between feet and view controls;
mobile keeps a dedicated stage above its controls. Future taller accessories
must fit the common frame rather than zooming out when selected.

Fitting the apron, pocket and ribbons casts hundreds of level rays at the
body proxies (`around`). `levelIndex` in chef.js bins the proxy triangles by
world height once and tests each ray's slab in the proxy's own space, as
`Mesh.raycast` does, so hits are identical (geometry fingerprints of 13
avatars match) while a pana builds in ~137 ms instead of ~203 ms.

Every pana has the same body, so most cloth fitting repeats exactly. Three
caches keep it, keyed by the exact float bits of the inputs
(`fingerprint` in geometry.js) rather than by avatar:

- the sport and tropical tops' fitted points, collar, cuffs and hem
  (outfits.js), keyed by garment points, skin weights and arm pose;
- the chef neck strap's fitted points (chef.js); on a hit the ray proxies
  and the fit geometry are never built;
- the fur foundation's marching-cubes template per resolution: coat colour
  only paints vertex colours from each vertex's stored paw blend.

Normals are recomputed from the kept points as before. 24 seeded random
avatars (all five outfits, both profiles) match the uncached build buffer
for buffer; builds after the first take about half the time.

## Mouth expressions

`mouth.js` creates a narrow closed smile, the open lining, tongue and retracting
incisors. Nine precomputed absolute morph targets project the lining and tongue
onto the face at different openings. Interpolate adjacent targets rather than
simply scaling the open mouth: a straight interpolation from open to closed can
cut through the curved face. The head has its own morph that fills the mouth
recess as it closes. Normals are also precomputed; no geometry is rebuilt during
animation. All these meshes are owned and disposed by the existing model.

Natural rests with a closed mouth, briefly smiles every ten seconds and reacts
to waving. Smile holds the reference grin. Talk and Laugh have phrased motion
with fully closed rests; Laugh also squints the eyes and gently nods. These are
silent procedural gestures, not audio-driven lip sync. Blinking remains active.
Expression selection is independent of clothing and body pose. `expression` is
also accepted by the constructor; `pana.mouth` exposes the mode and openness.

The studio exposes four Spanish expression controls. Selecting while paused
shows a still preview; it does not override pause or reduced-motion preferences.
Reset immediately closes the mouth and settles the body, including when paused.

## Geometry lessons

- Disconnected belly and thigh ellipsoids expose toy-like joint seams. The
  current body uses a smooth implicit union via `MarchingCubes`, sampled once
  at construction, then skinned to the hip and two leg bones. Paws use those
  same bones. This preserves a continuous silhouette while walking.
- A ShapeGeometry outline alone does not conform to a curved mouth: its long
  interior triangles cut across the head. Subdivide each triangle, project
  every vertex onto the recess, and compute analytical surface normals.
- Ear cups need a continuous profile from their back to their inner bowl.
  Separate back ellipsoids can poke through the bowl or leave side-view gaps.
- Separate sleeve caps produce an abrupt shoulder join even with smooth
  normals. The shirt now shares indexed vertices all the way through the
  sleeves. Opposite directed edges are required at the armhole connection;
  reversed sleeve winding cancels normals and creates a dark seam. The front
  chest control ring must sit below the neckline, otherwise it hides the collar.
- The studio uses a generated RoomEnvironment, a soft VSM key shadow, fill/rim
  lighting, contact shadow and ACES tone mapping. The reference's fine fur is
  approximated with a deterministic bump texture; there are no strand assets.

## Verification

`npm run check` passes. Browser QA is in
`Pana/web/character/tests/studio.browser.js`; run against `npm start`:

```text
node Pana/web/character/tests/studio.browser.js [absolute-playwright-package] [browser-executable]
```

It checks views, body/head identity across wardrobe changes, colors, wave and
walk, pause, orbit, reset, reference enlargement, PNG download, stable geometry
count, reduced motion, 390px mobile layout and browser errors. Screenshots go
to ignored `art/character/qa/` by default (`PANA_QA_OUTPUT` overrides it).

`shoulders.browser.js` uses the same arguments and checks all four connected tops,
exactly four intended openings each, consistent winding and normalized weights.
It captures five close-up poses in `art/character/shoulders/` and verifies bare
body replacement when selecting Chef.

`wardrobe.browser.js` covers all 15 public outfit/eyewear combinations, remembered
colors, exclusive headwear/wristbands, poses, rig identity, reset, stable GPU
geometry counts and 390px / 950px framing. Images in `art/character/wardrobe/`
include front, profile, back, extended strides, waves/carry poses and mobile.

`mix.browser.js` covers 120 clothing/headwear/eyewear/wristband combinations,
independent colors, both wristband fits, preset/custom synchronization, reset,
rig identity, stable GPU resources, mixed-outfit PNG export, poses and mobile /
laptop framing. Screenshots in `art/character/mix/` include a franela with the cap
and chef hat, plus a customized hoodie.

`expressions.browser.js` covers closed/open/partial mouths in three views,
phrased animation with rests, smooth transitions, finite morph data, blinking,
pause, wardrobe independence, reset while paused, stable GPU resources, PNG
export and reduced-motion/mobile behavior. Images go to `art/character/expressions/`.

`foundation.browser.js` covers all five outfits from four views, close-ups of
rest/wave/run/carry, the replacement body visibility, normalized weights, fur
color independence, absence of cuff/hem bindings, stable resources and mobile.
Images go to `art/character/foundation/`. The mix suite warms the mouth's optional
surfaces before its resource baseline because waving can open the smile.

`proportions.browser.js` verifies unchanged camera transforms, rig scales and
projected body height for every garment/hat on desktop, laptop and mobile,
including a custom zoom/orbit. It checks hat/feet clearance and confirms that
wave/run/carry leave the lower flanks stationary and forearms attached to their
bones. Full wave views and matched hat/no-hat screenshots are saved to
`art/character/proportions/` for visual inspection.

Current full studio render is roughly 100–135k triangles depending on viewpoint
and visible garment surfaces. The game profile uses reduced sampling and
subdivision, with the tested mixed hoodie/chef-hat/glasses character below 80k.
The body, garment and apron fitting caches store bounded CPU templates; each
character clones mutable geometry and owns its disposal. These caches do not
share live skeletons, material colors or GPU geometry between players.

## Notes for agents

Rules that used to live in AGENTS.md (paths are relative to `Pana/`). Keep them
true when you change this area.

The character sculpt lives in `engine/models/characters/pana/`;
`models/characters/pana/avatar-model.js` adapts it to saved
avatars and gameplay. The full editor stays at
`/personaje`; its old model module URLs only re-export shared sources.
Games use the lighter sampling profile and must call `character.dispose()`
when removing a character (detach shared carried props first).

Characters stand on articulated legs by default. Pass `{ seated: true }` for
vehicle drivers, `{ chef: true }` for cooking attire, and `walk` / `carry` /
`run` in `update()` to animate the shared rig.

Two opt-in cartoon impulses live on the built character: `bounce(strength)`
squashes the body on a damped spring (volume-preserving scale, settles in
~0.9 s) and `stagger(power, dir)` rocks the spine with head counter-rotation
(decays in ~0.6 s). Both are post-update overlays: they re-apply after
`sculpt.update` each frame and restore exactly when settled, so they compose
with poses, seating and game-side joint overrides (Trifulca calls them from
its own post-update animation; ambient walkers bounce at route turnarounds).
They own `body.scale` and `neck.rotation.z` while active — don't write those
channels game-side during an impulse.
