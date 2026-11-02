// Billar's Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Mete todas las bolas de tu grupo y después la ocho (o la nueve en Bola 9) antes que el otro equipo.'),
  howTo: [
    loc('Apunta tocando la mesa o con las flechas. Mantén Tirar: la fuerza sube y baja; suelta para tirar. Rojo es más fuerte.'),
    loc('Toca primero una bola de tu grupo. Después del contacto, mete una bola o haz que cualquiera llegue a una banda. Si metes una de las tuyas sin falta, sigues tirando.'),
    loc('Las faltas dan bola en mano: coloca la blanca donde quieras y después apunta y tira.'),
  ],
  sections: [{ title: loc('Apuntar y tirar'), rows: [
    { action: loc('Apuntar en la mesa'), keyboard: loc('Ratón'), gamepad: 'Stick der. + RT', touch: loc('Toca la mesa') },
    { action: loc('Girar el taco desde detrás de la bola'), keyboard: loc('Arrastra'), touch: loc('Arrastra a los lados') },
    { action: loc('Afinar la dirección del taco'), keyboard: '← →', gamepad: 'Stick izq. / Cruceta', touch: loc('Flechas en pantalla') },
    { action: loc('Afinar más fino'), keyboard: 'Shift + ← →', gamepad: 'LB' },
    { action: loc('Cargar la fuerza: mantén y suelta para tirar'), keyboard: loc('Espacio / Enter'), gamepad: 'A', touch: loc('Mantén Tirar') },
    { action: loc('Darle efecto a la blanca'), keyboard: loc('Clic en el panel Efecto'), touch: loc('Toca el panel Efecto') },
  ] }, { title: loc('Bola en mano'), rows: [
    { action: loc('Mover la blanca'), keyboard: loc('Flechas / Clic'), gamepad: 'Stick izq. / Cruceta', touch: loc('Toca la mesa') },
    { action: loc('Confirmar la posición'), keyboard: 'Enter', gamepad: 'X', touch: loc('Botón Colocar') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Cambiar la cámara'), keyboard: 'C', gamepad: 'Y', touch: loc('Botón Cámara') },
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('¿Quién rompe? Al empezar la partida todos sacuden el cacho a la vez y lo tapan: rompe el dado más alto; si empatan arriba, solo ellos sacuden otra vez. El anfitrión puede cambiarlo en Más ajustes.'),
    loc('Elige Individual para jugar uno contra uno, o Por equipos para dos grupos de uno, dos o tres panas. Los compañeros rotan después de cada tiro, incluso cuando el equipo sigue jugando. El anfitrión organiza los puestos antes de empezar.'),
    loc('Bola 8: la primera bola legal asigna lisas o rayadas. Vacía tu grupo antes de la ocho; meterla antes de tiempo o con falta pierde la mesa. En el saque, la ocho se repone.'),
    loc('Bola 9: toca primero la bola de menor número. Una combinación legal que meta la nueve gana la mesa. Si entra con falta, la nueve vuelve a la mesa.'),
    loc('Con Cocina, la bola en mano se coloca dentro de la zona amarilla y la blanca cruza su borde antes del primer contacto.'),
    loc('Si activas Cantar tronera, elige el número que ves junto al agujero. Solo conserva turno una bola que entre en esa tronera; la ocho en otra tronera pierde la mesa.'),
    loc('En práctica juegas todas las bolas y dejas la ocho para el final. Las faltas te dejan colocar la blanca y seguir.'),
    loc('La dificultad cambia la guía: en Fácil ves adónde van las dos bolas y los rebotes; en Experto solo la dirección del taco. Pana Bot también afina la puntería.'),
    loc('Efecto: arriba la blanca sigue después del choque, abajo regresa y a los lados cambia el rebote en las bandas.'),
    loc('Si alguien sale, su puesto queda libre para otro pana. La mesa conserva las bolas y el turno. El anfitrión empieza la revancha, o desde el menú vuelve a la sala si nadie llega.'),
  ],
};
