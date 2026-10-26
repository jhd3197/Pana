import { cupDuration } from './cup-definitions.js';
import { standings } from './cup-rules.js';
import { loc, locn } from '/engine/i18n.js';

export const CLASSIFICATION_TEXT = {
  finished: loc('Terminó'),
  dnf: loc('Sin terminar'),
  dns: loc('No salió'),
  retired: loc('Retirado'),
};

export function approximateCupText(cup) {
  const { minutes } = cupDuration(cup);
  return loc('Duración aproximada: {minutes} min, incluyendo resultados y cargas normales.', { minutes });
}

export function cupStandingsView(session, stageIndex = session.stageIndex) {
  const current = standings(session);
  const previous = standings({ ...session, ledger: session.ledger.filter(record => record.stage < stageIndex) });
  const previousPlaces = new Map(previous.map((row, index) => [row.id, index]));
  return current.map((row, index) => {
    const record = row.records.find(item => item.stage === stageIndex);
    const previousPlace = previousPlaces.get(row.id);
    return {
      ...row,
      racePoints: record?.points ?? 0,
      classification: record?.classification ?? null,
      rankChange: previousPlace == null ? 0 : previousPlace - index,
    };
  });
}

export function rankChangeText(change) {
  if (change > 0) return loc('Sube {n}', { n: change });
  if (change < 0) return loc('Baja {n}', { n: Math.abs(change) });
  return loc('Mantiene');
}

export function tiebreakText(reason) {
  if (reason === 'wins') return loc('Desempate: más victorias.');
  if (/^stage-[1-4]$/.test(reason ?? '')) return loc('Desempate: mejor clasificación en la carrera {n}.', { n: reason.slice(-1) });
  if (reason === 'initial-grid') return loc('Desempate: parrilla inicial.');
  return loc('Desempate: puntos.');
}

export function nextStageText(cup, session, seconds = null, trackName = id => id) {
  if (session.status === 'complete') return loc('Copa completada');
  const stage = cup.stages[session.stageIndex + 1];
  if (!stage) return '';
  const wait = seconds == null ? '' : ' · ' + loc('continúa en {s} s', { s: Math.max(0, Math.ceil(seconds)) });
  return loc('Siguiente: {track}', { track: trackName(stage.track) }) + ' · ' + locn(stage.laps, '{n} vuelta', '{n} vueltas') + wait;
}
