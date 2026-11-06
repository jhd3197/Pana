// Fosa's records on the shared board (engine/records.js): most jornadas in one
// expedition and most comebacks ("remontadas"), defined in rules.js tallyRound.
// Beside them, how often each pana has earned each end-of-dive title.
import { createRecordBoard, createTitleTally } from '/engine/records.js';
import { renderRecord, renderTitleTally, recordLine } from '/engine/record-widget.js';
import { loc } from '/engine/i18n.js';
import { recordRows, titleEntries, titleName } from './rules.js';
import { receiptFor } from './progress.js';

export function createFosaRecord({ lobby, end, line, lobbyTitles, endTitles }) {
  const board = createRecordBoard({ game: 'reliquia', metrics: [{ id: 'rounds', label: loc('Jornadas') }, { id: 'comebacks', label: loc('Remontadas') }] });
  const tally = createTitleTally({ game: 'reliquia' });
  const label = id => { const name = titleName(id); return name ? loc(name) : ''; };
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
    board, tally, report,
    begin() { run = board.startRun(); refreshLine(); },
    finish(state, id) {
      report(state, id);
      const me = myName(state, id), squad = state.players.filter(p => !p.spectator).map(p => p.name);
      renderRecord(end, board, { me, standings: run.summary(me) });
      // Only someone who dived keeps the count; a watcher's browser just reads it.
      if (squad.includes(me)) tally.add(receiptFor(state), titleEntries(state));
      renderTitleTally(endTitles, tally, { names: me ? [me, ...squad] : squad, me, label });
    },
    showLobby(me) { renderRecord(lobby, board, { me, compact: true }); renderTitleTally(lobbyTitles, tally, { names: [me], me, label }); },
  };
}
