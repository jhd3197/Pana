// Lancha's Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Llega primero a Puerto Ayacucho bajando el Orinoco en tu lancha.'),
  howTo: [
    loc('Sostén el acelerador todo el tiempo: machacarlo hace que la lancha vaya más lenta. Gira el motor para seguir el río.'),
    loc('El chorro, los saltos derechos y la estela de las toninas llenan el turbo. Cuando la barra pasa la mitad, suéltalo en una recta.'),
  ],
  sections: [{ title: loc('Manejar'), rows: [
    { action: loc('Acelerar (sostenido)'), keyboard: 'W / ↑', gamepad: 'RT / A', touch: loc('Botón Gas') },
    { action: loc('Girar el motor'), keyboard: 'A D / ← →', gamepad: 'Stick izq.', touch: loc('Botones Izq. y Der.') },
    { action: loc('Frenar; sostenido, retroceder'), keyboard: 'S / ↓', gamepad: 'LT / B', touch: loc('Botón Freno') },
    { action: loc('Turbo (gasta media barra)'), keyboard: loc('Espacio'), gamepad: 'X / RB', touch: loc('Botón Turbo') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('Sigue las flechas doradas en el agua: marcan el chorro, el carril rápido del raudal y esquivan los caimanes.'),
    loc('En el Orinoco las boyas marcan el canal: coral a la izquierda, verde a la derecha.'),
    loc('Cae derecho de los raudales o se te ahoga el motor.'),
    loc('En un remolino, acelera hacia afuera.'),
  ],
};
