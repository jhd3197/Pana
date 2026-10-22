import * as THREE from 'three';
import { paintNext } from './loading.js';
import { studioEnvironment, studioRims } from './garage-stage.js';

// Render the Taller's car thumbnails once on one temporary WebGL renderer.
export function garageCards(cars, getCar, canRender) {
  const images = cars.map(() => {
    const img = new Image(120, 92); img.alt = ''; return img;
  });
  // Build and draw one preview between paints.
  const ready = paintNext().then(async () => {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(240, 184);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    scene.environment = studioEnvironment(renderer);
    studioRims(scene, 1.4);
    scene.add(new THREE.HemisphereLight(0xfff1de, 0x483265, 1.1));
    const key = new THREE.DirectionalLight(0xffedce, 2.6);
    key.position.set(3, 7, 5); scene.add(key);
    const camera = new THREE.PerspectiveCamera(33, 240 / 184, 0.1, 50);
    camera.position.set(7, 4.7, 9);
    camera.lookAt(0, 1.65, 0);
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.4, 0.28, 12),
      new THREE.MeshStandardMaterial({ color: 0x382a50, roughness: 0.85, flatShading: true }));
    stage.position.y = -0.2; scene.add(stage);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.26, 0.055, 4, 32), new THREE.MeshBasicMaterial({ toneMapped: false }));
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
      scene.environment.dispose(); renderer.dispose(); renderer.forceContextLoss();
    }
  });
  return { ready, image: index => images[index]?.cloneNode() };
}
