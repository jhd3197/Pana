// Bolas Criollas' Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Arrima tus bolas al mingo más que el equipo rival y llega primero a la meta de tantos.'),
  howTo: [
    loc('Toca la cancha para dirigir la bola y afina con las flechas. Mantén el botón: la fuerza sube y baja; suelta para lanzar.'),
    loc('Elige el tiro: Arrime para acercarte al mingo, Rastrero para sacar una bola con un boche, Por el aire para pasar por encima (ajusta Altura antes de cargar).'),
    loc('Juega el equipo que está más lejos del mingo. Al gastar todas las bolas, el más cercano suma un tanto por cada bola más cerca que la mejor del rival.'),
  ],
  sections: [{ title: loc('Lanzar'), rows: [
    { action: loc('Dirigir la bola'), keyboard: loc('Clic en la cancha'), gamepad: 'Stick der. + RT', touch: loc('Toca la cancha') },
    { action: loc('Afinar la dirección'), keyboard: '← →', gamepad: 'Stick izq. / Cruceta', touch: loc('Flechas en pantalla') },
    { action: loc('Cargar la fuerza: mantén y suelta para lanzar'), keyboard: loc('Espacio / Enter'), gamepad: 'A', touch: loc('Mantén para lanzar') },
    { action: loc('Elegir Arrime, Rastrero o Por el aire'), keyboard: loc('Clic'), gamepad: 'Stick der. + RT', touch: loc('Toca el tiro') },
    { action: loc('Ajustar la altura del tiro por el aire'), keyboard: loc('Barra Altura'), touch: loc('Barra Altura') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Cambiar la cámara'), keyboard: 'C', gamepad: 'Y', touch: loc('Botón Cámara') },
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('Reglas de la casa: dos equipos de tres, rojos y verdes. Cada pana lanza dos o cuatro bolas; los bots cubren los puestos libres. Los compañeros rotan sus lanzamientos.'),
    loc('El mingo se coloca automáticamente al comenzar la mano. Arrima tu bola lo más cerca posible o usa un boche rastrero para desplazar las otras bolas. Por el aire permite superar una bola: ajusta Altura antes de cargar y mira el aro azul de caída. El mingo también se mueve con los golpes.'),
    loc('Antes de la primera mano, una moneda decide qué equipo lanza el mingo: cara para los rojos, sello para los verdes. El anfitrión puede cambiarlo en Más ajustes: al azar, el orden de la mesa o que empiece el equipo que perdió la última partida.'),
    loc('Juega el equipo que está más lejos del mingo. Si ya no le quedan bolas, juega el otro. Un empate de distancia alterna el equipo que lanza.'),
    loc('Al gastar todas las bolas, el equipo más cercano suma un tanto por cada bola más cerca del mingo que la mejor del rival. A igual distancia, la mano no da tantos.'),
    loc('Las bolas que cruzan la línea quedan fuera. Si sale el mingo, la mano es nula: nadie suma. El anfitrión abre la siguiente mano o la revancha.'),
    loc('Gana quien llegue a la meta elegida, 12 o 24 tantos. Esta versión casual usa una cancha compacta, mingo automático, boches rastreros y por el aire.'),
    loc('La línea de tiro indica dónde frenaría la bola si no chocara; mantén y suelta para ajustar la distancia. En Fácil muestra también los choques y dónde quedan las bolas; en Difícil y Experto se acorta. Cambiar a rastrero aumenta la velocidad: suelta antes si quieres mantener la misma distancia.'),
    loc('La dificultad también afina a los bots rivales: en Difícil y Experto sacan con boche las bolas que se pegan al mingo. Los bots de tu equipo juegan siempre en Normal.'),
  ],
};
