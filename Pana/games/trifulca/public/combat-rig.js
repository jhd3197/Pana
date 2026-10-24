import * as THREE from 'three';
// Apply the study's sculpt-space poses to the existing player's wardrobe.
// Root movement belongs to the host; authored lunges are deliberately bounded.
export function createCombatRig(character, gloves, shoulders) {
  const ears = character.head.children.filter(o => o.name === 'Cupped ear');
  const earBase = ears.map(o => o.rotation.clone());
  let active = false;
  const pivotOffset = new THREE.Vector3();
  return function apply(p, moving = 0) {
    if (!p) {
      if (active) {
        character.body.position.x = character.body.position.z = 0; character.body.scale.setScalar(1);
        character.legs.forEach(leg => { leg.scale.setScalar(1); leg.rotation.y = leg.rotation.z = 0; }); character.neck.rotation.y = 0;
        character.arms.forEach(a => { a.scale.x = a.scale.z = 1; });
        ears.forEach((ear, i) => ear.rotation.copy(earBase[i]));
      }
      active = false; return;
    }
    active = true;
    const b = character.body, squash = p.squash;
    b.position.y = p['body.y']; b.position.z = Math.max(-.25, Math.min(.3, p['body.z']));
    b.rotation.set(p['body.rx'], p['body.ry'] + p.spin, p['body.rz']);
    b.scale.set(1 + squash * .55, 1 - squash, 1 + squash * .55);
    if (p['body.pivot']) {
      const pivot = p['body.pivot'];
      pivotOffset.set(0, pivot, 0).applyEuler(b.rotation);
      b.position.x = -pivotOffset.x; b.position.y += pivot - pivotOffset.y; b.position.z -= pivotOffset.z;
    } else b.position.x = 0;
    const stab = p.stab;
    character.neck.rotation.set(
      Math.max(-.35, Math.min(.35, p['neck.rx'] - p['body.rx'] * .6 * stab)),
      Math.max(-.5, Math.min(.5, p['neck.ry'] - p['body.ry'] * .7 * stab)),
      Math.max(-.2, Math.min(.2, p['neck.rz'] - p['body.rz'] * .5 * stab)));
    character.head.rotation.z = p['head.rz'];
    character.arms.forEach((arm, i) => {
      const key = i ? 'armR' : 'armL', stretch = p[`${key}.s`];
      arm.position.copy(shoulders[i]); arm.position.z += p[`${key}.z`];
      arm.rotation.set(p[`${key}.rx`], p[`${key}.ry`], p[`${key}.rz`]);
      const width = 1 / Math.sqrt(stretch);
      arm.scale.set(width, stretch, width);
      gloves[i].scale.set(1 / .6 / width, 1 / .6 / stretch, 1 / .6 / width);
    });
    // Keep the shared walking cycle while moving, plant the stance otherwise.
    if (moving < .4) character.legs.forEach((leg, i) => {
      const key = i ? 'legR' : 'legL';
      const plant = Math.min(p.plant, Math.max(0, 1 - (Math.abs(p[`${key}.rz`]) - .2) / .4));
      leg.rotation.set(p[`${key}.rx`] - p['body.rx'] * plant, -p['body.ry'] * .55 * plant, p[`${key}.rz`] - p['body.rz'] * plant);
      const stretch = p[`${key}.s`], width = 1 / Math.sqrt(stretch);
      leg.scale.set(width, stretch, width);
    });
    if (moving >= .4) character.legs.forEach(leg => { leg.scale.setScalar(1); leg.rotation.y = leg.rotation.z = 0; });
    ears.forEach((ear, i) => {
      ear.rotation.z = earBase[i].z + (i ? -1 : 1) * p.ears * .45;
      ear.rotation.x = earBase[i].x - p.ears * .3;
    });
    character.eyes.forEach(eye => { eye.scale.y = Math.max(.08, p.eyes); });
    character.wardrobe.update();
  };
}
