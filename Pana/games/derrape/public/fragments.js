import * as THREE from 'three';

// Reusable burst for breakable props. A source group contains individual solid
// pieces. We clone their transforms, share geometry/materials, and never mutate
// the source; it can respawn. Ground sampling also works on elevated circuits.
export class FragmentBurst {
  constructor(scene, groundAt, { gravity = 24, limit = 160 } = {}) {
    this.scene = scene;
    this.groundAt = groundAt;
    this.gravity = gravity;
    this.limit = limit;
    this.pieces = [];
  }

  burst(source, { velocity = new THREE.Vector3(), power = 5, life = 1.1 } = {}) {
    source.updateWorldMatrix(true, true);
    const center = source.getWorldPosition(new THREE.Vector3());
    source.traverse(part => {
      if (!part.isMesh || part.userData.noFragment) return;
      const obj = new THREE.Mesh(part.geometry, part.material);
      part.matrixWorld.decompose(obj.position, obj.quaternion, obj.scale);
      // scene may be the track's group, not the world root.
      this.scene.worldToLocal(obj.position);
      const direction = part.getWorldPosition(new THREE.Vector3()).sub(center);
      direction.y = 0.3 + Math.random() * 0.6;
      direction.normalize().multiplyScalar(power * (0.6 + Math.random() * 0.6));
      direction.addScaledVector(velocity, 0.24);
      obj.castShadow = true;
      this.scene.add(obj);
      this.pieces.push({ obj, velocity: direction, age: 0, life: life * (0.8 + Math.random() * 0.4),
        scale: obj.scale.clone(), spin: new THREE.Vector3(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5) });
    });
    while (this.pieces.length > this.limit) this.pieces.shift().obj.removeFromParent();
  }

  update(dt) {
    this.pieces = this.pieces.filter(p => {
      p.age += dt;
      if (p.age >= p.life) { p.obj.removeFromParent(); return false; }
      p.velocity.y -= this.gravity * dt;
      p.obj.position.addScaledVector(p.velocity, dt);
      p.obj.rotation.x += p.spin.x * dt;
      p.obj.rotation.y += p.spin.y * dt;
      p.obj.rotation.z += p.spin.z * dt;
      const floor = this.groundAt(p.obj.position.x, p.obj.position.z) + 0.07;
      if (p.obj.position.y < floor) {
        p.obj.position.y = floor;
        p.velocity.y = Math.abs(p.velocity.y) * 0.28;
        p.velocity.x *= 0.72; p.velocity.z *= 0.72;
        p.spin.multiplyScalar(0.65);
      }
      p.obj.scale.copy(p.scale).multiplyScalar(Math.min(1, (p.life - p.age) / 0.28));
      return true;
    });
  }

  clear() {
    for (const p of this.pieces) p.obj.removeFromParent();
    this.pieces = [];
  }
}
