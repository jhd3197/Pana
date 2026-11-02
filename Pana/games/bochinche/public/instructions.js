// Bochinche's Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Saca a los demás panas de la arena y sé el último con vidas.'),
  howTo: [
    loc('Cuanto más daño acumulas, más lejos te mandan los golpes. Si te sacan de la arena pierdes una vida.'),
    loc('Gana quien conserve vidas. Si empatan al sonar la campana, hay muerte súbita.'),
  ],
  sections: [{ title: loc('Moverte'), rows: [
    { action: loc('Moverse'), keyboard: 'A D / ' + loc('Flechas'), gamepad: 'Stick izq. / Cruceta', touch: loc('Cruceta en pantalla') },
    { action: loc('Saltar · dos saltos'), keyboard: loc('Espacio'), gamepad: 'A', touch: loc('Botón Salto') },
    { action: loc('Escudo / esquivar con dirección'), keyboard: 'Shift', gamepad: 'LB', touch: loc('Botón Escudo') },
  ] }, { title: loc('Pelear'), rows: [
    { action: loc('Golpe / ataque aéreo, con dirección'), keyboard: 'J', gamepad: 'X', touch: loc('Botón Golpe') },
    { action: loc('Jonrón: golpe con toque lateral'), keyboard: loc('J + lado'), gamepad: loc('X + lado'), touch: loc('Botón Golpe + lado') },
    { action: loc('El poder de tu pana'), keyboard: 'K', gamepad: 'B', touch: loc('Botón Especial') },
    { action: loc('Candela'), keyboard: loc('K + lado'), gamepad: loc('B + lado'), touch: loc('Botón Especial + lado') },
    { action: loc('Hielo'), keyboard: loc('K + abajo'), gamepad: loc('B + abajo'), touch: loc('Botón Especial + abajo') },
    { action: loc('Volver al escenario'), keyboard: loc('K + arriba'), gamepad: loc('B + arriba'), touch: loc('Botón Especial + arriba') },
    { action: loc('Agarrar · dirección para lanzar'), keyboard: 'L', gamepad: 'Y', touch: loc('Botón Agarre') },
    { action: loc('Agarrar objetos'), keyboard: 'I / L', gamepad: 'Y', touch: loc('Botón Agarre') },
  ] }, { title: loc('Elige tu pana'), rows: [
    { action: loc('Elegir un pana'), keyboard: loc('Su letra / Clic'), touch: loc('Toca el pana') },
    { action: loc('Pana al azar'), keyboard: 'R', touch: loc('Botón ¡Sorpréndeme!') },
    { action: loc('Confirmar tu pana'), keyboard: 'Enter', touch: loc('Botón ¡Listo!') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('Escoge tu pana y tu estilo en la sala: cada pana tiene su poder en K.'),
  ],
};
