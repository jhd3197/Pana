// The armory's card pictures: each marker, part and charm drawn once from its
// real model (paintball-kit.js) by engine/object-thumb.js and kept for the page.
// armory.js loads this with the first card it draws.
import { createPaintKit, createPaintGrenade } from '/engine/models/props/paintball-kit.js';
import { objectThumb } from '/engine/object-thumb.js';
import { isMelee } from './armory-data.js';

// Markers point right showing their left side (the feed); melee lies down, head right.
const turnOf = weapon => isMelee(weapon) ? [0, .35, -Math.PI / 2] : [0, Math.PI / 2, 0];
// A part is seen three-quarters from behind, so a sight shows its window.
const partTurn = weapon => isMelee(weapon) ? [0, .9, -Math.PI / 2] : [0, Math.PI / 2 + .6, 0];
// Drawn at the card picture's own shape (armory.css .armory-pic), so nothing is letterboxed.
const CARD = { width: 128, height: 64 };
const kitOf = o => () => createPaintKit({ charm: 'none', ...o });

// A whole weapon in its finish, camo and splash.
export function weaponThumb({ weapon, color = '#f28b42', camo = null, pattern = 'splat' }) {
  return objectThumb(`pepazo:w:${weapon}:${color}:${camo}:${pattern}`, kitOf({ weapon, color, camo, pattern }), { ...CARD, turn: turnOf(weapon) });
}
// One attachment alone, as it is fitted to this weapon (its meshes are named 'Accesorio · …').
export function partThumb(weapon, part, color = '#f28b42') {
  return objectThumb(`pepazo:p:${weapon}:${part}:${color}`, kitOf({ weapon, color, attachments: [part] }),
    { turn: partTurn(weapon), tilt: .42, keep: o => o.name.startsWith('Accesorio'), ...CARD, margin: 1.15 });
}
// A charm alone, hanging from its ring.
export function charmThumb(charm) {
  return objectThumb(`pepazo:c:${charm}`, kitOf({ weapon: 'pistol', charm }), { turn: [0, Math.PI / 2, 0], keep: o => o.name === 'Llavero', ...CARD, margin: 1.15 });
}
export function grenadeThumb(color = '#f28b42') {
  return objectThumb(`pepazo:g:${color}`, () => createPaintGrenade({ color }), { ...CARD, margin: 1.2, tilt: .4 });
}
