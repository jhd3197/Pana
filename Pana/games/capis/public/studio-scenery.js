// Distant tepuy geometry, rock and waterfall shaders copied from the authored
// capis-map-studio.html app (DT/LT/Vx/FT). Only library bindings and lifecycle
// are adapted; seeded geometry, colours and animation remain unchanged.
import {
  Color,
  BufferGeometry,
  Float32BufferAttribute,
  MeshLambertMaterial,
  ShaderMaterial,
  UniformsUtils,
  UniformsLib,
  Group,
  MeshBasicMaterial,
  Mesh,
  PlaneGeometry,
  Sprite,
  SpriteMaterial,
  SphereGeometry,
} from 'three';
import { rng } from '/engine/random.js';
import { glowTexture } from '/engine/models/props/glow-paintball.js';
import { STUDIO_LOOKS } from './studio-looks.js';
const clamp01 = (x) => Math.max(0, Math.min(1, x));
function disposeGroup(group) {
  const geometries = new Set(),
    materials = new Set();
  group.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) materials.add(m);
  });
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
  group.removeFromParent();
}
export function createStudioScenery(scene, map) {
  return distantTepuys(scene, { ...map, seed: map.authoredSeed }, STUDIO_LOOKS[map.ambient]);
}
function tepuyGeometry(n, { w: e, d: t, h: i }) {
  let s = rng(n),
    r = 56,
    o = [s() * 6.3, s() * 6.3, s() * 6.3, s() * 6.3],
    a = (w) =>
      1 +
      0.13 * Math.sin(w * 2 + o[0]) +
      0.08 * Math.sin(w * 3 + o[1]) +
      0.05 * Math.sin(w * 7 + o[2]) +
      0.03 * Math.sin(w * 13 + o[3]),
    l = [
      [0, 1.55, 'forest'],
      [0.1, 1.32, 'forest'],
      [0.2, 1.14, 'forest'],
      [0.27, 1.03, 'foot'],
      [0.5, 1.01, 'rock'],
      [0.8, 0.995, 'rock'],
      [0.97, 1, 'rim'],
      [1, 0.97, 'top'],
    ],
    c = [],
    h = [],
    f = [],
    u = [],
    d = new Color('#4f6b3a'),
    p = new Color('#3a5230'),
    x = new Color('#a58f86'),
    g = new Color('#857670'),
    m = new Color('#5f7a48'),
    v = new Color('#4c4844');
  l.forEach(([w, _, S], A) => {
    for (let C = 0; C < r; C++) {
      let R = (C / r) * Math.PI * 2,
        D =
          a(R) *
          _ *
          (S === 'forest' ? 1 + 0.06 * Math.sin(R * 11 + A) : 1) *
          (S === 'rock' ? 1 + 0.012 * Math.sin(R * 23 + A * 3) : 1),
        I = S === 'rim' || S === 'top' ? (s() - 0.5) * 0.02 : 0;
      c.push((Math.cos(R) * D * e) / 2, (w + I) * i, (Math.sin(R) * D * t) / 2);
      let U =
        S === 'forest'
          ? d.clone().lerp(p, s() * 0.6)
          : S === 'foot'
            ? p.clone().lerp(g, 0.4)
            : S === 'rock'
              ? x.clone().lerp(g, s())
              : S === 'rim'
                ? v.clone().lerp(g, s() * 0.5)
                : m.clone().multiplyScalar(0.85 + s() * 0.3);
      (h.push(U.r, U.g, U.b), f.push(S === 'rock' || S === 'rim' ? 1 : 0));
    }
  });
  for (let w = 0; w + 1 < l.length; w++)
    for (let _ = 0; _ < r; _++) {
      let S = w * r + _,
        A = w * r + ((_ + 1) % r),
        C = (w + 1) * r + _,
        R = (w + 1) * r + ((_ + 1) % r);
      u.push(S, C, A, A, C, R);
    }
  let b = c.length / 3;
  (c.push(0, i * 1.01, 0), h.push(m.r * 0.9, m.g * 0.9, m.b * 0.9), f.push(0));
  let M = (l.length - 1) * r;
  for (let w = 0; w < r; w++) u.push(b, M + ((w + 1) % r), M + w);
  let y = new BufferGeometry();
  (y.setAttribute('position', new Float32BufferAttribute(c, 3)),
    y.setAttribute('color', new Float32BufferAttribute(h, 3)),
    y.setAttribute('aWall', new Float32BufferAttribute(f, 1)),
    y.setIndex(u));
  let E = y.toNonIndexed();
  return (y.dispose(), E.computeVertexNormals(), E);
}

function tepuyMaterial() {
  let n = new MeshLambertMaterial({ vertexColors: !0 });
  return (
    (n.onBeforeCompile = (e) => {
      ((e.vertexShader = e.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float aWall;
varying float vWall;
varying vec3 vTep;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vWall=aWall;vTep=position;`,
        )),
        (e.fragmentShader = e.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
varying float vWall;
varying vec3 vTep;
float tpH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float tpN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(tpH(i),tpH(i+vec2(1,0)),f.x),mix(tpH(i+vec2(0,1)),tpH(i+vec2(1,1)),f.x),f.y);}`,
          )
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
   {float a=atan(vTep.z,vTep.x)*38.;float fiss=pow(tpN(vec2(a,vTep.y*.05)),5.);float bed=smoothstep(.75,1.,sin(vTep.y*1.3+tpN(vec2(a*.2,vTep.y*.1))*2.));
    float streak=smoothstep(.55,.9,tpN(vec2(a*.6,vTep.y*.015)))*smoothstep(.3,.9,tpN(vec2(a*2.1,1.)));
    vec3 c=diffuseColor.rgb;c*=1.-vWall*(.42*fiss+.1*bed);c=mix(c,c*vec3(.38,.36,.36),vWall*streak*.55);diffuseColor.rgb=c;}`,
          )));
    }),
    (n.customProgramCacheKey = () => 'studio-tepuy'),
    n
  );
}

function waterfallMaterial(n) {
  return (
    (n.uBright ??= { value: 1 }),
    new ShaderMaterial({
      uniforms: Object.assign(UniformsUtils.clone(UniformsLib.fog), n),
      transparent: !0,
      depthWrite: !1,
      fog: !0,
      vertexShader: `varying vec2 vUv;
#include <fog_pars_vertex>
void main(){vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
      fragmentShader: `uniform float uTime,uBright;varying vec2 vUv;
#include <common>
#include <fog_pars_fragment>
float fh(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){float x=vUv.x;float lane=floor(x*9.);float s=fract(vUv.y*6.+uTime*(.9+fh(vec2(lane,1.))*.6)+fh(vec2(lane,2.)));float streak=smoothstep(.0,.35,s)*smoothstep(1.,.6,s);float edge=smoothstep(0.,.25,x)*smoothstep(1.,.75,x);float a=edge*(.45+.4*streak)*(.55+.45*vUv.y);gl_FragColor=vec4(vec3(.93,.97,1.)*(0.85+.15*streak)*uBright,a*(.6+.4*uBright));
#include <fog_fragment>
}`,
    })
  );
}

function distantTepuys(n, e, t) {
  let i = t.open,
    s = new Group();
  n.add(s);
  let r = rng(e.seed * 13 + 7),
    o = { uTime: { value: 0 } },
    a = glowTexture(),
    l = tepuyMaterial(),
    c = waterfallMaterial(o),
    h = [],
    f = [],
    u = new MeshBasicMaterial({
      color: i.cloud,
      transparent: !0,
      opacity: 0.35,
      depthWrite: !1,
    }),
    d = e.width / 2,
    p = Math.max(360, e.width * 2.2),
    x = 7,
    g = new Color(i.haze),
    m = i.tepuy ? new Color(i.tepuy) : null,
    v = d - p / 2;
  for (let M = 0; M < x; M++) {
    let y = 30 + r() * 40,
      E = y * (0.45 + r() * 0.3),
      w = 20 + r() * 22 + (M === 3 ? 12 : 0),
      _ = -175 - r() * 70 - (M % 2) * 30;
    v += (p / x) * (0.75 + r() * 0.5);
    let S = tepuyGeometry(e.seed * 31 + M, { w: y, d: E, h: w }),
      A = 0.32 + clamp01((-_ - 175) / 110) * 0.28 + (i.dense ? 0.25 : 0),
      C = S.attributes.color;
    for (let D = 0; D < C.count; D++) {
      let I = new Color(C.getX(D), C.getY(D), C.getZ(D));
      (m && I.lerp(m, 0.55), I.lerp(g, Math.min(0.92, A)), C.setXYZ(D, I.r, I.g, I.b));
    }
    let R = new Mesh(S, l);
    if (
      (R.position.set(v - (p / x) * 0.5, e.water + 1, _),
      (R.rotation.y = (r() - 0.5) * 0.5),
      s.add(R),
      true && (M === 3 || r() < 0.35))
    ) {
      let D = 0.9 + r() * 1.6,
        I = w * (0.62 + r() * 0.12),
        U = (r() - 0.5) * y * 0.3,
        H = new Mesh(new PlaneGeometry(D, I, 1, 1), c);
      (H.position.set(U, w - I / 2 - 0.4, (E / 2) * 1.02 + 0.6), R.add(H));
      let W = new Sprite(
        new SpriteMaterial({
          map: a,
          color: '#eef6f2',
          transparent: !0,
          opacity: 0.5,
          depthWrite: !1,
        }),
      );
      (W.scale.set(D * 7, D * 4, 1), W.position.set(U, w - I - 0.4, (E / 2) * 1.05 + 1), R.add(W), h.push(W));
    }
    if (r() < 0.7 || i.dense) {
      let D = new Mesh(new SphereGeometry(1, 12, 8), u);
      (D.scale.set(y * (0.25 + r() * 0.2), 1.6 + r() * 1.4, E * 0.35),
        D.position.set((r() - 0.5) * y * 0.5, w * (0.92 + r() * 0.12), E * 0.2),
        R.add(D),
        f.push({ c: D, phase: r() * 6, base: D.position.x }));
    }
  }
  let b = 0;
  return {
    update(M) {
      ((b += M),
        (o.uTime.value = b),
        h.forEach((y, E) => (y.material.opacity = 0.38 + 0.12 * Math.sin(b * 1.3 + E))),
        f.forEach((y) => (y.c.position.x = y.base + Math.sin(b * 0.07 + y.phase) * 3)));
    },
    dispose() {
      (a.dispose(), disposeGroup(s));
    },
  };
}
