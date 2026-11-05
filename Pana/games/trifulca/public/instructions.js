// Trifulca's Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Tumba a tu rival tres veces, o gánale por puntos o con el público, y termina la noche con más dolitas que nadie.'),
  howTo: [
    loc('Un toque justo después de pegar encadena el golpe. Machacar no.'),
    loc('Los golpes vacían tu barra. Sin barra, mareado: un golpe limpio te tumba. Tres caídas es K.O.'),
    loc('Jab le gana al trompón que todavía carga; cubrirse le gana al jab; esquivar le gana al trompón; agarrar le gana a cubrirse.'),
    loc('Si no estás peleando eres el ring: empuja al que se sale pa\' dentro y gana dolitas. Antes de la campana puedes apostar.'),
  ],
  sections: [{ title: loc('Pelear'), rows: [
    { action: loc('Moverse: tú siempre a la izquierda, derecha es hacia tu rival'), keyboard: 'W A S D / ' + loc('Flechas'), gamepad: 'Stick izq. / Cruceta', touch: loc('Cruceta') },
    { action: loc('Golpe: toque = jab, mantener = trompón'), keyboard: loc('J / Z / Clic'), gamepad: 'A', touch: loc('Botón Golpe') },
    { action: loc('Cubrirse'), keyboard: loc('K / X / Clic derecho'), gamepad: 'LB', touch: loc('Botón Cubrir') },
    { action: loc('Esquivar (con dirección: paso al lado)'), keyboard: loc('Espacio') + ' / C', gamepad: 'B', touch: loc('Botón Esquivar') },
    { action: loc('Agarrar y empujar'), keyboard: 'L / V', gamepad: 'X', touch: loc('Botón Agarrar') },
    { action: loc('Patada (gasta aguante; manos libres)'), keyboard: 'I', gamepad: 'RT', touch: loc('Botón Patada') },
    { action: loc('Barrida (gasta aguante; manos libres)'), keyboard: 'U', gamepad: 'LT', touch: loc('Botón Barrida') },
    { action: loc('Volteo (gasta aguante; manos libres)'), keyboard: 'O', gamepad: 'RB', touch: loc('Botón Volteo') },
    { action: loc('¡Dale! (el público se prende, quedas abierto)'), keyboard: 'T', gamepad: 'Y', touch: loc('Botón ¡Dale!') },
    { action: loc('Pararte después de una caída: machaca el golpe'), keyboard: 'J', gamepad: 'A', touch: loc('Botón Golpe') },
  ] }, { title: loc('Según el modo'), rows: [
    { action: loc('Trifulca libre: agarrar una silla o caja cercana y lanzarla'), keyboard: 'L', gamepad: 'X', touch: loc('Botón Agarrar') },
    { action: loc('Parejas: darle el relevo a tu pareja cuando estás junto a ella'), keyboard: 'L', gamepad: 'X', touch: loc('Botón Agarrar') },
  ] }, { title: loc('Fuera de la pelea'), rows: [
    { action: loc('Apostar al rojo o al azul antes de la campana'), keyboard: '1 – 4', touch: loc('Toca tu apuesta') },
    { action: loc('En el público: empujar pa\' dentro al que se sale'), keyboard: 'J', gamepad: 'A', touch: loc('Botón Golpe') },
    { action: loc('En el público: ¡cálmate! al que tiene el mareo alto'), keyboard: 'L', gamepad: 'X', touch: loc('Botón Agarrar') },
    { action: loc('En el público: ¡dale!'), keyboard: 'T', gamepad: 'Y', touch: loc('Botón ¡Dale!') },
    { action: loc('Al final: mano de caballero'), keyboard: 'L', gamepad: 'X', touch: loc('Botón Agarrar') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('Ganador se queda: el que gana sigue, el que pierde va a la cola.'),
    loc('Después de un trompón fallado quedas abierto: el rival puede contragolpear.'),
    loc('El tutorial del lobby enseña cada golpe paso a paso.'),
  ],
};
