// Parapente's Instrucciones page in the pause menu (engine/controls-page.js).
import { loc } from '/engine/i18n.js';

export default {
  goal: loc('Pasa las cinco balizas sobre Galipán y aterriza en la diana de Boca de Tigre con el mejor tiempo.'),
  howTo: [
    loc('Salta desde la cresta y pasa las balizas en orden: entra en el cilindro a cualquier altura. Si tocas el suelo antes de tiempo, te suben otra vez sobre la última baliza.'),
    loc('Las térmicas (polvo dorado y zamuros dando vueltas) te suben: gira cerrado con frenos dentro. Los aros dorados te empujan unos segundos.'),
    loc('Al final, baja con orejas o en espiral y aterriza en la diana. Cada metro fuera de la diana suma tiempo.'),
  ],
  sections: [{ title: loc('Volar'), rows: [
    { action: loc('Girar la vela'), keyboard: 'A D / ← →', gamepad: 'Stick izq.', touch: loc('Flechas') },
    { action: loc('Acelerador: más rápido, bajas más'), keyboard: 'W / ↑', gamepad: 'RT / A', touch: loc('Botón Acelerador') },
    { action: loc('Frenos: más lento y giro cerrado'), keyboard: 'S / ↓', gamepad: 'LT / B', touch: loc('Botón Frenos') },
    { action: loc('Orejas: bajar rápido'), keyboard: loc('Espacio'), gamepad: 'X / RB', touch: loc('Botón Orejas') },
  ] }, { title: loc('Siempre'), rows: [
    { action: loc('Activar o silenciar el sonido'), keyboard: 'M' },
    { action: loc('Abrir o cerrar el menú'), keyboard: 'Esc', gamepad: 'Start', touch: loc('Botón Menú') },
  ] }],
  tips: [
    loc('Con altura de sobra, el acelerador gana tiempo; sin altura, te deja en el suelo.'),
    loc('Si vas bajo para la próxima baliza, busca el polvo dorado de una térmica.'),
    loc('Frena justo antes de tocar el suelo.'),
    loc('El variómetro pita más rápido y más agudo cuanto más fuerte subes.'),
  ],
};
