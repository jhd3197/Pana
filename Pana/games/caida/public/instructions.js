// Caída's Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Gana quien llegue primero a 24 puntos.'),
  howTo: [
    loc('Juega una carta del mismo número que una de la mesa para recoger ambas y todas las consecutivas que le sigan, sin saltos: después del 7 viene la sota. Si no hay coincidencia, tu carta se queda en la mesa.'),
    loc('¡Caída! Solo si recoges la carta que el jugador anterior acaba de dejar: as a 7, un punto; sota, dos; caballo, tres; rey, cuatro. Recoger una carta vieja no es caída. En equipos no se puntúa una caída al compañero.'),
    loc('Mesa limpia suma cuatro puntos si aún quedan cartas por repartir. En últimas no vale. En esta mesa, caída y mesa limpia suman juntas.'),
  ],
  sections: [{ title: loc('En tu turno'), rows: [
    { action: loc('Seleccionar una carta'), keyboard: loc('1 a 3 / Clic'), gamepad: 'Cruceta + A', touch: loc('Toca la carta') },
    { action: loc('Jugar la carta seleccionada'), keyboard: 'Enter', gamepad: 'RB', touch: loc('Botón Jugar') },
    { action: loc('Cantar antes de jugar la primera carta'), keyboard: 'C', gamepad: 'X', touch: loc('Botón Cantar') },
    { action: loc('Pedir una pista'), keyboard: 'H', gamepad: 'Y', touch: loc('Botón Pista') },
    { action: loc('Voltear la mesa, solo de broma'), keyboard: 'F', gamepad: 'LT', touch: loc('Botón Voltear la mesa') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Activar o silenciar sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('Son 40 cartas: as, 2, 3, 4, 5, 6, 7, sota (10), caballo (11) y rey (12), en cuatro palos. Los palos no cambian las capturas.'),
    loc('¿Quién reparte primero? Al abrir la mesa todos sacuden el cacho a la vez y lo tapan: el dado más alto reparte el primer reparto. Si hay empate arriba, solo los empatados sacuden otra vez. El anfitrión puede cambiarlo en Más ajustes.'),
    loc('Se dan tres cartas por persona y cuatro cartas distintas a la mesa. El siguiente al repartidor empieza. Cuando todos juegan sus tres cartas, se reparten tres más. El repartidor cambia después de agotar la baraja.'),
    loc('En cada reparto, quien reparte puede cortar la baraja una vez, boca abajo, y elige empezar por 1 o por 4: 1–2–3–4 o 4–3–2–1. Cada acierto suma el número cantado. Sin aciertos: mal echada, un punto para el siguiente jugador. Los números repetidos se devuelven al fondo antes de continuar.'),
    loc('Cantos clásicos de esta mesa: ronda (pareja), 1–4 según la carta; rondín (tres iguales), 5; patrulla, también llamada patria (tres consecutivas), 6; vigía (pareja y carta adyacente), 7; registro (as, caballo, rey), 8. Solo el canto de mayor valor, antes de jugar tu primera carta. Puedes jugar sin cantarlo.'),
    loc('Aquí no se juega flor, matar cantos ni victoria automática por rondín. Puedes desactivar todos los cantos al abrir la mesa.'),
    loc('La última persona que recoge se lleva las cartas sobrantes, sin puntos de mesa limpia. Al contar, suma cada carta por encima de 20 en uno contra uno o parejas, 13 con tres personas, 10 con cuatro individuales y 6 con seis individuales. Los equipos de tres usan la base de 20. Si varios llegan a 24 al contar, se resuelve desde quien es mano.'),
    loc('En parejas o equipos de tres, los compañeros ocupan puestos alternos y comparten puntos y cartas recogidas. Los puestos vacíos los juegan bots. Un pana nuevo toma un puesto de bot; los demás observan hasta que haya espacio.'),
  ],
};
