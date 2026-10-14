import * as THREE from 'three';

// Render each actual car once. Eight static thumbnails share one short-lived
// renderer, so the selector never runs eight extra WebGL scenes every frame.
export function garageCards(cars, avatar, onSelect) {
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
  const fragment = document.createDocumentFragment();
  cars.forEach((def, index) => {
    const car = def.build(avatar);
    scene.add(car.root);
    ring.material.color.set(def.color);
    renderer.render(scene, camera);
    const button = document.createElement('button');
    button.className = 'car-choice';
    button.style.setProperty('--choice-color', def.color);
    button.setAttribute('aria-label', def.name);
    button.setAttribute('aria-pressed', String(index === 0));
    const img = document.createElement('img');
    img.src = renderer.domElement.toDataURL('image/png'); img.alt = ''; img.width = 120; img.height = 92;
    const name = document.createElement('span'); name.textContent = def.name;
    button.append(img, name); button.onclick = () => onSelect(index);
    fragment.append(button);
    car.root.removeFromParent();
    car.driver.dispose();
    car.root.traverse(o => o.geometry?.dispose());
  });
  stage.geometry.dispose(); stage.material.dispose(); ring.geometry.dispose(); ring.material.dispose();
  renderer.dispose(); renderer.forceContextLoss();
  return fragment;
}
