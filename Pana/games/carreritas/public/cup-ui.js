import { cupDuration } from './cup-definitions.js';
import { standings } from './cup-rules.js';

export const CLASSIFICATION_TEXT = {
  finished: 'Terminó',
  dnf: 'Sin terminar',
  dns: 'No salió',
  retired: 'Retirado',
};

export function approximateCupText(cup) {
  const { minutes } = cupDuration(cup);
  return `Duración aproximada: ${minutes} min, incluyendo resultados y cargas normales.`;
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
  if (change > 0) return `Sube ${change}`;
  if (change < 0) return `Baja ${Math.abs(change)}`;
  return 'Mantiene';
}

export function tiebreakText(reason) {
  if (reason === 'wins') return 'Desempate: más victorias.';
  if (/^stage-[1-4]$/.test(reason ?? '')) return `Desempate: mejor clasificación en la carrera ${reason.slice(-1)}.`;
  if (reason === 'initial-grid') return 'Desempate: parrilla inicial.';
  return 'Desempate: puntos.';
}

export function nextStageText(cup, session, seconds = null, trackName = id => id) {
  if (session.status === 'complete') return 'Copa completada';
  const stage = cup.stages[session.stageIndex + 1];
  if (!stage) return '';
  const wait = seconds == null ? '' : ` · continúa en ${Math.max(0, Math.ceil(seconds))} s`;
  return `Siguiente: ${trackName(stage.track)} · ${stage.laps} ${stage.laps === 1 ? 'vuelta' : 'vueltas'}${wait}`;
}
