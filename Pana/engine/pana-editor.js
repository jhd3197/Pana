// "Editar pana" without leaving the page. The Mi pana editor (/personaje)
// opens in a full-screen frame over the hub or a game lobby, so the room's
// socket, the lobby and a pana.sh party stay connected. Closing it gives the
// page back as it was; a changed pana fires `pana:avatar` on window.
//
//   import { openPanaEditor, bindPanaEditorLinks } from '/engine/pana-editor.js';
//   bindPanaEditorLinks();                     // every link to /personaje opens the frame
//   const { changed } = await openPanaEditor(); // or open it from a button
//   addEventListener('pana:avatar', e => sendAvatar(e.detail.avatar));
//
// Inside the frame the editor calls embeddedEditor(): its back link closes
// the frame (B on a controller, Escape too) and links out open a new tab.
import { loadAvatar, loadName } from './avatar.js';
import { loc } from './i18n.js';

export const EDITOR_PATH = '/personaje';
const EDITOR_LINK = 'a[data-pana-editor], a[href="/personaje"], a[href^="/personaje?"], a[href="/personaje.html"], a[href^="/personaje.html?"], a[href="/#mi-pana"]';
const CLOSE = 'pana:editor-close';
let current = null;

const saved = () => { try { return (localStorage.getItem('pana:avatar') || '') + '\n' + (localStorage.getItem('pana:name') || ''); } catch { return ''; } };

// Opens the editor over this page. Resolves with { changed } once it closes.
export function openPanaEditor({ query = '' } = {}) {
  if (current) return current.closed;
  const before = saved(), focus = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'pk-editor-frame';
  const frame = document.createElement('iframe');
  const params = new URLSearchParams(query); params.set('embed', '1');
  frame.src = `${EDITOR_PATH}?${params}`;
  frame.title = loc('Mi pana');
  frame.allow = 'fullscreen; gamepad';
  dialog.append(frame);
  document.body.append(dialog);
  let finish;
  const closed = new Promise(resolve => { finish = resolve; });
  const onMessage = event => { if (event.source === frame.contentWindow && event.data?.type === CLOSE) close(); };
  function close() {
    if (current?.dialog !== dialog) return;
    current = null;
    removeEventListener('message', onMessage);
    if (dialog.open) dialog.close();
    dialog.remove();
    document.documentElement.classList.remove('pk-editor-open');
    const changed = saved() !== before;
    if (changed) dispatchEvent(new CustomEvent('pana:avatar', { detail: { avatar: loadAvatar(), name: loadName() } }));
    focus?.focus?.({ preventScroll: true });
    finish({ changed });
  }
  addEventListener('message', onMessage);
  // Escape while the page around the frame has focus.
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
  dialog.addEventListener('close', close);  // closed some other way (a controller's B)
  document.documentElement.classList.add('pk-editor-open');
  dialog.showModal();
  frame.focus();
  current = { dialog, closed, close };
  return closed;
}

export function closePanaEditor() { current?.close(); }
export const panaEditorOpen = () => !!current;

// Every link to the editor on this page opens the frame instead of leaving.
// A new-tab click (Ctrl, middle button) still opens the page itself.
export function bindPanaEditorLinks(root = document) {
  root.addEventListener('click', event => {
    const link = event.target.closest?.(EDITOR_LINK);
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openPanaEditor({ query: new URL(link.href, location.href).search.slice(1) });
  });
}

// True when this page is the editor running inside openPanaEditor()'s frame.
export const isEmbeddedEditor = () => {
  try { return window.parent !== window && new URLSearchParams(location.search).has('embed'); } catch { return false; }
};

// The editor's side of the frame: `back` (its "Volver" link) becomes "Cerrar".
export const closeEmbeddedEditor = () => { if (isEmbeddedEditor()) window.parent.postMessage({ type: CLOSE }, location.origin); };
// Leaves the editor for another page (the shop): a new tab when framed.
export function leaveEditor(href) {
  if (isEmbeddedEditor()) open(href, '_blank', 'noopener'); else location.href = href;
}

export function embeddedEditor({ back } = {}) {
  if (!isEmbeddedEditor()) return null;
  const close = closeEmbeddedEditor;
  if (back) {
    back.setAttribute('aria-label', loc('Cerrar'));
    back.title = loc('Cerrar');
    back.addEventListener('click', event => { event.preventDefault(); close(); });
  }
  addEventListener('keydown', event => { if (event.key === 'Escape' && !event.defaultPrevented) close(); });
  // The shop and other pages open in a new tab, so the lobby stays.
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a[href]');
    if (!link || link === back || event.defaultPrevented || link.target) return;
    event.preventDefault();
    leaveEditor(link.href);
  });
  return { close };
}
