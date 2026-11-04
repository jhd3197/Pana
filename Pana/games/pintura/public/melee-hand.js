// The gloved hand that holds a melee weapon in first person, in the match and on the
// range: the engine's rig, wrapped round the grip the viewmodel has just posed.
// Markers carry their own hands, so it hides for them.
import { createHandKit } from '/engine/play/viewmodel-rig.js';

// A melee weapon is held bigger than a marker (its model is about life size).
export const heldScale = (melee, weapon) => melee ? (weapon === 'sandal' ? .45 : .42) : .3;

export function createMeleeHand(camera) {
  const kit = createHandKit({ glove: 0x2c2a33, scale: .82 }), rig = kit.hand({ parent: camera, side: 1 });
  rig.visible = false;
  return {
    get visible() { return rig.visible; }, hand: rig.hand,
    hide() { rig.visible = false; },
    // After the viewmodel's update: a thrown chancla leaves the hand showing, empty.
    update(on, held, color) { rig.visible = on; if (on) { kit.setColor(color); rig.follow(held); } },
    dispose() { kit.dispose(); },
  };
}
