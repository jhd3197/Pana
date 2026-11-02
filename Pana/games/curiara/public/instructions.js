// Curiara's Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Baja el río remando y llega primero a la churuata sin voltear tu curiara.'),
  howTo: [
    loc('Rema alternando izquierda y derecha para ir recto y a toda. Dos remadas del mismo lado giran la curiara hacia el lado contrario. Rema justo cuando el anillo pasa por la zona dorada: ¡Remazo!'),
    loc('Machacar frena la curiara: con calma se va más rápido. ¿Te cuesta el ritmo? Sostén el remo automático: la curiara rema sola y tú solo llevas el timón.'),
    loc('En parejas, la proa rema y la popa lleva el timón, cía y lanza el salpicón. Si la popa toca justo con la remada de la proa: ¡Ahora!'),
  ],
  sections: [{ title: loc('Remar (solo o en la proa)'), rows: [
    { action: loc('Remar a la izquierda'), keyboard: 'A / ←', gamepad: 'LB / LT', touch: loc('Botón Izq.') },
    { action: loc('Remar a la derecha'), keyboard: 'D / →', gamepad: 'RB / RT', touch: loc('Botón Der.') },
    { action: loc('Alternar: recto y a toda'), keyboard: 'A D A D', gamepad: 'LB RB LB RB', touch: loc('Izq. y Der. alternando') },
    { action: loc('Mismo lado: girar al lado contrario'), keyboard: 'D D / A A', gamepad: 'RB RB / LB LB', touch: loc('Der. Der. / Izq. Izq.') },
    { action: loc('Remo automático; A y D llevan el timón'), keyboard: 'W / ↑', gamepad: 'Stick izq.', touch: loc('Botón Auto') },
    { action: loc('Ciar: frenar; con A o D, pivotar'), keyboard: 'S / ↓', gamepad: 'Stick izq.', touch: loc('Botón Ciar') },
    { action: loc('¡Salpicón! a la curiara de al lado'), keyboard: loc('Espacio'), gamepad: 'A', touch: loc('Botón Salpicón') },
  ] }, { title: loc('En la popa (timón)'), rows: [
    { action: loc('Timón: sostén a un lado'), keyboard: 'A D / ← →', gamepad: 'LB RB / Stick izq.', touch: loc('Sostén Izq. o Der.') },
    { action: loc('¡Ahora!: toca justo con la remada'), keyboard: 'A / D', gamepad: 'LB / RB', touch: loc('Izq. o Der.') },
    { action: loc('Ciar'), keyboard: 'S / ↓', gamepad: 'Stick izq.', touch: loc('Botón Ciar') },
    { action: loc('¡Salpicón! a la curiara de al lado'), keyboard: loc('Espacio'), gamepad: 'A', touch: loc('Botón Salpicón') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('Sigue las flechas doradas en el agua: marcan el chorro y esquivan los caimanes.'),
    loc('Con Remadas en Toque, cada toque vale igual; evita machacar las teclas.'),
    loc('En un remolino, rema fuerte hacia afuera. Si la curiara se mece mucho, rema recto para calmarla.'),
  ],
};
