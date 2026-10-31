// ¡Embuste!'s meeting at the fire: who called it, the talk, the vote and the
// curiara. DOM only; game.js feeds it views and sends what the player picks.
import { PHRASES } from './rules.js';
import { loc, locn } from '/engine/i18n.js';

const $ = id => document.getElementById(id);
const el = (tag, className, text) => { const n = document.createElement(tag); if (className) n.className = className; if (text != null) n.textContent = text; return n; };

export function createMeeting({ act, nameOf, colorOf }) {
  let key = '', chatSeen = 0, meetingId = null;
  $('phrases').replaceChildren(...PHRASES.map((text, i) => { const b = el('button', '', loc(text)); b.type = 'button'; b.onclick = () => act('chat', { phrase: i }); return b; }));
  $('skip').onclick = () => act('vote', { target: 'skip' });
  $('chat-form').addEventListener('submit', e => {
    e.preventDefault();
    const text = $('chat-input').value.trim(); if (!text) return;
    act('chat', { text }); $('chat-input').value = '';
  });

  function render(view) {
    const m = view.meeting, me = view.me;
    if (!m) { meetingId = null; return; }
    const id = `${view.round}:${m.by}:${m.body}`;
    if (id !== meetingId) {
      meetingId = id; chatSeen = 0; key = ''; $('chat-log').replaceChildren();
      const body = m.body != null ? nameOf(m.body) : null;
      $('meeting-eyebrow').textContent = body ? loc('Encontraron una estatua') : loc('Sonó la campana');
      $('meeting-title').textContent = body ? loc('¡{name} está envuelto!', { name: body }) : loc('¡Reunión en la fogata!');
      $('meeting-copy').textContent = body ? loc('{name} lo encontró y llamó a todos. ¿Quién fue?', { name: nameOf(m.by) }) : loc('{name} tocó la campana. Hablen y decidan quién se va río abajo.', { name: nameOf(m.by) });
    }
    const ghost = me.ghost;
    $('meeting').classList.toggle('is-ghost', ghost);
    $('chat-form').classList.toggle('hidden', !view.options.chat);
    $('meeting-time').textContent = Math.ceil(m.t);
    $('meeting-stage').textContent = m.stage === 'discuss' ? loc('para hablar') : m.stage === 'vote' ? loc('para votar') : loc('río abajo');
    $('skip').disabled = ghost || m.stage !== 'vote' || m.mine != null;
    $('skip').textContent = m.mine === 'skip' ? loc('Saltaste') : loc('No votar (saltar)');

    const counts = {};
    for (const v of m.votes || []) (counts[v.target] ??= []).push(v.voter);
    const people = view.roster.filter(r => !r.spectator);
    const next = [m.stage, m.mine, m.voted.join(','), people.map(r => `${r.seat}${r.out ? 'x' : ''}`).join(','), JSON.stringify(counts)].join('|');
    if (next !== key) {
      key = next;
      $('vote-list').replaceChildren(...people.map(r => {
        const li = el('li'), b = el('button', 'vote');
        b.type = 'button'; b.dataset.seat = r.seat;
        const canVote = !ghost && m.stage === 'vote' && m.mine == null && !r.out;
        b.disabled = !canVote;
        b.classList.toggle('is-dead', !!r.out); b.classList.toggle('is-mine', m.mine === r.seat);
        b.classList.toggle('is-voted', m.voted.includes(r.seat)); b.classList.toggle('is-partner', view.partners.includes(r.seat));
        const face = el('span', 'pk-avatar', r.name.slice(0, 1).toUpperCase()); face.style.background = colorOf(r.seat); face.translate = false;
        const who = el('span', 'vote-name', r.seat === me.seat ? loc('{name} · tú', { name: r.name }) : r.name); who.translate = false;
        b.append(face, who, el('span', 'vote-mark', loc('votó')));
        if (counts[r.seat]) b.append(el('span', 'vote-count', locn(counts[r.seat].length, '{n} voto', '{n} votos')));
        b.onclick = () => act('vote', { target: r.seat });
        li.append(b); return li;
      }));
    }
    for (const line of m.chat) if (line.id > chatSeen) {
      chatSeen = line.id;
      // Quick phrases are keys; typed chat and names stay as written.
      const li = el('li'); li.translate = false; li.append(el('b', '', `${nameOf(line.seat)}: `), document.createTextNode(PHRASES.includes(line.text) ? loc(line.text) : line.text));
      $('chat-log').append(li); $('chat-log').scrollTop = $('chat-log').scrollHeight;
    }
  }

  // The verdict over the river.
  function verdict(view) {
    const r = view.meeting?.result; if (!r) return null;
    if (r.ejected == null) return { title: r.tie ? loc('Empate: nadie se va río abajo.') : loc('Saltaron la votación.'), copy: loc('La noche sigue con todos en el campamento.') };
    const who = nameOf(r.ejected);
    return { title: loc('{name} se va río abajo en la curiara.', { name: who }), copy: r.role === 'momia' ? loc('{name} era una momia.', { name: who }) : r.role === 'pana' ? loc('{name} no era una momia.', { name: who }) : loc('¿Era una momia? Nadie lo sabrá hasta el amanecer.') };
  }

  return { render, verdict };
}
