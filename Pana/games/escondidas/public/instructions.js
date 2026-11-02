// Escondidas' Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Escondido: conviértete en un objeto y aguanta hasta que se acabe el tiempo. Buscador: encuentra a todos los panas antes de que suene el final.'),
  howTo: [
    loc('Cada ronda un pana busca y los demás se esconden. Los escondidos tienen tres cambios para copiar un barril, una caja, una cava, una mata o un banco de la plaza.'),
    loc('El buscador apunta al objeto sospechoso y lo revisa. Si es un pana, lo pilló; si falla, espera un momento antes de volver a revisar.'),
    loc('Cada captura suma 1 punto y sobrevivir a la ronda suma 3. El buscador cambia en cada ronda.'),
  ],
  sections: [{ title: loc('Moverte'), rows: [
    { action: loc('Caminar hacia donde miras'), keyboard: 'W A S D / Flechas', gamepad: 'Stick izq.', touch: loc('Flechas en pantalla') },
    { action: loc('Correr'), keyboard: 'Shift', gamepad: 'LB / L3' },
    { action: loc('Mirar'), keyboard: loc('Ratón'), gamepad: 'Stick der.', touch: loc('Arrastra la pantalla') },
    { action: loc('Capturar el ratón para mirar'), keyboard: loc('Clic') },
    { action: loc('Cambiar entre primera persona y la cámara detrás de tu pana'), keyboard: 'V', gamepad: 'Y' },
  ] }, { title: loc('Escondido'), rows: [
    { action: loc('Copiar el objeto cercano'), keyboard: 'E', gamepad: 'A / RT', touch: loc('Botón Copiar') },
    { action: loc('Transformarte en un objeto de la lista'), keyboard: '1 a 5', touch: loc('Toca el objeto') },
    { action: loc('Volver a pana'), keyboard: 'Q', gamepad: 'B', touch: loc('Botón Volver a pana') },
  ] }, { title: loc('Buscador'), rows: [
    { action: loc('Revisar lo que tienes en la mira'), keyboard: loc('Clic / E'), gamepad: 'A / RT', touch: loc('Botón Revisar') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Ver la tabla (mantén)'), keyboard: 'Tab', gamepad: 'View' },
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Soltar el ratón y abrir el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('Buscador: apunta al objeto sospechoso y haz clic. Si es un pana, lo pillaste a la primera. Si fallas, esperas 1,6 segundos.'),
    loc('Escondido: pulsa V para ver tu disfraz desde atrás y comprobar que pasas desapercibido.'),
    loc('Quédate quieto y disfrazado: si el buscador te ve moverte, la barra de sospecha sube.'),
  ],
};
