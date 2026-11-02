// ¡Stop!'s Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Suma más puntos que nadie escribiendo palabras que empiecen con la letra de la ronda, mejor si nadie más las puso.'),
  howTo: [
    loc('Sale una letra y escribes una palabra por categoría que empiece con ella. Nadie ve tu hoja hasta la revisión.'),
    loc('El primero que llena todo grita ¡STOP! y los demás tienen 5 segundos. Si nadie termina, se acaba el tiempo.'),
    loc('Lo que el juego conoce cuenta solo (verde). Lo que no empieza con la letra, no (rojo). Lo dudoso se vota: «¿Eso cuenta?».'),
  ],
  sections: [{ title: loc('La rueda'), rows: [
    { action: loc('¡Para! la rueda cuando te toca'), keyboard: loc('Espacio'), gamepad: 'X', touch: loc('Botón ¡Para!') },
  ] }, { title: loc('Tu hoja'), rows: [
    { action: loc('Pasar a la siguiente casilla'), keyboard: 'Tab / Enter', touch: loc('Toca la casilla') },
    { action: loc('Gritar ¡STOP! con todo lleno'), keyboard: loc('Clic'), gamepad: 'Cruceta + A', touch: loc('Botón ¡STOP!') },
    { action: loc('Votar si una palabra cuenta'), keyboard: loc('Clic'), gamepad: 'Cruceta + A', touch: loc('Toca tu voto') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('100 puntos si nadie más la puso, 50 si alguien la repitió. Una dudosa que la mesa acepta con dos tercios suma +50 de Creatividad.'),
    loc('Lo que la mesa acepta se queda: en la próxima partida cuenta solo.'),
    loc('Con «Más criollo» las groserías van a votación; sin eso, la libreta las tacha sola.'),
    loc("En «Pa' reírse», «Confiesa» e «Inventa» no hay respuesta correcta: la mesa vota todo y gana el más ocurrido."),
    loc('El anfitrión puede poner hasta tres categorías propias en «Categorías». Siempre se votan.'),
  ],
};
