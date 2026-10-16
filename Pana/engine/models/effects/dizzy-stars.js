// Cartoon dizzy stars: flat gold stars on a ring, spun by the caller. Used over
// a stunned pana's head and a bonked iguana. userData.spin(angle) sets the ring.
import * as THREE from 'three';

export function dizzyStars({ count = 3, radius = 0.9, size = 0.13, color = '#ffc629' } = {}) {
  const stars = new THREE.Group(); stars.name = 'Dizzy stars';
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  const shape = new THREE.Shape();
  for (let j = 0; j < 10; j++) {
    const a = j * Math.PI / 5, r = j % 2 ? size * 0.42 : size;
    j ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  for (let i = 0; i < count; i++) {
    const a = i * Math.PI * 2 / count, star = new THREE.Mesh(i ? geometry.clone() : geometry, material);
    star.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius); stars.add(star);
  }
  stars.userData.spin = angle => { stars.rotation.y = angle; };
  stars.userData.dispose = () => { stars.traverse(o => o.geometry?.dispose()); material.dispose(); };
  return stars;
}
