// Carreritas' Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Termina las vueltas antes que los demás carros y sube al podio.'),
  howTo: [
    loc('Mantén el botón de derrape y gira para tomar las curvas. Suelta al salir de la curva: el carro se estabiliza y las chispas dan turbo. Saltando con el derrape puedes hacer trucos en el aire.'),
    loc('Rompe cajas de madera para conseguir objetos: llevas hasta dos y lanzas el elegido hacia adelante o hacia atrás. Cada moneda da un poquito más de velocidad, y al final de la carrera se cambian por mangos para el taller.'),
    loc('Si te quedas atascado, pide rescate al zamuro: sales y vuelves como fantasma durante 3 segundos.'),
  ],
  sections: [{ title: loc('Manejar'), rows: [
    { action: loc('Acelerar'), keyboard: 'W / ↑', gamepad: 'RT / A', touch: loc('Botón Gas') },
    { action: loc('Frenar'), keyboard: 'S / ↓', gamepad: 'LT / B', touch: loc('Botón Freno') },
    { action: loc('Girar'), keyboard: 'A D / ← →', gamepad: 'Stick izq. / Cruceta', touch: loc('Flechas') },
    { action: loc('Saltar y derrapar · truco en el aire'), keyboard: 'Shift / K', gamepad: 'RB', touch: loc('Botón Derrape') },
    { action: loc('Mirar atrás'), keyboard: 'C', gamepad: 'View / L3' },
    { action: loc('Pedir rescate al zamuro'), keyboard: 'R', gamepad: 'Y' },
    { action: loc('Claxon'), keyboard: 'H' },
  ] }, { title: loc('Objetos'), rows: [
    { action: loc('Lanzar objeto adelante'), keyboard: loc('Espacio / E'), gamepad: 'LB', touch: loc('Botón Adelante') },
    { action: loc('Lanzar objeto atrás'), keyboard: loc('X / S + Espacio'), gamepad: 'X', touch: loc('Botón Atrás') },
    { action: loc('Elegir objeto'), keyboard: '1 / 2', touch: loc('Toca el objeto') },
    { action: loc('Cambiar objeto'), keyboard: 'Q', gamepad: 'Cruceta ↑', touch: loc('Botón ⇄') },
  ] }, { title: loc('Pantalla dividida: jugador 2'), rows: [
    { action: loc('Acelerar, frenar y girar'), keyboard: loc('Flechas') },
    { action: loc('Saltar y derrapar'), keyboard: loc('Shift der. / /') },
    { action: loc('Lanzar objeto adelante'), keyboard: 'Enter' },
    { action: loc('Lanzar objeto atrás'), keyboard: loc('Punto') },
    { action: loc('Cambiar objeto'), keyboard: loc('Coma') },
    { action: loc('Pedir rescate al zamuro'), keyboard: loc('Retroceso') },
    { action: loc('Mirar atrás'), keyboard: "'" },
  ] }, { title: loc('En el taller'), rows: [
    { action: loc('Cambiar entre carro, lancha y avioneta'), keyboard: 'Q / E' },
    { action: loc('Abrir el garaje'), keyboard: 'G' },
    { action: loc('Volver'), keyboard: 'Esc' },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Pausa'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Pausa') },
  ] }],
  tips: [
    loc('Al derrapar, la ayuda corrige si te acercas al borde; gira al otro lado para abrir la curva. No hace falta esperar a las chispas moradas para soltar.'),
    loc('Puedes acelerar antes del ¡YA!. Desde el final del "1" sales con arranque cohete; desde el "3" el motor se ahoga y sale flojito un momento.'),
    loc('En pantalla dividida, el jugador 1 maneja con W A S D y Shift izq., y cada mando conectado maneja un carro, en orden.'),
    loc('Los roces entre carros no te lanzan al aire.'),
    loc('Cada carro tiene su talento: lee su ficha y combina cauchos con derrapes, rebufo o piruetas.'),
    loc('Calidad Rápida reduce sombras, lluvia y detalles para equipos lentos. No cambia la física ni reduce el retraso de internet.'),
  ],
};
