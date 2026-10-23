# Improving a complete racing map

A list of reviewed features does not establish a substantially improved map.
Small scenery fixes can pass every regression check while leaving its driving
experience almost unchanged. Use a complete map prototype with explicit lap
chapters before generalising the method to the catalogue.

## Evidence before edits

Record the starting revision, quality, viewport, seed and capture method. Read
the actual route, terrain, crossfall, water and scenery contracts. Capture
driver views across the whole lap and moving sequences through the proposed
changes. A static pose demonstrates alignment, but not how roll or camera
smoothing respond during driving.

Placement must initialise grounded pitch and roll from the same surface sampler
as physics. Presentation-only audit ticks do not run the driving update: leaving
the initial angles at zero produced level cars on banked-road screenshots even
though moving cars leaned correctly. Clear stale angular velocities on placement
and test the rendered car's up vector against the actual road triangle, including
opposite banks and off-centre lanes. Capture pitch, roll and grounded state with
the pose metadata so this mismatch is visible in evidence, not only screenshots.

When studying video, record timestamps and sampling density. A coarse scan of
the full duration is not continuous viewing. Inspect selected sequences at
closer intervals to understand approach, concealment, turn and reveal. Name
the transferable design principle; preserve Pana's own places and assets.

## Design a sequence, then build it

Give the lap several distinct chapters, each with a destination, a steering
decision and a transition into the next. Decide what the driver should see
now and what should appear later. Keep the next steering decision readable.
Open water, beaches and recovery straights are purposeful contrasts to hills,
enclosed streets and vegetation; do not surround every metre with scenery.

Work in this order: road/terrain profile, sightlines, landmark placement,
camera framing, scenery groups, surfaces, lighting, then detail. Revisit the
moving view after each substantial change. Change all relevant layers as a
coordinated composition, rather than adding unrelated decorations.

Use existing crossfall for road geometry, vehicle support and roadside heights.
Keep inside/outside signs consistent with the route's offset convention.
Ease transitions, check both lane edges and leave water/bridge/layered-road
contracts intact. Compact elevation functions avoid changing distant sectors.
Joined parapet faces follow a slope cleanly; separately tilted boxes produced
a visible sawtooth edge in the coastal prototype.

Reuse native plants in uneven groups with deliberate openings. Measure model
extents and test actual accepted placements, terrain support and road clearance.
Move existing architecture into readable driving distance before adding more.
The world-kit foundation helper resets scale: apply a deliberate landmark
scale after placement, with a foundation radius that covers the scaled base.

Separate chapters through broad surface and lighting differences before adding
fine texture. Use the existing mixed road shader, terrain paint, batching and
quality mechanisms. Check that important terrain and landmark cues survive
low detail; avoid relying on optional foliage to explain a turn.

## Acceptance

Compare the same route anchors and inspect actual approach/turn/exit motion.
When geometry changes, equal elapsed-time videos need not share vehicle poses.
State whether camera settings changed. Record geometry/support agreement,
transition grades, reveal/occlusion rays, clearance, camera framing, low-quality
readability, full laps, tide/transform behaviour and existing rendering caps.
Raycast opaque world geometry for camera obstructions; collectible coins can
temporarily cross that ray and are not a terrain collision.

Run focused browser suites and the required unit/convention gate. Keep known
failures separate from introduced regressions. Software-rendered timings and
automated lap completion are not physical-device FPS or player comfort proof.
Keep evidence local, update the existing plan and commit implementation on the
authorised branch. A reusable skill should encode this process and its checks;
banking angles, palette, species and camera height remain map-specific decisions.

## Bululu prototype contract

`bululu-layout.js` gives the lighthouse and eastern lookout compact 14 m and
11 m rises. The three curved sections use 14, 9 and 12-degree maximum banks.
The .665–.805 tidal chapter has zero crossfall and retains its water response.
The first crest screens the distant beach approach at .08–.12 and reveals it
at .15–.20. `bululu-composition.browser.js` tests that sequence using real road
and terrain rays, plus road/support agreement and accepted palm clearance.

The relocated lighthouse is scaled to 1.45 after foundation placement. Village
frontage moves closer to the return without narrowing the racing corridor.
Pale stone marks village/lookouts; warm sand remains on beach/tidal sections.
Continuous parapets replace the outside rope only at the two lookouts.
`cameraHeight: 4.4` lowers Bululu's chase viewpoint; the default stays 5 m on
other maps, with existing comfort, mirror and split-camera behaviour retained.

## Materials and driving feedback

Bululu's two inland hills use irregular mesa profiles: flatter grassy caps and
steeper limestone faces. Road elevation and crossfall stay independent of this
scenery profile. Paint exposed slopes before natureSurface classifies grass;
otherwise grass can grow over rock. Broad world-space erosion bands provide
scale without downloaded textures. Recheck foundations after terrain changes:
the lookout lifeguard tower belongs on the flat beach, not a tall slope plinth.

The Bululu palette supplies one sun direction for the sky, local lighting and
screen glow. The glow is a restrained directional overlay, not full-scene bloom.
Terrain and road rays screen it; these rays must use the scene's world matrices,
including mirroring. An occlusion test must start above the terrain: rays from
inside a single-sided terrain mesh do not test an actual driver's sightline.

`drivingEffects` opts a map into the shared presentation helper. One transparent
draw provides peripheral streaks and sun glow. Each camera owns its state and
the render callback selects the state for that viewport. Speed and boost control
streak strength; the centre stays clear. Comfort, reduced motion and look-back
disable both overlays. Low quality reduces streak count without removing the
road's navigation cues. This does not establish real-device performance.

Bululu's five pads use green arrows. The featured pad at .37 is 14 by 18 metres,
subdivided to follow the bank, with six luminous roadside chevrons. Its trigger
uses the same dimensions and local ground height; the turbo duration remains
1.2 seconds. Other maps retain their pad colours, dimensions and height checks.
Dispose pad geometry and marker resources when leaving a race. Compare actual
boost activation in motion as well as fixed driver views at the approach.
