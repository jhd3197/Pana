import * as THREE from 'three';

// World-space grain, sediment bands and rain streaks add scale to cliff faces
// without large texture downloads or visible UV seams. Flat ground stays soft.
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
      float grain = terrainNoise(terrainP * 1.8) * 0.19 + terrainNoise(terrainP * 0.35) * 0.23;
      float warp = terrainNoise(terrainP * vec3(0.07, 0.015, 0.07));
      float bedding = smoothstep(0.83, 0.98, sin(terrainP.y * 1.55 + warp * 3.0) * 0.5 + 0.5);
      float fractures = smoothstep(0.64, 0.83, terrainNoise(terrainP * vec3(0.65, 0.025, 0.65)));
      float weather = 0.84 + grain - bedding * 0.23 - fractures * 0.32;
      diffuseColor.rgb *= mix(1.0, weather, cliff);`);
  };
  material.customProgramCacheKey = () => 'bululu-weathered-terrain-v1';
  return material;
}
