import * as THREE from 'three';

// A bounded pool of camera-facing comic bursts, triggered by real hit events.
export function createCombatImpacts(scene) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 16; i++) {
    const angle = i / 16 * Math.PI * 2, r = i % 2 ? .2 : .55;
    const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
    if (i) shape.lineTo(x, y); else shape.moveTo(x, y);
  }
  const geometry = new THREE.ShapeGeometry(shape);
  const labels = new Map();
  for (const word of ['¡PAF!', '¡PUM!', '¡TAC!', '¡PAM!', '¡ZAS!', '¡PLAF!']) { // i18n-ignore: onomatopoeia painted in the ring
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.font = '900 52px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 9; ctx.strokeStyle = '#301b12'; ctx.fillStyle = '#ffe480';
    ctx.strokeText(word, 128, 48); ctx.fillText(word, 128, 48);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    labels.set(word, texture);
  }
  const pool = Array.from({ length: 8 }, () => {
    const group = new THREE.Group(); group.visible = false; scene.add(group);
    const material = new THREE.MeshBasicMaterial({ color: '#ff8a2a', transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const burst = new THREE.Mesh(geometry, material);
    const core = new THREE.Mesh(geometry, material.clone()); core.material.color.set('#fff9d5'); core.scale.setScalar(.62); core.position.z = .01;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
    label.position.y = .65; label.scale.set(1.3, .49, 1);
    group.add(burst, core, label);
    return { group, burst, core, label, age: 1, power: 1 };
  });
  let cursor = 0;
  return {
    spawn(position, kind, move) {
      const item = pool[cursor++ % pool.length];
      item.age = 0; item.power = kind === 'trompon' ? 1.25 : .8;
      item.group.position.copy(position); item.group.visible = true;
      item.burst.material.color.set(kind === 'block' ? '#86dceb' : '#ff8a2a');
      item.label.material.map = labels.get(kind === 'block' ? '¡TAC!' : ({ kick: '¡PAM!', sweep: '¡ZAS!', toss: '¡PLAF!' }[move] || (kind === 'trompon' ? '¡PUM!' : '¡PAF!'))); // i18n-ignore
      item.label.material.needsUpdate = true;
    },
    update(dt, camera) {
      for (const item of pool) {
        item.age += dt; item.group.visible = item.age < .5;
        if (!item.group.visible) continue;
        item.group.quaternion.copy(camera.quaternion);
        const t = item.age, fade = Math.max(0, 1 - t / .3);
        item.burst.scale.setScalar(item.power * (1 + t * 2)); item.burst.rotation.z = t * 2;
        item.core.scale.setScalar(item.power * .62 * (1 + t * 2));
        item.burst.material.opacity = item.core.material.opacity = fade;
        item.label.position.y = .65 + t * .5; item.label.material.opacity = Math.min(1, ( .5 - t) * 7);
      }
    },
    dispose() {
      for (const item of pool) {
        item.group.removeFromParent(); item.burst.material.dispose(); item.core.material.dispose(); item.label.material.dispose();
      }
      geometry.dispose(); labels.forEach(texture => texture.dispose());
    },
  };
}
