// A controller works the editor like a menu (engine/gamepad.js).
import { padControls } from '/engine/gamepad.js';
import { showCover } from '/engine/loading-cover.js';
import { loadAvatar } from '/engine/avatar.js';
import { cachedPortrait } from '/engine/portrait-cache.js';
import { embeddedEditor } from '/engine/pana-editor.js';
padControls({ playing: () => false });
// Opened over a lobby or the hub (engine/pana-editor.js): "Volver" closes the
// frame instead, so the page underneath keeps its room.
const back = document.querySelector('header .back');
const embedded = embeddedEditor({ back });
if (embedded) back.querySelector('[data-shared-icon]').dataset.sharedIcon = 'close';
// Your pana covers the page while the editor and its 3D model load, so the
// panel never fills in under the player.
const cover = showCover({ title: 'Mi pana', image: '/images/launcher/personaje-cover.webp', portrait: cachedPortrait(loadAvatar()) || '', text: 'Preparando tu pana…' });
try {
  await import('./editor.js');
  document.querySelector('.panel').inert = false;
  cover.done();
} catch (error) {
  const status = document.getElementById('loading');
  status.hidden = false;
  status.textContent = 'No pudimos preparar tu pana. Revisa la conexión y vuelve a intentar.';
  // The cover stays up with the message and its retry.
  cover.fail(status.textContent, () => location.reload());
  if (embedded) {
    const close = document.createElement('button');
    close.type = 'button'; close.className = 'pk-btn'; close.textContent = 'Cerrar';
    close.addEventListener('click', embedded.close);
    cover.node.querySelector('.pk-cover-card').append(close);
  }
  // The whole error (a module that failed to resolve names its specifier),
  // so the hosted error log shows the cause, not only "could not start".
  console.error('Mi pana could not start:', error?.message || error, error?.stack || '');
}
