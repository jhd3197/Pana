// Bululú's Instrucciones page in the pause menu (engine/controls-page.js):
// the board, then one section per minigame with its keys, and each
// minigame's rules among the tips.
import { loc } from '/engine/i18n.js';

const mini = (title, text) => `${title} ${text}`;
const move1d = { gamepad: 'Stick izq. / Cruceta', touch: loc('Botones ← →') };
const action1d = { keyboard: loc('Espacio'), gamepad: 'A', touch: loc('Botón Saltar') };
const move2d = { keyboard: loc('W A S D / Flechas'), gamepad: 'Stick izq. / Cruceta', touch: loc('Cruceta en pantalla') };
const action2d = { keyboard: loc('Espacio'), gamepad: 'A', touch: loc('Botón de acción') };

export default {
  goal: loc('Junta 20 monedas y cómprale un Mango de oro al puesto del árbol. Gana el pana con más mangos de oro.'),
  howTo: [
    loc('Tira los dados y avanza. La casilla azul te da 3 monedas, la roja te quita 3 y la amarilla trae un evento loco.'),
    loc('Después de cada ronda hay un minijuego: el ganador se lleva 10 monedas. Al final, si hay empate en mangos, ganan las monedas.'),
  ],
  sections: [{ title: loc('En el tablero'), rows: [
    { action: loc('Agitar los dados; suelta para tirar'), keyboard: loc('Mantén Espacio / Enter'), gamepad: 'A', touch: loc('Mantén el botón') },
    { action: loc('Lanzar los dados con más fuerza'), keyboard: loc('Arrastra y suelta en la isla'), touch: loc('Arrastra y suelta en la isla') },
    { action: loc('Elegir el camino en el cruce'), keyboard: '1 / 2', touch: loc('Toca el camino') },
    { action: loc('Comprar el Mango de oro o dejarlo'), keyboard: 'S / N', touch: loc('Toca tu respuesta') },
    { action: loc('Decir ¡Listo! antes del minijuego'), keyboard: loc('Espacio / Enter'), gamepad: 'A', touch: loc('Botón ¡Listo!') },
    { action: loc('Ver el tablero o volver'), keyboard: 'Tab', gamepad: 'View', touch: loc('Botón Ver tablero') },
    { action: loc('Mirar el tablero: girar y acercar'), keyboard: loc('Arrastra / Rueda'), touch: loc('Arrastra y pellizca') },
    { action: loc('Mirar otro punto de la isla'), keyboard: loc('Clic en el mapa'), touch: loc('Toca el mapa') },
    { action: loc('Cambiar la luz'), keyboard: 'L', touch: loc('Botones Día, Noche y Ciclo') },
  ] }, { title: loc('¡Atrapa los mangos!'), rows: [
    { action: loc('Moverte'), keyboard: 'A D / ← →', ...move1d },
  ] }, { title: loc('¡No te caigas!'), rows: [
    { action: loc('Saltar'), keyboard: loc('Espacio / W'), gamepad: 'A', touch: loc('Botón Saltar') },
  ] }, { title: loc('¡Caída!'), rows: [
    { action: loc('¡Dale!'), ...action1d },
  ] }, { title: loc('¡Un, dos, tres, momia!'), rows: [
    { action: loc('Correr'), keyboard: 'D / →', gamepad: 'Stick izq. / Cruceta', touch: loc('Botón →') },
    { action: loc('Disfrazarte'), ...action1d },
  ] }, { title: loc('¡Coleo!'), rows: [
    { action: loc('Moverte'), keyboard: 'A D / ← →', ...move1d },
    { action: loc('Jalar la cola'), ...action1d },
  ] }, { title: loc('¡Choque de carritos!'), rows: [
    { action: loc('Manejar'), ...move2d },
    { action: loc('Turbo'), ...action2d },
  ] }, { title: loc('¡Embuste!'), rows: [
    { action: loc('Girar el malacate y votar'), ...action1d },
    { action: loc('Elegir a quién votas'), keyboard: 'A D / ← →', ...move1d },
  ] }, { title: loc('¡Remada!'), rows: [
    { action: loc('Remar alternando'), keyboard: 'A D / ← →', ...move1d },
  ] }, { title: loc('¡Raudal!'), rows: [
    { action: loc('Cambiar de carril'), keyboard: 'A D / ← →', ...move1d },
    { action: loc('Saltar el raudal'), ...action1d },
  ] }, { title: loc('¡Remolino!'), rows: [
    { action: loc('Remar alternando'), keyboard: 'A D / ← →', ...move1d },
    { action: loc('¡Salpicón! Empuja al de al lado'), ...action1d },
  ] }, { title: loc('¡Chinazo!'), rows: [
    { action: loc('Apuntar'), keyboard: loc('Ratón / W A S D'), gamepad: 'Stick der. / Stick izq.', touch: loc('Arrastra el dedo') },
    { action: loc('Estirar la china; suelta para tirar'), keyboard: loc('Clic / Espacio'), gamepad: 'RT / A', touch: loc('Levanta el dedo para tirar') },
  ] }, { title: loc('¡Bolas Criollas!'), rows: [
    { action: loc('Apuntar'), keyboard: 'A D / ← →', gamepad: 'Stick izq. / Cruceta', touch: loc('Cruceta en pantalla') },
    { action: loc('Mantén para la fuerza; suelta para lanzar'), keyboard: loc('Mantén Espacio'), gamepad: 'A', touch: loc('Mantén el botón de acción') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Sonido'), keyboard: 'M' },
    { action: loc('Pausa'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    mini(loc('¡Atrapa los mangos!'), loc('Muévete y atrapa los mangos con tu cesta. Los de oro valen 3. ¡Ojo con los cocos!')),
    mini(loc('¡No te caigas!'), loc('Salta el tronco cuando pase por debajo. Se pone cada vez más rápido… ¡y a veces cambia de dirección!')),
    mini(loc('¡Caída!'), loc('Cuando la carta nueva tenga el mismo número que la de antes, ¡dale primero! Si le das sin caída, pierdes un punto.')),
    mini(loc('¡Un, dos, tres, momia!'), loc('Corre hacia la reliquia mientras la momia cuenta. Cuando se voltee, ¡quieto! Si te ve moviéndote, vuelves al inicio. Disfrazado de barril puedes avanzar despacito (tres veces).')),
    mini(loc('¡Coleo!'), loc('Ponte justo detrás del toro y jálale la cola para tumbarlo. Cada toro tumbado es un punto. Si jalas al aire, tu caballo tropieza.')),
    mini(loc('¡Choque de carritos!'), loc('Empuja a los demás carritos al agua. Cada uno que tumbes es un punto. Al final, el borde de la tarima se cae… ¡quédate en el centro!')),
    mini(loc('¡Embuste!'), loc('Uno de los panas es una momia que finge trabajar. Gira tu malacate con Espacio y mira bien: la momia suelta arena. Al final, elige con ← → y vota con Espacio. Si te toca ser la momia, gira sin apuro: así casi no suelta arena. Pero si no giras, se nota.')),
    mini(loc('¡Remada!'), loc('Rema alternando A y D para llegar primero a la meta, a 120 metros. Con ritmo vas más rápido que machacando: rema cuando el canalete termina su jalón.')),
    mini(loc('¡Raudal!'), loc('La corriente te lleva. Cambia de carril con A y D para esquivar las piedras y agarrar mangos. Antes de cada salto, Espacio: ¡salta el raudal!')),
    mini(loc('¡Remolino!'), loc('Un remolino crece en la laguna y te jala. Rema alternando A y D para alejarte del centro y empuja a los demás con Espacio. ¡Gana el último que quede fuera!')),
    mini(loc('¡Chinazo!'), loc('Las iguanas se están comiendo los mangos. Apunta, estira la china y suéltala: la piedra tarda un poquito, así que apunta adelante de las que corren. Cada iguana vale 1 y la dorada vale 3. ¡Ojo con la guacamaya: te quita 2!')),
    mini(loc('¡Bolas Criollas!'), loc('Tienes dos bolas. Arrima al mingo dorado: gana quien quede más cerca. La línea muestra dónde frenaría tu bola sin choques. Si el mingo sale, nadie gana.')),
  ],
};
