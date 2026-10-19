import * as THREE from 'three';

// World-space blotches and speckle give cliff faces scale and a warm,
// rounded cartoon look without texture downloads or UV seams. Flat ground
// keeps its own colour.
export function terrainMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 vTerrainPosition;
      varying vec3 vTerrainNormal;`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vTerrainPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      vTerrainNormal = normalize(mat3(modelMatrix) * normal);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vTerrainPosition;
      varying vec3 vTerrainNormal;
      float terrainHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float terrainNoise(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(terrainHash(i), terrainHash(i + vec3(1,0,0)), f.x),
                       mix(terrainHash(i + vec3(0,1,0)), terrainHash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(terrainHash(i + vec3(0,0,1)), terrainHash(i + vec3(1,0,1)), f.x),
                       mix(terrainHash(i + vec3(0,1,1)), terrainHash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 terrainP = vTerrainPosition;
      float cliff = 1.0 - smoothstep(0.38, 0.77, abs(normalize(vTerrainNormal).y));
      // Rounded, toy-like rock: soft blotches of lighter and warmer stone and
      // a fine speckle, no horizontal bands or dark fracture lines.
      float blotch = terrainNoise(terrainP * 0.16) * 0.55 + terrainNoise(terrainP * 0.45) * 0.45;
      float speckle = terrainNoise(terrainP * 2.4);
      vec3 warm = diffuseColor.rgb * vec3(1.12, 1.0, 0.86);
      vec3 rock = mix(diffuseColor.rgb, warm, 0.6) * (0.9 + blotch * 0.22 + speckle * 0.05);
      diffuseColor.rgb = mix(diffuseColor.rgb, rock, cliff);`);
  };
  material.customProgramCacheKey = () => 'pana-warm-terrain-v2';
  return material;
}
