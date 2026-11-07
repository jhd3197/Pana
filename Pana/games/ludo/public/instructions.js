// Ludo's Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Cada pana tiene cuatro fichas. Gana quien lleva las cuatro hasta el centro.'),
  howTo: [
    loc('Agita el dado manteniendo el botón o Espacio y suéltalo, o lánzalo arrastrando sobre la mesa. Cuanto más lo agitas, más fuerte vuela; la fuerza no cambia el número.'),
    loc('Las casillas con doble borde y un círculo son seguras: aquí no se come. En las demás, caer sobre fichas rivales las devuelve a su patio. La sala puede dar otra tirada al capturar.'),
    loc('Las fichas pueden compartir casilla y no forman barreras. El pasillo de tu color es privado. Debes sacar el número exacto para llegar a casa.'),
  ],
  sections: [{ title: loc('En tu turno'), rows: [
    { action: loc('Agitar el dado; suelta para tirar'), keyboard: loc('Mantén Espacio'), gamepad: 'X / RT', touch: loc('Mantén el botón del dado') },
    { action: loc('Lanzar el dado con más fuerza'), keyboard: loc('Arrastra y suelta en la mesa'), touch: loc('Arrastra y suelta en la mesa') },
    { action: loc('Mover una ficha disponible'), keyboard: loc('1 a 4 / Clic'), gamepad: 'Cruceta + A', touch: loc('Toca la ficha o su botón') },
    { action: loc('Voltear la mesa, solo de broma'), keyboard: 'F', gamepad: 'LT', touch: loc('Botón Voltear la mesa') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Ver el progreso de los panas'), keyboard: loc('Mantén Shift'), touch: loc('Botón Ver panas') },
    { action: loc('Cambiar a la vista desde arriba'), keyboard: 'V', touch: loc('Botón Vista desde arriba') },
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('¿Quién empieza? Todos sacuden el cacho a la vez y lo tapan: sale primero el dado más alto. Si hay empate arriba, solo los empatados sacuden otra vez. El anfitrión puede cambiarlo en Más ajustes.'),
    loc('El anfitrión elige si sales con seis o con uno y seis. Al salir, la ficha queda en la casilla de salida.'),
    loc('Salida asistida: si todas tus fichas pendientes están en el patio, tras un límite aleatorio de tres a cinco intentos fallidos sale un seis. Se aplica a todos; la sala puede elegir azar clásico.'),
    loc('Un único movimiento legal se hace solo al caer el dado. Si solo puedes sacar fichas del patio, sale la primera automáticamente.'),
    loc('Un seis permite volver a tirar. Si la sala activa la regla, el tercer seis seguido pierde ese lanzamiento y termina el turno; los movimientos anteriores se conservan.'),
    loc('Si no tienes movimiento, el turno pasa automáticamente. Los puestos vacíos juegan con bots; un pana que llega hereda las fichas de un bot.'),
  ],
};
