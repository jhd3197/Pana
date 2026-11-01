// The look of a destructible side-view ground (terrain-mask.js), drawn as a
// slab: a front face, a wall extruded from the smooth outline (the top of the
// ground and every crater, cave and cliff seen at an angle) and an optional
// back wall. Everything is coloured in the fragment shader from world
// position and two field textures (fieldRGBA): a smooth anti-aliased
// silhouette, soil with wavy strata following the depth below the surface,
// pebbles, speckle and roots, rock with layers and cracks, sand with grain
// and a wet band by the water, a grass band with a bright lip and short
// rounded tufts, soft occlusion in caves and under overhangs, and the paint
// of the blasts on top. No tiling, no image textures.
//
//   const ground = createTerrain(scene, mask, { palette, zBack: -2.6, zFront: .55, back: hollowMask });
//   ground.update(takeDirty(mask));   // after a blast or a splash
//   ground.reset(mask);               // a new match
//
// Lambert lighting, fog and tone mapping come from three.js
// (MeshLambertMaterial with the colour swapped in onBeforeCompile). If the
// shader fails to compile, `fallback()` swaps in a plain Lambert cut out by
// the coverage, so the ground still shows.
import * as THREE from 'three';
import { fieldRGBA, coverageContour } from './terrain-mask.js';
import { getSettings } from '../settings.js';

const linear = rgb => new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);

// Shared GLSL: integer hash, value noise, fbm, and the ground's colour.
const GLSL = /* glsl */`
varying vec3 vTerrainP;
varying vec3 vTerrainN;
uniform sampler2D uField;
uniform sampler2D uPaint;
uniform vec2 uSize;
uniform float uCell, uBack, uA2C, uTuft, uSandBelow, uWater, uDeepFrom, uDeepAt, uTintMax, uZBack, uZFront;
uniform vec3 uEarth, uDeep, uTopsoil, uGrass, uSand, uWet, uRock, uRoot;
uniform vec3 uTints[4];
float tHash(vec2 p) {
  uvec2 q = uvec2(ivec2(floor(p)) + 65536);
  uint h = q.x * 1597334677u ^ q.y * 3812015801u;
  h ^= h >> 16; h *= 0x7feb352du; h ^= h >> 15; h *= 0x846ca68bu; h ^= h >> 16;
  return float(h) * (1.0 / 4294967295.0);
}
float tNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float tFbm(vec2 p) {
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < TERRAIN_OCTAVES; i++) { s += a * tNoise(p); n += a; p = p * 2.03 + vec2(17.1, 9.3); a *= 0.5; }
  return s / n;
}
// Fades a detail out once its size nears a pixel (no shimmer at the whole-map view).
float tFade(float size, float px) { return 1.0 - smoothstep(size * 0.18, size * 0.5, px); }
vec3 tTint(float k) {
  k *= uTintMax;
  vec3 c = mix(uTints[0], uTints[1], clamp(k, 0.0, 1.0));
  c = mix(c, uTints[2], clamp(k - 1.0, 0.0, 1.0));
  return mix(c, uTints[3], clamp(k - 2.0, 0.0, 1.0));
}
// Pebbles: at most one per cell of the grid, a lit ellipse with a dark rim.
// x: how much stone, y: its light (lit from the top left), z: the soft shadow under it, w: its own shade.
vec4 tPebbles(vec2 p, float size, float chance) {
  vec2 id = floor(p / size), f = fract(p / size);
  if (tHash(id + 3.1) > chance) return vec4(0.0);
  vec2 c = 0.32 + 0.36 * vec2(tHash(id + 7.7), tHash(id + 1.9));
  float r = 0.1 + 0.14 * tHash(id + 5.3);
  vec2 d = (f - c) / vec2(r * (1.1 + 0.5 * tHash(id + 2.2)), r);
  float l = length(d);
  float a = 1.0 - smoothstep(0.8, 1.0, l);
  vec2 ds = (f - c - vec2(0.03, -0.07)) / vec2(r * 1.4, r * 1.2);
  float shadow = (1.0 - smoothstep(0.7, 1.15, length(ds))) * (1.0 - a);
  float lit = 0.95 + 0.4 * clamp(dot(d, vec2(-0.45, 0.8)), -1.0, 1.0) * l - 0.25 * smoothstep(0.55, 1.0, l);
  return vec4(a, lit, shadow, tHash(id + 9.1));
}
// Height of the grass tufts along x: soft rounded clumps of a few blades.
float tTufts(float x) {
  float clump = smoothstep(0.2, 0.8, tNoise(vec2(x * 1.4, 4.0))) * 0.75 + 0.25 * tNoise(vec2(x * 5.0, 6.0));
  float h = 0.0;
  for (int k = 0; k < 3; k++) {
    float w = k == 0 ? 0.23 : k == 1 ? 0.14 : 0.09;
    float u = (x + float(k) * 0.37) / w, i = floor(u);
    float lean = (tHash(vec2(i, float(k) + 8.0)) - 0.5) * 0.5;
    float f = (fract(u) - 0.5 - lean * 0.3) * 2.0 / (0.7 + 0.3 * tHash(vec2(i, float(k) + 4.0)));
    float blade = pow(max(0.0, 1.0 - f * f), 0.7) * (0.2 + 0.8 * tHash(vec2(i, float(k) + 2.0)));
    h = max(h, blade * (1.0 - 0.18 * float(k)));
  }
  return h * uTuft * (0.25 + 0.75 * clump);
}
vec4 terrainColor() {
  vec3 P = vTerrainP, N = normalize(vTerrainN);
  float skin = 1.0 - step(0.5, abs(N.z));
  vec2 q = P.xy - N.xy * 0.07 * skin;
  vec4 F = texture2D(uField, q / uSize), T = texture2D(uPaint, q / uSize);
  float sd = (F.r * 255.0 - 128.0) * 0.25 * uCell;          // below the surface (< 0 in the air)
  float depth = max(sd, 0.0), surf = P.y + sd;
  float px = skin > 0.5 ? length(fwidth(P)) : fwidth(P.x);
  vec2 W = skin > 0.5 ? vec2(P.x + P.z * 0.61, P.y + P.z * 0.37) : P.xy;   // where the texture is read

  // --- silhouette: coverage at 0.5, its edge a little ragged, anti-aliased
  float edge = F.g - 0.5 + (tNoise(P.xy * 7.0) - 0.5) * 0.16 + (tNoise(P.xy * 19.0) - 0.5) * 0.06 * tFade(0.05, px);
  float alpha = skin > 0.5 ? 1.0 : clamp(edge / max(fwidth(edge), 1e-4) + 0.5, 0.0, 1.0);

  // How much the surface above is beach: a ragged line, and sand thicker towards the water.
  float sandCover = smoothstep(uSandBelow + 0.7, uSandBelow - 0.7, surf + (tNoise(vec2(P.x * 0.9, 2.0)) - 0.5) * 0.7);
  float sandy = smoothstep(0.3, 0.6, sandCover);
  float bare = max(F.a, sandy);
  float grassy = 1.0 - bare;

  // --- tufts of grass standing on the front face over grassy ground
  float tuftH = tTufts(P.x);
  float tt = tuftH + sd + 0.03;                        // sd = −height over the ground
  float tuft = clamp(tt / max(fwidth(tt), 1e-4) + 0.5, 0.0, 1.0) * smoothstep(0.2, 0.6, grassy)
    * (1.0 - skin) * (1.0 - uBack) * step(sd, 0.02);
  alpha = max(alpha, tuft);
  if (alpha < (uA2C > 0.5 ? 0.02 : 0.5)) discard;

  // --- soil: earth darkening with height, wavy strata that follow the surface
  float kDeep = clamp((uDeepFrom - P.y) / uDeepAt, 0.0, 1.0);
  vec3 soil = mix(uEarth, uDeep, kDeep);
  float wave = (tFbm(vec2(W.x * 0.16, 3.0)) - 0.5) * 2.2 + (tNoise(vec2(W.x * 0.9, 8.0)) - 0.5) * 0.35;
  float v = depth * 0.8 + (P.y * 0.25) + wave;
  float strata = smoothstep(0.25, 0.75, 0.5 + 0.5 * sin(v * 3.1));
  soil *= 0.9 + 0.13 * strata;
  float clay = smoothstep(0.9, 0.97, 0.5 + 0.5 * sin(v * 1.37 + 1.3)) * tFade(0.15, px);
  soil = mix(soil, soil * 1.28 + vec3(0.03, 0.02, 0.0), clay * 0.55);
  soil *= 0.84 + 0.3 * tFbm(W * 1.3);
  float fleck = tNoise(mat2(0.8, -0.6, 0.6, 0.8) * W * 26.0);
  soil *= 1.0 + (smoothstep(0.78, 0.9, fleck) * 0.22 - smoothstep(0.22, 0.1, fleck) * 0.2) * tFade(0.04, px);
  // pebbles and small stones
  float stones = smoothstep(0.3, 0.6, depth);
  vec4 peb = tPebbles(W + 0.5, 0.3, 0.16) * tFade(0.08, px) * stones;
  vec4 stone = tPebbles(W * vec2(1.0, 1.2) + 7.0, 0.9, 0.07) * tFade(0.2, px) * stones;
  soil *= 1.0 - 0.3 * max(peb.z, stone.z);
  vec3 pebCol = mix(uRock * 1.1, soil * 1.5, 0.25 + 0.4 * peb.w) * peb.y;
  vec3 stoneCol = mix(uRock, uRock * vec3(1.1, 1.0, 0.86), stone.w) * stone.y;
  soil = mix(soil, pebCol, peb.x);
  soil = mix(soil, stoneCol, stone.x);

  // --- rock: grey-brown layers and cracks where rockAt says
  // Read rock a little off to the side by a noise, so its edges wander instead of following the map's boxes.
  vec2 warp = (vec2(tFbm(W * 0.32 + 21.0), tFbm(W * 0.32 + 47.0)) - 0.5) * 2.4 + (vec2(tNoise(W * 1.3), tNoise(W * 1.3 + 5.0)) - 0.5) * 0.5;
  float rockHere = texture2D(uField, (q + warp) / uSize).b;
  float rk = smoothstep(0.32, 0.6, rockHere + (tNoise(W * 3.0) - 0.5) * 0.2);
  if (rk > 0.0) {
    float lv = W.y * 2.6 + (tFbm(vec2(W.x * 0.22, W.y * 0.2)) - 0.5) * 3.4 + sin(W.x * 0.9) * 0.25;
    float layer = fract(lv), band = floor(lv);
    vec3 rock = uRock * (0.78 + 0.3 * tHash(vec2(band, 3.0))) * (0.9 + 0.14 * smoothstep(0.0, 0.5, layer));
    rock = mix(rock, rock * vec3(0.92, 0.95, 1.04), tHash(vec2(band, 4.0)) * 0.6);
    rock = mix(rock, rock * vec3(1.06, 0.98, 0.9), tNoise(W * 0.7));
    rock *= 1.0 - 0.25 * smoothstep(0.9, 0.99, layer) * tFade(0.12, px);
    float crack = abs(tFbm(W * vec2(0.9, 1.4) + 3.0) * 2.0 - 1.0);
    float lines = (1.0 - smoothstep(0.0, 0.035, crack)) * smoothstep(0.35, 0.6, tNoise(W * 0.6 + 11.0));
    rock *= 1.0 - 0.4 * lines * tFade(0.1, px);
    rock *= 1.0 + 0.08 * (1.0 - smoothstep(0.0, 0.08, crack - 0.04)) * (1.0 - lines) * tFade(0.1, px);
    rock *= 0.92 + 0.16 * tNoise(W * 9.0) * tFade(0.05, px);
    soil = mix(soil, rock, rk);
  }

  // --- under the grass: topsoil, a soft shadow, roots
  float band = 0.2 + 0.09 * tNoise(vec2(P.x * 2.7, 1.0)) + 0.04 * tNoise(vec2(P.x * 11.0, 2.0));
  float under = depth - band;
  vec3 top = mix(uTopsoil, soil, smoothstep(0.05, 0.55, under));
  soil = mix(top, soil, rk * 0.6);
  soil *= 1.0 - 0.32 * exp(-max(under, 0.0) / 0.07) * grassy;
  float rc = floor(W.x / 0.47), rlen = 0.3 + 0.75 * tHash(vec2(rc, 12.0));
  float rx = (rc + 0.2 + 0.6 * tHash(vec2(rc, 11.0))) * 0.47 + sin(under * 9.0 + rc) * 0.035 + under * (tHash(vec2(rc, 13.0)) - 0.5) * 0.5;
  float rw = 0.04 * (1.0 - under / rlen) + 0.004;
  float root = (1.0 - smoothstep(rw * 0.5, rw, abs(W.x - rx))) * step(0.0, under) * step(under, rlen) * step(0.55, tHash(vec2(rc, 14.0)));
  float rx2 = rx + under * (tHash(vec2(rc, 15.0)) - 0.5) * 1.2 + 0.05, rlen2 = rlen * 0.55, rw2 = 0.016 * (1.0 - under / rlen2);
  root = max(root, (1.0 - smoothstep(rw2 * 0.4, rw2, abs(W.x - rx2))) * step(0.0, under) * step(under, rlen2) * step(0.55, tHash(vec2(rc, 14.0))) * 0.8);
  soil = mix(soil, mix(soil, uRoot, 0.65), root * grassy * (1.0 - rk) * tFade(0.06, px));

  // --- sand on the beach and the sandbar: grain, faint ripples, wet by the water
  float sandDepth = 0.18 + 2.6 * sandCover * sandCover + (tNoise(vec2(W.x * 1.7, 6.0)) - 0.5) * 0.25;
  float sandAmt = step(0.02, sandCover) * (1.0 - smoothstep(sandDepth - 0.08, sandDepth + 0.08, depth));
  if (sandAmt > 0.0) {
    float wetK = max(smoothstep(uSandBelow - 1.3, uSandBelow - 1.9, surf), smoothstep(uWater + 0.55, uWater + 0.15, P.y + (tNoise(vec2(P.x * 2.0, 0.0)) - 0.5) * 0.12));
    vec3 sand = mix(uSand, uWet, wetK);
    float grain = (tNoise(W * 41.0) - 0.5) * tFade(0.025, px);
    sand *= 0.96 + 0.2 * grain + 0.08 * (tFbm(W * 2.5) - 0.5);
    // fine bedding lines that follow the slope of the beach, faintly wavy
    float bed = depth * 7.0 + (tNoise(vec2(W.x * 1.2, 0.0)) - 0.5) * 1.5;
    sand *= 1.0 - 0.07 * smoothstep(0.75, 1.0, sin(bed * 6.2832)) * tFade(0.06, px);
    // light and dark grains, a few tiny shells
    vec2 G = mat2(0.86, -0.5, 0.5, 0.86) * W * 30.0;
    sand *= 1.0 + (smoothstep(0.82, 0.92, tNoise(G)) * 0.28 - smoothstep(0.2, 0.1, tNoise(G + 13.0)) * 0.22) * tFade(0.035, px);
    sand = mix(sand, vec3(0.92, 0.88, 0.8), smoothstep(0.93, 0.97, tNoise(W * 9.0 + 4.0)) * 0.7 * tFade(0.08, px));
    // a darker band under the bedding: damp sand settling on the earth below
    sand *= 1.0 - 0.18 * smoothstep(sandDepth - 0.6, sandDepth, depth);
    soil = mix(soil, sand, sandAmt);
  }

  // --- the cover: grass with a bright lip on the top, or bare damp topsoil
  float g = 1.0 - smoothstep(band - 0.02, band + 0.015, depth);
  float lip = 1.0 - smoothstep(0.0, 0.05, depth);
  vec3 grass = uGrass * (0.92 + 0.16 * tNoise(vec2(W.x * 3.0, W.y * 6.0)));
  grass = mix(grass * 1.08, grass * 0.68, smoothstep(0.0, band, depth));
  grass = mix(grass, uGrass * vec3(1.25, 1.2, 0.95), lip * 0.6);
  vec3 bareTop = mix(uTopsoil * 0.85, uTopsoil * 1.1, lip);
  vec3 cover = mix(grass, bareTop, F.a);
  vec3 color = mix(soil, cover, g * (1.0 - sandy));
  color = mix(color, color * 1.12, lip * sandy);

  // --- soft occlusion: near air below the grass line, under overhangs
  float wide = T.b;
  float occl = mix(0.6, 1.0, smoothstep(0.5, 0.95, wide)) ;
  float deepEnough = smoothstep(0.45, 0.75, depth);
  float overhang = mix(0.6, 1.0, smoothstep(0.0, 0.7, T.a * 255.0 * uCell));
  color *= mix(1.0, occl, deepEnough * (1.0 - skin)) * overhang;
  // a faint bevel on every edge of the front face
  color *= 1.0 + 0.1 * (1.0 - smoothstep(0.0, 0.12, edge)) * (1.0 - skin) * (1.0 - g);

  // --- the extruded wall: grass on top faces, darker towards the back
  if (skin > 0.5) {
    float up = smoothstep(0.35, 0.75, N.y);
    float back = clamp((P.z - uZBack) / (uZFront - uZBack), 0.0, 1.0);
    vec3 topGrass = uGrass * (0.8 + 0.18 * tNoise(vec2(P.x, P.z) * 9.0) + 0.14 * tNoise(vec2(P.x * 2.0, P.z * 1.6)) + 0.1 * tNoise(vec2(P.x, P.z) * 31.0) * tFade(0.04, px));
    vec3 topBare = uTopsoil * (0.9 + 0.2 * tNoise(vec2(P.x * 6.0, P.z * 6.0)));
    vec3 topSand = uSand * (0.92 + 0.1 * tNoise(vec2(P.x * 30.0, P.z * 30.0)));
    vec3 topCol = mix(mix(topGrass, topBare, F.a), topSand, sandy);
    color = mix(color * mix(0.55, 0.95, back), topCol * mix(0.82, 1.0, back), up * smoothstep(0.0, 0.35, 1.0 - depth));
  }
  if (uBack > 0.5) color *= 0.3 + 0.1 * smoothstep(0.0, 3.0, depth);

  // --- the blasts' paint over all of it (and on the tufts standing in it)
  float stain = T.r;
  vec3 tint = tTint(T.g);
  if (tuft > 0.0 && sd < 0.0) {
    vec4 S = texture2D(uPaint, vec2(P.x, surf - 0.05) / uSize);
    stain = S.r; tint = tTint(S.g);
    vec3 blade = mix(uGrass * 0.62, uGrass * 1.18, clamp(-sd / max(tuftH, 0.02), 0.0, 1.0));
    blade *= 0.9 + 0.2 * tHash(vec2(floor(P.x / 0.085), 5.0));
    color = mix(color, blade, step(0.0, -sd) * tuft);
  }
  // A crisp wet edge where the coat thins out, fully coloured inside.
  float soak = smoothstep(0.1, 0.26, stain + (tNoise(P.xy * 6.0) - 0.5) * 0.12) * mix(0.72, 0.94, smoothstep(0.2, 0.8, stain));
  vec3 wetPaint = tint * (0.9 + 0.16 * tNoise(P.xy * 3.0)) * (1.0 - 0.25 * (1.0 - smoothstep(0.1, 0.2, stain)));
  color = mix(color, wetPaint, soak * (1.0 - uBack));
  return vec4(color, alpha);
}
`;

function makeTextures(mask) {
  const n = mask.cols * mask.rows * 4, make = data => {
    const t = new THREE.DataTexture(data, mask.cols, mask.rows, THREE.RGBAFormat);
    t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
    return t;
  };
  const field = new Uint8Array(n), paint = new Uint8Array(n);
  return { field, paint, fieldTex: make(field), paintTex: make(paint) };
}

// The terrain material: Lambert with the ground's colour from the shader.
export function terrainMaterial({ fieldTex, paintTex, mask, palette = {}, back = false, a2c = true, zBack = -2.6, zFront = .55, detail = getSettings().detail }) {
  const p = palette, tints = (p.tints || [[255, 80, 160]]).slice(0, 4);
  while (tints.length < 4) tints.push(tints[tints.length - 1]);
  const uniforms = {
    uField: { value: fieldTex }, uPaint: { value: paintTex }, uSize: { value: new THREE.Vector2(mask.width, mask.height) },
    uCell: { value: mask.cell }, uBack: { value: back ? 1 : 0 }, uA2C: { value: a2c ? 1 : 0 }, uTuft: { value: p.tuft ?? .3 },
    uSandBelow: { value: p.sandBelow ?? -1e3 }, uWater: { value: p.water ?? -1e3 }, uDeepFrom: { value: p.deepFrom ?? mask.height },
    uDeepAt: { value: (p.deepAt ?? 140) * mask.cell }, uTintMax: { value: Math.max(1, (p.tints?.length || 1) - 1) },
    uZBack: { value: zBack }, uZFront: { value: zFront },
    uEarth: { value: linear(p.earth || [178, 112, 62]) }, uDeep: { value: linear(p.deep || [88, 52, 34]) },
    uTopsoil: { value: linear(p.topsoil || p.deep || [116, 74, 42]) }, uGrass: { value: linear(p.grass || [96, 166, 56]) },
    uSand: { value: linear(p.sand || [226, 198, 140]) }, uWet: { value: linear(p.wet || p.sand || [176, 150, 108]) },
    uRock: { value: linear(p.rock || [156, 134, 110]) }, uRoot: { value: linear(p.roots || [104, 70, 42]) },
    uTints: { value: tints.map(linear) },
  };
  const material = new THREE.MeshLambertMaterial({ alphaToCoverage: a2c });
  material.defines = { TERRAIN_OCTAVES: detail === 'baja' ? 3 : 4 };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainP;\nvarying vec3 vTerrainN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrainP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTerrainN = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL}`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = terrainColor();');
  };
  material.customProgramCacheKey = () => `terrain-${material.defines.TERRAIN_OCTAVES}`;
  material.userData.uniforms = uniforms;
  return material;
}

// The slab: front face, extruded outline and (optional) back wall, from one mask.
//   palette: earth deep topsoil grass sand wet rock roots tints (0..255 RGB),
//            sandBelow water deepFrom (world y), deepAt (cells), tuft (height)
//   rockAt(x, y), grassAt(x, y): as for fieldRGBA
//   back: a Uint8Array like mask.solid of extra ground for the back wall (hollows), or false
export function createTerrain(scene, mask, { palette = {}, rockAt = null, grassAt = null, zBack = -2.6, zFront = .55, back = null, renderer = null } = {}) {
  const gl = renderer?.getContext?.(), a2c = !!gl?.getContextAttributes?.()?.antialias;
  const opts = { rockAt, grassAt, tints: palette.tints?.length || 2 };
  let tex = makeTextures(mask), backTex = back !== false ? makeTextures(mask) : null;
  const plane = new THREE.PlaneGeometry(mask.width, mask.height);
  const material = terrainMaterial({ ...tex, mask, palette, a2c, zBack, zFront });
  const front = new THREE.Mesh(plane, material);
  front.position.set(mask.width / 2, mask.height / 2, zFront); front.name = 'terrain-front';
  const skin = new THREE.Mesh(new THREE.BufferGeometry(), material);
  skin.name = 'terrain-skin'; skin.frustumCulled = false;
  const group = new THREE.Group(); group.add(front, skin);
  let backWall = null;
  if (backTex) {
    backWall = new THREE.Mesh(plane, terrainMaterial({ ...backTex, mask, palette, back: true, a2c, zBack, zFront }));
    backWall.position.set(mask.width / 2, mask.height / 2, zBack - .05); backWall.name = 'terrain-back'; group.add(backWall);
  }
  scene.add(group);
  let shape = null;   // the solid cells the skin was built from
  // The outline is kept in bands of BAND columns; a blast re-traces only the
  // bands its columns (plus the field's blur reach) touch, not the whole map.
  const BAND = 64, REACH = 14;
  let bands = [];

  function buildSkin(rect = null) {
    const n = Math.ceil(mask.cols / BAND);
    if (!rect || bands.length !== n) bands = new Array(n).fill(null);
    for (let k = 0; k < n; k++) {
      if (bands[k] && rect && ((k + 1) * BAND + 1 < rect.c0 - REACH || k * BAND > rect.c1 + REACH)) continue;
      bands[k] = coverageContour(mask, tex.field, 127.5, { c0: k * BAND, c1: (k + 1) * BAND });
    }
    let count = 0; for (const b of bands) count += b.count;
    const segments = new Float32Array(count * 4), normals = new Float32Array(count * 4);
    for (let k = 0, at = 0; k < n; at += bands[k].count * 4, k++) { segments.set(bands[k].segments, at); normals.set(bands[k].normals, at); }
    const pos = new Float32Array(count * 12), nor = new Float32Array(count * 12), index = new Uint32Array(count * 6);
    for (let s = 0; s < count; s++) {
      let ax = segments[s * 4], ay = segments[s * 4 + 1], bx = segments[s * 4 + 2], by = segments[s * 4 + 3];
      let anx = normals[s * 4], any = normals[s * 4 + 1], bnx = normals[s * 4 + 2], bny = normals[s * 4 + 3];
      // Wind each quad so it faces out of the ground.
      if (-(by - ay) * (anx + bnx) + (bx - ax) * (any + bny) < 0) {
        [ax, bx] = [bx, ax]; [ay, by] = [by, ay]; [anx, bnx] = [bnx, anx]; [any, bny] = [bny, any];
      }
      const v = s * 12;
      pos.set([ax, ay, zFront, bx, by, zFront, ax, ay, zBack, bx, by, zBack], v);
      nor.set([anx, any, 0, bnx, bny, 0, anx, any, 0, bnx, bny, 0], v);
      const i = s * 4;
      index.set([i, i + 1, i + 2, i + 1, i + 3, i + 2], s * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    skin.geometry.dispose(); skin.geometry = geo;
    shape = mask.solid.slice();
  }
  // Did any cell in the rect change from solid to air (or back) since the skin was built?
  function reshaped(rect) {
    if (!shape) return true;
    for (let r = rect.r0; r <= rect.r1; r++) for (let c = rect.c0; c <= rect.c1; c++) {
      const i = r * mask.cols + c; if (shape[i] !== mask.solid[i]) return true;
    }
    return false;
  }
  function paintBack() {
    if (!backTex) return;
    const extra = back instanceof Uint8Array ? back : mask.hollow || null;
    fieldRGBA({ ...mask, stain: new Uint8Array(mask.solid.length), tint: new Uint8Array(mask.solid.length) }, backTex.field, backTex.paint, { ...opts, grassAt: null, extra });
    backTex.fieldTex.needsUpdate = backTex.paintTex.needsUpdate = true;
  }
  function update(rect) {
    if (!rect) return;
    fieldRGBA(mask, tex.field, tex.paint, opts, rect);
    tex.fieldTex.needsUpdate = tex.paintTex.needsUpdate = true;
    if (reshaped(rect)) buildSkin(rect);
  }
  function reset(next = mask) {
    if (next.cols !== mask.cols || next.rows !== mask.rows) throw new Error('createTerrain: a mask of another size');
    mask = next;
    fieldRGBA(mask, tex.field, tex.paint, opts);
    tex.fieldTex.needsUpdate = tex.paintTex.needsUpdate = true;
    buildSkin(); paintBack();
  }
  // A plain Lambert ground cut out by the coverage, for when the shader cannot compile.
  function fallback() {
    const color = new THREE.Color(...(palette.earth || [178, 112, 62]).map(v => v / 255));
    const plain = (t, k) => new THREE.MeshLambertMaterial({ color: color.clone().multiplyScalar(k), alphaMap: t.fieldTex, alphaTest: .5 });
    front.material = plain(tex, 1); skin.material = new THREE.MeshLambertMaterial({ color: '#6f9a40' });
    if (backWall) backWall.material = plain(backTex, .45);
    material.dispose();
  }
  reset(mask);
  return {
    group, front, skin, back: backWall, material, update, reset, fallback,
    get triangles() { return (skin.geometry.index?.count || 0) / 3 + 2 * (backWall ? 2 : 1); },
    dispose() {
      group.removeFromParent(); plane.dispose(); skin.geometry.dispose();
      for (const m of [front.material, skin.material, backWall?.material]) m?.dispose();
      for (const t of [tex, backTex]) if (t) { t.fieldTex.dispose(); t.paintTex.dispose(); }
    },
  };
}
