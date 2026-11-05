// Your two gloved hands in first person, on the engine's shared rig and motion:
// the suit's sleeve, brass cuff and whatever each hand holds. They hide while you
// are down, gripping a treasure or pushing one. The rules' p.swing starts a blow.
import { applyHeld, createHeldMotion, swingPose } from '/engine/play/viewmodel.js';
import { createHandKit } from '/engine/play/viewmodel-rig.js';
import { gripFor } from './grips.js';

const NARROW = .55;     // how far in the hands come on a portrait screen

export function createHands({ camera, itemModel }) {
  const kit = createHandKit({ glove: 0x57402f, scale: .82, glow: .14 }), carry = {}, pose = [0, 0, 0, 0, 0, 0];
  const hands = [0, 1].map(i => ({ rig: kit.hand({ parent: camera, side: i ? -1 : 1 }), motion: createHeldMotion(), key: '', swings: 0, lastSwing: 0, grip: gripFor(null) }));
  hands.forEach(h => h.rig.setGrip(h.grip.shape));
  function hold(h, held) {
    const key = held ? `${held.id}:${held.kind}:${held.pile?.length || 0}` : '';
    if (h.key === key) return; h.key = key;
    h.grip = gripFor(held); h.rig.setGrip(h.grip.shape); h.rig.slot.clear();
    if (!held) return;
    const model = itemModel(held.kind), { scale, at, turn } = h.grip;
    model.scale.multiplyScalar(held.pile ? .28 + held.pile.length * .05 : scale);
    model.position.set(...at); model.rotation.set(...turn);
    model.traverse(o => { o.castShadow = false; });
    h.rig.slot.add(model);
  }
  return {
    hands,
    update(dt, me, { bob, sway, push = 0, aspect = 1, color }) {
      const hidden = me.downed || me.grip != null || me.push != null, sprint = me.moving && me.vx ** 2 + me.vz ** 2 > 40, spread = aspect < 1 ? NARROW : 1;
      kit.setColor(color);
      hands.forEach((h, i) => {
        const held = me.hands[i], side = i ? -1 : 1;
        hold(h, held);
        h.rig.visible = !hidden;
        h.rig.elbow.x = .42 * side * spread;
        // A fresh blow: the countdown on this hand went up.
        const swing = me.swingHand === i ? me.swing : 0;
        if (swing > h.lastSwing + 1e-4) h.swings++;
        h.lastSwing = swing;
        // An empty hand does not rise: a thrown flare leaves it mid-swing.
        if (h.motion.equip(held?.kind || 'empty', h.swings) && !held) h.motion.swap = 0;
        h.motion.step(dt, { sprint, down: me.downed });
        const { windup, recovery } = h.grip.blow, since = h.motion.swing(dt, { swings: h.swings, windup, recovery });
        swingPose(since, windup, recovery, pose, h.grip.table);
        applyHeld(h.rig.hand, pose, h.motion.carry(carry, { bob: bob + i * Math.PI, sway, air: me.jumpHeight || 0, push }), { side, spread });
        h.rig.update();
      });
    },
    // A small blow with the right hand, as if at the rock in front of you: no rule sees it.
    knock() { hands[0].swings++; },
    dispose() { kit.dispose(); },
  };
}
