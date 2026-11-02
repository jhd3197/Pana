// Dominó's Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Quédate sin fichas antes que nadie y suma los puntos que les quedan a tus rivales.'),
  howTo: [
    loc('Juega una ficha que coincida con una punta. Si sirve en ambas, elige A o B. No puedes pasar si tienes jugada.'),
    loc('Gana quien se queda sin fichas y suma los puntos que quedaron a sus rivales. Una capicúa es la última ficha que podía jugarse en ambas puntas.'),
  ],
  sections: [{ title: loc('En tu turno'), rows: [
    { action: loc('Elegir una ficha de tu mano'), keyboard: loc('1 a 0 / Clic'), gamepad: 'Cruceta + A', touch: loc('Toca la ficha') },
    { action: loc('Elegir una punta si la ficha cabe en ambas'), keyboard: 'A / B', gamepad: 'LB / RB', touch: loc('Toca la punta') },
    { action: loc('Pasar, solo si no tienes jugada'), keyboard: 'P', gamepad: 'X', touch: loc('Botón Pasar') },
    { action: loc('Pedir una pista'), keyboard: 'H', gamepad: 'Y', touch: loc('Botón Pista') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('Mesa clásica de cuatro o ampliada de seis. Los puestos alternos forman dos equipos; Individual reparte puntos a cada pana.'),
    loc('Siete o diez fichas por pana. La mesa amplía el juego a doble nueve o doble doce cuando hace falta; las sobrantes se apartan, no hay robo.'),
    loc('La salida puede ser doble seis, ganador anterior (primera mano: doble seis), o un pana al azar. En Más ajustes, ¿Quién empieza? decide la primera mano con el cacho: todos sacuden, tapan y sale el dado más alto.'),
    loc('Con Pase anotado, cada paso da diez puntos al equipo o pana anterior. El anfitrión elige si una tranca puntúa o se reparte sin puntuar.'),
    loc('Con reloj, al agotarse el turno se juega una ficha legal automáticamente. Los ajustes muestran el tiempo y la meta de la partida.'),
  ],
};
