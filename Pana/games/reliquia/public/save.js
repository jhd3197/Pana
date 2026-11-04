// Fosa's saved expeditions on the shared store (engine/save-game.js): the host
// autosaves between floors, offers Continuar in the lobby and shows the divers'
// slots until the expedition goes back down. See docs/knowledge/reliquia.md.
import { createSaveStore, createAutosave } from '/engine/save-game.js';
import { renderContinue, renderSlots, saveDate } from '/engine/save-widget.js';
import { loc, locn, formatNumber } from '/engine/i18n.js';
import { jornadaName, themeOf } from './deck.js';
import { itemName, ITEMS } from './items.js';
import { saveable, SAVE_VERSION } from './rules.js';
import { COLORS } from './view.js';

export function createFosaSave({ room, list, slots, notify }) {
  const store = createSaveStore({ game: 'reliquia', version: SAVE_VERSION });
  let listOpen = null, slotsKey = null, finishedId = null;
  const autosave = createAutosave({ store,
    ready: () => room.isHost && room.connected && saveable(room.state),
    key: () => `${room.state.origin}:${room.state.level}`,
    make: () => { const s = room.state; return { id: s.origin, data: s, meta: { level: s.level, place: jornadaName(s.level, themeOf(s)), divers: s.players.filter(p => !p.spectator || p.held).length } }; },
  });
  const describe = ({ at, meta }) => `${loc('Jornada {n} · {place}', { n: meta.level, place: loc(meta.place) })} · ${locn(meta.divers, '{n} pana', '{n} panas')} · ${saveDate(at)}`;

  function showList(state) {
    const open = room.connected && room.isHost && state.phase === 'lobby' && !state.resumed;
    if (open === listOpen) return;   // this runs every tick; the list only changes by hand
    listOpen = open;
    renderContinue(list, open ? store.list() : [], { describe,
      onContinue: save => { const data = store.load(save.id); if (!data || !room.continueSave(data)) notify(loc('No se pudo abrir la partida.')); },
      onDiscard: save => { store.remove(save.id); listOpen = null; showList(room.state); },
    });
  }

  function showSlots(state) {
    if (slots.hidden === !!state.resumed) slots.hidden = !state.resumed;
    if (!state.resumed) { slotsKey = null; return; }
    const divers = state.players.filter(p => !p.spectator || p.held);
    const key = JSON.stringify([state.level, state.mangos, room.id, room.isHost, divers.map(p => [p.id, p.seat, p.name, p.held, p.saved, p.avatar, p.hands.map(h => h?.kind)])]);
    if (key === slotsKey) return;
    slotsKey = key;
    renderSlots(slots, {
      heading: loc('Jornada {n} · {place} · {mangos} mangos', { n: state.level, place: loc(jornadaName(state.level, themeOf(state))), mangos: formatNumber(Math.floor(state.mangos)) }),
      action: room.isHost ? { label: loc('Nueva expedición'), run: () => room.action('abandon') } : null,
      slots: divers.map(p => ({
        key: p.seat, name: p.name, avatar: p.avatar, color: COLORS[p.seat % 8], here: !p.held, me: p.id === room.id,
        label: p.held ? loc('Guardado') : p.saved ? loc('Aquí') : loc('Nuevo'),
        detail: p.hands.filter(h => h && ITEMS[h.kind].tool).map(h => itemName(h.kind)).join(' · '),
        take: p.held ? () => room.action('take', { seat: p.seat }) : null,
      })),
    });
  }

  return {
    store,
    tick: () => autosave.tick(),
    render(state) { showList(state); showSlots(state); },
    // The expedition is over: nothing left to continue.
    finished(state) { if (room.isHost && finishedId !== state.origin) { finishedId = state.origin; store.remove(state.origin); } },
  };
}
