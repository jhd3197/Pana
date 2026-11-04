// Fosa's records on the shared board (engine/records.js): most jornadas in one
// expedition and most comebacks ("remontadas"), defined in rules.js tallyRound.
import { createRecordBoard } from '/engine/records.js';
import { renderRecord, recordLine } from '/engine/record-widget.js';
import { loc } from '/engine/i18n.js';
import { recordRows } from './rules.js';

export function createFosaRecord({ lobby, end, line }) {
  const board = createRecordBoard({ game: 'reliquia', metrics: [{ id: 'rounds', label: loc('Jornadas') }, { id: 'comebacks', label: loc('Remontadas') }] });
  let run = null;
  const refreshLine = () => { line.textContent = recordLine(board); line.parentElement.hidden = !line.textContent; };
  const myName = (state, id) => state.players.find(p => p.id === id)?.name ?? '';
  // True when this report took a record from someone (a first mark stays quiet in play).
  function report(state, id) {
    run ??= board.startRun();
    const broke = run.report(recordRows(state, id));
    refreshLine();
    return broke.some(b => b.previous);
  }
  refreshLine();
  return {
    board, report,
    begin() { run = board.startRun(); refreshLine(); },
    finish(state, id) { report(state, id); const me = myName(state, id); renderRecord(end, board, { me, standings: run.summary(me) }); },
    showLobby(me) { renderRecord(lobby, board, { me, compact: true }); },
  };
}
