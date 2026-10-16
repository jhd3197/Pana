# Folio/MIT grab list — research for plan 50+

Raw analysis reports (6 MIT repos mined for reusable systems, parameters, and adaptation notes).
Sources: brunosimon/folio-2019, pmndrs/racing-game, pmndrs/ecctrl, pmndrs/use-cannon, pmndrs/cannon-es,
subprotocol/verlet-js, lo-th/Oimo.js, pmndrs/react-three-rapier. Repos cloned at ../GitHub/_ref-repos/.
All MIT — reuse code/values with copyright notices retained.

---

<agent_swarm_result>
<summary>completed: 6</summary>
<subagent agent_id="agent-0" item="folio-2019 — This is Bruno Simon's original car-portfolio (Three.js + Cannon.js, vanilla JS, Webpack, MIT). Highest priority. Analyze deeply: (a) car physics in src/javascript/World/Car.js — chassis shape, wheel bodies, constraint types, engine/brake/steering values, downforce tricks; (b) the world/object system — how props (bowling pins, signs, trees, walls, bricks, cones) are defined as physics objects, look at src/javascript/World/Sections/ or Objects; (c) the area/zone system that opens content panels (src/javascript/World/Areas.js); (d) sounds system (Howler usage, positional audio); (e) camera follow logic; (f) any juiciness: shadows, materials, floor geometry trick, debug UI. Return a categorized grab list: every mechanic/prop/system with its source file path, the key parameter values used, and a note on how it maps to a Rapier-based project." outcome="completed"># folio-2019 — Grab List Report

Repo analyzed: `C:\Users\Juan\Documents\GitHub\_ref-repos\folio-2019` (Bruno Simon's 2019 portfolio, MIT, Three.js r150s-era + cannon-es-0.x, vanilla JS). All paths below are relative to `folio-2019/src/`.

One global note: the whole project is **Z-up** (gravity `(0,0,-13)`, `camera.up.set(0,0,1)`); your Rapier project is almost certainly Y-up — transpose axes when copying values. Rapier units are meters/kg like Cannon, so numeric values port 1:1.

---

## 1. GRAB LIST

### A. Car / Physics feel

**A1. Raycast vehicle tuning table — the single most valuable file**
`javascript/World/Physics.js` → `setCar()`, `this.car.options` (lines 120-149). Verified values:
- Chassis: box `depth 2.03 × width 1.02 × height 1.16`, offset `z +0.41` (raises CoM visual vs body), **mass 40**
- Wheels: radius `0.25`, height `0.24`, mass `5` (kinematic cylinder bodies, visuals only), suspension stiffness `50`, rest length `0.1`, damping relaxation `1.8` / compression `1.5`, max suspension force `100000`, **roll influence `0.01`** (nearly zero body roll — key to the arcade feel), max travel `0.3`, friction slip `10`, custom sliding rotational speed `-30`
- Controls: steering speed `0.015` (rad/frame-scaled), steering max `Math.PI * 0.17` (~30°), accel speed `16` / boost `28` (engine force, rear wheels), max speed `0.0097` / boost `0.019` (in their scaled units), brake strength `1.35`
- Front axle at `+0.635`, rear at `-0.475`, track half-width `0.39`
- *Adapt:* Rapier ≥0.12 ships `DynamicRayCastVehicleController` (`world.createVehicleController(chassisBody)`) with per-wheel suspension/friction params that map almost 1:1. Otherwise implement 4 raycasts + spring forces yourself with these exact numbers.

**A2. Anti-rollback / auto-slow-down force** — `Physics.js` postStep (lines 416-429): when no throttle input, applies an impulse opposite to travel direction of `velocity.length() * 0.1`. This is the "car stops quickly but not instantly" feel.
*Adapt:* `body.applyImpulse(forward.negate().scale(speed*0.1), true)` each tick when idle.

**A3. Upside-down auto-recovery state machine** — `Physics.js` postStep (lines 368-396): checks `worldUp · localUp < 0.5`, waits 1000ms pending, then `jump(true)` — an impulse of `150` on Z applied at `position + (0.1,0,0)` (off-center → torque flips the car). States `watching/pending/turning` with timeouts.
*Adapt:* trivial — read body rotation, apply impulse at offset point via `applyImpulseAtPoint`.

**A4. Jump/horn hop** — `Physics.js` `car.jump(_toReturn, _strength=150)` (line 162). Called from horn key in `Car.js` (`KeyH` → `jump(false, 150)` with 400ms debounce).
*Adapt:* one `applyImpulseAtPoint`.

**A5. Steering return-to-center + direction-aware steering** — `Physics.js` tick (lines 479-521): steering increments by `delta * steeringSpeed`, decays to 0 when no input, flips sign when reversing (`goingForward ? -1 : 1`), clamps to max. Engine force cut off above max speed rather than clamped velocity.
*Adapt:* pure input-side logic, no physics dependency.

**A6. Rolling-resistance "sleep" economy** — chassis `allowSleep = false` (never sleeps), props `sleepSpeedLimit 0.01` and start asleep (`sleep: true` default in `Objects.add`), waking on car contact. `car.create()` also supports `recreate()` on reset key (R).
*Adapt:* Rapier bodies sleep automatically; `RigidBodyDesc.setCanSleep(false)` on chassis. Store initial transform per prop and restore on reset.

**A7. Contact materials table** — `Physics.js` `setMaterials()` (lines 67-88): floor↔dummy friction `0.05` / restitution `0.3`; dummy↔dummy friction `0.5` / restitution `0.3`; floor↔wheel friction `0.3` / restitution `0`; global default friction `0`, restitution `0.2`, gravity `-3.25 * 4 = -13` (stronger than Earth — snappier falls).
*Adapt:* Rapier colliders take per-collider friction/restitution and combine rules (`CoefficientCombineRule`) to emulate contact pairs.

**A8. Car-vs-static impact sound hook** — `Physics.js` line 191: on chassis `collide`, only if `event.body.mass === 0`, plays `'carHit'` with `contact.getImpactVelocityAlongNormal()`.
*Adapt:* Rapier `EventQueue.drainContactForceEvents` gives `totalForceMagnitude()`; or compute relative velocity along contact normal from `drainCollisionEvents` + body velocities.

### B. Props & toys

**B1. The Blender-naming-convention collision pipeline (the core architecture trick)** — `javascript/World/Physics.js` `addObjectFromThree()` (lines 629-823) + `javascript/World/Objects.js` `getConvertedMesh()`.
Every GLB has a "base" scene (visuals) and a "collision" scene. Collision meshes are named `cube_N`, `cylinder_N`, `sphere_N`, `center_N` — the parser regex-matches names (`/^cube_?[0-9]{0,3}?|box.../i`) and builds compound Cannon bodies from primitives using `mesh.scale` for size and `mesh.position/quaternion` for shape offset; `center_N` marks the center of mass. Visual meshes named `shadeOrange_1` / `pureRed_2` get material assigned by name regex from a shared material library (`Objects.js` `setParsers`).
*Adapt:* identical in Rapier — `ColliderDesc.cuboid/cylinder/ball` attached at offsets to one rigid body. This is the #1 structural grab: your Blender→GLB workflow can copy the naming convention verbatim.

**B2. Wall/stack generator** — `javascript/World/Walls.js`. Generates `rectangle`, `brick` (running bond with half-offset rows, `equilibrateLastLine`), and `triangle` (bowling pin rack) stacks from `widthCount/heightCount/offsetWidth/offsetHeight/randomOffset/randomRotation`.
Used in `Sections/PlaygroundSection.js`: brick walls `5×6`, offsets `(0,1.05,0)` width / `(0,0,0.45)` height, random rotation `(0,0,0.4)`, brick mass `0.5`; bowling pins triangle `widthCount 4`, mass `0.1` (super light = dramatic scatter), ball mass `1`.
*Adapt:* pure JS layout math, 100% portable.

**B3. Reset-area pattern** — `PlaygroundSection.js` (lines 112-147, 192-221): an `Area` next to each toy; `interact` calls `wall.reset()` which restores each body's stored origin (`collision.reset()` saves initial position/quaternion in `addObjectFromThree`). Plus a floor label mesh ("reset" texture).
*Adapt:* store `{position, rotation}` at spawn in your own prop registry; restore via `body.setTranslation/setRotation` and zero velocities.

**B4. Klaxon + toy spawners** — `World/Car.js` `setKlaxon()` / `setShootingBall()`: `KeyH` horn (400ms debounce, 0.2% chance of alternate horn sample, car hop), `k` rains physical horn props (mass 5) around the car, `b` shoots a bowling ball (mass 5, impulse `100` toward the car).
*Adapt:* spawn a rigid body + `applyImpulse` — trivially portable, huge fun-per-line.

**B5. Konami-code lemon rain** — `World/EasterEggs.js` `setKonamiCode()`: tracks rolling key history, on match spawns `3^count` lemons (mass `0.5`, `woodHit` sound) at 50ms intervals above the car. Touch fallback: swipe-direction detection. Also wig-swap area and collectible eggs (collide-with-car → reward code).
*Adapt:* pure JS, portable.

**B6. Decorative tile paths** — `World/Tiles.js`: weighted-random tile models (`chances: 8/1/2/4/2`), laid along a vector with `interDistance 1.5`, alternating tangent offset `0.3`, position randomness `0.3`, rotation randomness `0.1` + rotating each picked model by 90° increments. Mass 0, static — pure visual wayfinding between sections.
*Adapt:* portable layout code.

**B7. Award trophies as knockable physics props** — `Sections/Project.js` `setFloor()`: awwwards/FWA/CSSDA trophy meshes are dynamic props (mass `1.5`, `woodHit` sound) on each project's floor. Baguettes in `InformationSection.js` (mass 1.5, one with `sleep: false` so it dangles).
*Adapt:* portable concept + values.

### C. World systems

**C1. Area system (interactable floor zones)** — `World/Area.js` + `Areas.js`.
- Car test: simple AABB each tick — `Math.abs(car.x - area.x) < halfExtents.x` (Area.js line 284).
- Mouse: single shared `Raycaster` against invisible `mouseMesh` planes, `needsUpdate` flag so raycast only runs on mousemove.
- `in()/out()/interact()` (E, F, or Enter key) with GSAP fence animation (`back.out(3)` ease, 0.35s) and a "press Enter" key hint that rises from the floor (`hiddenZ 1.5 → shownZ 2.5`).
- Visuals: `Geometries/AreaFloorBorderGeometry.js` + `shaders/areaFloorBorder/` (dashed animated border, `uLoadProgress` used as a loading bar on the start screen) and `Geometries/AreaFenceGeometry.js` + `shaders/areaFence/` (rising holographic wall: scrolling diagonal stripes via `mod(x+y+z - time*0.00035)` + border edges, alpha 0.25/0.5).
*Adapt:* zero physics dependency — AABB check + shader. Direct copy.

**C2. Zone system (camera/trigger volumes)** — `World/Zones.js` + `Zone.js`: dead-simple invisible AABBs tested against car position each tick, emitting `in/out` with a `data` payload. Used in `Sections/ProjectsSection.js` `setZone()` to switch camera angle (`data: { cameraAngle: 'projects' }`) and fade the directional blur post-passes.
*Adapt:* same AABB test; this is how you'd trigger achievement unlocks/content panels.

**C3. Object registry + static geometry merging** — `World/Objects.js` `setMerge()`: every `mass === 0` object gets its meshes baked into world-space geometry merged by material name via `BufferGeometryUtils.mergeGeometries` → one draw call per material for the whole static world. Also `matrixAutoUpdate = false` on every static container.
*Adapt:* engine-agnostic, works in your Three.js setup as-is. Big perf win.

**C4. Reveal/intro sequence** — `World/index.js` `setReveal()`: matcap shader uniform `uRevealProgress` 0→1 over 3s + floor shadows fade (delay 0.5s) + car drops from `z=12` with `wakeUp()` at 300ms + engine volume ramps to `0.7`. Start screen uses an Area's floor-border `uLoadProgress` as the loading bar.
*Adapt:* GSAP + uniforms, portable.

**C5. Section architecture** — `World/index.js` `setSections()`: each map region is a class receiving shared services `{objects, areas, zones, walls, tiles}` + an `(x,y)` origin. `projects at (30,-30)`, `playground at (-38,-34)`, etc.
*Adapt:* organizational pattern, portable.

### D. Effects & juice

**D1. Fake planar shadows system (no shadow maps!)** — `World/Shadows.js` + `shaders/shadow/` + `Materials/FloorShadow.js`.
- Every dynamic object gets a quad that follows its `(x,y)`, offset by a fake sun vector (`sun.position (-2.5,-2.65,3.75)` normalized per object height — shadow slides as object rises), rotates to match the object's projected yaw, fades with height `((maxDistance-z)/maxDistance)^2` with `maxDistance 3`, and fades when tilted (orientation alpha from angle between object X axis and up).
- Shadow color is a burnt orange `#d04500` matching the floor palette, `uFadeRadius 0.35` soft edge in shader. Global alpha ramps to `0.5` on reveal.
- Static scenery bakes shadows into textures rendered on separate floor planes (`floorShadow/fragment.glsl`: `1.0 - texture.r` × `uAlpha` × color).
*Adapt:* 100% renderer-side; copy `Shadows.js` nearly verbatim (flip z→y). Massive perf saving vs shadow maps.

**D2. Matcap material library + custom indirect-lighting shader** — `World/Materials.js` + `shaders/matcap/fragment.glsl`. ~12 named matcaps; the fragment shader adds fake bounce light from the floor: `indirectDistanceStrength` from world height (`amplitude 1.75`, `strength 0.5`, `power 2.0`) × `indirectAngleStrength` from normal·down (`strength 1.5`, `offset 0.6`) mixing toward floor orange `#d04500`. Also `discard` when `vWorldPosition.z < 0` (clips debris below floor).
*Adapt:* GLSL is portable as-is; flip axis. This is the "folio look".

**D3. Floor gradient trick** — `World/Floor.js` + `shaders/floor/`: a 2×2 `DataTexture` built from 4 corner colors (`#f5883c/#ff9043/#fccf92/#f5aa58`), stretched over a huge plane with `LinearFilter` — cheapest possible world-scale gradient, recolorable live from debug GUI.
*Adapt:* copy directly.

**D4. Post-processing chain** — `javascript/Application.js` `setPasses()` + `Passes/Blur.js` + `Passes/Glows.js`: separable blur (two passes, `blur13.glsl` kernel), strength 1, used as screen-edge DOF and faded to 0 inside the projects zone; final `GlowsPass` = radial color glow overlay (`#ffcfe0`, position `(0, 0.25)`, radius `0.7`, alpha `0.55`).
*Adapt:* standard EffectComposer ShaderPasses, portable.

**D5. Antenna spring physics** — `World/Car.js` `setAntena()` (lines 135-198): 2D spring driven by car acceleration — `speedStrength 10`, `damping 0.035`, `pullBackStrength 0.02` (quadratic pull-back), rotated into car-local frame, applied as `rotation.x/y * 0.1`. This tiny spring is 50% of the car's perceived liveliness.
*Adapt:* pure JS, ~30 lines, copy.

**D6. Brake/reverse light opacity** — `Car.js` `setBackLights()`: cloned pure-color materials, `opacity 0.5 → 1` when braking/reversing.
*Adapt:* trivial.

**D7. Wheel screech on lateral acceleration** — `Car.js` `setMovement()` line 98: `localAcceleration.x > 0.03` and ≥5s since last → `sounds.play('screech')`. Speed derived from position delta × `17/delta` (their magic unit scale).
*Adapt:* threshold check on computed acceleration.

**D8. Title-bar car** — `Application.js` `setTitle()`: document.title renders `____🚗______` advancing with `car.forwardSpeed`. Free delight, 15 lines.

### E. Audio

**E1. Velocity-mapped collision sound framework** — `World/Sounds.js` `add()/play()`. Per-sound-name config: `minDelta` (debounce ms), `velocityMin` (ignore soft hits), `velocityMultiplier`, `volumeMin/Max`, `rateMin/Max` (random pitch). Volume = `clamp((velocity-velocityMin)*mult, min, max)` then **squared** (perceptual curve); random sample from array + random rate. Concrete table worth copying: brick `(minDelta 100, velMin 1, mult 0.75, vol 0.2–0.85, rate 0.5–0.75)`, bowlingPin `(mult 0.5, rate 0.1–0.85)`, carHit `(velMin 2, vol 0.2–0.6, rate 0.35–0.55)`, woodHit `(minDelta 30, rate 0.75–1.5)`.
*Adapt:* framework is pure Howler; feed it Rapier contact-force magnitudes instead of Cannon's `getImpactVelocityAlongNormal()`. No positional audio used anywhere — everything is 2D with velocity-driven volume; that simplification is worth copying too.

**E2. Procedural engine sound** — `Sounds.js` `setEngine()`: single looping sample; `progress = |speed|*2.5 + accel*0.4` clamped 0-1, eased up `0.3` / down `0.15` (asymmetric = rev flare, soft decel), then rate `0.4→1.4` and volume `0.4→1` mapped from progress. Master volume `0.5`, ramps to `0.7` on reveal.
*Adapt:* copy the easing/mapping verbatim; feed `sounds.engine.speed` from your chassis velocity.

**E3. Mute hygiene** — `Sounds.js` `setMute()`: `m` key toggle + auto-mute on `document.hidden`. Controls also reset all action flags on tab blur (`Controls.js` line 32) — prevents stuck keys.

### F. Camera

**F1. Eased-follow camera rig** — `javascript/Camera.js`: target eases with factor `0.15` per tick; camera positioned at `targetEased + normalized(angle) * distance`; FOV `40`, far `80`. Named angle presets tweened with GSAP (`default (1.135,-1.45,1.15)`, `projects (0.38,-1.4,1.63)`, `power1.inOut`, 2s) switched by Zones.
*Adapt:* 20 lines of lerp logic, portable.

**F2. Wheel/pinch zoom** — `Camera.js` `setZoom()`: normalized 0-1 zoom (`minDistance 14`, `amplitude 15`), eased `0.1`, wheel delta `0.001`.
**F3. Grab-pan the world** — `Camera.js` `setPan()`: raycast drag against a giant invisible ground plane (`500×500`), eased `0.1`, resets on any drive key. Cursor CSS classes `has-cursor-grab/grabbing/pointer` on the canvas.

---

## 2. TOP 5 — impact-for-effort

1. **Car tuning table + RaycastVehicle mapping (A1–A3)** — `Physics.js` lines 120-149 + postStep. The entire "Bruno feel" is ~25 numbers (mass 40, roll influence 0.01, suspension 50/0.1, accel 16/28, steering π·0.17) plus the idle slow-down impulse and the upside-down flip state machine. Rapier's `DynamicRayCastVehicleController` takes near-identical per-wheel params. Highest impact, ~1 day.
2. **Velocity-mapped sound framework + engine loop (E1, E2)** — `Sounds.js` is ~100 lines of pure Howler (which you already use), transforms perceived polish. Only missing input is impact magnitude, which Rapier's contact-force events provide.
3. **Named-primitive collision pipeline + object registry (B1, C3)** — the `cube_N/sphere_N/center_N` + `shadeColor_N` Blender naming convention with `addObjectFromThree`. Directly translatable to `ColliderDesc.cuboid/ball/cylinder` compound bodies, and it defines your whole asset workflow. Steals you a production pipeline, not just code.
4. **Fake planar shadows (D1)** — `Shadows.js` + one fragment shader. Zero shadow-map cost, sun-offset, height fade, tilt fade. Near-verbatim port, huge look/perf win.
5. **Area + Zone systems with fence shader (C1, C2)** — AABB tests + GSAP + the stripe shader. Directly powers content panels and camera-angle switching; ~1 file each.

## 3. Surprising / clever things worth copying

- **No shadow maps, no lights, no positional audio, no per-frame raycasts** — the whole look is matcaps + gradient floor + fake shadow quads + baked floor-shadow textures; audio is 2D with volume² mapping. Radical simplifications that read as "polish".
- **Gravity is 13 m/s², not 9.81** — everything falls/snaps faster; arcade feel lives here (`Physics.js:37`).
- **The matcap shader discards fragments below the floor plane** (`vWorldPosition.z < 0 → discard`) — props sinking through the floor vanish instead of glitching visually. Same trick in the area-fence shader so the fence rises *out of* the floor.
- **The start screen's loading bar is the area floor-border shader** (`uLoadProgress` on the same dashed-border material) — the loader is diegetic.
- **Roll influence 0.01 + chassis box offset (+0.41 z) separates visual CoM from physical CoM** — the car never rolls over in normal play, but still *can* flip on big jumps (handled by the auto-flip state machine).
- **Steering flips sign when reversing** and max-speed is enforced by *cutting engine force*, not clamping velocity — so boost downhill overspeed still works.
- **The horn is a physics action**: `KeyH` = honk + 150-impulse hop with 400ms debounce; 0.2% random alternate horn sample. The Konami lemon count grows as `3^count` — repeated use escalates exponentially.
- **`document.title` is a progress bar for the car** (`____🚗____` driven by `forwardSpeed`).
- Touch joystick steers toward an **absolute world angle** (delta between joystick angle and car angle, wrapped to ±π) rather than relative steer — much better on mobile than emulating arrow keys.
- `matrixAutoUpdate = false` on literally every static object + merge-by-material into one geometry per material — the static world costs ~a dozen draw calls.
- Cannon's `world.step(delta/1000)` runs **per render frame** with no fixed timestep — they just rely on `Time` delta clamping; fine to copy if your tick is clamped, but Rapier will behave better with a fixed-step accumulator.

Nothing was modified; analysis only. Note: `folio-2019` bundles GSAP and dat.GUI — your project would need equivalents for tweening/debug UI if not already present (the tweens are simple `to/fromTo` calls, easy to reimplement or swap for your own easing).</subagent>
<subagent agent_id="agent-1" item="racing-game — pmndrs/racing-game (React Three Fiber + cannon-es RaycastVehicle, MIT). The user does NOT use React — they use vanilla three.js + Rapier, so translate findings. Analyze: (a) src/models/vehicle/Vehicle.tsx and wheel setup — raycast vehicle config: suspension stiffness/compression/damping/relaxation, suspension rest length, friction slip, roll influence, max suspension travel, chassis inertia, downforce, steering curves by speed, brake force, engine force, boost; (b) drift/skid logic and any tire-mark or dust particle effects; (c) camera: src/effects or camera follow/chase logic, FOV kick on boost; (d) speed display, minimap, lap/checkpoint logic if present; (e) sound: engine sound pitch-by-speed (sounds folder). Return a grab list of mechanics with exact file paths and the actual numeric parameter values, plus how each maps to Rapier (which has no RaycastVehicle but has dynamic vehicle controllers / can be done with raycasts manually)." outcome="completed">All files read and verified. Here is the complete grab list for `pmndrs/racing-game` (repo at `C:\Users\Juan\Documents\GitHub\_ref-repos\racing-game`, MIT).

## 1. GRAB LIST

### Car / Physics feel

**A. Vehicle tuning constants — `src/store.ts:21-61`** (the single most valuable file)
- `vehicleConfig`: `width: 1.7, height: -0.3, front: 1.35, back: -1.3, steer: 0.3, force: 1800, maxBrake: 65, maxSpeed: 88`
- `wheelInfo`: `radius: 0.38, suspensionRestLength: 0.35, suspensionStiffness: 30, frictionSlip: 1.5, rollInfluence: 0, sideAcceleration: 3, customSlidingRotationalSpeed: -0.01, useCustomSlidingRotationalSpeed: true, axleLocal: [-1,0,0], directionLocal: [0,-1,0]`
- Chassis (`src/models/vehicle/Chassis.tsx:70`): box `[2, 1.1, 4.7]`, `mass: 500`, `allowSleep: false`. Wheels are kinematic cylinders (radius 0.38, depth 0.5, mass 50, `collisionFilterGroup: 0`) — purely visual, the raycast does the work.
- Note: this repo does NOT touch `suspensionCompression`/`damping`/`relaxation`/`maxSuspensionTravel`, so cannon defaults apply (compression 4.4, damping 2.3, relaxation 2, maxTravel 1, maxForce 1e5). If you want to tune suspension feel further, those are free parameters Rapier exposes.
- **Rapier map:** Rapier 3D (JS, ≥0.12) has `RAPIER.World.createVehicleController(chassisBody)` (`DynamicRayCastVehicleController`) with `setSuspensionRestLength`, `setSuspensionStiffness`, `setSuspensionCompression/Damping`, `setMaxSuspensionTravel`, `setFrictionSlip`, `setSideFrictionStiffness`, `setChassisConnectionPointCs`, `setDirectionCs/axleCs`, `setEngineForce`, `setSteering`. 1:1 port of these numbers; units match (both SI-ish, mass 500, force 1800 N). Wheel connection points: `[±width/2, height, front|back]` computed in `Vehicle.tsx:28-36`.

**B. Drive/brake/steer application — `src/models/vehicle/Vehicle.tsx:60-80`**
- Both engine force and steering are smoothed: `engineValue = lerp(engineValue, target, delta*20)`, `steeringValue = lerp(..., delta*20)`. This lerp-to-target (not instant) is the secret to the non-twitchy feel — grab it.
- Rear-wheel drive: `applyEngineForce` on wheels 2,3 only; engine force cuts at `speed < maxSpeed ? engineValue : 0` (soft top speed).
- Boost = `engineValue × 1.5` while boosting, consumed from a `boost` meter of `maxBoost: 100` at 1 unit/frame.
- Brakes on rear wheels only: `setBrake(controls.brake ? (controls.forward ? maxBrake/1.5 : maxBrake) : 0, i)` — braking while still holding throttle is weaker.
- Reverse = engine force sign flip (`+force` when backward).
- **Rapier map:** identical per-frame calls: `controller.setWheelEngineForce(i, engineValue)`, `controller.setWheelSteering(i, steeringValue)`, `controller.setWheelBrake(i, value)` inside your `timeStep` loop. There is no speed-based steering curve in this repo — steering is constant 0.3 rad; the "tightness at speed" comes from physics alone. (You may still want a `steer * f(speed)` multiplier; this repo proves you can start without one.)

**C. Fake chassis lean + vibration — `Vehicle.tsx:100-112`**
- Visual-only: inner mesh `rotation.z = lerp(z, (-steeringValue * speed) / 200, delta * 4)` (body roll into corners), plus high-frequency jitter `rotation.x/z = sin/cos(t*20) * (speed/maxSpeed) / 100`. Costs nothing, sells speed.
- **Vanilla note:** apply to a child group of the physics-followed chassis object, exactly as they do (child `group` inside the physics body group).

**D. Brake light + steering wheel + dash needle — `Chassis.tsx:109-120`**
- Brake-light material lerps `opacity` to 1 when braking (`delta*10`), glass goes transparent in first-person, steering wheel mesh rotates `±π` with input, dashboard needle `rotation.y = (speed/maxSpeed) * -2π - 0.9`.
- **Vanilla note:** pure material/rotation lerps — trivial in vanilla three.

**E. Collision sound by impact velocity — `Chassis.tsx:80-87`**
- Debounced 200 ms; `volume = clamp(e.contact.impactVelocity / 10, 0.2, 1)`; skips trigger bodies.
- **Rapier map:** read `contactForceEvent.magnitude()` / impulse from the collision event queue; debounce identically.

### Effects & juice

**F. Dust trail — `src/effects/Dust.tsx`**
- One `InstancedMesh` of 200 white spheres (radius 1, `opacity 0.1`, `depthWrite: false`). Every 0.02 s, spawn 2 instances at the rear wheels' world positions (±0.25 random spread, y−0.4), scale = `Math.random() * intensity` where `intensity = lerp(intensity, (sliding || brake) * speed / 40, delta*8)`; otherwise all instances shrink by 0.005/frame. Ring-buffer index.
- **Vanilla note:** straight InstancedMesh + matrix writes; `sliding` comes from the vehicle controller (`sliding` flag / `wheelIsInContact` + slip — Rapier's controller exposes `isSliding` per wheel via `wheelIsSliding`... in Rapier you compute slip as `wheelFrictionSlip` or lateral velocity vs heading; simplest: trigger on `brake && speed>threshold` like the Skid does).

**G. Skid marks — `src/effects/Skid.tsx`**
- One `InstancedMesh`, 500 black planes `0.4 × 0.8`, `opacity 0.5`, `depthWrite: false`, geometry pre-rotated `rotateX(-π/2)`. Spawned at rear-wheel world positions with chassis yaw (extracted via `Euler.setFromRotationMatrix(m.extractRotation(chassis.matrix))`) every frame while `brake && speed > 10`. Ring buffer; marks persist forever.
- **Vanilla note:** copy verbatim.

**H. Boost exhaust particles — `src/effects/Boost.tsx`**
- 12 instanced cyan (`#5ecfff`) boxes `0.1³` at exhausts `(±0.4, -0.5, -1.8)`; per-particle `progress = (t + (i+j)*0.2) % 1` drives z-offset `−progress*0.75`, rotation `progress/2`, scale `(1−progress)*2` (0 when not boosting).

**I. Camera sway — `Vehicle.tsx:103-108`**
- Adds noise to camera rotation: `rotation.z += sin(t * swaySpeed*0.9)/1000 * swayValue`, `rotation.x += sin(t * swaySpeed)/1000 * swayValue`; `swaySpeed` 30 (60 boosting), `swayValue = (speed/maxSpeed) * 2` (×8 when boosting). This is their "FOV kick" substitute — FOV itself is fixed at 75 (`effects/Cameras.tsx:10`).

### Camera

**J. Chase-cam positioning — `Vehicle.tsx:82-98` + `effects/Cameras.tsx`**
- DEFAULT: camera local target `v.set((sin(steering)*speed)/2.5, 1.25 + (engineValue/1000)*-0.5, -5 - speed/15 + (brake ? 1 : 0))`, `position.lerp(v, delta)`. Read: camera pulls back with speed (`-speed/15`), swings out when steering (`sin(steer)*speed/2.5`), dips with throttle, steps closer when braking.
- Roll: `rotation.z = lerp(z, (-steeringValue*speed)/40, delta)` (or /60 in first-person, π for bird's-eye).
- FIRST_PERSON target: `(0.3 + sin(-steer)*speed/30, 0.4, -0.1)`. BIRD_EYE is an `OrthographicCamera` at y=100, zoom 15, rotation `[-π/2, 0, π]`.
- Camera is a **child of the chassis group** (mounted inside `<Chassis>`), so it follows rotation/position for free; only local offsets are animated.
- **Vanilla note:** parent the `PerspectiveCamera` to the car group and lerp `.position` + `.rotation.z` per frame with `delta` smoothing — no follow-math needed.

### World systems

**K. Goal/checkpoint triggers — `src/models/Goal.ts`, placed in `src/App.tsx:61-63`**
- Invisible thin box triggers `[0.001, 10, 18]` with `userData.trigger = true`; `onCollideBegin` wires to `onStart`/`onCheckpoint`/`onFinish`. Timing in `store.ts:178-193`: `Date.now() - start`; split display in `ui/Checkpoint.tsx` (green/red diff vs `bestCheckpoint`, auto-clears after 3 s).
- **Rapier map:** sensor cuboid colliders (`collider.setSensor(true)`) + `eventQueue.drainCollisionEvents` / intersection events — this maps perfectly onto their existing "areas" concept in folio-2025.

**L. Reset bounds — `src/models/BoundingBox.tsx` + `store.ts:194-205`**
- Six invisible trigger planes forming a 512×100×512 box; on collide → `reset()`: zero velocity, teleport to spawn `[-110, 0.75, 220]`, `angularVelocity [0,0.5,0]` (spawns mid-spin for fun), `boost = maxBoost`.
- **Rapier map:** sensors again, or simpler: `if (car.position.y < threshold) reset()`.

**M. Heightmap terrain from image — `src/models/track/Heightmap.tsx`**
- Draws a 1024px B/W PNG into a canvas, reads pixels, builds a `width×height` matrix: `p = pixel * 40 / 255`, then `/4`, `Math.max(0, p)`, `toPrecision(2)`; `elementSize: 0.5085` (from `App.tsx:60`), vertical scale 40, rotated `[-π/2, 0, -π]`.
- **Rapier map:** `RAPIER.ColliderDesc.heightfield(nrows, ncols, heights, scale)` — same pixel-read trick, just pass a flat `Float32Array` column-major.

**N. Kinematic animated obstacle (Train) — `src/models/track/Train.tsx`**
- GLB animation drives a visual mesh; a kinematic box `[38, 8, 10]`, `mass 10000` follows it each frame via `api.position.set(...)`. Plus looping positional train audio.
- **Rapier map:** `RigidBodyDesc.kinematicPositionBased()` + `setNextKinematicTranslation/Rotation` each step.

**O. Minimap — `src/ui/Minimap.tsx`** (cleverest system in the repo)
- Renders the level **once** from an orthographic top-down camera (fitted to the level's `Box3`) into an FBO (`size*2` = 400px), only objects on `levelLayer` (layer 1). Every frame: draws main scene, then renders a virtual scene with two sprites (map texture masked by `mask.svg`, player cursor `cursor.svg`) in orthographic overlay. Player sprite position = `(chassisPos - levelCenter) / levelDimensions * size`, rotation = chassis heading via `getWorldDirection` + `Vector2.angle()`.
- **Vanilla note:** fully portable — `WebGLRenderTarget`, a second `OrthographicCamera`, `gl.autoClear=false; gl.clearDepth()`, and a second `Scene`. Layer trick works identically in vanilla (`mesh.layers.enable(1)`).

### Audio

**P. Two-layer engine sound with RPM gears — `src/effects/audio/Engine.tsx` + `Accelerate.tsx` + `Chassis.tsx:96-105`**
- RPM model: `gears = 10`; `gearPosition = speed / (maxSpeed/gears)`; `rpmTarget = max(((gearPosition % 1) + log(gearPosition)) / 6, 0)` — sawtooth per gear, logarithm flattens high gears.
- Engine loop (`engine.mp3`): volume `1 - speed/maxSpeed`, playbackRate lerps to `rpmTarget + 1` (`delta*10`).
- Accelerate layer (`accelerate.mp3`): volume `2*speed/maxSpeed`, playbackRate lerps to `rpmTarget + 0.5` — two loops crossfade across the speed range, simulating gear shifts.
- Boost loop: `rate = (speed/maxSpeed)^1.5 + 0.5`, volume `rate*1.5`.
- Brake screech: plays only while `brake && speed > 10`, stops below 10.
- **Vanilla/Howler map:** Howler has `rate()` and `volume()` with `fade()`; replicate the rpmTarget formula verbatim and lerp `howl.rate(current, target)` per frame. No positional audio in Howler, but their `distance: 5` params are barely used for the car anyway (it's always near the camera).

### Controls

**Q. Rebindable key map — `src/store.ts:85-118` + `src/controls/Keyboard.ts`**
- Action → key-array map (`forward: ['arrowup','w','z']` — includes AZERTY z/q!), flattened to `keyMap[key.toLowerCase()]`; ignores events from `INPUT` elements; plain window keydown/keyup. folio-2025 already has keybinds but the "ignore INPUT targets" and lowercase normalization details are worth stealing.

**R. Leva tuning editor — `src/ui/Editor.ts`** (React/leva, but the *concept*)
- Live-tunes `radius/width/height/front/back/steer/force/maxBrake/maxSpeed` + all suspension params against the store, with sensible min/max/step per param (steer 0.1–1, force 0–3000, maxBrake 0.1–100, stiffness 0–500...). Use these ranges as your tuning sandbox; vanilla equivalent = lil-gui.

## 2. TOP 5 by impact-for-effort

1. **`store.ts` tuning block + `Vehicle.tsx:60-80` drive loop** — one afternoon to port to Rapier's `DynamicRayCastVehicleController`; it is literally the whole "car feel". Start with their numbers exactly, tune from there.
2. **Chase camera (`Vehicle.tsx:82-108`)** — parent camera to car, lerp position/roll, add sway. ~30 lines, instantly makes driving feel 10× better. Includes the speed-pullback and steer-swing that most chase cams miss.
3. **Skid marks + dust (`Skid.tsx`, `Dust.tsx`)** — two InstancedMeshes, ~120 lines total, the biggest visual-juice-per-line in the repo. Ring-buffer pattern is directly copyable.
4. **RPM/gear audio model (`Chassis.tsx:96-105` + Engine/Accelerate loops)** — the `((gearPosition % 1) + log(gearPosition)) / 6` sawtooth with two crossfading loops gives gear-shifts from a single mp3. Easy with Howler `rate()`.
5. **Goal/checkpoint sensor pattern + split timing (`Goal.ts`, `App.tsx:61-63`, `Checkpoint.tsx`)** — Rapier sensors make this trivial, and it's a game-loop feature (lap timing on portfolio tracks/areas) not just polish.

## 3. Surprising / clever things worth copying

- **Camera is a child of the physics car.** No follow-target math at all — the chase cam just lerps its *local* position. Combined with `rotation.z` roll and tiny sinusoidal sway, it reads as a much fancier camera than it is.
- **Engine sound is 2 loops, not a synth:** crossfading volume between `engine.mp3` (loud at low speed) and `accelerate.mp3` (loud at high speed) + the log-flattened gear sawtooth for pitch fakes a full gearbox with zero samples per gear.
- **Spawns with `angularVelocity [0, 0.5, 0]`** — the car does a little spin on every reset. Free personality.
- **Rear-wheel-only drive and brakes** (`i = 2..4`) — contributes to the drifty, slidey character on purpose; front wheels only steer.
- **Everything mutable lives outside React state** (`mutation` object, `store.ts:234-249`) to avoid re-render overhead; the vanilla analog is just "a plain object your ticker mutates", which you're already doing — validates the approach.
- **Minimap renders the world to a texture once**, not every frame — huge perf win; only 2 sprites update per frame.
- **Speed is just `velocity.length()`** shown as "mph" (`ui/Speed/Text.tsx`) — no unit conversion; maxSpeed 88 chosen because it *reads* well as mph.
- **Gap worth noting:** there is no FOV kick on boost (FOV fixed 75) and no speed-based steering curve — boost juice comes entirely from sway + particles + audio. If you port boost, consider adding `camera.fov = 75 + speed/maxSpeed * 10` with `updateProjectionMatrix()` yourself; it's the one obvious place to go beyond the original.</subagent>
<subagent agent_id="agent-2" item="ecctrl — pmndrs/ecctrl (React Three Fiber + Rapier character/vehicle controller toolkit, MIT). User uses vanilla three.js + Rapier, no React. Analyze: (a) the floating capsule character controller: spring/damping hover force, ground detection raycasts, slope handling, jump, air control, step offset — find the core logic files under src/ and list the exact spring constants, ray lengths, damping values; (b) EcctrlVehicle + ThrustPropeller drone module: how thrust/torque per propeller is applied; (c) moving platform handling. Return a grab list: which mechanics could be transplanted into a car-focused 3D portfolio (e.g. spring-hover feel, character mode, jump pads), with file paths and key values, plus vanilla-JS adaptation notes." outcome="completed">Analysis complete. I read every core file of ecctrl (`src/character/Ecctrl.tsx`, `src/vehicles/EcctrlVehicle.tsx`, `src/vehicles/components/ShapeCastWheel.tsx`, `src/vehicles/components/ThrustPropeller.tsx`, `src/curves/CurveLUT.ts`, `src/gravity/*`, `src/shared/Math.ts`, `src/time/TimeControl.tsx`, plus the demo `example/EcctrlWrapper.tsx` and `example/map/TestMap.tsx`). Nothing modified. Here is the grab list.

# ecctrl grab list — for folio-2025 (vanilla JS + Three.js + Rapier)

Repo: `C:\Users\Juan\Documents\GitHub\_ref-repos\ecctrl` (MIT, © Erdong Chen — attribute in credits/license).

Everything below is React only in its *wiring* (context/refs/useFrame). The actual physics is plain math on a Rapier `world` + rigid body, so every algorithm transplants directly: replace `useFrame` with your tick loop, `useRef` with module-level temp vectors, `useRapier()` with your Rapier world instance.

## 1. GRAB LIST

### Car / Physics feel

**A. Shape-cast wheel suspension (the crown jewel)**
- File: `src/vehicles/components/ShapeCastWheel.tsx` (`floatVehicle`, lines ~537-616)
- Casts a flat `rapier.Cylinder(rayShapeH, rayShapeR)` downward per wheel via `world.castShape`, spring force along the **hit normal** (not up axis): `springForce = springK * max(0, rayLength - toi)`, `dampingForce = dampingC * hitPointVel.dot(up)`, impulse = `(spring - damping) * normal * dt`, applied with `body.applyImpulseAtPoint(floatImp, supportPoint, false)`.
- Defaults: `rayShapeR 0.5, rayShapeH 0.15, rayLength 0.5, springK 180, dampingC 16` — but the demo's tuned car values are the real gold: `springK 38000, dampingC 4000` (heavy car) and `25000/3200` (lighter car), damping comment says max ≈ `2*sqrt(K*mass)`.
- Clever detail: it reprojects the shape-cast witness point back to the wheel center plane (`stableRayHitPoint`) and only blends side support when the normal indicates side contact — kills "contact-patch jacking" while steering.
- *Adapt:* This is a complete arcade raycast-car. folio-2025's car could be rebuilt as chassis cuboid + 4 of these wheels, or you can steal just the normal-aligned spring+damping for a single-body "hover car" feel.

**B. Tire friction model with slip curves + friction ellipse**
- File: `ShapeCastWheel.tsx` (`computeWheelFrictionImpulse`, lines ~730-799)
- Longitudinal/lateral slip ratios → LUT curves (`lngSlipRatioCurveData` peaks at slip 0.25 then falls to 0.7 — real tire behavior), static-friction blend below `lowVelThreshold 0.4`, friction ellipse clamps combined lng/lat impulse, then exponential smoothing (`relaxLngRate 0.05, relaxLatRate 0.1, minRelax 0.3`). Grip derived from the *hit collider's* Rapier friction: `(surfaceFriction + tireGripFactor 1.5) * 0.5`.
- *Adapt:* Even if you keep your current car, steal two cheap lines: lateral velocity kill via impulse along the wheel's left axis, and surface-friction-dependent grip (ice/grass zones for free via collider friction values).

**C. Drivetrain: engine torque curve, gears, steering-speed curve**
- File: `src/vehicles/EcctrlVehicle.tsx` (defaults `DEFAULT_CAR_CONFIG` lines 24-44; `handleUserInput` in ShapeCastWheel ~677-704)
- `engineMaxTorque = horsepower * 7022 / maxRPM`; torque per wheel = `driveDemand * maxTorque * driveRatio * torqueCurveLUT(wheelAngVel/maxAngVel)`; auto transmission shifts at `shiftUpRPM 5200 / shiftDownRPM 2200` with `shiftCooldown 0.35s`; steering angle scaled by speed through `steerAngleCurveData` (full lock below 20% speed, 40% at top speed) with `steerRate = 2π rad/s` rate limiting, `maxSteerAngle = π/6`.
- *Adapt:* The "speed-sensitive steering" curve alone fixes the #1 arcade-car feel problem (spinning out at high speed). One LUT lookup per frame.

**D. Floating capsule character controller (spring hover)**
- File: `src/character/Ecctrl.tsx` (`floatCharacter` ~582-675, `applyFloatingForce` ~677-691)
- Shape-cast a `rapier.Ball(rayRadius)` from `pos + up*rayOriginOffest` downward, length `rayLength`. Defaults: `capsuleHalfHeight 0.3, capsuleRadius 0.3, floatHeight 0.2, rayOriginOffest -0.3, rayHitForgiveness 0.28, rayLength = radius+1, rayRadius = radius/2, springK 80, dampingC 6` — demo tunes to `springK 6400, dampingC 860` at `density 200` (so K scales with mass; rule of thumb K ≈ 32×mass, C ≈ 4.3×mass).
- Grounded when `hitDist < rayRadius + floatHeight + rayHitForgiveness` — the forgiveness band is what makes it walk up steps/curbs with **no explicit step-offset logic**.
- *Adapt:* A walk mode (get out of the car and explore on foot) becomes a weekend feature instead of a month. The spring values scale trivially to your character mass.

**E. Movement impulse model + slope projection**
- File: `Ecctrl.tsx` (`moveCharacter` ~454-494, `slopeDetect` ~720-735)
- Impulse = `m * clamp(accDeltaTime,0,1) * frictionCoef * (desiredVel - currentVelOnPlane - rejectVel)`, applied at `pos + up*0.5` (`moveImpulsePointOffset`, raises application point so the capsule doesn't flip). Moving direction is rotated by `slopeAngleInFront = -asin(slopeNormal · inputDir)` so you glide up slopes instead of pushing into them. `rejectVel` kills sideways velocity when grounded (`rejectVelFactor 1`) → instant, non-drummy direction changes.
- *Adapt:* `rejectVel` + slope-rotated input direction are ~10 lines each and improve any character/prop controller.

**F. Dynamic gravity scale (the "game feel" gravity trick)**
- File: `Ecctrl.tsx` (`applyDynamicGravity` ~827-846)
- On ground: `gravityScale = 0` (spring does all support → no jitter). Rising: normal gravity. Falling: `fallingGravityScale 3` until `fallingMaxVel 20`, then 0. Jump: `jumpVel 5` (demo 6), `jumpDuration 0.1s`, `slopeJumpFactor` blends jump direction toward slope normal.
- *Adapt:* Falling with 3× gravity is the single cheapest "game feel" upgrade there is — applies to the car after jumps too (snappier landings).

**G. Auto-balance + turn torque (PD on a rigid body)**
- File: `Ecctrl.tsx` (`autoBalanceCharacter` ~518-522, `turnCharacter` ~527-534)
- Upright torque = `(bodyY × worldUp) * autoBalanceSpringK - angVelOnPlane * autoBalanceDampingC` (defaults `0.5/0.03`, demo `50/3` at density 200). Yaw turn torque = `bodyY * angle * 0.08 - angVelOnY * 0.006` (demo `8/0.76`).
- *Adapt:* Directly reusable as car "self-righting" / anti-flip assist, or for any toy physics prop that should stay upright.

**H. Drone / thrust propeller module (quadcopter mixer!)**
- Files: `src/vehicles/components/ThrustPropeller.tsx`, mixer in `EcctrlVehicle.tsx` (`applyDroneControl` ~754-782, `computePropellerFinalThrottle` ~693-700)
- Each propeller reports thrust axis + `torqueInfluence = localPos × thrustForce + reactionTorque` (reaction torque = `maxThrust 500 * torqueRatio 0.6`, alternate props `invertTorque` like a real quad). PD controller: tilt toward desired acceleration with `TILT_P 15, TILT_D 3`, yaw `YAW_VEL_P 4`, speed clamps `maxHorizSpeed 30, maxVertSpeed 8, maxTiltAngle π/4`, plus the "safe mix" clamp `maxSafeMix = min(1-hover, hover)` so yaw/roll never changes altitude. Per-prop: `applyImpulseAtPoint(thrust*throttle*dt, worldPos)` + `applyTorqueImpulse`.
- *Adapt:* A flyable drone (camera drone achievement? fly-over mode?) drops straight out of this. Also reusable as a "jump pad"/thruster mechanic: thrust at a point = instant hoverboard/fan.

### Props & toys

**I. Enter/exit vehicle system**
- File: `example/EcctrlWrapper.tsx` (`handleVehicleAccess` ~108-163, sensor collider ~913-926)
- A Rapier **sensor** cylinder on the car toggles `ableToAccess` when the character capsule (identified by collider `name`) intersects; `F` switches the active controller; exit position computed as `carPos + sideAxis * 1.5` with yaw rebuilt via `makeBasis(side, up, fwd)` → `Euler "YXZ"`.
- *Adapt:* Your project has named colliders already; the sensor + controller-swap + exit-transform pattern is ~80 lines vanilla.

**J. Counter-force on standing objects (Newton's third law juice)**
- File: `Ecctrl.tsx` (`applyMassOnStandCollider` ~696-705, `applyCounterMoveImp`/`applyJumpImpulse` ~811-821); wheels: `applyMassOnStandCollider`/`applyFricitonOnStandCollider`
- Applies opposite impulses to whatever dynamic body you stand on: weight `m*g*dt`, jump recoil `-m*jumpVel`, move recoil, wheel friction. Makes stacked boxes, seesaws, floating planks react to the player.
- *Adapt:* If folio-2025 has pushable props, standing/driving on them will feel 10× more physical for ~20 lines.

### World systems

**K. Moving platform handling (kinematic + dynamic)**
- Files: `Ecctrl.tsx` (`isOnMovingObjectDetect` ~754-792, `computeRelativeVelocity` ~797-806); `ShapeCastWheel.tsx` ~621-652; platforms in `example/map/TestMap.tsx` ~101-125
- If the ray-hit body is dynamic (type 0) or kinematic (type 2): compute platform point velocity = `linvel + angvel × (charPos - platformCoM)`, scaled by `massRatio = LUT(clamp(platformMass/charMass, 0, 1))`, then **subtract it from the character's velocity before all control math** (relative-velocity frame). Also rotates the character's facing by the platform's angular velocity quaternion so you don't slide off carousels.
- *Adapt:* Platforms themselves are just `setNextKinematicTranslation/Rotation` driven by `sin(time)` — you already do this pattern; the relative-velocity trick is the part worth stealing for elevators/ferries/rotating platforms the car can drive onto.

**L. Custom gravity fields**
- Files: `src/gravity/useCustomGravity.ts`, `example/GravityField.tsx`; applied via `gravityField(pos)` → `applyImpulse(g * m * gravityScale * dt)`, with gravity direction smoothly slerped (`gravityDirLerpSpeed 6`, `1 - exp(-speed*dt)` smoothing) and the robust `createSlerpVec3` in `src/shared/Math.ts` (handles the antipodal case).
- *Adapt:* Low-gravity zone / moon area / upside-down room achievement. ~40 lines total.

**M. CurveLUT — Hermite curve baking**
- File: `src/curves/CurveLUT.ts` (108 lines, dependency-free)
- Weighted cubic Hermite (tangent angles in radians + weights) baked into a 50-sample `Float32Array` LUT with lerp evaluation. Used for torque curve, steer curve, slip curves, mass falloff.
- *Adapt:* Copy the file verbatim. Use it everywhere you'd otherwise hand-write `MathUtils.smoothstep` chains — engine feel, camera FOV vs speed, audio pitch vs RPM.

**N. TimeControl — slow motion / pause**
- File: `src/time/TimeControl.tsx`: `world.step(clamp(delta, 0, 1/30) * timeScale)` with delta clamping.
- *Adapt:* In vanilla Rapier you own `world.step` already — the takeaway is the `maxDelta 1/30` clamp (prevents physics explosions on tab-refocus) and timeScale for crash slow-mo juice.

### Effects & juice

- **Exponential damping idiom everywhere**: `lerp(cur, target, 1 - exp(-rate * dt))` for wheel model suspension bounce (`wheelModelLerpPosRate 10`), propeller spin-up (`propellerModelMaxSpin 50, lerpRate 10`), gravity direction. Frame-rate independent — adopt as house style (folio already has lerps; this is the correct form).
- **fpsCorr = `60 * world.timestep`** multiplier on all impulses — keeps tuning stable when timestep changes.
- **Debug arrow helpers** (`ArrowHelper` scaled by impulse * `debuggerArrowScale 10`) for suspension/friction/engine forces — worth building once for tuning your car; the demo tunes springK/dampingC live with Leva for a reason.
- **Wheel visual update**: wheel mesh Y lerps to `-(rayLength + R) + wheelRadius + (rayLength - toi)` (suspension compression), `rotation.x += wheelAngVel * dt` — exactly the visual suspension bounce a portfolio car needs.

### Audio

- Nothing in ecctrl (no audio code). But: `engineRPM.current` is computed from real wheel RPM × gear ratio — pipe that into a Howler `rate()` (playback speed) and you have a pitch-correct engine loop with gear shifts, for free from grab C.

### Camera

- `src/gravity/EcctrlCameraControls.tsx`: subclass that re-bases the camera's up-axis via pivot quaternions — only needed if you do gravity zones (grab L).
- `example/EcctrlWrapper.tsx` ~165-300: follow-camera smoothing (`smoothTime 0.1`), camera-collision mesh list (collect static meshes, raycast to prevent clipping), pointer-lock toggle, and "dolly to first person" trick (`dolly(distance - 0.02)`).
- *Adapt:* folio-2025 already has a follow camera; steal the camera-collision raycast and the dynamic-up-axis math if you add gravity areas.

## 2. TOP 5 (impact-for-effort)

1. **A+B — ShapeCastWheel suspension + tire friction.** A complete, battle-tested arcade car on plain Rapier impulses. Highest effort of the list (~700 lines to port) but it *is* the core mechanic of a drive-around portfolio, and the demo's tuned values (`springK 38000/dampingC 4000`, slip curves) are proven. Even a partial port (normal-aligned spring + lateral friction impulse) transforms car feel.
2. **F — Dynamic gravity scale (3× fall, 0 on ground) + jump impulse model.** ~30 lines, instant game-feel upgrade for both character and car landings.
3. **M — CurveLUT.ts.** 108 lines, zero deps, copy verbatim. Unlocks torque curves, speed-sensitive steering (from C), audio pitch curves, camera curves — the "tuning infrastructure" everything else hangs off.
4. **D+E — Floating capsule character mode.** Spring values given (scale K≈32×mass, C≈4.3×mass), step climbing via `rayHitForgiveness` band with no step-offset code, slope-projected movement, `rejectVel`. Turns "walk around outside the car" into a small feature — and combined with I (sensor enter/exit) you get the full Bruno-Simon loop.
5. **K — Moving-platform relative velocity.** ~40 lines; makes elevators/rotating platforms carry the car/character correctly instead of sliding — a classic "wow" portfolio toy (drive onto a moving ferry/elevator to reach a hidden area).

## 3. Surprising / clever bits worth copying

- **No step-offset code at all** — step climbing falls out of the "forgiveness" band: grounded = `hitDist < floatDist + rayHitForgiveness`. The spring just pushes you up over curbs. Most character controllers have a whole step module for this.
- **Gravity scale 0 while grounded** — the spring provides all support force, so there's zero resting jitter and slopes don't slide you; gravity only exists in the air.
- **Applying move impulse above the center of mass** (`moveImpulsePointOffset 0.5`) so the capsule leans into acceleration slightly instead of tipping — a one-line feel trick, also applicable to the car (apply drive force at wheel contact, not CoM).
- **The drone mixer** (`computePropellerFinalThrottle` + `maxSafeMix = min(1-hover, hover)`) is a genuine quadcopter control mixer (PX4-style) shrunk to 15 lines — yaw never steals lift.
- **Witness-point reprojection in the wheel shape-cast** — projects the shape-cast hit back onto the wheel's center plane before computing friction, eliminating steering jacking. Subtle, and the kind of bug you'd chase for days.
- **Everything is impulses × `world.timestep`, never forces** — with `fpsCorr = 60*timestep` as the universal correction factor, which is why the tuning survives any framerate; and bodies are allowed to **sleep** (explicit wake checks before applying impulses) so parked cars cost nothing.
- **`friction: -0.5` on the character rigid body** — negative collider friction, since all friction is hand-computed; combined with Rapier's friction *average* combine rule it yields `(-0.5 + surface)/2` clamped ≥ 0. Hacky but deliberate.

Caveats for the port: ecctrl uses `@dimforge/rapier3d-compat` API names (`castShape(..., QueryFilterFlags.EXCLUDE_SENSORS, ...)`, `time_of_impact` vs `timeOfImpact` depending on ray vs shape cast) — match against whichever rapier3d build folio-2025 pins. The Leva debug panels and zustand stores are React-only and should be dropped (folio likely has its own debug UI or none). MIT: keep the `NOTICE`/attribution line from the repo header in any ported file.</subagent>
<subagent agent_id="agent-3" item="use-cannon + cannon-es — Two repos at C:\Users\Juan\Documents\GitHub\_ref-repos\use-cannon (react-three-cannon, MIT, examples live in packages/react-three-cannon-examples/src/demos/) and C:\Users\Juan\Documents\GitHub\_ref-repos\cannon-es (the physics engine itself, MIT). User uses vanilla three.js + Rapier, no React. From use-cannon demos analyze: RaycastVehicle demo, Pingpong (paddle control + restitution), Chain (point-to-point constraints), CubeHeap (performance with many bodies), Constraints demo, Trimesh/convex hull demos. From cannon-es analyze: what's worth reading to understand solver tuning — default solver iterations, contact stiffness/relaxation defaults, friction/restitution combine rules (src/world/World.ts, src/material/ContactMaterial.ts), and SAPBroadphase vs NaiveBroadphase performance notes. Return a grab list: demo mechanics worth porting (with file paths + parameter values) and engine-tuning knowledge that translates to Rapier equivalents (solver iterations, contact params)." outcome="completed">I have everything verified. Here's the full report.

# GRAB LIST — use-cannon + cannon-es → Rapier/vanilla folio-2025

All paths verified by reading the code. `uc-` = `C:\Users\Juan\Documents\GitHub\_ref-repos\use-cannon\packages\react-three-cannon-examples\src\demos\`, `ce-` = `C:\Users\Juan\Documents\GitHub\_ref-repos\cannon-es\src\`.

## 1. Categorized grab list

### Car / Physics feel

**RaycastVehicle demo — complete tuning recipe** — `uc-RaycastVehicle\Vehicle.tsx`
- Chassis: box args `[1.7, 1, 4]`, `mass: 500`, `allowSleep: false`.
- Wheels: `radius: 0.7`, layout `front: 1.3`, `back: -1.15`, `width: 1.2`, chassis connection height `-0.04`.
- Suspension (shared `wheelInfo`, lines 39–52): `suspensionStiffness: 30`, `dampingCompression: 4.4`, `dampingRelaxation: 10`, `maxSuspensionTravel: 0.3`, `suspensionRestLength: 0.3`, `maxSuspensionForce: 1e4`, `frictionSlip: 2`, `axleLocal: [-1,0,0]`, `directionLocal: [0,-1,0]`, `customSlidingRotationalSpeed: -30`.
- Controls (lines 99–120): engine `force: 1500` on rear wheels (indices 2,3), `steer: 0.5` rad on front wheels (0,1), `maxBrake: 50` on rear; reset zeroes velocity + restores pose.
- Scene (`index.tsx:69-72`): `broadphase="SAP"`, `allowSleep`, and crucially `defaultContactMaterial={{ contactEquationRelaxation: 4, friction: 1e-3 }}` — near-zero ground contact friction is intentional because tire grip comes entirely from `frictionSlip`, not from collider friction.
- *Rapier note:* maps 1:1 to `RAPIER.DynamicRayCastVehicleController` (`world.createVehicleController(chassisBody)` → `addWheel(connectionPoint, direction, axle, suspensionRestLength, radius)` → `setWheelSuspensionStiffness / setWheelSuspensionCompression / setWheelSuspensionRelaxation / setWheelMaxSuspensionTravel / setWheelFrictionSlip / setWheelEngineForce / setWheelSteering / setWheelBrake`, then `controller.updateVehicles(dt)` per step). Keep ground collider friction low (0.001–0.1) and do grip via `frictionSlip`. rapier3d's vehicle controller is built on the same Bullet-style raycast model as cannon's, so these exact numbers are a valid starting point.

**Keyboard controls map** — `uc-RaycastVehicle\use-controls.ts`
- Plain boolean-ref pattern: `keyControlMap` maps `w/s/a/d` + arrows + space=brake + `r`=reset; keydown/keyup flip booleans, consumed in the frame loop. No per-frame event parsing.
- *Rapier note:* already framework-free logic — strip the `useRef/useEffect` and use a plain object; drop straight into vanilla JS.

**Hinge-motor walking robot** — `uc-demo-HingeMotor.tsx`
- Motorized hinge chain: `enableMotor()/disableMotor()`, `setMotorSpeed(7)` (2 when clicked), hinge axes `[0,0,1]`, `collideConnected: false`, `linearDamping: 0.4`. Collision-filter bitmasks (`GROUP_GROUND = 2**0`, `GROUP_BODY = 2**1`) so limbs only hit the ground. Needs `iterations={80}` and `gravity [0,-40,0]` to stay stable.
- *Rapier note:* `RAPIER.JointData.revolute(...)` + `configureMotorVelocity(targetVel, factor)` on `RevoluteImpulseJoint`; bitmask groups map directly to Rapier `setCollisionGroups((membership<<16)|filter)`. Lesson: self-collision filtering is what makes articulated props feasible, and long joint chains demand high solver iterations (in Rapier raise `world.numSolverIterations`).

**Friction materials system** — `uc-demo-Friction.tsx` + `ce-world/World.ts:656-662`
- Material-pair table: e.g. rubber×ground `friction: 0.4, restitution: 0.3, contactEquationStiffness: 1e8, contactEquationRelaxation: 3`; slippery `friction: 0`; bouncy `restitution: 1.1` (set on the material itself, overrides pair values). Rubber-slipping is toggled live by swapping the ContactMaterial (`friction: rubberSlips ? 0 : 1`, line 129).
- Lookup rule (verified in `World.ts:658-661`): pair's ContactMaterial if found, else `defaultContactMaterial` (`friction 0.3, restitution 0.0` at `World.ts:248-251`); a non-negative material-level friction/restitution overrides the pair value.
- *Rapier note:* Rapier has no material pairs — instead per-collider `ColliderDesc.setFriction(v)` / `setRestitution(v)` plus `setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min|Max|Average|Multiply)`. Build a tiny named-material table (`'ice' → {friction:0.05}`, `'rubber' → {friction:1.0}`, use `Min` combine so any slippery surface wins) — replicates the demo's zones (ice patch, bouncy pad) with ~30 lines.

### Props & toys

**Pingpong — kinematic mouse paddle + restitution toy** — `uc-Pingpong\index.tsx`
- Paddle: kinematic box `[3.4,1,3]`, teleported each frame to `(mouse.x*10, mouse.y*5, 0)`; roll lerped `lerp(v, mouse.x*Math.PI/5, 0.2)` — this rotation-lag is what lets the player "slice" the ball. Ball: sphere `radius 0.5, mass 1`. World: `gravity [0,-40,0]`, `restitution 0.7`, `friction 0.9`, `contactEquationStiffness 1e7`, `contactEquationRelaxation 1`, `frictionEquationRelaxation 2`, `iterations 20`, `tolerance 0.0001`, `allowSleep false`. Floor trigger at y=-10 resets score.
- *Rapier note:* kinematic → `RigidBodyDesc.kinematicPositionBased()` + `setNextKinematicTranslation/Rotation` each frame (never `setTranslation` — that skips velocity inference and kills the slice effect). Restitution 0.7 / gravity −40 port directly. Exaggerated gravity (4×) is the core "arcade feel" takeaway — matches what a drive-around game wants.

**Chain — breakable cone-twist constraint chain** — `uc-demo-Chain.tsx`
- Links: cylinder `[0.5,0.5,2,16]`, `mass 1`, `linearDamping 0.8`; each joined to parent with ConeTwist: `pivotA [0,-h/2,0]`, `pivotB [0,h/2,0]`, `angle Math.PI/8`, `twistAngle 0`, axes `[0,1,0]`. `maxMultiplier` (0/500/1000/1500/∞) makes chains breakable by impulse — the demo color-codes chains by break strength. Top handle is a kinematic pointer-driven box. `gravity [0,-40,0]`, `allowSleep false`.
- *Rapier note:* cone-twist ≈ `RAPIER.JointData.spherical(anchorA, anchorB)` (cone limit needs a custom check) or `JointData.rope(maxLen, anchorA, anchorB)` for a pure distance chain. Rapier joints don't auto-break — read `joint.impulse`? Not exposed in JS; instead measure anchor distance or relative velocity each frame and `world.removeImpulseJoint()` past a threshold. `linearDamping: 0.8` is the key value — undamped chains jitter; `setLinearDamping(0.8)` ports directly. Great for hanging props/lamps/tire swings the car can break.

**Spring constraint (click-to-tighten)** — `uc-demo-Constraints.tsx`
- `useSpring(box, ball, { stiffness: 100, damping: 1, restLength: 2 })`; `setRestLength(0|2)` toggles on click. Box `linearDamping: 0.7`; ball is a kinematic mouse-follower.
- *Rapier note:* Rapier JS has no spring joint — implement Hooke's law manually: each frame `F = -k*(dist - rest) - c*relVel`, `applyImpulse(F*dt)` on both bodies. 10 lines, and it covers bungee props, magnets, tow ropes.

**Triggers (sensor volumes)** — `uc-demo-Triggers.tsx`
- `useBox({ isTrigger: true, onCollide })` — a `4×1×4` box at y=5 that fires events without physics response (changes scene bg color).
- *Rapier note:* `ColliderDesc.setSensor(true)` + `EventQueue(true)` → `drainIntersectionEvents`/`drainContactForceEvents`. This is exactly how folio-2025's area triggers/achievements should work; grab the pattern, not the code.

**ConvexPolyhedron colliders from render geometry** — `uc-demo-ConvexPolyhedron.tsx`
- `toConvexProps()`: `Geometry().fromBufferGeometry(geo)`, `mergeVertices()`, then `vertices` + `faces` feed `useConvexPolyhedron({ mass: 100 })`. Used for diamond GLB, cones, even cubes (comment: "wildly inefficient vs useBox").
- *Rapier note:* even simpler — `RAPIER.ColliderDesc.convexHull(Float32Array of positions)` does the merge internally. Use for chunky props; prefer `cuboid`/`ball` primitives when the shape allows.

**Trimesh static bowl** — `uc-demo-Trimesh.tsx`
- Extracts `geometry.attributes.position.array` + `index.array` from a GLB, `useTrimesh({ args:[vertices,indices], mass: 0 })` — static trimesh with dynamic spheres (rendered as TorusKnots with sphere colliders! visual ≠ collider) bouncing inside.
- *Rapier note:* `RAPIER.ColliderDesc.trimesh(vertices, indices)` on a fixed body. Same rules: static-only, and the "cheap collider under fancy mesh" trick (sphere body + TorusKnot mesh) is the real grab.

**Heightfield terrain** — `uc-demo-Heightfield.tsx`
- Heights as `number[][]` grid + `elementSize`; visual plane built from the same matrix (vertices `[i*dx, j*dy, z]`), so collider and mesh can never diverge.
- *Rapier note:* `RAPIER.ColliderDesc.heightfield(nrows, ncols, heights, scale)`. If the folio world ever wants rolling hills, generate both mesh and collider from one height array.

### World systems

**Fixed-timestep accumulator with maxSubSteps** — `ce-world/World.ts:486-510` (`step(dt, timeSinceLastCalled, maxSubSteps = 10)`), convenience `fixedStep(dt = 1/60, maxSubSteps = 10)` at `:462-471`, with body interpolation between states (`interpolatedPosition`).
- Pattern: `accumulator += frameDt; while (accumulator >= dt && substeps < maxSubSteps) { internalStep(dt); accumulator -= dt }`; capped substeps prevent the spiral of death.
- *Rapier note:* Rapier JS steps the whole world per call — keep `world.timestep = 1/60`, run the same accumulator loop yourself, cap at ~5 substeps, and interpolate (or accept 60 Hz lock). cannon's `maxSubSteps: 10` and use-cannon's `stepSize = 1/60` (`physics-provider.tsx:65,71`) are the reference values.

**Sleeping** — World option `allowSleep` (default false in cannon; enabled in RaycastVehicle scene, disabled in toy scenes), chassis explicitly `allowSleep: false`.
- *Rapier note:* Rapier sleeps bodies automatically; a driven vehicle needs `rigidBody.setSleeping(false)`/activation — same carve-out as the demo's chassis.

**use-cannon Provider defaults** — `use-cannon\packages\react-three-cannon\src\physics-provider.tsx:56-72`: `iterations = 5` (deliberately lower than cannon's 10 — games trade accuracy for speed), `tolerance = 0.001` (looser than cannon's 1e-7), `gravity [0,-9.81,0]`, `stepSize 1/60`, `maxSubSteps 10`, `broadphase 'Naive'` by default (SAP opt-in), `defaultContactMaterial = { contactEquationStiffness: 1e6 }`.

### Effects & juice

**Impact-velocity-scaled audio + scoring** — `uc-Pingpong\index.tsx:27-34`
- `pong(velocity)`: `ping.currentTime = 0; ping.volume = clamp(velocity/20, 0, 1); ping.play()`; score only increments if `velocity > 4`. Velocity from `e.contact.impactVelocity`.
- *Rapier/Howler note:* Rapier `drainContactForceEvents` gives `totalForceMagnitude` (or compute relative velocity at contact via narrow-phase contact pairs). With Howler: `sound.seek(0); sound.volume(clamp(v/20,0,1)); sound.play()` — and gate game logic on a velocity threshold so taps don't count. This is the single best "juice per line" pattern in both repos.

**Visual–collider mismatch for charm** — TorusKnot meshes on sphere colliders (`demo-Trimesh.tsx:42-50`), skinned arm GLB on a plain box paddle. Cheap colliders, expressive visuals.

### Audio
Only one real pattern (above): retrigger via `currentTime = 0`, volume from impact velocity, threshold-gated scoring. Ping sound asset at `uc-Pingpong\resources\ping.mp3`.

### Camera
Nothing to grab — every demo uses static cameras or OrbitControls; the folio's chase-cam has no counterpart here. (Pingpong `fov 50, position [0,5,12]` and Chain `[0,5,20]` are just stage framing.)

## 2. TOP 5 by impact-for-effort

1. **RaycastVehicle wheelInfo + force/steer/brake values** (`Vehicle.tsx:39-52, 99-120`) — a complete, play-tested arcade-car tune that ports almost verbatim to Rapier's `DynamicRayCastVehicleController`. Biggest direct upgrade to the core game. Include the counterintuitive ground-friction ≈ 0 trick (`index.tsx:71`).
2. **Impact-velocity sound/score gating** (`Pingpong/index.tsx:27-34`) — ~10 lines with Howler; instantly makes every collision in the world feel physical.
3. **Named-material friction table with combine rules** (`demo-Friction.tsx` + `World.ts:658-661`) — small lookup table + Rapier `CoefficientCombineRule` gives you ice patches, bouncy pads, rubber zones — high gameplay variety for trivial effort.
4. **Fixed-timestep accumulator + maxSubSteps cap** (`World.ts:486-510`) — if folio-2025 currently steps per rAF delta, this fixes physics instability across framerates; ~20 lines, uses values verified in two repos (1/60, 10 substeps).
5. **Kinematic pointer/animated props with rotation-lag** (`Pingpong` paddle, `demo-Chain.tsx:99-118` PointerHandle) — `lerp(target, 0.2)` lag on kinematic bodies is what makes moving platforms/paddles/gates feel good; direct `setNextKinematicTranslation` port.

## 3. Surprising / clever

- **Wheel friction ≠ contact friction**: the RaycastVehicle scene sets world default contact friction to `1e-3` — the chassis/wheels slide freely; all grip is synthetic via `frictionSlip: 2`. If your Rapier car feels "sticky" or rolls over at low speed, your ground friction is doing work that should belong to the tire model.
- **cannon's solver iterations are a budget, not a cost**: `GSSolver.solve` (`ce-solver/GSSolver.ts:112-115`) early-outs when total impulse error² < `tolerance²`. So `iterations: 20` (Pingpong) or `80` (HingeMotor) only cost what the scene needs. use-cannon knowingly ships *lower* defaults than the engine (5 vs 10, tolerance 0.001 vs 1e-7) — tune per scene, not globally.
- **SPOOK stiffness/relaxation have no Rapier per-contact equivalent**: cannon's `contactEquationStiffness: 1e7, relaxation: 3` (`ce-material/ContactMaterial.ts:88-95`) is soft-constraint tuning. Rapier is impulse-based; the closest knobs are global `world.integrationParameters` (erp/natural frequency) and joint-local motors — meaning the *feel* must be re-tuned with friction/restitution/combine rules + solver iterations (`world.numSolverIterations`, default 4), not transcribed. Don't try to port stiffness values numerically.
- **SAPBroadphase axis choice**: `SAPBroadphase.autoDetectAxis` (`ce-collision/SAPBroadphase.ts:220-262`) picks the sort axis by world AABB spread ("pick the axis where bodies are most distributed", `:21-24`). Irrelevant for Rapier (its broadphase is automatic) — one whole category of cannon tuning you get to skip.
- **`customSlidingRotationalSpeed: -30`** keeps wheels visually spinning during slides — a one-flag drift-juice feature; Rapier's controller exposes no equivalent, but you can fake it by spinning the wheel mesh when `wheelIsInContact && sliding`.
- **Teleport-a-random-body liveliness**: CubeHeap (`demo-CubeHeap.tsx:35,56`) respawns one random instance per frame so the pile never settles — a cheap trick for "busy world" props. (Note: with Rapier, 200 bodies + `InstancedMesh` is comfortable; cannon needed SAP for this, Rapier doesn't.)
- **`Geometry().fromBufferGeometry()` + `mergeVertices()`** (`demo-ConvexPolyhedron.tsx:11-17`) is the legacy-three shim for deduping vertices before convex collider creation — if your GLB props have duplicated vertices, dedupe before `convexHull` or hull quality suffers.

Nothing in either repo covers chase cameras or Howler-style positional audio — those gaps are worth noting so the parent agent doesn't expect grabs there.</subagent>
<subagent agent_id="agent-4" item="verlet-js + Oimo.js — Two repos at C:\Users\Juan\Documents\GitHub\_ref-repos\verlet-js (MIT, ~small verlet-integration physics: cloth, ropes, tire/particles) and C:\Users\Juan\Documents\GitHub\_ref-repos\Oimo.js (MIT, light 3D physics engine with demos: ragdolls, vehicles, dominoes). Analyze verlet-js: the core integrator (lib/verlet-js or js files), Composite/Particle/Constraint structure, the demo effects (cloth, spiderweb, tree/fractal, tire with treads) — which of these could be ported as decorative/juicy physics toys into a three.js + Rapier 3D portfolio world (e.g. hanging banners, rope bridges, soft flags), and how hard each port would be. Analyze Oimo.js demos: which demo mechanics (ragdoll, vehicle setup values, ball/dice piles, joint playgrounds) are worth stealing as ideas, with file paths and key parameter values. Return a categorized grab list." outcome="completed"># Grab List — verlet-js + Oimo.js

Both repos verified by reading the actual code. Key architectural takeaway up front: **verlet-js is 2D** (`lib/vec2.js`), and its demos are worth porting as a tiny self-contained verlet integrator running *outside* Rapier (position-based dynamics is far cheaper and more stable for decorative cloth/rope than rigid-body joints). Oimo.js is worth mining for **parameter values, joint patterns, and demo composition ideas**, not its engine internals.

---

## 1. GRAB LIST

### Props & toys

**A. Verlet rope / lineSegments → hanging ropes, rope bridges, string lights**
- Source: `verlet-js/lib/objects.js:40` (`lineSegments(vertices, stiffness)`), `verlet-js/lib/constraint.js:34` (`DistanceConstraint` relax solver), `verlet-js/examples/shapes.html:49` (5-point rope pinned at both ends, stiffness `0.02` — deliberately saggy).
- What: chain of particles with distance constraints; pin ends with `composite.pin(index)`. Relax loop runs `step` iterations per frame (`sim.frame(16)` in demos).
- Adapt: swap `Vec2`→`THREE.Vector3` (or a 40-line Vec3 clone), render as `THREE.TubeGeometry` rebuilt per frame or a `Line`; attach pin ends to Rapier body positions for ropes that react to physics. **Easy (½ day).**

**B. Cloth → flags, banners, awnings over area entrances**
- Source: `verlet-js/lib/objects.js:55` (`cloth(origin, w, h, segments, pinMod, stiffness)`), demo `verlet-js/examples/cloth.html:56` — 20×20 grid, pinMod `6` (pin every 6th top-row particle), stiffness `0.9`, `sim.friction = 1`.
- Clever bit: `cloth.html:74-83` computes per-quad "local pull" (`off`) and maps it to color/opacity — drive a vertex-color or shader uniform from constraint stretch for free "shimmering fabric" juice.
- Adapt: same Vec3 swap; build a `PlaneGeometry` and write particle positions into its position attribute each frame, recompute normals. Wind = add `sin(t + x)` noise to particle positions before integration (the tree demo does exactly this at spawn, `tree.html:79-82`). **Easy-medium (1 day).**

**C. Tire/soft-wheel composite → squishy tire piles, bouncy decorative wheels**
- Source: `verlet-js/lib/objects.js:86` (`tire(origin, radius, segments, spokeStiffness, treadStiffness)`). Ring particles + center particle; treads linked to neighbors and to `i+5` for shear resistance, spokes to center.
- Tuned values from `shapes.html:53-55`: soft `(r=50, seg=30, spoke=0.3, tread=0.9)`, floppy `(seg=7, 0.1, 0.2)`, rigid `(seg=3, 1, 1)` — a ready-made stiffness cheat sheet.
- Adapt: pure verlet again; in a car portfolio this is thematically perfect (a pile of soft tires you can shove). **Medium (1 day incl. mesh skinning).**

**D. Ragdoll (13 bodies, 12 joints) → crash-test-dummy prop / bowling pins with personality**
- Source: `Oimo.js/examples/test_ragdoll.html:270-328`. Body part sizes: pelvis/spine boxes `[20,10,15]`, head sphere `10`, arms `[20,10,10]`/`[20,8,8]` with `rot:[0,0,±20]` splay, legs `[10,20,10]`/`[8,20,8]`.
- Joint recipe: spine joints `min:2, max:20, spring:[2, 0.3]` (soft angular springs); shoulders use diagonal axes `axe1/axe2:[0,1,1]`; knees hinge `axe:[1,0,0], min:2, max:60`. Collision between parts toggleable (`collision:collision`).
- Recycling trick (`test_ragdoll.html:356-391`): when pelvis `y < -200`, `resetPosition` all 13 bodies to a spawn point — a respawn pattern for any prop that falls out of the world.
- Adapt: Rapier `sphericalJoint`/`revoluteJoint` with `configureJointLimits` + `setContactsEnabled(false)`; springs map to joint motor stiffness/damping. **Medium (1–2 days).**

**E. Soft-body donut rings (ball chains) → necklaces, hanging bead chains, flexible tubes**
- Source: `Oimo.js/examples/demos/donut.js:36-76`. 16 spheres (radius `3`, margin `0.3`) in a ring, joined either by `jointBall` (rigid) or `jointHinge` with `spring:[2, 0.3], min:90, max:-90, collision:false`; mesh skinned via `THREE.Tubular` updated from body positions each frame (`updatePath()`).
- Adapt: Rapier spherical joints between small spheres, or — cheaper — verlet rope closed into a loop (item A). The `spring:[2,0.3]` values transfer directly to Rapier joint spring frequency/dampingRatio. **Medium.**

**F. Bead-chain "jewel" ring → decorative chain curtains**
- Source: `Oimo.js/examples/demos/jewel.js:21-31`. 150 unit spheres on radius 50, each hinge-joined to the next (`pos1:[0,-1,0], pos2:[0,1,0], spring:[2,0.3]`) and closed into a loop. Falls as a wobbling chain torus.
- Adapt: verlet loop (cheaper) or Rapier rope via revolute joints. **Easy-medium.**

**G. Dice/box pile + wrecking sphere**
- Source: `Oimo.js/examples/demos/stacking.js:30-39`. 6×10×6 grid of boxes, size `d-m` (`d=1`, `m=0.01` — tiny gap prevents initial interpenetration), `friction:0.4, restitution:0.1`; wrecking sphere `density:10, friction:0.3, restitution:0.3`.
- Also `jewel.js:38-43`: random dice `size 5–15` scattered with `geo.dice` custom geometry.
- Adapt: trivial in Rapier (cuboids + same friction/restitution). The 1% size-gap trick directly fixes Rapier "exploding stacks on spawn." **Trivial (hour).**

**H. Circular brick tower to smash through**
- Source: `Oimo.js/examples/demos/tower.js:26-67` (`addTower`). Brick depth formula `sz = radius*5/detail`, alternating-course offset `(j & 1) * 0.5` (real masonry bonding), `mass:0.4`, `restitution:0.1`; sphere projectile `density:0.6` fired at it, plus a ramp `rot:[0,0,60]`.
- Adapt: pure math, ports verbatim to Rapier cuboids. Perfect drive-through set piece next to the car. **Easy (few hours).**

### World systems

**I. Sleeping-body material swap (perf-aware visual state)**
- Source: pattern repeated in every Oimo demo, e.g. `tower.js:80-81`, `test_ragdoll.html:350-353,394-397` — `if (b.sleeping) m.material = mat.sleep else m.material = mat.move`.
- Adapt: Rapier bodies expose `isSleeping()`; swap to a cheaper material / skip per-frame mesh updates for slept props in a dense world. Also confirms sleeping exists and is cheap — islands sleep after `sleepTime > 0.5s` (`src/core/World.js:708`). **Trivial.**

**J. Collision groups bitmask (walker demo)**
- Source: `Oimo.js/examples/test_walker.html:196-202,226,259`. `group1: 1<<0, group2: 1<<1`; humans use `[10,0.4,0.2, group1, group2]` (config = [density, friction, restitution, belongsTo, collidesWith]) so ragdoll parts don't self-collide but do hit debris.
- Adapt: Rapier collision groups are the identical concept (`(membership<<16)|filter`) — steal the grouping plan: `CAR`, `PROPS`, `DECOR-NOCOLLIDE`. **Trivial.**

**K. Web-worker physics loop**
- Source: `Oimo.js/examples/test_worker.html` + `examples/js/worker/`. Physics stepped off main thread, transforms posted back.
- Adapt: Rapier3d is already wasm and fast; only grab if profiling shows main-thread jank with many props. **Hard, defer.**

**L. Point-gravity "planet" (orbit toy)**
- Source: `Oimo.js/examples/demos/planet.js:83-84`. World `gravity:[0,0,0]`; per frame every body gets `force = position.negate().normalize().multiplyScalar(0.1)` via `applyImpulse` → 200 random bodies orbit a central sphere.
- Adapt: one `applyImpulse` per body per frame in Rapier; great zero-g easter-egg area or a particle-attractor juice moment. **Trivial.**

**M. Kinematic body driven by animation (BVH skeleton → physics)**
- Source: `Oimo.js/examples/demos/kinematic3.js` — `kinematic:true` bodies positioned each frame from animated bone matrices (`updateSkeleton`, lines 139-183), so animation physically pushes dynamic balls around. Also `test_walker.html` + `examples/js/Human.js`: a procedural sine-gait walker (`speed:0.3, thighRange:50, thighBase:100, calfRange:30, calfOffset:-1.57`) driving kinematic bones that knock debris over.
- Adapt: Rapier `RigidBodyType.KinematicPositionBased` with `setNextKinematicTranslation/Rotation`. The `Human.js` gait numbers are a self-contained walk cycle you could drive a mascot statue with. **Medium-hard.**

### Effects & juice

**N. Constraint-stretch → color mapping (free cloth shading)**
- Source: `verlet-js/examples/cloth.html:74-83` (`coef = |off|/stride * 255` → `rgba(coef, 0, 255-coef, lerp(0.25,1,...))`). Adapt to per-vertex color or a shader uniform on the banner mesh. **Trivial once cloth exists.**

**T. Gradient-dome sky background**
- Source: `Oimo.js/examples/test_vehicle.html:174-179` — inverted `IcosahedronGeometry(3000,1)` with a 16×256 canvas gradient texture (`gradTexture`, line 361), `side:BackSide, depthWrite:false`, rotated 15°. Cheap, no HDR file. Adapt: paste-ready for three.js. **Trivial.**

**U. Procedural canvas textures**
- Source: `test_vehicle.html:375-405` `basicTexture` (64×64 two-tone checker for awake/sleep states), `test_ragdoll.html:432` gradient variant. Zero-asset debug textures; useful for prototyping new props before art exists. **Trivial.**

### Car / Physics feel

**O. Wheel-joint vehicle rig (reference values, with caveats)**
- Source: `Oimo.js/examples/test_vehicle.html:44-64,327`. Chassis box `[160,50,400]` config `[10, 0.4, 0.0]` (density/friction/restitution), wheels cylinder radius `50`, width `30`, config `[10,10,0.0]` (friction 10!), `jointWheel` with `axe1:[0,0,1]` (suspension axis), `axe2:[0,1,0]` (steer axis), `spring:[8,1]` (suspension frequency/damping), `collision:false` chassis↔wheel. Drive: `rotationalLimitMotor2.setMotor(speed=±100, force=25)`; brake on keyup: `setMotor(0, 4)`.
- `correctRotation` (`:83-94`): projects the wheel's roll axis onto the chassis steer axis and re-orthogonalizes — a fix for wheel axis drift you'd need with any 2-axis wheel joint.
- Caveat (verified in code): steering is left unimplemented with the author's own "I'm so confused right now" comment (`:437-444`) — this demo is a straight-line motor rig only. Use it for spring/motor values and the axis-correction trick, not as a steering reference.
- Adapt: Rapier has `DynamicRayCastVehicleController` (far better starting point); steal `spring:[8,1]` as suspension stiffness/damping seed and the `setMotor(0, 4)` passive-brake idea for off-throttle drag. **Values: trivial to grab; full rig: use Rapier's vehicle controller instead.**

**P. LimitMotor semantics cheat sheet**
- Source: `Oimo.js/src/constraint/joint/LimitMotor.js:35-56`. `setLimit(lower, upper)` with "lower > upper disables", `setMotor(speed, maxForce)` with "maxForce 0 disables", `setSpring(frequency, dampingRatio)` with "dampingRatio 1 = critical". Oimo's spring `[frequency, dampingRatio]` convention maps 1:1 to Rapier joint motor `stiffness/damping` configuration — use it as the translation table for all `spring:[2,0.3]`, `spring:[8,1]`, `spring:[0.1,0.1]` values quoted above.

### Camera
- Nothing worth grabbing. Oimo demos all use vanilla `OrbitControls` (`test_vehicle.html:136-138`); verlet-js is 2D canvas. The folio's follow-cam has no counterpart here.

### Audio
- Nothing. `Oimo.js/examples/js/sound.js` exists but is a trivial tone helper, not a game audio system; verlet-js is silent. Keep Howler.

---

## 2. TOP 5 (impact ÷ effort)

1. **Cloth/flag system (B + N)** — 60-line integrator port, instantly gives banners/flags over every area entrance with stretch-based color juice. Highest visual payoff per hour.
2. **Smashable brick tower (H)** — `addTower` is 40 lines of pure math, drops straight into Rapier cuboids, and gives the car something satisfying to destroy.
3. **Ragdoll dummy (D)** — full body-part dimensions + joint limits/springs already tuned; a classic Bruno-Simon-adjacent toy (hit it with the car). The respawn-on-fall pattern comes free.
4. **Rope/string-lights verlet chain (A)** — half-day port, dresses up the whole world (bunting between trees, rope fences); pins can hang from Rapier bodies.
5. **Sleep-state material swap + collision-group plan (I + J)** — near-zero effort, keeps a prop-dense world at 60fps and stops self-collision glitches; both map 1:1 onto existing Rapier APIs.

## 3. Surprising / clever details

- **verlet-js needs no Rapier at all.** The whole engine is `verlet.js:127-175` (~50 lines): velocity is implicit (`pos - lastPos`), constraints are solved by iterated position relaxation, `stepCoef = 1/step` divides correction across iterations. Porting = deleting the mouse/canvas code and swapping Vec2→Vec3. Running cloth *inside* Rapier would be heavier and twitchier.
- **`sim.frame(16)` everywhere** — 16 relaxation iterations per render frame is the stability sweet spot all verlet demos use; budget accordingly (a 20×20 cloth = 760 constraints × 16 iterations ≈ 12k cheap ops/frame — fine).
- **Masonry bonding in `addTower`** — `(j & 1) * 0.5` half-brick offset per course is why the tower collapses convincingly instead of shearing in rings.
- **The 1% spawn gap** (`stacking.js:25,34`: `m = 0.01`, boxes sized `d-m`) — prevents initial-contact popping in stacked grids; applies directly to any Rapier wall/pile spawn.
- **Oimo's own vehicle steering is unfinished** (`test_vehicle.html:437`) — funny and worth knowing before trusting that demo; grab its suspension/motor numbers only.
- **Spiderweb tension trick** (`spiderweb.html:170-171`): after building constraints, every rest length is multiplied by `tensor = 0.3` — pre-tensioning a net by shrinking rest lengths. Same trick makes a taut trampoline/net in the folio for one line of code.
- **Diagonal shoulder axes** (`test_ragdoll.html:302`: `axe1:[0,1,1]`) — non-axis-aligned hinge axes give natural slouchy arm motion; an easy detail to miss when hand-rolling ragdoll joints.

Nothing was modified in either repo.</subagent>
<subagent agent_id="agent-5" item="react-three-rapier — pmndrs/react-three-rapier (MIT, Rapier bindings for R3F). User uses vanilla three.js + @dimforge/rapier3d directly, no React — so the value here is PATTERNS, not code. Analyze: (a) how it structures colliders (cuboid/ball/capsule/trimesh/convex hull), collision groups and interaction groups bitmasks, sensor colliders for trigger zones; (b) joints: revolute, prismatic, spherical, rope, spring joints — demo examples showing joint configs; (c) useful hooks logic worth reimplementing vanilla: useRapier stepping, interpolation, kinematic character controller wrapper (src/components/CharacterController or similar); (d) any vehicle-ish example. Also check the repo's demo/test files for joint playgrounds. Return a grab list of Rapier API patterns and joint recipes (with file paths) that a vanilla Rapier project can copy, especially anything enabling: swinging signs, rope bridges, spring-mounted props, trigger areas, one-way platforms." outcome="completed"># react-three-rapier — Grab List Report

Repo analyzed: `C:\Users\Juan\Documents\GitHub\_ref-repos\react-three-rapier` (pmndrs/react-three-rapier, MIT). Since folio-2025 is vanilla JS + `@dimforge/rapier3d` directly, everything below is expressed as raw Rapier API calls — the React layer is just a thin wrapper around them, so translation is 1:1. Note: the repo uses `rapier3d-compat`; folio's `@dimforge/rapier3d` has the identical API.

## 1. GRAB LIST

### Car / Physics feel

**Fixed-timestep accumulator + interpolation loop** — `packages/react-three-rapier/src/components/Physics.tsx:581-707`
The single most valuable pattern in the repo. Gaffer-style fixed timestep: `accumulator += clamp(dt, 0, 0.5)`, step world at `1/60` in a while loop, then interpolate meshes with `alpha = accumulator / timeStep` using `position.lerp(newPos, alpha)` / `quaternion.slerp(newRot, alpha)` between cached previous-state and current-state. This kills the physics stutter vanilla Rapier projects get when stepping with raw frame delta.
*Adapt:* copy the accumulator + previousState map + lerp/slerp block almost verbatim into folio's tick loop. Default integration params worth copying too (`Physics.tsx:443-451`): `numSolverIterations=4`, `normalizedAllowedLinearError=0.001`, `normalizedPredictionDistance=0.002`, `maxCcdSubsteps=1`, `contact_natural_frequency=30`.

**Joint-motor car** — `demo/src/examples/car/CarExample.tsx`
Chassis = dynamic cuboid (6×1×1.9 box), 4 wheels = dynamic cylinders with **convex hull** colliders (`colliders="hull"`), each attached with a **revolute joint**: `JointData.revolute(bodyAnchor=wheelPosition, wheelAnchor=[0,0,0], axis=[0,0,1])` (via `packages/react-three-rapier/src/hooks/joints.ts:130-148`), then every frame `joint.configureMotorVelocity(20, 10)` (target velocity 20 rad/s, max force factor 10).
*Adapt:* good reference for motorized props (ferris wheel, revolving door, windmill). For the actual drivable car folio already has, a raycast/kinematic controller is better — but `configureMotorVelocity` is the recipe for any spinning prop.

**Kinematic platforms/rotors** — `demo/src/examples/kinematics/KinematicsExample.tsx`
`type="kinematicPosition"` bodies driven by `setNextKinematicTranslation({x: sin(t/100), y: -8 + sin(t/50)*0.5, z: 0})` and `setNextKinematicRotation(quat)` every frame. Rapier computes correct velocities from kinematic movement, so dynamic bodies resting on them get pushed properly.
*Adapt:* identical calls in vanilla — `body.setNextKinematicTranslation(...)` in the tick loop. Use for moving platforms, rotating obstacles, escalators.

**Damping feel tuning** — `demo/src/examples/damping/DampingExample.tsx` + `snapshot/SnapshotExample.tsx:63`
`angularDamping={i/10}` gradient demo. Also `ccd` + `canSleep={false}` flags on fast props (`spring/SpringExample.tsx:29`).
*Adapt:* `RigidBodyDesc.setAngularDamping()` / `.setLinearDamping()` / `.setCcdEnabled(true)` / `.setCanSleep(false)` — direct setters on vanilla `RigidBodyDesc`.

### Props & toys (the joint recipe box)

**Spring-mounted props (bouncy signs, wobble toys)** — `demo/src/examples/spring/SpringExample.tsx` + `hooks/joints.ts:199-221`
`JointData.spring(restLength=0, stiffness=1.0e3, damping, anchorA=[0,0,0], anchorB=worldPos)`. The clever part is the **damping formula**: `criticalDamping = 2 * sqrt(stiffness * mass)`, then `damping = dampingRatio * criticalDamping` with ratio swept 0→2 across the row to show under/critical/over-damping. Bodies use `ccd` and `canSleep={false}`.
*Adapt:* copy the critical-damping formula as-is — it makes spring tuning predictable for any hanging prop.

**Newton's cradle / pendulum rods (swinging signs)** — `demo/src/examples/cradle/CradleExample.tsx`
Fixed anchor body + dynamic rod body joined by `JointData.spherical([0,0,0],[0,0,0])`. Compound colliders on one body: `CylinderCollider(halfHeight=1, radius=0.05)` + `BallCollider(radius=0.2, restitution=1.2)` at offsets `[0,-1,0]` and `[0,-2,0]`. `restitution > 1` on the ball keeps the cradle lively.
*Adapt:* this IS the swinging-sign recipe: fixed body at the hinge point, dynamic body for the sign, `world.createImpulseJoint(RAPIER.JointData.spherical(anchorA, anchorB), a, b, true)`. Add `limitsEnabled` via revolute joint if you want a max swing angle.

**Rope bridge / chain** — `demo/src/examples/joints/JointsExample.tsx:53-89`
40-segment rope: each segment a ball rigid body (first segment `kinematicPosition`, rest dynamic), adjacent segments joined with `JointData.spherical([-0.5,0,0], [0.5,0,0])` — anchors offset half a segment length on each side. The kinematic head is animated with `setNextKinematicRotation` to make the whole rope dance.
*Adapt:* same chain-of-spherical-joints pattern works for rope bridges (planks + two rope rails), hanging vines, pull-chains.

**Wrecking ball (rope joint)** — `demo/src/examples/rope-joint/RopeJointExample.tsx`
`JointData.rope(length=35, anchorA=[0,0,0], anchorB=[0,0,0])` between a fixed anchor and a ball body with `restitution=1.2`, `density=30`, radius 2. Rope joint only caps max distance — free pendulum below it.
*Adapt:* one-liner in vanilla: `world.createImpulseJoint(RAPIER.JointData.rope(len, a, b), body1, body2, true)`. Lighter than a spherical joint chain for single hanging props.

**Prismatic joint with limits (sliding doors, drawers, elevators)** — `demo/src/examples/joints/JointsExample.tsx:91-111`
`JointData.prismatic(anchorA=[-4,0,0], anchorB=[0,4,0], axis=[1,0,0])` then `params.limitsEnabled = true; params.limits = [-2, 2]` (`hooks/joints.ts:157-175`).
*Adapt:* direct copy for anything that slides along one axis with end stops.

**Breakable wall** — `demo/src/examples/rope-joint/RopeJointExample.tsx:51-74`
Grid of dynamic cuboid boxes (`density=2`) stacked as a wall — no joints, just stacking; the wrecking ball demolishes it. Cheap "destructible" prop.

### World systems

**Trigger zones (sensors)** — `demo/src/examples/sensors/SensorsExample.tsx`
`CuboidCollider` with `sensor` flag + `onIntersectionEnter/Exit`. Under the hood (`packages/react-three-rapier/src/utils/utils-collider.ts:436-444`): `collider.setSensor(true)` and `collider.setActiveEvents(ActiveEvents.COLLISION_EVENTS)`, then after `world.step(eventQueue)`, `eventQueue.drainCollisionEvents((h1,h2,started) => ...)` distinguishing real contacts from sensor overlaps via `world.intersectionPair(c1, c2)` (`Physics.tsx:766-787`).
*Adapt:* this is folio's "areas" system done properly: sensor cuboid + `drainCollisionEvents` + `intersectionPair` check. Handles both enter AND exit reliably.

**Interaction/collision groups bitmask helper** — `packages/react-three-rapier/src/utils/interaction-groups.ts` (43 lines, copy verbatim)
`interactionGroups(memberships, filters)` → `(bitmask(memberships) << 16) | bitmask(filters ?? all16)`. Groups 0–15. Note the documented gotcha: filters must pass **both ways** for events to fire.
*Adapt:* copy the two functions as-is; use with `colliderDesc.setCollisionGroups()` to separate car/world/props/sensor layers.

**One-way platforms** — `demo/src/examples/one-way-platform/OneWayPlatform.tsx`
Full recipe using Rapier's physics hooks: (1) `collider.setActiveHooks(ActiveHooks.FILTER_CONTACT_PAIRS)`, (2) pass a `PhysicsHooks` object with `filterContactPair(c1, c2, b1, b2)` into `world.step(eventQueue, hooks)`, (3) cache body positions/velocities **before** the step, (4) in the filter return `SolverFlags.COMPUTE_IMPULSE` only if `ballVel.y < 0 && ballPos.y > platformPos.y`, else `SolverFlags.EMPTY` to pass through.
*Adapt:* translates directly — vanilla `world.step(eventQueue, hooks)` accepts the same hooks object. The pre-step state cache is the non-obvious trick (you can't safely query the world mid-solve).

**Attractors (gravity wells, magnets, fans)** — `packages/react-three-rapier-addons/src/addons/attractor/Attractor.tsx:62-132`
Three force models: `static: s`, `linear: s * (d/r)`, `newtonian: G*s*m2/d²`, applied as `rigidBody.applyImpulse(dir * force, true)` in a before-step callback, gated by `range`, with an Infinity guard and optional collision-group filtering via bitmask test on `collider.collisionGroups()`.
*Adapt:* ~30 lines of vanilla code. Great for a "magnet" achievement zone or a fan that blows the car.

**World snapshots (reset/checkpoint system)** — `demo/src/examples/snapshot/SnapshotExample.tsx:26-35`
`snapshot = world.takeSnapshot()` → `Uint8Array`; restore with `rapier.World.restoreSnapshot(snapshot)`.
*Adapt:* two API calls. Ideal for "reset world state" after the car wrecks props, or retry-an-achievement buttons.

**Heightfield terrain** — `demo/src/examples/collision-events/CollisionEventsExample.tsx:120-129`
`HeightfieldCollider` args: `[nrows-1, ncols-1, heights[], {x: width, y: 1, z: depth}]`.
*Adapt:* `ColliderDesc.heightfield(...)` if folio ever wants bumpy terrain instead of trimesh ground.

**Auto-collider generation from Three geometry** — `packages/react-three-rapier/src/utils/utils-collider.ts:327-389`
The four recipes: cuboid → `geometry.computeBoundingBox()`, half-extents = size/2, offset = bbox center; ball → `computeBoundingSphere()` radius+center; trimesh → `mergeVertices(geometry)` (from three-stdlib) then pass `position.array` + `index.array`; hull → pass `position.array` directly. Plus scale handling (`scaleColliderArgs`, lines 27-53): scale vertices for trimesh/hull, scale args per-component for primitives.
*Adapt:* port `getColliderArgsFromGeometry` — it lets folio auto-generate colliders from loaded GLB meshes instead of hand-placing boxes.

**Debug rendering** — `packages/react-three-rapier/src/components/Debug.tsx`
`const buffers = world.debugRender()` → `LineSegments` with `position` (3 floats) + `color` (4 floats) vertex attributes, `vertexColors: true`, `frustumCulled={false}`, refreshed every frame.
*Adapt:* 15 lines of vanilla three.js; an essential dev tool for placing sensors/joints.

**Event queue draining with contact manifolds** — `Physics.tsx:709-839`
`eventQueue.drainCollisionEvents` for enter/exit, `eventQueue.drainContactForceEvents` for impact force (`event.totalForceMagnitude()`, `event.maxForceDirection()`), and `world.contactPair(c1, c2, (manifold, flipped) => ...)` with `manifold.solverContactPoint(0)` to get the **world-space impact point** (used in CollisionEventsExample.tsx:86-97 to spawn explosion markers at the exact contact).
*Adapt:* this is the hook for impact sounds (Howler volume ∝ `totalForceMagnitude`), sparks/particles at contact points, and crash detection. Requires `collider.setActiveEvents(ActiveEvents.COLLISION_EVENTS | ActiveEvents.CONTACT_FORCE_EVENTS)`.

### Effects & juice

- Contact-point spawning (explosion spheres at `manifold.solverContactPoint(0)`) — `collision-events/CollisionEventsExample.tsx:82-100`.
- Exaggerated `restitution` (1.2–2.0) on toy balls for cartoon bounciness — sensors, api-usage, cradle examples.
- On-sleep/on-wake events tracked by diffing `body.isSleeping()` each frame (`Physics.tsx:652-660`) — useful to pause jiggle animations on settled props.
- `contactSkin={0.5}` (`contact-skin/ContactSkinExample.tsx`) — makes a ball visibly hover/roll on an inflated contact surface; `colliderDesc.setContactSkin()` in vanilla. Good for hovercraft-style props.

### Audio

Nothing in this repo — no audio code at all. The transferable idea is purely architectural: drive Howler from `drainContactForceEvents` magnitude and sensor enter/exit (see above).

### Camera

Nothing — demos use drei OrbitControls only. No camera patterns to grab.

## 2. TOP 5 (impact-for-effort)

1. **Fixed-timestep accumulator + interpolation** (`Physics.tsx:581-707`) — the biggest perceptual-quality win available; ~60 lines of vanilla port, fixes all physics jitter for the car and props.
2. **Joint recipe set: spherical (swinging signs, rope bridges), spring with critical-damping formula, prismatic with limits** (`hooks/joints.ts` + cradle/joints/spring examples) — unlocks every "toy" on the wishlist with tiny code; each joint is 3–5 lines of raw Rapier.
3. **Sensor trigger zones + `drainCollisionEvents`/`intersectionPair` dispatch** (`SensorsExample.tsx` + `Physics.tsx:709-787`) — directly upgrades folio's area/achievement detection; includes reliable exit events.
4. **`interactionGroups()` bitmask helper + one-way platform via `ActiveHooks.FILTER_CONTACT_PAIRS`** (`interaction-groups.ts`, `OneWayPlatform.tsx`) — 43 lines to copy for layers; the hook-based one-way platform pattern generalizes to drive-through-fences, ghost mode, selective collisions.
5. **Contact-force + manifold contact point events** (`Physics.tsx:790-839`, `CollisionEventsExample.tsx:86`) — fuels crash sounds, particles at exact impact points, and "hit something hard" achievements with ~20 lines.

## 3. Surprising / clever

- **Spring damping derived from critical damping** (`SpringExample.tsx:42-45`): `damping = ratio * 2 * sqrt(stiffness * mass)` — turns spring tuning from guesswork into picking a damping ratio (0.5 = jiggly, 1.0 = critically damped, 2.0 = stiff). Genuinely rare to see documented in example code.
- **Pre-step state caching for contact filtering** (`OneWayPlatform.tsx:48-79`): you can't query body positions inside the `filterContactPair` hook (mid-solve), so they snapshot translations/velocities in a `useBeforePhysicsStep` callback and read the cache in the filter. Non-obvious and essential for any custom contact filtering in vanilla too.
- **Interpolation without extra allocations**: meshes are placed by `lerp/slerp(alpha)` from cached previous state to current, with `alpha = accumulator / timeStep` — no fixed-delay rendering, no extrapolation. Sleeping bodies are skipped entirely (`Physics.tsx:662-668`) as a free perf win.
- **`world.takeSnapshot()`** is a single call returning a `Uint8Array` — a full save/restore system for the whole physics world in two lines. Most Rapier users never discover it.
- **`restitution` above 1.0** (1.2–2.0) is used deliberately across demos as a juice dial — energy-adding bounciness reads as playful, not buggy.
- Note: despite the task brief, there is **no CharacterController implementation in this repo** (grep confirms zero matches; the addons package contains only the Attractor). For a kinematic character controller wrapper, look at `KinematicCharacterController` in Rapier's own docs or the pmndrs `ecctrl` package instead.</subagent>
</agent_swarm_result>