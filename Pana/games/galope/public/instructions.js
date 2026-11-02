// Galope's Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Completa las vueltas por los Llanos antes que los demás jinetes.'),
  howTo: [
    loc('Galopa siguiendo las estacas y salta cada tronco del camino: si lo tropiezas, tu caballo casi se para.'),
    loc('El remate te da más velocidad pero gasta fuerza. Si la agotas, tu caballo se cansa y tienes que aflojar hasta que se recupere. En el estero el agua frena, pero ahí recuperas fuerzas.'),
  ],
  sections: [{ title: loc('Cabalgar'), rows: [
    { action: loc('Avanzar'), keyboard: 'W / ↑', gamepad: 'RT / Stick izq.', touch: loc('Botón ¡Arre!') },
    { action: loc('Girar'), keyboard: 'A D / ← →', gamepad: 'Stick izq.', touch: loc('Flechas') },
    { action: loc('Frenar'), keyboard: 'S / ↓', gamepad: 'LT', touch: loc('Botón Freno') },
    { action: loc('Remate: gasta fuerza'), keyboard: 'Shift', gamepad: 'RB / L3', touch: loc('Botón Remate') },
    { action: loc('Saltar troncos'), keyboard: loc('Espacio'), gamepad: 'A', touch: loc('Botón Saltar') },
    { action: loc('Volver al camino'), keyboard: 'R', gamepad: 'Y' },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('Cuando aparece ¡Tronco!, salta un poco antes de llegar.'),
    loc('Guarda las últimas fuerzas para el remate final.'),
    loc('Con Rebufo activado, correr justo detrás de otro jinete te da más velocidad.'),
    loc('Fuera del camino vas más lento, salvo que el anfitrión active los atajos.'),
  ],
};
