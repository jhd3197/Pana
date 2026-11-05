// The shared look of engine/logbook.js: a chip with the completion and the newest
// entry beside it, and a queue so discoveries made together each get their toast.
// Titles are translated here, so a game marks them with locKey().
//
//   const line = createLogbookChip(logbook, { text: pct => loc('Cuaderno {pct} %', { pct }) });
//   $('results-card').append(line.el);                // follows the logbook by itself
//   const say = createDiscoveryQueue(notify);         // createToast or createFeats text
//   say(loc('Cuaderno: {entry}', { entry: loc(found.entry.title) }));
import { loc } from './i18n.js';

export function createLogbookChip(logbook, { text = pct => `${pct} %` } = {}) {
  const el = Object.assign(document.createElement('div'), { className: 'pk-logbook' });
  const chip = Object.assign(document.createElement('span'), { className: 'pk-chip pk-chip--teal' });
  const newest = Object.assign(document.createElement('span'), { className: 'pk-copy' });
  el.append(chip, newest);
  function update() {
    const entry = logbook.newest();
    chip.textContent = text(logbook.percent());
    newest.textContent = newest.title = entry ? loc(entry.title) : '';
  }
  const off = logbook.onChange(update);
  update();
  return { el, update, dispose() { off(); el.remove(); } };
}

// Shows one line, then the next once `gap` ms have passed. Pure timers, no DOM.
export function createDiscoveryQueue(show, { gap = 3600, timers = globalThis } = {}) {
  const waiting = []; let timer = 0;
  function next() {
    timer = 0;
    const text = waiting.shift();
    if (text === undefined) return;
    show(text);
    timer = timers.setTimeout(next, gap);
  }
  const say = text => { waiting.push(text); if (!timer) next(); };
  say.dispose = () => { timers.clearTimeout(timer); timer = 0; waiting.length = 0; };
  return say;
}
