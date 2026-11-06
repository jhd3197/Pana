// Real light for the other divers' headlamps: a small fixed pool of SpotLights
// lent to the nearest ones. Every diver has a glow and a beam of their own (both
// unlit, explorer-suit.js), but each light costs every lit pixel on screen, and
// the number of lights can never change without recompiling every shader. An
// idle lamp stays in the scene at intensity 0.
import * as THREE from 'three';

const REACH = 16, ANGLE = .52, PENUMBRA = .5, DECAY = 1.35, DROP = .16;
const at = new THREE.Vector3();

export function createHeadlamps(scene, count) {
  const lamps = Array.from({ length: count }, () => {
    const light = new THREE.SpotLight(0xfff0d8, 0, REACH, ANGLE, PENUMBRA, DECAY);
    light.name = 'Diver headlamp'; scene.add(light, light.target);
    return light;
  });
  // divers: { suit, heading, d } for those in view of this floor, any order.
  // Runs every frame: the lit ones follow their helmets.
  function update(divers, power) {
    const nearest = lamps.length < divers.length ? [...divers].sort((a, b) => a.d - b.d) : divers;
    lamps.forEach((light, i) => {
      const diver = nearest[i];
      if (!diver) { light.intensity = 0; return; }
      diver.suit.lamp.getWorldPosition(at);
      light.position.copy(at);
      light.target.position.set(at.x + Math.sin(diver.heading), at.y - DROP, at.z + Math.cos(diver.heading));
      light.color.set(0xfff0d8); light.intensity = power;
    });
  }
  return { lamps, update, dispose() { lamps.forEach(light => { light.removeFromParent(); light.target.removeFromParent(); light.dispose(); }); } };
}
