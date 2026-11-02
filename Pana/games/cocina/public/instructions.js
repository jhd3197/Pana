// Pana Cocina's Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Sirvan todos los pedidos que puedan antes del cierre y junten estrellas: 350, 850 y 1500 puntos.'),
  howTo: [
    loc('Busca un cajón de ingredientes, déjalos en una tabla y recoge la preparación. Llévala al fogón; cuando esté verde, recoge el plato y sírvelo en el mostrador.'),
    loc('Si dejas un plato mucho rato en el fogón, se quema y prende fuego: acciona dos veces en ese fogón para apagarlo. Un plato quemado en tus manos va al cubo de basura.'),
  ],
  sections: [{ title: loc('Moverte'), rows: [
    { action: loc('Moverte'), keyboard: loc('W A S D / Flechas'), gamepad: 'Stick izq.', touch: loc('Flechas en pantalla') },
    { action: loc('Un empujoncito'), keyboard: 'Shift', gamepad: 'B / RB', touch: loc('Botón ¡Voy!') },
  ] }, { title: loc('En la cocina'), rows: [
    { action: loc('Recoger, dejar o apagar un fuego'), keyboard: loc('E / Espacio'), gamepad: 'A / X', touch: loc('Botón de acción') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('La mesa «Para tu pana» permite pasar platos.'),
    loc('El botón de acción aparece junto a una estación y dice qué vas a hacer ahí.'),
  ],
};
