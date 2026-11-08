// Capis a Pintazos on a controller: the shooter layout (Pepazo's too) so a
// pad feels the same across games. RT / R2 charges while held and fires on
// release, A / Cross jumps, Y shows the whole map; the left stick and d-pad
// walk and aim. engine/gamepad.js presses these keys, game.js reads them.
import { loc } from '/engine/i18n.js';

export const PAD = Object.freeze({
  move: 'wasd',
  keys: Object.freeze({
    rt: ['Space', loc('Cargar y disparar')],
    a: ['Enter', loc('Saltar')],
    y: ['KeyZ', loc('Ver todo el mapa')],
  }),
});
