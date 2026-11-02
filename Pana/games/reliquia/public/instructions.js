// Reliquia's Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Saquen tesoros de la mina en equipo y suban con el montacargas antes de que la codicia los entierre.'),
  howTo: [
    loc('Cada jornada pide una cuota: llenen el carrito, empújenlo a la plataforma de carga y apriétenle el botón amarillo. Cuando la carga subida alcance la cuota, el montacargas los sube y la jornada termina.'),
    loc('Apunta con el punto del centro a lo que quieres usar: palancas, carrito, tesoros, la tienda. Cada mano lleva un tesoro, una herramienta o un puñado de cuatro piezas.'),
    loc('Al final de cada piso se abre la bajada. ¿Se van con lo que tienen o bajan un piso más?'),
  ],
  sections: [{ title: loc('Moverte'), rows: [
    { action: loc('Caminar hacia donde miras'), keyboard: 'W A S D', gamepad: 'Stick izq.', touch: loc('Cruceta') },
    { action: loc('Mirar (haz clic en la pantalla para capturar el ratón)'), keyboard: loc('Ratón'), gamepad: 'Stick der.', touch: loc('Arrastra el dedo') },
    { action: loc('Saltar'), keyboard: loc('Espacio'), gamepad: 'A', touch: loc('Botón Saltar') },
    { action: loc('Correr'), keyboard: 'Shift', gamepad: 'LB / L3' },
  ] }, { title: loc('Tus manos'), rows: [
    { action: loc('Usar lo de la mano derecha'), keyboard: loc('Clic / V'), gamepad: 'RT', touch: loc('Botón Usar') },
    { action: loc('Usar lo de la mano izquierda'), keyboard: loc('Clic derecho / F'), gamepad: 'LT', touch: loc('Botón Izq.') },
    { action: loc('Agarrar, abrir; mantén para girar ruedas, levantar panas o atrapar lo que te lanzan'), keyboard: 'E', gamepad: 'X', touch: loc('Botón Agarrar') },
    { action: loc('Soltar'), keyboard: 'Q', gamepad: 'B', touch: loc('Botón Soltar') },
    { action: loc('Lanzar lo que tienes en la mano'), keyboard: 'G', gamepad: 'Y', touch: loc('Botón Lanzar') },
    { action: loc('Arrastrar a un pana caído'), keyboard: 'R', gamepad: 'RB' },
  ] }, { title: loc('El equipo'), rows: [
    { action: loc('¿Nos vamos ya? · ¡Una sala más! · y otros gritos'), keyboard: '1 – 7', touch: loc('Botón Grito') },
    { action: loc('Ver al equipo'), keyboard: 'Tab', gamepad: 'View' },
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Soltar el ratón y abrir el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('El que se quede abajo cuando el montacargas suba vuelve al campamento con un hilito de vida.'),
    loc('Cada mano lleva un tesoro, una herramienta o un puñado de cuatro piezas: échalas al carrito (E) o lánzalas adentro (G).'),
    loc('Solo puedes llevar un arma a la vez: al agarrar otra, sueltas la que tenías.'),
    loc('Los tesoros grandes piden dos, tres o cuatro panas: cada uno agarra un lado (E) y caminan juntos. Solo se arrastran despacito.'),
    loc('El farol congela a las momias que alumbra. En la oscuridad corren más.'),
    loc('Cada tesoro que levantan sube la codicia: más trampas, momias bravas, túneles que se derrumban y un jaguar negro que los caza.'),
    loc('Si caen todos, del camión solo se salva una parte.'),
  ],
};
