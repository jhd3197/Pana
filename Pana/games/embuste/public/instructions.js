// ¡Embuste!'s Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Panas: terminen las tareas hasta que salga el sol o voten a todas las momias. Momias: envuelvan panas hasta igualarlos sin que las descubran.'),
  howTo: [
    loc('Recorre el campamento y haz tus tareas: cada una abre un panel que tapa la pantalla. Si encuentras a un pana envuelto, repórtalo y discutan en la fogata quién es la momia.'),
    loc('Si eres momia, envuelve a los panas cuando nadie mire, sabotea el campamento, disfrázate y métete en los troncos huecos para salir al otro lado del mapa.'),
  ],
  sections: [{ title: loc('Moverte y usar'), rows: [
    { action: loc('Moverte'), keyboard: `W A S D / ${loc('Flechas')}`, gamepad: 'Stick izq. / Cruceta', touch: loc('Cruceta en pantalla') },
    { action: loc('Usar: tareas, escondites, la campana; mantén para reparar'), keyboard: 'E', gamepad: 'A', touch: loc('Botón Usar') },
    { action: loc('Reportar una estatua de vendas'), keyboard: 'R', gamepad: 'X', touch: loc('Botón Reportar') },
  ] }, { title: loc('En las tareas'), rows: [
    { action: loc('Pulsar o mantener el botón de la tarea'), keyboard: loc('Espacio / Enter / Clic'), gamepad: 'B', touch: loc('Toca el botón') },
    { action: loc('Apuntar y tocar en el panel'), keyboard: loc('Ratón'), gamepad: 'Stick der. + RT', touch: loc('Toca o arrastra') },
  ] }, { title: loc('Si eres momia'), rows: [
    { action: loc('Envolver a un pana cercano'), keyboard: 'Q', gamepad: 'LB', touch: loc('Botón Envolver') },
    { action: loc('Abrir los sabotajes'), keyboard: 'F', gamepad: 'Y', touch: loc('Botón Sabotaje') },
    { action: loc('Disfrazarte o quitarte el disfraz'), keyboard: 'C', gamepad: 'RB', touch: loc('Botón Disfraz') },
    { action: loc('Elegir un disfraz'), keyboard: '1 / 2 / 3 / 4', touch: loc('Toca el disfraz') },
    { action: loc('Cruzar al otro lado del tronco'), keyboard: 'V', touch: loc('Botón Al otro lado') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('Las tareas tapan la pantalla: mira a tu alrededor antes de empezar.'),
    loc('Si encuentras a un pana envuelto, repórtalo y discutan en la fogata.'),
    loc('Las momias pueden meterse en los troncos huecos y aparecer al otro lado del mapa.'),
  ],
};
