import { wardrobeMeta, wardrobeColor } from './wardrobe-data.js';

// Both the editor and gameplay use this exact slot/color application.
export function applyWardrobe(sculpt, accessories, look, previous = {}) {
  const wardrobe = sculpt.wardrobe;
  const headwear = { gorra: 'cap', 'gorra-atras': 'cap', cinta: 'band', chef: 'chef' };
  if (previous.top !== look.top) {
    if (look.top === 'base') wardrobe.setOutfit('base');
    else wardrobe.setGarment(look.top);
  }
  wardrobe.setHeadwear(headwear[look.hat] || 'none');
  wardrobe.details.cap.rotation.y = look.hat === 'gorra' ? Math.PI : 0;
  wardrobe.setWristbands(look.wrist);
  if (look.top !== 'base') wardrobe.setColor(wardrobeColor(look, 'top', look.top, 'main'));
  if (headwear[look.hat]) wardrobe.setHeadwearColor(wardrobeColor(look, 'hat', look.hat, 'main'));
  const glasses = wardrobeMeta('glasses', look.glasses).repo;
  sculpt.setGlasses(glasses || 'none');
  accessories.show('hat', headwear[look.hat] ? 'none' : look.hat);
  accessories.show('glasses', glasses ? 'none' : look.glasses);
  accessories.show('neck', look.neck);
  accessories.show('back', look.back);
  for (const slot of ['hat', 'glasses', 'neck', 'back']) {
    for (const channel of Object.keys(wardrobeMeta(slot, look[slot]).slots || {})) {
      accessories.color(slot, look[slot], channel, wardrobeColor(look, slot, look[slot], channel));
    }
  }
  for (const [id, enabled] of Object.entries(look.extras)) {
    accessories.setFace(id, enabled);
    for (const channel of Object.keys(wardrobeMeta('extras', id).slots || {})) {
      accessories.color('face', id, channel, wardrobeColor(look, 'extras', id, channel));
    }
  }
  if (previous.top !== look.top || previous.print !== look.print) accessories.setPrint(look.print, look.top);
  if (wardrobeMeta('print', look.print).slots) accessories.printColor(wardrobeColor(look, 'print', look.print, 'main'));
  if (previous.face !== look.face) sculpt.setExpression(look.face);
  Object.assign(previous, { top: look.top, print: look.print, face: look.face });
}
