// Capis a Pintazos' Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Deja a los tres capis rivales fuera: píntalos enteros o túmbalos al río antes que ellos a los tuyos.'),
  howTo: [
    loc('Por turnos, mueve a tu capi, apunta y carga el tiro: mientras más lo mantienes, más lejos llega. Al soltar, sale la pintura.'),
    loc('Un capi con 100 % de pintura o que cae al río queda fuera. Después de disparar tienes 3 segundos para cubrirte.'),
  ],
  sections: [{ title: loc('En tu turno'), rows: [
    { action: loc('Caminar'), keyboard: `A D / ${loc('Flechas')}`, gamepad: 'Stick izq. / Cruceta', touch: loc('Flechas izquierda y derecha') },
    { action: loc('Apuntar'), keyboard: `W S / ${loc('Ratón')}`, gamepad: 'Stick izq. / Cruceta', touch: loc('Botones arriba y abajo') },
    { action: loc('Mantén para cargar, suelta para disparar'), keyboard: `${loc('Espacio')} / ${loc('Clic')}`, gamepad: 'A', touch: loc('Botón ¡Pinta!') },
    { action: loc('Saltar'), keyboard: 'Enter / J', gamepad: 'B', touch: loc('Botón Saltar') },
    { action: loc('Elegir un arma'), keyboard: `${loc('1 a 5')} / ${loc('Clic en el arma')}`, touch: loc('Toca el arma') },
    { action: loc('Arma anterior o siguiente'), keyboard: 'Q / E / Tab' },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Ver todo el mapa'), keyboard: 'Z', gamepad: 'Y', touch: loc('Botón Mapa') },
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('El viento empuja la pintura: mira la flecha antes de disparar.'),
    loc('La tierra pintada resbala: los capis se deslizan cuesta abajo.'),
    loc('La Bazuca, La Lejana, La Licuadora y El Trueno tienen pocos tiros por equipo; La Piñita nunca se acaba.'),
    loc('Cada partida trae un mapa nuevo. En la sala, escribe su número para repetir uno.'),
    loc('Con amigos, los panas de un equipo se turnan. Un equipo sin panas lo juega la máquina.'),
  ],
};
