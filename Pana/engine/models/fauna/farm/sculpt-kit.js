// Horse/chicken/cow sculpt recipes adapted from threejs-procedural-animals (MIT).
// Copyright (c) 2026 Majid Manzarpour and procedural-animals contributors.
// See /engine/vendor/procedural-animals/README.md and LICENSE for provenance.
// Pana adaptation: simplified anatomy, native skinning, matte coats, absolute-time
// idle poses. Ground at y=0; forward +Z; metres. Every instance owns its GPU data.
const ell = (m, c, r, bone = 0, tag = 'coat', k = .06, axis) => m.ell({ c, r, bone, tag, k, axis });
const cone = (m, a, b, ra, rb, bone = 0, tag = 'coat', k = .035) => m.cone({ a, b, ra, rb, bone, tag, k });


export { ell, cone };
export { SDFModel } from "/engine/vendor/procedural-animals/core/sdf/sdf.js";
