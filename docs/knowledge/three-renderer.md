# Three.js renderer

All browser entry points, addon imports, browser harnesses and game templates
pin Three.js **0.186.1**. Keep core and addons on the same exact version. Pana
continues to use WebGLRenderer with native ES modules and no build step.
WebGL 2 is required: Three.js removed WebGL 1 support in r163.

## Migration details

- Use `PCFShadowMap` for soft PCF shadows. `PCFSoftShadowMap` is deprecated.
- Use `Timer`, calling `update()` before reading each frame's `getDelta()`.
  `getDelta()` alone no longer advances time. Use `reset()` when discarding
  loading or paused time, and `getElapsed()` instead of Clock's `elapsedTime`.
  Do not connect the timer to document visibility for online games: their
  background tabs must keep ticking. Existing delta clamps remain in place.
- When `matrixAutoUpdate` is false and code writes a mesh's `matrix`, set
  `matrixWorldNeedsUpdate = true`. This matters for bounds and matrix queries
  before the first render, including the mine and expedition-camp props.
- Custom GLSL and `onBeforeCompile` hooks remain on WebGLRenderer. Upgrading
  the library does not convert them into WebGPU/TSL materials.
- r186's standard vertex-color varying is `vec4 vColor`. Emissive hooks in
  Galipán, Maracaibo and Tovar use `vColor.rgb`, since emissive radiance is
  `vec3`. `night-materials.browser.js` compiles these worlds' real materials,
  including reflectors outside the normal camera view.
- PBR lighting and shadow filtering have changed since r160; compare real
  renders before retuning exposure or authored colors globally.

The all-games smoke asserts the actual loaded revision, not just a WebGL canvas.
The conventions suite checks CDN pins across runtime, tests and templates.
When upgrading again, update those assertions together and exercise water,
particles, nature materials, characters and Studio previews as well as gameplay.

Reference: https://github.com/mrdoob/three.js/wiki/Migration-Guide
