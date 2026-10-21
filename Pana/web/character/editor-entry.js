// A controller works the editor like a menu (engine/gamepad.js).
import { padControls } from '/engine/gamepad.js';
import { showCover } from '/engine/loading-cover.js';
import { loadAvatar } from '/engine/avatar.js';
import { cachedPortrait } from '/engine/portrait-cache.js';
padControls({ playing: () => false });
// Your pana covers the page while the editor and its 3D model load, so the
// panel never fills in under the player.
const cover = showCover({ title: 'Mi pana', portrait: cachedPortrait(loadAvatar()) || '', text: 'Preparando tu pana…' });
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
  console.warn('Mi pana could not start:', error.message);
}
