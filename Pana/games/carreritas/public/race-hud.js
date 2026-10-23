// The live parts of the race HUD that are more than text: the standings that
// slide in only when the player's place changes, the speed needle with its
// peak mark, and the key reminders that show for the first seconds only.
// game.js loads it with the first race (lazyRace) and calls update() once per
// drawn frame.
const SHOW_S = 3;        // standings stay up this long after a place change
const HINT_S = 6;        // key reminders fade out this far into the race
const WINDOW = 5;        // up to this many racers the whole field is listed
const ARC = 209.4;       // length of the gauge arc (r 50, 240°), in SVG units
const PEAK_HOLD = 1.5, PEAK_FALL = 0.25;   // the peak mark waits, then sinks

const esc = (text) => String(text).replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);

export function createRaceHud(doc = document) {
  const $ = (id) => doc.getElementById(id);
  const root = $('race'), board = $('board'), pos = $('pos');
  const fill = $('gauge-fill'), needle = $('gauge-needle'), peakMark = $('gauge-peak');
  const rows = new Map();
  let shownPlace = -1, showT = 0, peak = 0, peakT = 0, shownRatio = -1, shownPeak = -1;

  function rowFor(c) {
    let li = rows.get(c);
    if (!li) {
      li = doc.createElement('li');
      li.innerHTML = `<b></b><i></i><span>${esc(c.name)}</span><em class="delta"></em>`;
      li.style.setProperty('--c', c.def.color);
      board.append(li);
      rows.set(c, li);
    }
    return li;
  }

  // Lay the rows out around the player: the whole field when it is small,
  // otherwise the player and the cars right ahead and behind.
  function layout(order, player) {
    const place = order.indexOf(player);
    const from = order.length <= WINDOW ? 0 : Math.max(0, Math.min(place - 1, order.length - 3));
    const to = order.length <= WINDOW ? order.length : from + 3;
    for (const [c, li] of rows) if (!order.includes(c)) { li.remove(); rows.delete(c); }
    order.forEach((c, i) => {
      const li = rowFor(c), shown = i >= from && i < to;
      li.hidden = !shown;
      if (!shown) return;
      li.classList.toggle('me', c === player);
      li.style.setProperty('--r', String(i - from));
      const n = String(i + 1);
      if (li.firstChild.textContent !== n) li.firstChild.textContent = n;
    });
    board.style.setProperty('--rows', String(to - from));
  }

  function setDelta(player, dir) {
    const delta = rows.get(player)?.querySelector('.delta');
    if (delta) delta.className = `delta${dir ? ` ${dir}` : ''}`;
  }

  return {
    // A new race: forget the last field and hide everything that pops.
    reset() {
      for (const li of rows.values()) li.remove();
      rows.clear();
      shownPlace = -1; showT = 0; peak = 0; peakT = 0; shownRatio = shownPeak = -1;
      board.classList.remove('show');
    },
    // race: the game's race state; order: the current standings.
    update(race, order, dt) {
      const p = race.player;
      if (root.dataset.mode !== race.mode) root.dataset.mode = race.mode;
      root.classList.toggle('hints', race.state === 'count' || race.clock < HINT_S);

      // Standings: only when the player's place changes during the race.
      const place = order.indexOf(p);
      if (shownPlace < 0 || race.state !== 'go') shownPlace = place;
      else if (place !== shownPlace) {
        layout(order, p);
        setDelta(p, place < shownPlace ? 'up' : 'down');
        shownPlace = place;
        showT = SHOW_S;
        board.classList.add('show');
        pos.classList.remove('pop'); void pos.offsetWidth; pos.classList.add('pop');
      }
      if (showT > 0) {
        showT -= dt;
        layout(order, p);
        if (showT <= 0) board.classList.remove('show');
      }

      // Speed gauge: the arc and needle follow the speed, the peak mark keeps
      // the highest recent value so a turbo or a hit shows how far it moved.
      const ratio = Math.min(1, Math.abs(p.vf) / (p.tune.top * 1.5));
      if (ratio >= peak) { peak = ratio; peakT = PEAK_HOLD; }
      else if ((peakT -= dt) <= 0) peak = Math.max(ratio, peak - dt * PEAK_FALL);
      const r = Math.round(ratio * 200) / 200, k = Math.round(peak * 200) / 200;
      if (r !== shownRatio) {
        shownRatio = r;
        fill.style.strokeDasharray = `${(r * ARC).toFixed(1)} 400`;
        needle.style.transform = `rotate(${(r * 240 - 120).toFixed(1)}deg)`;
      }
      if (k !== shownPeak) {
        shownPeak = k;
        peakMark.style.transform = `rotate(${(k * 240 - 120).toFixed(1)}deg)`;
      }
    },
  };
}
