import { loc } from '/engine/i18n.js';

export function confirmRaceExit(net) {
  if (!net?.cup || ['complete', 'abandoned'].includes(net.cup.status)) return true;
  return confirm(loc('¿Salir de la copa? No podrás volver a esta copa.'));
}
