// Skid marks: fading dark quads a drifting car leaves on the road under its
// rear wheels. One InstancedMesh is a ring buffer of marks: past the cap a
// new mark overwrites the oldest, so a whole race costs one draw call and no
// allocation. Marks never move once laid; they only fade.
import * as THREE from 'three';
import { getSettings } from '/engine/settings.js';
import { DRIFT_MIN_SPEED } from './drive-rules.js';

const MARK_LIFE = 5;      // seconds a mark stays visible, fading out
const MARK_GAP = 0.05;    // seconds between stamps while drifting
const MAX_MARKS = 400;    // ring buffer size (quality baja uses half)
const NEAR = 70;          // other cars lay marks only this close to the panas

const geo = new THREE.PlaneGeometry(0.42, 1);   // tyre width × unit length
geo.rotateX(-Math.PI / 2);
const mat = new THREE.MeshBasicMaterial({ color: 0x17120e, transparent: true, depthWrite: false });
// Per-instance fade, the same shader trick as the Puffs in engine/fx.js.
mat.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float instanceOpacity;\nvarying float vInstanceOpacity;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstanceOpacity = instanceOpacity;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vInstanceOpacity;')
    .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity * vInstanceOpacity );');
};
mat.customProgramCacheKey = () => 'carreritas-skid-marks';
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class SkidMarks {
  // focus(): the car far-away rivals are culled against (the local player).
  constructor(scene, { focus } = {}) {
    this.scene = scene;
    this.focus = focus || (() => null);
    const mesh = new THREE.InstancedMesh(geo, mat, MAX_MARKS);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.geometry = geo.clone();   // the fade attribute is per mesh; the shape is shared data
    this.opacity = new THREE.InstancedBufferAttribute(new Float32Array(MAX_MARKS), 1).setUsage(THREE.DynamicDrawUsage);
    mesh.geometry.setAttribute('instanceOpacity', this.opacity);
    mesh.frustumCulled = false;   // marks spread over the whole track
    mesh.count = 0;
    this.mesh = mesh;
    this.age = new Float32Array(MAX_MARKS);
    this.head = 0;
    this.count = 0;
    scene.add(mesh);
  }

  // One frame for one car: while it drifts, stamp a quad under each rear
  // wheel, aligned with the direction the tyre is actually travelling.
  lay(c, dt) {
    c.markT = (c.markT || 0) - dt;
    if (!c.drift || !c.onGround || c.boat || c.plane || Math.abs(c.vf) < DRIFT_MIN_SPEED * 0.75) return;   // a lancha leaves wake, not rubber
    const low = getSettings().quality === 'baja';
    if (c.markT > 0) return;
    c.markT = low ? MARK_GAP * 2 : MARK_GAP;
    if (!c.isPlayer && !c.human) {
      const f = this.focus();
      if (f && (f.x - c.x) ** 2 + (f.z - c.z) ** 2 > NEAR * NEAR) return;
    }
    const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -fz, rz = fx;
    _q.setFromAxisAngle(UP, Math.atan2(c.vx, c.vz));
    _s.set(1, 1, Math.hypot(c.vx, c.vz) * MARK_GAP + 0.35);
    const cap = low ? MAX_MARKS / 2 : MAX_MARKS;
    for (const side of [-1, 1]) {
      const n = this.head++ % cap;
      _p.set(c.x - fx * 1.7 + rx * side * 1.05, c.y + 0.045, c.z - fz * 1.7 + rz * side * 1.05);
      this.mesh.setMatrixAt(n, _m.compose(_p, _q, _s));
      this.age[n] = 0;
      this.count = Math.min(cap, Math.max(this.count, n + 1));
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt) {
    const fade = this.opacity.array;
    for (let n = 0; n < this.count; n++) {
      this.age[n] += dt;
      fade[n] = 0.55 * Math.max(0, 1 - this.age[n] / MARK_LIFE);
    }
    this.opacity.needsUpdate = true;
  }

  clear() {
    this.head = 0;
    this.count = 0;
    this.mesh.count = 0;
    this.age.fill(0);
    this.opacity.array.fill(0);
    this.opacity.needsUpdate = true;
  }
}
