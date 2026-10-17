import * as THREE from 'three';

// Fine aggregate and broad worn patches break up flat road color. Generated in
// the existing road draw: no image download, texture allocation or extra mesh.
export function roadMaterial(color, earth = false) {
  const detail = { value: 1 };
  const material = new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true,side:THREE.DoubleSide});
  material.userData.roadDetail = detail;
  material.customProgramCacheKey = () => `derrape-road-${earth ? 'earth' : 'asphalt'}`;
  material.onBeforeCompile = shader => {
    shader.uniforms.roadDetail = detail;
    shader.vertexShader = `varying vec2 vRoadPoint;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoadPoint = position.xz;');
    shader.fragmentShader = `varying vec2 vRoadPoint;
uniform float roadDetail;
float roadHash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float roadNoise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(roadHash(i),roadHash(i+vec2(1.,0.)),f.x),mix(roadHash(i+vec2(0.,1.)),roadHash(i+vec2(1.,1.)),f.x),f.y);
}
${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
if (roadDetail > 0.0) {
  float patches = roadNoise(vRoadPoint * ${earth ? '0.18' : '0.11'});
  float grain = roadHash(floor(vRoadPoint * ${earth ? '14.0' : '36.0'}));
  float nearDetail = 1.0 - smoothstep(0.025,0.12,length(fwidth(vRoadPoint)));
  float wear = mix(${earth ? '0.84,1.08' : '0.91,1.04'},patches);
  wear *= mix(1.0,0.88 + 0.24*grain,nearDetail);
  diffuseColor.rgb *= mix(1.0,wear,roadDetail);
}`);
  };
  return material;
}
