import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';

// A small recipe, not a texture per tree. Seeds change the surface without moving
// scenery. Frequencies are in metres so slopes, batches and instances agree.
export function natureStyle(id, seed = 73) {
  for (const c of id) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0;
  const random = rng(seed);
  const dry = ['llanos', 'desierto', 'salinas'].includes(id) ? 0.8 : id === 'selva' || id === 'delta' ? 0.12 : 0.4;
  return {
    seed, offset: [random() * 300, random() * 100, random() * 300], dry, snow: id === 'paramo',
    patch: id === 'estadio' ? 0.13 : id === 'llanos' ? 0.038 : 0.065,
    blade: id === 'estadio' ? 3.4 : id === 'paramo' ? 1.4 : 2.2,
  };
}

const functions = /* glsl */`
varying vec3 vNaturePoint;
varying float vNatureSurface;
uniform float natureDetail;
uniform vec3 natureOffset;
uniform float naturePatch;
uniform float natureDry;
uniform float natureBlade;
float natureHash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float natureNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(natureHash(i), natureHash(i + vec3(1,0,0)), f.x),
                 mix(natureHash(i + vec3(0,1,0)), natureHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(natureHash(i + vec3(0,0,1)), natureHash(i + vec3(1,0,1)), f.x),
                 mix(natureHash(i + vec3(0,1,1)), natureHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`;

const shading = /* glsl */`
// Derivatives are evaluated before surface branches, including along biome edges.
vec3 natureDx = dFdx(vNaturePoint), natureDy = dFdy(vNaturePoint);
float naturePixel = max(length(natureDx), length(natureDy));
if (natureDetail > 0.0 && vNatureSurface > 0.001) {
  vec3 p = vNaturePoint + natureOffset;
  float fine = smoothstep(1.0, 2.0, natureDetail);
  if (vNatureSurface < 1.5) {
    float up = abs(normalize(cross(natureDx, natureDy)).y);
    float coverage = clamp(vNatureSurface, 0.0, 1.0) * smoothstep(0.45, 0.8, up);
    // Broad growth/dry patches remain readable from the map overview.
    float patches = natureNoise(vec3(p.xz * naturePatch, 0.0));
    float tufts = natureNoise(vec3(p.xz * 0.85, 8.0));
    float tuftFade = 1.0 - smoothstep(0.3, 1.5, naturePixel);
    float tone = 0.66 + patches * 0.52 + (tufts - 0.5) * 0.26 * tuftFade;
    float straw = smoothstep(0.52, 0.85, patches) * natureDry;
    vec3 grass = vec3(tone) * mix(vec3(1), vec3(1.12, 1.015, 0.79), straw);
    if (fine > 0.0) {
      // Each cell holds a tapered, randomly leaning blade. Filtering removes
      // blades smaller than a pixel instead of turning them into distant noise.
      vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * p.xz * natureBlade;
      vec2 cell = floor(q), f = fract(q);
      float seed = natureHash(vec3(cell, 17.0));
      vec2 center = vec2(0.27) + 0.46 * vec2(natureHash(vec3(cell, 31.0)), natureHash(vec3(cell, 53.0)));
      float angle = seed * 6.283185;
      vec2 bladePoint = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * (f - center);
      float y = bladePoint.y / (0.14 + seed * 0.11);
      float x = bladePoint.x + y * (seed - 0.5) * 0.045;
      float width = (0.025 + seed * 0.02) * (1.0 - abs(y));
      float aa = max(0.005, naturePixel * natureBlade * 0.7);
      float blade = (1.0 - smoothstep(max(0.0, width), max(0.0, width) + aa, abs(x))) * (1.0 - smoothstep(0.75, 1.0, abs(y)));
      float fade = 1.0 - smoothstep(0.22, 0.8, naturePixel * natureBlade);
      grass *= 1.0 + blade * (seed < 0.5 ? -0.32 : 0.25) * step(0.25, seed) * fade * fine;
    }
    float patchFade = 1.0 - smoothstep(0.25, 1.0, naturePixel * naturePatch);
    diffuseColor.rgb *= mix(vec3(1), grass, coverage * patchFade);
  } else if (vNatureSurface < 2.5) {
    float clusters = natureNoise(p * 1.7);
    float fade = 1.0 - smoothstep(0.15, 0.9, naturePixel);
    float tone = 1.0 + (clusters - 0.5) * 0.38 * fade;
    if (fine > 0.0) {
      float leaves = natureNoise(p * vec3(10.0, 16.0, 10.0));
      float leafFade = 1.0 - smoothstep(0.025, 0.14, naturePixel);
      tone += (smoothstep(0.25, 0.72, leaves) - 0.5) * 0.34 * leafFade * fine;
    }
    diffuseColor.rgb *= tone;
  } else {
    float fade = 1.0 - smoothstep(0.1, 0.7, naturePixel);
    float grain = natureNoise(p * vec3(5.0, 0.45, 5.0));
    float tone = 1.0 + (grain - 0.5) * 0.35 * fade;
    if (fine > 0.0) {
      float cracks = smoothstep(0.57, 0.79, natureNoise(p * vec3(23.0, 1.5, 23.0)));
      float crackFade = 1.0 - smoothstep(0.02, 0.1, naturePixel);
      tone -= cracks * 0.32 * crackFade * fine;
    }
    diffuseColor.rgb *= tone;
  }
}
`;

// Material.clone() normally drops onBeforeCompile. A real copy implementation
// keeps both the original cliff/wind hook and independent live quality uniforms
// when Studio takes ownership of a preview's materials.
class NatureMaterial extends THREE.MeshStandardMaterial {
  constructor(source, style, snowAmount) {
    super();
    if (!source) return;
    super.copy(source);
    this.baseCompile = source.onBeforeCompile;
    this.baseKey = source.customProgramCacheKey();
    this.style = structuredClone(style);
    this.userData.natureDetail = { value: 2 };
    if (style.snow) this.userData.snowAmount = snowAmount;
    if (style.bloom) this.userData.bloomTime = { value: 0 };
  }
  copy(source) {
    super.copy(source);
    this.baseCompile = source.baseCompile;
    this.baseKey = source.baseKey;
    this.style = structuredClone(source.style);
    return this;
  }
  customProgramCacheKey() { return `${this.baseKey}|carreritas-nature-v3:${!!this.style?.tagged}:${!!this.style?.snow}:${!!this.style?.snowSurface}:${!!this.style?.bloom}`; }
  onBeforeCompile(shader, renderer) {
    this.baseCompile.call(this, shader, renderer);
    Object.assign(shader.uniforms, {
      natureDetail: this.userData.natureDetail,
      natureOffset: { value: new THREE.Vector3(...this.style.offset) },
      naturePatch: { value: this.style.patch }, natureDry: { value: this.style.dry }, natureBlade: { value: this.style.blade },
    });
    shader.vertexShader = `${this.style.tagged ? 'attribute float natureSurface;' : ''}\nvarying float vNatureSurface;\nvarying vec3 vNaturePoint;\n${shader.vertexShader}`
      .replace('#include <project_vertex>', `#include <project_vertex>
        // Rest positions keep the pattern attached while the existing wind
        // deforms the vertex. Instance transforms still vary adjacent trees.
        vec4 naturePosition = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          naturePosition = instanceMatrix * naturePosition;
        #endif
        vNaturePoint = (modelMatrix * naturePosition).xyz;
        vNatureSurface = ${this.style.tagged ? 'natureSurface * 3.0' : '0.0'};`);
    shader.fragmentShader = functions + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${shading}`);
    if (this.style.bloom) {
      shader.uniforms.bloomTime = this.userData.bloomTime;
      shader.fragmentShader = `uniform float bloomTime;\n${shader.fragmentShader}`;
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // Only opted-in flowering crowns: existing green leaves, bark and fruit
        // keep their colors. Rest-space patches turn at different moments.
        if (natureDetail > 0.0 && vNatureSurface > 1.5 && vNatureSurface < 2.5) {
          float flower = smoothstep(1.12, 1.4, diffuseColor.r / max(diffuseColor.g, 0.001));
          float bloom = 0.56 + 0.44 * cos(bloomTime * 0.034906585);
          float bloomPatch = natureNoise((vNaturePoint + natureOffset) * 0.7);
          float green = smoothstep(bloom - 0.16, bloom + 0.16, bloomPatch);
          vec3 leaf = vec3(0.19, 0.37, 0.075) * (0.65 + max(diffuseColor.r, diffuseColor.g) * 0.65);
          diffuseColor.rgb = mix(diffuseColor.rgb, leaf, green * flower);
        }`);
    }
    if (this.style.snow) {
      shader.uniforms.natureSnow = this.userData.snowAmount;
      shader.fragmentShader = `uniform float natureSnow;\n${shader.fragmentShader}`;
      // Use the lit surface normal (including instances and wind), not abs(y):
      // undersides remain bare. Untagged fruit/trim in mixed batches stays bare.
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (natureDetail > 0.0 && ${this.style.snowSurface ? 'true' : 'vNatureSurface > 0.001'}) {
          float snowUp = inverseTransformDirection(normal, viewMatrix).y;
          float snowNoise = natureNoise((vNaturePoint + natureOffset) * 0.36);
          float altitude = mix(0.35, 1.0, smoothstep(30.0, 150.0, vNaturePoint.y));
          float settled = clamp(natureSnow, 0.0, 1.0) * altitude;
          float snowCover = smoothstep(0.48 - settled * 0.22, 0.92 - settled * 0.18, snowUp + (snowNoise - 0.5) * 0.32)
            * smoothstep(0.0, 0.65, settled + (snowNoise - 0.5) * 0.22) * smoothstep(0.0, 0.1, settled);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.83, 0.89, 0.96), snowCover);
          roughnessFactor = mix(roughnessFactor, 0.88, snowCover);
        }`);
    }
  }
}

export function applyNatureMaterials(group, id, seed) {
  const style = natureStyle(id, seed), materials = new Map();
  const snowAmount = { value: 0.28 };
  if (style.snow) group.userData.snowAmount = snowAmount;
  group.traverse(o => {
    const tagged = !!o.geometry?.attributes.natureSurface;
    const snowSurface = style.snow && !!o.userData.snowSurface;
    const bloom = id === 'plaza' && !!o.userData.bloom;
    if ((!tagged && !snowSurface) || !o.material) return;
    const own = source => {
      if (!source.isMeshStandardMaterial || source.userData.natureDetail) return source;
      const key = `${source.uuid}:${tagged}:${snowSurface}:${bloom}`;
      if (!materials.has(key)) materials.set(key, new NatureMaterial(source, { ...style, tagged, snowSurface, bloom }, snowAmount));
      return materials.get(key);
    };
    o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
  });
  const dispose = group.userData.dispose;
  let released = false;
  group.userData.dispose = () => {
    if (released) return;
    released = true;
    dispose?.(); materials.forEach(material => material.dispose());
  };
}
