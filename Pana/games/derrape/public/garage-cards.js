import * as THREE from 'three';
import { paintNext } from './loading.js';
import { makeWheel } from '/engine/models/vehicles/car-kit.js';

// Render each actual car once. Eight static thumbnails share one short-lived
// renderer, so the selector never runs eight extra WebGL scenes every frame.
export function garageCards(cars, getCar, onSelect, canRender) {
  const fragment = document.createDocumentFragment();
  const images = cars.map((def, index) => {
    const button = document.createElement('button');
    button.className = 'car-choice';
    button.style.setProperty('--choice-color', def.color);
    button.setAttribute('aria-label', def.name);
    button.setAttribute('aria-pressed', String(index === 0));
    const img = document.createElement('img');
    img.alt = ''; img.width = 120; img.height = 92;
    const name = document.createElement('span'); name.textContent = def.name;
    const num = document.createElement('b'); num.textContent = def.num; num.setAttribute('aria-hidden', 'true');
    button.append(img, num, name); button.onclick = () => onSelect(index);
    fragment.append(button);
    return img;
  });
  // Buttons work immediately; build and draw one preview between paints.
  const ready = paintNext().then(async () => {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(240, 184);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff1de, 0x483265, 1.6));
    const key = new THREE.DirectionalLight(0xffedce, 2.6);
    key.position.set(3, 7, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x8daaff, 1.6);
    rim.position.set(-3, 2, -4); scene.add(rim);
    const camera = new THREE.PerspectiveCamera(33, 240 / 184, 0.1, 50);
    camera.position.set(7, 4.7, 9);
    camera.lookAt(0, 1.65, 0);
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.4, 0.28, 12),
      new THREE.MeshStandardMaterial({ color: 0x382a50, roughness: 0.85, flatShading: true }));
    stage.position.y = -0.2; scene.add(stage);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.26, 0.055, 4, 32), new THREE.MeshBasicMaterial());
    ring.rotation.x = -Math.PI / 2; ring.position.y = -0.04; scene.add(ring);
    try {
      for (const [index, def] of cars.entries()) {
        await paintNext();
        while (!canRender() || document.hidden) await new Promise(resolve => setTimeout(resolve, 150));
        const car = getCar(index), parent = car.root.parent;
        scene.add(car.root);
        ring.material.color.set(def.color);
        try {
          renderer.render(scene, camera);
          images[index].src = renderer.domElement.toDataURL('image/png');
        } finally {
          car.root.removeFromParent();
          if (parent) parent.add(car.root);
        }
      }
    } finally {
      stage.geometry.dispose(); stage.material.dispose(); ring.geometry.dispose(); ring.material.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    }
  });
  return { fragment, ready };
}

// The cauchos strip: a real makeWheel render per wheel on the same
// short-lived renderer pattern as the car thumbnails above.
export function wheelCards(wheels, onSelect, canRender) {
  const fragment = document.createDocumentFragment();
  const images = wheels.map((def, index) => {
    const button = document.createElement('button');
    button.className = 'wheel-choice';
    button.style.setProperty('--choice-color', def.color);
    button.setAttribute('aria-label', def.name);
    button.setAttribute('aria-pressed', String(index === 0));
    const img = document.createElement('img');
    img.alt = ''; img.width = 96; img.height = 72;
    const name = document.createElement('span'); name.textContent = def.name;
    button.append(img, name); button.onclick = () => onSelect(def.id);
    fragment.append(button);
    return img;
  });
  // Buttons work immediately; build and draw one preview between paints.
  const ready = paintNext().then(async () => {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(192, 144);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff1de, 0x483265, 1.6));
    const key = new THREE.DirectionalLight(0xffedce, 2.6);
    key.position.set(3, 7, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x8daaff, 1.6);
    rim.position.set(-3, 2, -4); scene.add(rim);
    const camera = new THREE.PerspectiveCamera(33, 192 / 144, 0.1, 50);
    camera.position.set(2.1, 1.1, 2.6);
    camera.lookAt(0, 0, 0);
    try {
      for (const [index, def] of wheels.entries()) {
        await paintNext();
        while (!canRender() || document.hidden) await new Promise(resolve => setTimeout(resolve, 150));
        // calle has no spec of its own: preview it as the classic street wheel.
        const wheel = makeWheel(def.wheel ?? { r: 0.69, w: 0.68, style: 'spokes', rim: '#6b707e', cap: '#e0262f' });
        wheel.rotation.y = 0.55;
        scene.add(wheel);
        try {
          renderer.render(scene, camera);
          images[index].src = renderer.domElement.toDataURL('image/png');
        } finally {
          wheel.removeFromParent();
          wheel.traverse(o => o.geometry?.dispose());
        }
      }
    } finally {
      renderer.dispose(); renderer.forceContextLoss();
    }
  });
  return { fragment, ready };
}
