// Parallax occlusion mapping on a MeshStandardMaterial: the surface looks carved because
// each fragment walks its view ray down a height map and shades the point it meets. No
// geometry, no tangents, no second UV, no discarded fragments: the outline stays the
// mesh's own. Works on instanced and baked meshes. Numbers and maps: pom-sim.js.
//
//   const set = createPomSet();              // follows the settings by itself
//   set.add(material, 'brick');              // 'brick' (UVs) or 'rock' (projected from the world)
//   set.dispose();
//
// or by hand: applyPom(material, { heightMap, depth, steps: [8, 24], refine, ... }),
// applyRelief(material, ...) for the plain normal-map version, clearRelief(material).
// Off (phones, lower detail, ?pom=0) a material with UVs is the stock normal map, with
// no patch at all; one without UVs gets a single tap of the projected normal.
// Load it with import(): a game's first load stays as it was.
// i18n-ignore-file: shader source, no player text
import * as THREE from 'three';
import { getSettings, onSettings, TOUCH_ONLY } from '../settings.js';
import { POM_MAP_SIZE, POM_MIN_COS, POM_SURFACES, pomFlag, pomGate, reliefPixels, surfaceHeights } from './pom-sim.js';

const glslFloat = v => Number.isInteger(v) ? `${v}.0` : `${v}`;

// Normal in RGB, height in A, for a surface of pom-sim.js. Built once, on first use.
const maps = new Map();
export function reliefMap(kind) {
  if (maps.has(kind)) return maps.get(kind);
  const surface = POM_SURFACES[kind], size = POM_MAP_SIZE;
  const texture = new THREE.DataTexture(reliefPixels(surfaceHeights(kind, size), size, surface), size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.name = `relief-${kind}`; texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 4; texture.needsUpdate = true;
  maps.set(kind, texture);
  return texture;
}

// ---------- The shader ----------
const VERTEX = {
  pars: 'varying vec3 vPomWorld;\n',
  body: `
  vec4 pomWorld = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    pomWorld = batchingMatrix * pomWorld;
  #endif
  #ifdef USE_INSTANCING
    pomWorld = instanceMatrix * pomWorld;
  #endif
  vPomWorld = ( modelMatrix * pomWorld ).xyz;
`,
};

// The surface's frame. `pomBase` is the coordinate at the mesh's face, pomGx and pomGy its
// screen gradients, and pomRay how far it slides per metre into the surface, seen from here.
const frame = world => world ? `
  vec3 pomDx = dFdx( vPomWorld ), pomDy = dFdy( vPomWorld ), pomGeo = normalize( cross( pomDx, pomDy ) ), pomAbs = abs( pomGeo );
  // The facet's dominant axis picks the projection. Derivatives stay inside one triangle, so it is one choice per facet.
  vec3 pomAxisU = pomAbs.y >= pomAbs.x && pomAbs.y >= pomAbs.z ? vec3( 1.0, 0.0, 0.0 ) : pomAbs.x >= pomAbs.z ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
  vec3 pomAxisV = pomAbs.y >= pomAbs.x && pomAbs.y >= pomAbs.z ? vec3( 0.0, 0.0, 1.0 ) : vec3( 0.0, 1.0, 0.0 );
  vec2 pomBase = vec2( dot( vPomWorld, pomAxisU ), dot( vPomWorld, pomAxisV ) ) / uPomTile;
  vec2 pomGx = vec2( dot( pomDx, pomAxisU ), dot( pomDx, pomAxisV ) ) / uPomTile, pomGy = vec2( dot( pomDy, pomAxisU ), dot( pomDy, pomAxisV ) ) / uPomTile;
  vec3 pomToEye = cameraPosition - vPomWorld;
  float pomDistance = length( pomToEye );
  vec3 pomEye = pomToEye / pomDistance;
  float pomCos = dot( pomGeo, pomEye );
  vec2 pomRay = vec2( dot( pomEye, pomAxisU ), dot( pomEye, pomAxisV ) ) / uPomTile / max( pomCos, ${glslFloat(POM_MIN_COS)} );
` : `
  vec3 pomDx = dFdx( - vViewPosition ), pomDy = dFdy( - vViewPosition ), pomGeo = normalize( cross( pomDx, pomDy ) );
  vec2 pomBase = vNormalMapUv, pomGx = dFdx( pomBase ), pomGy = dFdy( pomBase );
  // Gradients of u and v over the surface, from the screen derivatives: no tangent attribute.
  vec3 pomR1 = cross( pomDy, pomGeo ), pomR2 = cross( pomGeo, pomDx );
  float pomDet = dot( pomDx, pomR1 );
  pomDet = abs( pomDet ) < 1e-12 ? 1e-12 : pomDet;
  vec3 pomGradU = ( pomR1 * pomGx.x + pomR2 * pomGy.x ) / pomDet, pomGradV = ( pomR1 * pomGx.y + pomR2 * pomGy.y ) / pomDet;
  float pomDistance = length( vViewPosition );
  vec3 pomEye = vViewPosition / pomDistance;
  float pomCos = dot( pomGeo, pomEye );
  vec2 pomRay = vec2( dot( pomGradU, pomEye ), dot( pomGradV, pomEye ) ) / max( pomCos, ${glslFloat(POM_MIN_COS)} );
`;

const march = ([min, max], refine) => `
  vec2 pomDelta = vec2( 0.0 );
  float pomHitDepth = 0.0, pomLod = 0.0;
  int pomLayers = 0;
  float pomAway = 1.0 - smoothstep( uPomFade.x, uPomFade.y, pomDistance );
  if ( pomAway > 0.0 && pomCos > 0.0 ) {
    // One level for the whole walk (no derivatives inside a loop), sharp along the long axis of a grazing footprint.
    pomLod = max( 0.0, 0.5 * log2( min( dot( pomGx, pomGx ), dot( pomGy, pomGy ) ) * uPomSize * uPomSize ) );
    pomLayers = int( floor( mix( ${glslFloat(max)}, ${glslFloat(min)}, clamp( pomCos, 0.0, 1.0 ) ) + 0.5 ) );
    // Edge-on slivers (a block's top seen through a joint) stay flat: too few pixels for a walk to read.
    vec2 pomSpan = pomRay * uPomDepth * pomAway * smoothstep( 0.05, 0.16, pomCos );
    float pomLayer = 1.0 / float( pomLayers ), pomA = 0.0, pomB = 0.0;
    float pomH = 1.0 - textureLod( uPomMap, pomBase, pomLod ).a, pomHa = pomH;
    for ( int i = 0; i < pomLayers && pomB < pomH; i ++ ) {
      pomA = pomB; pomHa = pomH; pomB += pomLayer;
      pomH = 1.0 - textureLod( uPomMap, pomBase - pomSpan * pomB, pomLod ).a;
    }
    // Secant steps between the last two layers: this is what hides the stairs.
    float pomFa = pomHa - pomA, pomFb = pomH - pomB;
    if ( pomFa > 0.0 ) {
      for ( int i = 0; i < ${refine}; i ++ ) {
        float pomC = mix( pomA, pomB, pomFa / ( pomFa - pomFb ) );
        float pomFc = 1.0 - textureLod( uPomMap, pomBase - pomSpan * pomC, pomLod ).a - pomC;
        if ( pomFc > 0.0 ) { pomA = pomC; pomFa = pomFc; } else { pomB = pomC; pomFb = pomFc; }
      }
      pomHitDepth = mix( pomA, pomB, pomFa / max( pomFa - pomFb, 1e-5 ) );
    }
    pomDelta = - pomSpan * pomHitDepth;
    // The grooves hold the dark: under a lamp on the camera that is most of what shows the depth.
    diffuseColor.rgb *= mix( 1.0, smoothstep( 0.0, 0.42, 1.0 - pomHitDepth ), uPomCavity * pomAway );
  }
`;

const normalChunk = () => THREE.ShaderChunk.normal_fragment_maps.replaceAll('texture2D( normalMap, vNormalMapUv )', 'textureGrad( normalMap, vNormalMapUv + pomDelta, dFdx( vNormalMapUv ), dFdy( vNormalMapUv ) )');
const mapChunk = () => THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', 'textureGrad( map, vMapUv + pomDelta, dFdx( vMapUv ), dFdy( vMapUv ) )');
const worldNormal = `
  {
    vec3 pomN = textureGrad( uPomMap, pomBase + pomDelta, pomGx, pomGy ).xyz * 2.0 - 1.0;
    pomN.xy *= uPomNormal;
    vec3 pomT = mat3( viewMatrix ) * pomAxisU, pomB = mat3( viewMatrix ) * pomAxisV;
    pomT = normalize( pomT - normal * dot( pomT, normal ) ); pomB = normalize( pomB - normal * dot( pomB, normal ) );
    normal = normalize( pomT * pomN.x + pomB * pomN.y + normal * pomN.z );
  }
`;

// A short walk toward the strongest light, from where the eye's ray landed. Only the direct light
// dims. Worth it under a light off to one side; a lamp on the camera sees no shadow at all.
const shadow = world => `
  {
    #if NUM_DIR_LIGHTS > 0
      vec3 pomL = directionalLights[ 0 ].direction;
    #elif NUM_POINT_LIGHTS > 0
      vec3 pomL = normalize( pointLights[ 0 ].position + vViewPosition );
    #elif NUM_SPOT_LIGHTS > 0
      vec3 pomL = normalize( spotLights[ 0 ].position + vViewPosition );
    #else
      vec3 pomL = vec3( 0.0 );
    #endif
    ${world ? 'vec3 pomLw = pomL * mat3( viewMatrix ); float pomLn = dot( pomLw, pomGeo ); vec2 pomLr = vec2( dot( pomLw, pomAxisU ), dot( pomLw, pomAxisV ) ) / uPomTile;'
    : 'float pomLn = dot( pomL, pomGeo ); vec2 pomLr = vec2( dot( pomGradU, pomL ), dot( pomGradV, pomL ) );'}
    if ( pomLn > 0.02 && pomLayers > 0 ) {
      vec2 pomLs = pomLr / max( pomLn, ${glslFloat(POM_MIN_COS)} ) * uPomDepth * pomHitDepth * 0.25;
      float pomBlocked = 0.0;
      for ( int i = 1; i <= 4; i ++ ) {
        float pomLift = float( i ) * 0.25 * pomHitDepth;
        pomBlocked = max( pomBlocked, textureLod( uPomMap, pomBase + pomDelta + pomLs * float( i ), pomLod ).a - ( 1.0 - pomHitDepth + pomLift ) );
      }
      float pomLit = 1.0 - clamp( pomBlocked * 6.0, 0.0, 0.8 ) * pomAway;
      reflectedLight.directDiffuse *= pomLit; reflectedLight.directSpecular *= pomLit;
    }
  }
`;

const PARS = `
uniform sampler2D uPomMap;
uniform float uPomDepth, uPomCavity, uPomSize, uPomNormal;
uniform vec2 uPomFade, uPomTile;
`;

function patch(material, { key, uniforms, world, stepsLine, shade }) {
  const before = material.userData.pomPrior ?? { onBeforeCompile: material.onBeforeCompile };
  material.userData.pomPrior = before;
  material.onBeforeCompile = (shader, renderer) => {
    before.onBeforeCompile?.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    if (world) {
      shader.vertexShader = VERTEX.pars + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>${VERTEX.body}`);
      shader.fragmentShader = 'varying vec3 vPomWorld;\n' + shader.fragmentShader;
    }
    shader.fragmentShader = PARS + shader.fragmentShader
      .replace('#include <map_fragment>', stepsLine + mapChunk())
      .replace('#include <normal_fragment_maps>', world ? worldNormal : normalChunk());
    if (shade) shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>${shade}`);
    material.userData.pomShader = shader;
  };
  material.customProgramCacheKey = () => key;
  material.needsUpdate = true;
}

const uniformsFor = (map, { depth = .05, fade = [5, 12], cavity = .7, tile = [1, 1], normalScale = 1 }) => ({
  uPomMap: { value: map }, uPomDepth: { value: depth }, uPomFade: { value: new THREE.Vector2(...fade) }, uPomCavity: { value: cavity },
  uPomSize: { value: map.image.width }, uPomNormal: { value: normalScale }, uPomTile: { value: new THREE.Vector2(...tile) },
});

// The full effect. `heightMap` carries the height in A and the normal in RGB (reliefMap).
// `projection: 'uv'` needs the mesh's UVs; 'world' needs nothing but positions, for baked
// low-poly rock, and reads `tile` (metres per repeat). `depth` is in metres.
export function applyPom(material, { heightMap, projection = 'uv', steps = [8, 24], refine = 3, selfShadow = false, debug = false, ...rest }) {
  const world = projection === 'world', [min, max] = steps;
  if (!world) { material.normalMap = heightMap; material.normalScale.setScalar(rest.normalScale ?? 1); }
  const uniforms = uniformsFor(heightMap, rest);
  patch(material, {
    key: `pom:${projection}:${min}:${max}:${refine}:${selfShadow ? 1 : 0}:${debug ? 1 : 0}`, uniforms, world,
    stepsLine: frame(world) + march(steps, refine),
    shade: selfShadow ? shadow(world) : '',
  });
  if (debug) {   // QA: each fragment's layer count over the maximum, drawn raw.
    const compile = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => { compile(shader, renderer); shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>\n  gl_FragColor = vec4( vec3( float( pomLayers ) / ${glslFloat(max)} ), 1.0 );`); };
  }
  material.userData.pom = { on: true, uniforms };
  return material;
}

// The plain version, for phones and lower detail. With UVs this is three's own normal map
// and nothing else; without them, one tap of the projected normal.
export function applyRelief(material, { heightMap, projection = 'uv', ...rest }) {
  clearRelief(material);
  if (projection === 'uv') { material.normalMap = heightMap; material.normalScale.setScalar(rest.normalScale ?? 1); material.needsUpdate = true; material.userData.pom = { on: false }; return material; }
  const uniforms = uniformsFor(heightMap, rest);
  patch(material, { key: 'pom:relief', uniforms, world: true, stepsLine: `${frame(true)}\n  vec2 pomDelta = vec2( 0.0 );\n` });
  material.userData.pom = { on: false, uniforms };
  return material;
}

export function clearRelief(material) {
  const prior = material.userData.pomPrior;
  if (prior) { material.onBeforeCompile = prior.onBeforeCompile; delete material.customProgramCacheKey; delete material.userData.pomPrior; delete material.userData.pomShader; }
  if (material.normalMap?.name.startsWith('relief-')) material.normalMap = null;
  delete material.userData.pom;
  material.needsUpdate = true;
  return material;
}

// Is the full effect on, right now, on this device?
export const pomOn = () => pomGate({ detail: getSettings().detail, touch: TOUCH_ONLY, flag: pomFlag(globalThis.location?.search) });

// A group of materials that follow the setting: changing the picture detail swaps them, once.
export function createPomSet() {
  const materials = new Map();
  let live = null;
  const dress = (material, kind) => {
    const { tile, generate: _g, seed: _s, ...surface } = POM_SURFACES[kind], heightMap = reliefMap(kind), options = { heightMap, tile, ...surface };
    if (live) applyPom(material, options); else applyRelief(material, options);
  };
  const sync = () => { const now = pomOn(); if (now === live) return; live = now; materials.forEach((kind, material) => dress(material, kind)); };
  const unsubscribe = onSettings(sync);
  return {
    get on() { return live; },
    get size() { return materials.size; },
    add(material, kind) {
      if (materials.has(material)) return;
      materials.set(material, kind); dress(material, kind);
      material.addEventListener('dispose', () => materials.delete(material), { once: true });
    },
    dispose() { unsubscribe?.(); materials.clear(); },
  };
}
