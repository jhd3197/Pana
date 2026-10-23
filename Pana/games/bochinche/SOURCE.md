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
