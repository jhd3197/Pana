// Póquer's Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';
import { HANDS } from './rules.js';

export default {
  goal: loc('Quédate con las fichas de la mesa: gana pozos con la mejor mano o haciendo que los demás se retiren.'),
  howTo: [
    loc('Texas reparte dos cartas privadas; Omaha reparte cuatro y exige usar exactamente dos de tu mano y tres de la mesa. Las fichas, ciegas y límites los elige el anfitrión.'),
    loc('Hay cuatro rondas de apuestas: antes del flop, flop (tres cartas), turn (cuarta) y river (quinta). Puedes pasar si no debes fichas, igualar, subir o retirarte.'),
  ],
  sections: [{ title: loc('En tu turno'), rows: [
    { action: loc('Retirarte, pasar, igualar o subir'), keyboard: loc('Clic'), gamepad: 'Cruceta + A', touch: loc('Toca el botón') },
    { action: loc('Escribir tu apuesta total en esta calle'), keyboard: loc('Números'), touch: loc('Toca Apuesta total') },
  ] }, { title: loc('¿Quién reparte?'), rows: [
    { action: loc('Sacudir el cacho y soltar para taparlo'), keyboard: loc('Mantén Espacio'), touch: loc('Mantén el botón') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('¿Quién reparte primero? Al empezar la partida todos sacuden el cacho a la vez: el dado más alto se lleva el botón del repartidor. Si hay empate arriba, solo los empatados sacuden otra vez. El anfitrión puede cambiarlo en Más ajustes.'),
    loc('Subir indica tu apuesta total en esta calle, incluyendo lo que ya pusiste. La subida mínima es la última subida completa. Puedes apostar todas tus fichas aunque no alcancen ese mínimo.'),
    loc('Si alguien va con todo, los pozos secundarios se reparten entre quienes aportaron a cada uno. Una subida incompleta no reabre la opción de subir a quien ya actuó.'),
    loc('De menor a mayor: {hands}. El as también sirve para la escalera A-2-3-4-5. Si las mejores cinco cartas empatan, comparten el pozo.', { hands: HANDS.map(hand => loc(hand, { $ctx: 'mano' })).join(', ') }),
    loc('Al vencer el tiempo elegido pasas si puedes, o te retiras. Si pierdes la conexión, te retiras de esa mano salvo que ya hayas ido con todo. Quien llega con una mano en curso espera la siguiente.'),
    loc('Con recompras, la siguiente mano repone la cantidad inicial a quien quedó en cero. Sin recompras, observa hasta que el anfitrión cambie los ajustes. En límite fijo hay hasta cuatro apuestas por calle; en turn y river la apuesta se duplica.'),
  ],
};
