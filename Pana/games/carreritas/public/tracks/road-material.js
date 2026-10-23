import * as THREE from 'three';
import { rng } from '/engine/random.js';

// Fine aggregate and broad worn patches break up flat road color. Generated in
// the existing road draw: no image download, texture allocation or extra mesh.
// `map` is the painted surface from roadTexture below, repeated along the lap.
export function roadMaterial(color, earth = false, mixed = false, map = null) {
  const detail = { value: 1 };
  const material = new THREE.MeshStandardMaterial({color,map,vertexColors:mixed,roughness:.92,side:THREE.DoubleSide});
  material.userData.roadDetail = detail;
  material.customProgramCacheKey = () => `carreritas-road-${mixed?'mixed':earth ? 'earth' : 'asphalt'}${map?'-painted':''}`;
  material.onBeforeCompile = shader => {
    if(mixed){
      shader.vertexShader=`attribute float roadSurface; varying float vRoadSurface;\n${shader.vertexShader}`.replace('#include <begin_vertex>','#include <begin_vertex>\nvRoadSurface=roadSurface;');
      shader.fragmentShader=`varying float vRoadSurface;\n${shader.fragmentShader}`;
    }
    shader.uniforms.roadDetail = detail;
    shader.vertexShader = `attribute vec2 roadCoords; varying vec2 vRoadCoords; varying vec2 vRoadPoint;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoadPoint = position.xz; vRoadCoords = roadCoords;');
    shader.fragmentShader = `varying vec2 vRoadPoint;
varying vec2 vRoadCoords;
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
  // The references read as roads because wear runs along the route and the
  // edge carries dust. Keep both continuous through every banked bend.
  float edgeDust = smoothstep(.75,1.,abs(vRoadCoords.x));
  float wheelWear = exp(-pow((abs(vRoadCoords.x)-.43)*12.,2.));
  float brokenWear = .6 + .4*roadNoise(vec2(vRoadCoords.y*.055,0.));
  diffuseColor.rgb *= 1. - .10*wheelWear*brokenWear*roadDetail;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.13,1.07,.94),edgeDust*.75*roadDetail);
  ${mixed?`if(vRoadSurface>.5&&vRoadSurface<1.5){
    float mud=roadNoise(vRoadPoint*.7);diffuseColor.rgb*=mix(.72,1.13,mud);
  }else if(vRoadSurface>=1.5){
    vec2 tile=vRoadPoint*vec2(1.4,2.0);tile.x+=mod(floor(tile.y),2.0)*.5;
    vec2 edge=min(fract(tile),1.-fract(tile));float joint=smoothstep(.025,.065,min(edge.x,edge.y));
    diffuseColor.rgb*=mix(.7,1.05,joint*nearDetail+(1.-nearDetail)*.8);
  }`:''}
}`);
  };
  return material;
}


// Painted road surfaces for the circuits that use the generic ribbon. The
// reference-ported maps paint their own; these follow the same recipe: cracked
// asphalt with edge lines and a centre line, rutted earth, rippled sand.
// `tile` is the metres of road one texture repeat covers along the lap.
export const ROAD_STYLES = {
  estadio: { surface: 'asphalt', base: '#5c5d62', centre: null },
  plaza: { surface: 'asphalt', base: '#626267', centre: 'dash' },
  chichi: { surface: 'asphalt', base: '#67666b', centre: 'yellow', posts: true },
  paramo: { surface: 'asphalt', base: '#6b6b71', centre: 'yellow', posts: true },
  desierto: { surface: 'dirt', base: '#d98d52' },
  selva: { surface: 'dirt', base: '#b5744a' },
  llanos: { surface: 'dirt', base: '#d6a566', grass: true },
  salto: { surface: 'dirt', base: '#c79a6a' },
  delta: { surface: 'dirt', base: '#c59766', grass: true },
  bululu: { surface: 'sand', base: '#f0d8a2' },
  salinas: { surface: 'sand', base: '#eccabf', shoulder: '#b78f82' },
  // Mixed surfaces tint per vertex (stone, mud): grain only, no paint.
  cuevas: { surface: 'grain' },
  puerto: { surface: 'grain' },
};
const EARTH = new Set(['selva', 'llanos', 'desierto', 'bululu', 'delta', 'salto']);

export function roadStyle(T) {
  const style = ROAD_STYLES[T.id];
  if (style) return style;
  const base = '#' + new THREE.Color(T.def.palette.track).getHexString();
  return EARTH.has(T.id) ? { surface: 'dirt', base } : { surface: 'asphalt', base, centre: 'dash' };
}

const TILE = { asphalt: 24, dirt: 18, sand: 16, grain: 10 };
export const roadTile = style => TILE[style.surface];

// One canvas per style: u runs across the road (0 = left edge), v along it.
export function roadTexture(style, seed = 1) {
  const W = 256, H = style.surface === 'asphalt' ? 1024 : 512, r = rng(seed);
  const rr = (a, b) => a + r() * (b - a);
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  const base = new THREE.Color(style.base || '#ffffff');
  // THREE.Color is linear; the canvas is painted in sRGB.
  const tone = (k, a = 1) => {
    const t = base.clone().multiplyScalar(k).getRGB({}, THREE.SRGBColorSpace);
    return `rgba(${Math.min(255, t.r * 255) | 0},${Math.min(255, t.g * 255) | 0},${Math.min(255, t.b * 255) | 0},${a})`;
  };
  c.fillStyle = tone(1); c.fillRect(0, 0, W, H);
  // Pixels are ~3x longer across than along, so specks are drawn tall.
  const specks = (n, dark, light, a0, a1) => {
    for (let i = 0; i < n; i++) {
      c.fillStyle = r() < .5 ? tone(dark, rr(a0, a1)) : tone(light, rr(a0, a1));
      c.fillRect(r() * W, r() * H, rr(1, 2.5), rr(2, 6));
    }
  };
  if (style.surface === 'grain') {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 5000; i++) { const v = rr(.78, 1.08); c.fillStyle = `rgba(${v * 236 | 0},${v * 236 | 0},${v * 236 | 0},.5)`; c.fillRect(r() * W, r() * H, rr(1, 2.5), rr(2, 6)); }
  } else if (style.surface === 'asphalt') {
    // Resurfaced patches, aggregate and long hairline cracks.
    for (let i = 0; i < 9; i++) { c.fillStyle = tone(r() < .5 ? .86 : 1.1, .55); c.fillRect(rr(20, W - 90), rr(0, H), rr(30, 80), rr(60, 180)); }
    specks(9000, .55, 1.45, .12, .32);
    c.strokeStyle = tone(.5, .7); c.lineWidth = 1.4;
    for (let k = 0; k < 16; k++) {
      let x = rr(30, W - 30), y = rr(0, H); c.beginPath(); c.moveTo(x, y);
      for (let j = 0; j < 9; j++) { x += rr(-7, 7); y += rr(8, 26); c.lineTo(x, y); }
      c.stroke();
    }
    // Tar seals along old joints.
    c.fillStyle = tone(.62, .6);
    for (let y = rr(0, 200); y < H; y += rr(220, 420)) c.fillRect(0, y, W, 3);
    c.fillStyle = 'rgba(250,249,240,.95)';
    c.fillRect(W * .035, 0, 5, H); c.fillRect(W * .965 - 5, 0, 5, H);
    if (style.centre === 'dash') for (let y = 0; y < H; y += H / 2) c.fillRect(W / 2 - 2, y + H * .06, 4, H * .2);
    if (style.centre === 'yellow') { c.fillStyle = 'rgba(255,198,40,.95)'; c.fillRect(W / 2 - 6, 0, 4, H); c.fillRect(W / 2 + 2, 0, 4, H); }
  } else if (style.surface === 'dirt') {
    for (let i = 0; i < 40; i++) {
      c.fillStyle = tone(r() < .5 ? .84 : 1.12, .35);
      c.beginPath(); c.ellipse(r() * W, r() * H, rr(12, 40), rr(30, 110), 0, 0, Math.PI * 2); c.fill();
    }
    // Packed wheel ruts with a raised, lighter crown between them.
    for (const u of [.3, .7]) {
      const g = c.createLinearGradient(W * (u - .09), 0, W * (u + .09), 0);
      g.addColorStop(0, tone(1, 0)); g.addColorStop(.5, tone(.74, .75)); g.addColorStop(1, tone(1, 0));
      c.fillStyle = g; c.fillRect(W * (u - .09), 0, W * .18, H);
      c.strokeStyle = tone(.66, .45); c.lineWidth = 1;
      for (let k = 0; k < 7; k++) { const x = W * u + rr(-10, 10); c.beginPath(); c.moveTo(x, 0); c.lineTo(x + rr(-3, 3), H); c.stroke(); }
    }
    c.fillStyle = tone(1.1, .35); c.fillRect(W * .44, 0, W * .12, H);
    specks(4500, .6, 1.35, .2, .45);
    for (let i = 0; i < 220; i++) { c.fillStyle = r() < .65 ? tone(.6, .7) : tone(1.3, .6); c.beginPath(); c.ellipse(r() * W, r() * H, rr(1, 2), rr(2.5, 5), 0, 0, Math.PI * 2); c.fill(); }
    if (style.grass) for (let i = 0; i < 520; i++) {
      const u = r() < .55 ? rr(.45, .55) : r() < .5 ? rr(0, .07) : rr(.93, 1);
      c.fillStyle = `hsla(${rr(78, 104) | 0},${rr(45, 62) | 0}%,${rr(34, 48) | 0}%,.9)`;
      c.fillRect(u * W, r() * H, rr(1.5, 3), rr(5, 12));
    }
    c.fillStyle = tone(1.18, .5); c.fillRect(0, 0, W * .03, H); c.fillRect(W * .97, 0, W * .03, H);
  } else {
    // Sand: wind ripples across, two soft tyre tracks along.
    for (let y = 0; y < H; y += rr(9, 15)) {
      c.strokeStyle = tone(r() < .5 ? .9 : 1.07, .55); c.lineWidth = rr(1.5, 3);
      c.beginPath(); c.moveTo(0, y);
      for (let x = 0; x <= W; x += 16) c.lineTo(x, y + Math.sin(x * .05 + y) * 3);
      c.stroke();
    }
    for (const u of [.32, .68]) { c.fillStyle = tone(.88, .45); c.fillRect(W * u - 9, 0, 18, H); }
    specks(2500, .8, 1.15, .15, .35);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping; texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8; texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
