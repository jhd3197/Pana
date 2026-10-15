import * as THREE from 'three';

// One sky draw for every outdoor world. Clouds live at two optical heights,
// independent of map bounds; no world-sized mesh enters scenery batches.
export function createSky(palette = {}) {
  const uniforms = {
    time: { value: 0 }, daylight: { value: 1 }, cover: { value: .52 }, seed: { value: 7 },
    horizon: { value: new THREE.Color(0xc7e1e8) }, zenith: { value: new THREE.Color(0x458ec4) },
    sunDirection: { value: new THREE.Vector3(-.48, .72, .5).normalize() },
    sunDisc: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    // The art-directed sky is already display-referred, independent of a game's
    // exposure. Keeping its colors stable also makes Studio match race cameras.
    toneMapped: false, uniforms,
    vertexShader: `varying vec3 direction;
      void main() {
        direction = position;
        vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
        gl_Position = clip.xyww;
      }`,
    fragmentShader: `
      uniform float time, daylight, cover, seed, sunDisc;
      uniform vec3 horizon, zenith, sunDirection;
      varying vec3 direction;
      float hash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * .1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
      }
      float billow(vec2 p) {
        float n = .54*noise(p); p = mat2(.8,.6,-.6,.8)*p*2.03+17.1;
        n += .27*noise(p); p = p*2.07+9.2;
        n += .13*noise(p); return n + .06*noise(p*2.1);
      }
      void main() {
        vec3 d = normalize(direction);
        float height = max(d.y,0.0);
        vec3 color = mix(horizon,zenith,pow(height,.48));
        float sun = max(dot(d,sunDirection),0.0);
        color += vec3(1.0,.63,.29)*pow(sun,18.0)*.14*daylight;
        color += vec3(1.0,.83,.49)*smoothstep(.9993,.99965,sun)*sunDisc*daylight;
        if (d.y > .015) {
          // Thin, stretched high cloud behind larger, lower cumulus banks.
          vec2 high = d.xz / (height+.12) * vec2(3.0,9.0) + vec2(time*.002,seed+43.0);
          float wisps = smoothstep(.59,.8,billow(high)) * .28;
          color = mix(color,mix(vec3(.12,.17,.26),vec3(.84,.91,.95),daylight),wisps*smoothstep(.02,.22,height));
          vec2 p = d.xz / (height+.085) * 1.35 + vec2(seed*13.7,time*.006);
          float density = billow(p);
          float threshold = mix(.7,.36,cover);
          float cloud = smoothstep(threshold,threshold+.075,density);
          float edge = smoothstep(threshold-.015,threshold+.025,density)-cloud;
          float thickness = smoothstep(threshold,threshold+.22,density);
          float shade = clamp((billow(p+sunDirection.xz*.32)-density)*5.0+.9-thickness*.45,.12,1.0);
          vec3 cloudColor = mix(vec3(.43,.59,.71),vec3(1.0,.975,.91),shade);
          cloudColor += edge*vec3(.1,.08,.04)*pow(sun,5.0);
          cloudColor = mix(vec3(.075,.11,.19),cloudColor,daylight);
          float visibility = smoothstep(.025,.16,height);
          // Distant banks blend into the horizon instead of ending in a hard band.
          cloudColor = mix(horizon,cloudColor,smoothstep(.03,.28,height));
          color = mix(color,cloudColor,cloud*visibility*.97);
        }
        gl_FragColor = vec4(color,1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1,32,16),material);
  mesh.name = 'Living sky'; mesh.renderOrder = -1000; mesh.frustumCulled = false;
  mesh.userData.isSky = true; mesh.raycast = () => {};
  // Resolve the live material: Studio takes ownership by cloning materials.
  const live = () => mesh.material.uniforms;
  function setPalette(p = {}) {
    const u = live();
    u.horizon.value.set(p.horizon ?? 0xc7e1e8); u.zenith.value.set(p.skyTop ?? 0x458ec4);
    u.cover.value = p.cloudCover ?? .52; u.seed.value = p.skySeed ?? 7;
    u.sunDisc.value = p.sunDisc === false ? 0 : 1;
    if(p.sunDirection)u.sunDirection.value.copy(p.sunDirection).normalize();
  }
  function update(t, daylight = 1) {
    live().time.value = t; live().daylight.value = THREE.MathUtils.clamp(daylight,0,1);
  }
  mesh.userData.tick = update;
  let disposed = false;
  function dispose() { if(disposed)return;disposed=true;mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose(); }
  setPalette(palette);
  return { mesh, setPalette, update, dispose };
}
