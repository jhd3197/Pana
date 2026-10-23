// The loading screen every page shares: the page's art, its name and what is
// loading now, over everything until the page underneath is ready in its
// final layout. Then it fades out, so nothing is seen jumping into place.
// game-entry.js covers a game's start (and its lobby ↔ game switches); the
// Mi pana editor covers its own.
//
//   const cover = showCover({ title: 'Carreritas', image: '/images/launcher/carreritas.jpg', text: 'Preparando la sala…' });
//   cover.say('Calentando los motores…');
//   cover.done();                                   // fades out after the next frame is painted
//   cover.fail('No pudimos…', () => location.reload());
export function showCover({ title = 'Pana', image = '', portrait = '', text = 'Cargando…' } = {}) {
  const node = document.createElement('div');
  node.className = 'pk-cover';
  node.setAttribute('role', 'status');
  node.setAttribute('aria-live', 'polite');
  node.setAttribute('aria-busy', 'true');
  if (image) node.style.setProperty('--cover-image', `url("${image}")`);
  const card = document.createElement('div'); card.className = 'pk-cover-card';
  if (portrait) { const img = new Image(); img.className = 'pk-cover-portrait'; img.alt = ''; img.src = portrait; card.append(img); }
  const name = document.createElement('b'); name.className = 'pk-cover-title'; name.textContent = title;
  const line = document.createElement('p'); line.className = 'pk-cover-text'; line.textContent = text;
  const bar = document.createElement('span'); bar.className = 'pk-cover-bar'; bar.append(document.createElement('i'));
  card.append(name, line, bar); node.append(card);
  (document.body || document.documentElement).append(node);
  let gone = false;
  return {
    node,
    say(next) { if (!gone && next) line.textContent = next; },
    done() {
      if (gone) return;
      gone = true;
      node.style.pointerEvents = 'none';   // the page underneath takes clicks at once
      // Two frames: the page underneath has painted in its final place first.
      // A background tab runs no frames, so a timer finishes the job there.
      let faded = false;
      const fade = () => {
        if (faded) return;
        faded = true; node.classList.add('is-done'); node.setAttribute('aria-busy', 'false');
        setTimeout(() => node.remove(), 450);
      };
      requestAnimationFrame(() => requestAnimationFrame(fade));
      setTimeout(fade, 250);
    },
    fail(message, retry) {
      line.textContent = message; bar.remove(); node.setAttribute('aria-busy', 'false');
      if (!retry) return;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'pk-btn pk-btn--primary'; button.textContent = 'Volver a intentar';
      button.addEventListener('click', retry);
      card.append(button);
    },
  };
}
