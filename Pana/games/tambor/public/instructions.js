// La Rueda de Tambor's Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Mantén la rueda sonando: toca tu tambor a tiempo, baila lo que canta el MCP sin fallar y anima desde la gente.'),
  howTo: [
    loc('Los tamboreros llenan el Sabor. Con mucho Sabor el MCP canta con calma; si el tambor se cae, los llamados vienen más rápido y más apretados.'),
    loc('Los bailadores siguen al MCP: ¡Cadera!, ¡Vuelta!, ¡Pañuelo!, ¡Pégate!, ¡Abajo! y ¡Golpe!. Tres fallas y te saca de la rueda.'),
    loc('En la gente aplaude en el golpe: la Bulla le da más tiempo a los que bailan. Al final de cada canción los tamboreros y la gente cambian de lugar.'),
  ],
  sections: [{ title: loc('En el tambor'), rows: [
    { action: loc('Palo: toca en el contratiempo'), keyboard: loc('Espacio'), gamepad: 'A / RB', touch: loc('Botón Golpe') },
    { action: loc('Mano: un cuero con cada mano'), keyboard: '← → / F J', gamepad: 'X B / Cruceta', touch: loc('Flechas izquierda y derecha') },
    { action: loc('Charrasca: mantén y suelta en el golpe'), keyboard: loc('Espacio'), gamepad: 'A / RB', touch: loc('Botón Golpe') },
    { action: loc('Caracol: mantén en los momentos grandes'), keyboard: loc('Espacio'), gamepad: 'A / RB', touch: loc('Botón Golpe') },
    { action: loc('¡Golpe!: repite con las dos manos el golpe del MCP'), keyboard: '← → / F J', gamepad: 'X B / Cruceta', touch: loc('Flechas izquierda y derecha') },
  ] }, { title: loc('Bailando en el centro'), rows: [
    { action: loc('¡Cadera!: izquierda o derecha en el golpe'), keyboard: '← / →', gamepad: 'X / B', touch: loc('Flechas izquierda y derecha') },
    { action: loc('¡Vuelta!: la flecha que pide y luego el golpe'), keyboard: loc('Flecha + Espacio'), gamepad: 'Cruceta + A', touch: loc('Flecha y Golpe') },
    { action: loc('¡Pañuelo!: mantén dos tiempos'), keyboard: loc('Espacio'), gamepad: 'A', touch: loc('Botón Golpe') },
    { action: loc('¡Pégate!: arriba una sola vez'), keyboard: '↑', gamepad: 'Y', touch: loc('Flecha arriba') },
    { action: loc('¡Abajo!: mantén dos tiempos'), keyboard: '↓', gamepad: 'Cruceta ↓', touch: loc('Flecha abajo') },
    { action: loc('¡Golpe!: un golpe y quieto'), keyboard: loc('Espacio'), gamepad: 'A', touch: loc('Botón Golpe') },
  ] }, { title: loc('En la gente'), rows: [
    { action: loc('Aplaudir en el golpe'), keyboard: loc('Espacio'), gamepad: 'A / RB', touch: loc('Botón Aplaudir') },
    { action: loc('Echar un dicho'), keyboard: '1 – 4', touch: loc('Toca el dicho') },
    { action: loc('¡Quiero entrar! (una vez por canción)'), keyboard: 'Q', gamepad: 'LB', touch: loc('Botón ¡Quiero entrar!') },
    { action: loc('Relevo: entrar al centro en el ¡Golpe!'), keyboard: 'E', gamepad: 'RT', touch: loc('Botón ¡Entro!') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('Cada quien oye la música en su compu y se juzga contra ella: el retraso de Discord no importa. Ajusta el golpe una vez en la sala.'),
    loc('Al final de cada canción los tamboreros y la gente cambian de lugar. Todos bailan.'),
  ],
};
