import * as THREE from 'three';
import { curve, ellipsoid, mesh, signedPower } from '/engine/models/characters/pana/geometry.js';

export function createGlasses({ head, material, headFront }) {
  const root = new THREE.Group(); root.name = 'accessory:glasses'; head.add(root);
  const frame = material('Espresso acetate frames', '#30231d', { roughness: 0.29, clearcoat: 0.45, sheen: 0 });
  const metal = material('Glasses hinges', '#c3a575', { roughness: 0.3, metalness: 0.55, sheen: 0 });
  const lens = material('Smoked sunglass lenses', '#242b2c', { roughness: 0.19, clearcoat: 0.7, sheen: 0, metalness: 0.08, side: THREE.DoubleSide });
  const variants = {};
  for (const style of ['round', 'sun']) {
    const group = new THREE.Group(); group.name = `glasses:${style}`; root.add(group); variants[style] = group;
    const rectangular = style === 'sun';
    for (const sign of [-1, 1]) {
      const rim = new THREE.Group(); rim.name = 'Glasses rim';
      rim.position.set(sign * 0.60, 0.26, headFront(sign * 0.60, 0.26) + 0.095);
      rim.rotation.y = sign * 0.47; rim.rotation.z = sign * 0.10; group.add(rim);
      const outline = Array.from({ length: 64 }, (_, i) => {
        const t = i / 64 * Math.PI * 2;
        return [signedPower(Math.cos(t), rectangular ? 0.48 : 1) * (rectangular ? 0.24 : 0.205), signedPower(Math.sin(t), rectangular ? 0.48 : 1) * (rectangular ? 0.20 : 0.22), 0];
      });
      curve(rim, 'Acetate rim', outline, rectangular ? 0.032 : 0.017, frame, true, 80);
      if (rectangular) {
        const shape = new THREE.Shape(); shape.moveTo(outline[0][0], outline[0][1]);
        outline.slice(1).forEach(p => shape.lineTo(p[0], p[1])); shape.closePath();
        const pane = mesh(rim, 'Sunglass lens', new THREE.ShapeGeometry(shape, 32), lens, [0, 0, -0.006]);
        pane.castShadow = false;
      }
      rim.updateMatrix();
      const start = new THREE.Vector3(sign * (rectangular ? 0.245 : 0.211), 0.035, 0).applyMatrix4(rim.matrix);
      curve(group, 'Glasses temple', [start.toArray(), [sign * 0.88, 0.31, 0.36], [sign * 0.91, 0.40, 0.04], [sign * 0.86, 0.40, -0.15]], rectangular ? 0.026 : 0.015, frame, false, 40);
      ellipsoid(group, 'Temple hinge', metal, start.toArray(), [0.016, 0.026, 0.014], 0.8, 16);
      const inner = new THREE.Vector3(-sign * (rectangular ? 0.24 : 0.205), 0.07, 0).applyMatrix4(rim.matrix);
      curve(group, 'Raised nose bridge', [inner.toArray(), [sign * 0.26, 0.39, 0.85], [sign * 0.12, 0.405, 0.91], [0, 0.405, 0.92]], rectangular ? 0.026 : 0.016, frame, false, 32);
    }
  }
  let selected = 'none';
  return {
    root, variants,
    get style() { return selected; },
    setStyle(value) {
      if (!['none', 'round', 'sun'].includes(value)) return;
      selected = value;
      Object.entries(variants).forEach(([id, group]) => { group.visible = id === value; });
      root.visible = value !== 'none';
    },
  };
}
