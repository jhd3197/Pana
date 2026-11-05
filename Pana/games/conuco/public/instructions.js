// The pause menu's Instrucciones page (engine/controls-page.js). Instructions
// never go on the HUD: keep how to play and the controls here.
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Arregla tu casa y llena tu conuco.'),
  howTo: [
    loc('Toca un cantero vacío para sembrar. El maíz siempre es gratis; las demás semillas salen de la tienda.'),
    loc('Lo sembrado crece aunque cierres el juego. Cuando esté listo, tócalo y cobra mangos y XP.'),
    loc('Si lo dejas más de un día se marchita poco a poco. Nunca se muere: solo paga menos, hasta la mitad.'),
    loc('La tienda cambia cada cuatro horas, igual para todos.'),
    loc('Con mangos arreglas la casa, y cada nivel trae más canteros. Con XP subes de rango y ganas adornos.'),
  ],
  sections: [{ title: loc('Tu conuco'), rows: [
    { action: loc('Sembrar o cosechar'), keyboard: loc('Clic en el cantero'), gamepad: 'A', touch: loc('Toca el cantero') },
  ] }],
  tips: [loc('Los mangos son los mismos de todos los juegos de Pana.')],
};
