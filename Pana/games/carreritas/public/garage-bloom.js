// A soft bloom for the garage showroom so lamps and the accent ring glow.
// Only built when the quality setting allows it; races never use it.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function garageBloom(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // A high threshold: only lamps and other emissive parts glow, not white paint.
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.35, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const size = () => { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); };
  size();
  return { render: () => composer.render(), size, dispose: () => composer.dispose() };
}
