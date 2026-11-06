// ¿Quién quiere ser mi pana?'s Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Sube la escalera de mangos respondiendo bien y termina con más mangos que nadie: el total más alto se lleva el Mango de oro.'),
  howTo: [
    loc('Todos responden a la vez. Nadie ve lo que marcaste hasta la revelación: decir «puse la B» en la llamada puede ser verdad o un farol.'),
    loc('Acierta y subes un escalón. Falla y bajas al último escalón seguro (4 y 8). En la final cada quien apuesta en secreto parte de sus mangos.'),
  ],
  sections: [{ title: loc('En cada pregunta'), rows: [
    { action: loc('Marcar una respuesta o tu apuesta en la final'), keyboard: '1 – 4 / A – D', gamepad: 'Cruceta + A', touch: loc('Toca la respuesta') },
    { action: loc('Usar un comodín'), keyboard: loc('Clic'), gamepad: 'Cruceta + A', touch: loc('Toca el comodín') },
    { action: loc('Cancelar tu respuesta mientras sigue la pregunta'), keyboard: loc('Clic'), gamepad: 'Cruceta + A', touch: loc('Botón Cancelar respuesta') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('Responder rápido da mangos extra. Esperar a ver qué dicen los demás te cuesta.'),
    loc('Comodines, uno de cada uno: Copiarse (marca lo mismo que otro pana sin ver qué puso), Mitad y mitad, Doble o nada y Plantarse.'),
    loc('En la final cada quien apuesta en secreto parte de sus mangos. El total más alto se lleva el Mango de oro.'),
  ],
};
