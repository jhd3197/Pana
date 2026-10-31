# Shared player controller (on foot)

Walking, sprinting, jumping and footsteps for every game where a pana moves on
foot. The simulation half is pure and runs on the host and in a guest's
prediction; the sound half only calls the engine's `sfx`.

| Module | What it does |
|---|---|
| `engine/play/walker.js` | `stepWalker(p, input, dt, opts)`: movement vector, sprint with stamina, speed, optional inertia, collision through the game's own `move`, the shared jump and the floor height. `walkVector` and `axisMove` are the small parts. |
| `engine/play/jump.js` | The press counter and the arc (`pressJump`, `stepJump`, `resetJump`). `stepWalker` calls it. |
| `engine/play/footsteps.js` | `createFootsteps()`: a step every few metres walked (a longer stride sprinting, so speed sets the cadence), alternating feet, plus take-off and landing. |
| `engine/sfx.js` | The sounds it plays: `step`, `jump`, `land` per surface. See `shared-sfx.md`. |

```js
// rules.js (host and prediction): the game decides its numbers, the walker does the walk
const r = stepWalker(p, input, dt, {
  walk: 7, run: 10, canSprint: !input.fire, regen: 5,
  move: axisMove((x, z) => blocked(x, z)),            // or a wall solver: (p, dx, dz) => layout.moveBody(p, dx, dz)
});
p.sprint = r.sprinting;

// game.js (client, each frame)
const feet = createFootsteps();
feet.update(dt, { speed, height: p.jumpHeight, sprint: r.sprinting, surface: 'wood' }, sfx);
```

## Rules

- `stepWalker` writes only `p.stamina`, `p.x`/`p.z` (through `move`), the jump
  fields, `p.y` (when `ground` is given) and `velocity.vx/vz` (when `velocity` is
  given). The game stores `sprinting` and `moving` itself, so a game's snapshot
  does not grow when it moves onto the walker.
- Game rules stay in the game and arrive as numbers: Reliquia folds sandals, a
  rope drag, a slow curse and a stun into `walk` and `run`; Pepazo folds its
  weapon's mobility and the slow of a paint hit.
- Floors are the game's call: pass `surface` each frame (`concrete stone tile
  wood metal dirt grass sand water`).

## Used by

Reliquia (movement, jump, steps, landing) and Pepazo (movement, jump, steps).
Other games with their own walking are listed as migration candidates in
`docs/SHARED-ENGINE.md`.
