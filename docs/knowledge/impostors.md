# Impostors (baked billboards)

`engine/models/core/impostor.js` draws distant objects as photographs of
themselves. `impostorPlacements(parent, source, placements, opts)` has the
same contract as `instancePlacements` in `static-batch.js`: one prototype,
many `{x, y, z, rot, scale}` placements bucketed into cells. Each placement is
one camera-facing quad (two triangles); a cell is one draw.

## How it works

- The prototype is rendered from 8 directions around its vertical axis into
  a 4×2 atlas, twice: albedo and object-space normals. The quad turns about
  its vertical axis to face the camera, picks the two nearest views and
  blends them. Normals are rotated by the placement's yaw and lit by the
  scene's real sun, sky, received shadows and fog, so a card follows the
  time of day like the 3D model.
- Albedo is the real material (maps, vertex colours, prints) rendered under
  an `AmbientLight` of intensity π into an sRGB target: three.js returns the
  base colour exactly. Emissive is zeroed on the source materials for that
  pass and restored; the card's own material carries the glow.
- Detailed double-sided leaf crowns (over 300 triangles) blend 70 % of a
  sphere normal around the crown, so a canopy shades as one rounded mass, as
  the 3D crown reads. Low-poly hulls keep their facets.
- Bakes run in `prepareImpostors(renderer)`, called at the start of
  Carreritas' `prepare-race.js`. A card drawn before that bakes every pending
  prototype from its first `onBeforeRender`.
- Atlases are released when the last cell's geometry is disposed, so the
  normal geometry teardown (and `forestQuality`'s tier disposal) frees them.

## Keeping the look

Bake the model the band already drew there, not a nicer one. The coastal
forest bakes its middle and far models (the clustered canopy and the hull
silhouettes); a card of the detailed model looked airier and emptier than
the current hills. Trees beyond `IMPOSTOR_FROM` (45 m from the route) become
cards; passing cars never see one turn.

## Traps

- A render target's viewport is read only when it is bound: call
  `setRenderTarget` again after changing `target.viewport` for each tile, or
  every view lands on the whole atlas.
- Neighbouring views share the atlas. Mip levels average across tiles and
  show the quad's rectangle at a distance; the shader caps the level at 3
  and the bake pads each view by 12 %.
- Transparent texels are dilated from opaque neighbours before upload, or
  filtering pulls the cleared black into crown edges.
- Racers' ghost look clones every material; the card material's `clone`
  keeps its shader patch.
- Each prototype costs two 1024×512 RGBA atlases (≈ 5.6 MB with mips) at the
  default 256 px tile; rival panas use 128 px tiles. Baking adds 0.2–1.3 s to
  a map's load in Carreritas.

## Measured (RTX 4090, 1280×800, Alta, 8 racers)

Triangles fell 10–40 % across Selva, Chichi, Llanos and Chuao (Chichi start
3.49M → 2.22M, Selva mid-lap 1.92M → 1.40M). On this GPU the time saved is
small; trees are a triangle cost that matters on weak GPUs. Alpha-tested
cards add overdraw: check GPU time, not only triangles, when adding more.
