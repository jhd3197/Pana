// Small, typed presentation snapshots. Never accept HTML from another browser.
const $ = id => document.getElementById(id);
const visible = id => !$(id).classList.contains('hidden');
export function readPresentation() {
  return {
    plank: $('plank').textContent, sign: $('sign').textContent, count: $('count').textContent,
    toast: visible('toast') ? [...$('toast').children].map(el => el.textContent) : null,
    miniIntro: visible('mini-intro') ? { title: $('mini-title').textContent, howto: $('mini-howto').textContent,
      keys: $('mini-keys').textContent } : null,
    winner: visible('winner') ? [...$('winner').children].filter(el => !el.classList.contains('crown')).map(el => el.textContent) : null,
    results: visible('results'),
  };
}
export function writePresentation(state) {
  for (const id of ['plank', 'sign', 'count']) $(id).textContent = state[id];
  $('sign').classList.toggle('hidden', !state.sign);
  for (const [id, values, tags] of [['toast', state.toast, ['b', 'span']], ['winner', state.winner, ['small', 'b', 'em']]]) {
    const el = $(id);
    el.classList.toggle('hidden', !values);
    if (values) el.replaceChildren(...values.map((text, i) => {
      const node = document.createElement(tags[i] || 'span'); node.textContent = text; return node;
    }));
  }
  $('mini-intro').classList.toggle('hidden', !state.miniIntro);
  if (state.miniIntro) {
    $('mini-title').textContent = state.miniIntro.title;
    $('mini-howto').textContent = state.miniIntro.howto;
    $('mini-keys').textContent = state.miniIntro.keys;
  }
}
