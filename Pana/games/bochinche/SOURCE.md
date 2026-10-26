# Super Bash Folds adaptation

Bochinche uses the MIT-licensed combat, CPU, moves, item rules and collision
layout from Super Bash Folds by Swarek, source revision
`1028a3b739ef54efdcbe5a2ef0ad1714fe569c47`.
The copyright notice and complete license are in `LICENSE-super-bash-folds`.

The maintained JavaScript under `public/combat/` was ported from
`src/game/{engine,ai,roster,openRoster,fighterBuilders,contracts,items,stages}.ts`
and the two content registries. Type annotations and bundler asset imports
were removed. Random streams now use Pana's resumable generator. These are
ordinary source modules: there is no build or content-generation step.

The original 14 fighter definitions remain as move data; the lobby exposes
three contrasting styles (kaykit-knight, platformer, yeti). All fighters
render as the player's saved Pana character. Original sprite atlases, third-party
fighter meshes, website, menus and build tooling are not included.

The Verdant Grove platform coordinates are retained; its stage illustration
is replaced by a native Three.js floating arena. The local Pana adapter owns
online play, JSON checkpoints, input counters, touch, shared settings and HUD.

Item icons under `public/assets/items/` are original Super Bash Folds artwork,
dedicated to CC0 by its maintainer. The original provenance declaration is
included as `ITEM-PROVENANCE.md`.

Pana extends the original duel simulation to up to six fighters: pairwise
collisions, multi-target melee/items, nearest-enemy CPU/projectile targeting,
last-survivor results and sudden death restricted to tied stock leaders.

## User-supplied Bochinche prototypes

Salto Ángel and Catatumbo scene modules are adapted from the user's downloaded
`bochinche-salto-angel.html` and `bochinche-catatumbo.html` artifacts, supplied
for integration in October 2026. Their procedural geometry, textures and
ambient animations are retained, with the standalone renderer/UI removed.
`bochinche-golpes (1).html` supplies the Rayo, Candela, Hielo and Jonrón concepts,
colors, damage targets and anticipation/impact presentation. Combat timings,
networking, player models and bounded effects use Pana's implementation.
These additions are separate from the upstream MIT combat-engine adaptation;
no additional third-party license claim is inferred for the supplied artifacts.

Los Roques is adapted from the supplied `bochinche-los-roques.html` using
the same scene integration approach. The four HUDs reference the supplied
Bochinche HUD, Caída HUD, Billar HUD and Trifulca HUD ZIP packages. Their
mock background screenshots and invented result rewards are not shipped.

The authored stage dressing now reuses Pana's canonical vegetation, island
houses, coastal fishing props, macaws and flamingos. Collision-bearing
platforms and environmental hazards retain the authored layout.

`bochinche-golpes (9).html` supplies the thirteen panas, their outfits,
props, poderes, damage targets and effect concepts. Its Mi Pana Editor
bundle, renderer, bloom and cinematic camera are not imported; props and
effects are rebuilt as bounded modules. `Bochinche HUD (2).zip` supplies
the fight HUD, Elige tu pana and results layouts; its SVG faces, mock
stats and mango rewards are replaced by real portraits and room data.
