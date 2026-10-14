// Kept independent of Three.js so module/GPU failures can be retried from startup.
const $ = id => document.getElementById(id);
const messages = [
  'Despertando a los panas…',
  'Planchando las franelas…',
  'Convenciendo al mango de quedarse quieto…',
  'Buscando las llaves del carrito…',
  'Contando palmeras. Otra vez…',
  'Sacando una foto de familia…',
  'Ya casi. El pana se está peinando…',
];
let opened = false, previewReady = false, latest, revealing = false;
const startedAt = performance.now();

async function reveal() {
  if (opened || revealing) return;
  revealing = true;
  // Decode the first screen before revealing it; offscreen images stay lazy.
  const list = $('asset-list').getBoundingClientRect();
  const visible = [...document.querySelectorAll('.thumbnail img')].filter(img => {
    const box = img.getBoundingClientRect(); return box.top < list.bottom && box.bottom > list.top;
  });
  await Promise.all(visible.map(img => { img.loading = 'eager'; return img.decode().catch(() => {}); }));
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  opened = true;
  const moveFocus = $('startup').contains(document.activeElement);
  $('studio-app').inert = false; $('studio-app').removeAttribute('aria-hidden');
  $('startup').setAttribute('aria-busy', 'false'); $('startup').hidden = true;
  if (moveFocus) $('asset-list').focus({ preventScroll: true });
}
export function failStartup(message, detail, allowContinue = false) {
  if (opened) return;
  $('startup').setAttribute('aria-busy', 'false');
  $('startup-error').hidden = false;
  $('startup-error-message').textContent = message;
  $('startup-error-detail').textContent = detail;
  $('startup-continue').hidden = !allowContinue;
}
export function updateStartup(service) {
  if (opened) return;
  latest = service;
  const state = service.state, errors = service.errors;
  // Cached records are provisional until their source fingerprints have been checked.
  const ready = state.validating ? 0 : state.ready;
  $('startup-progress').max = state.total; $('startup-progress').value = ready;
  $('startup-count').textContent = `${ready} / ${state.total}`;
  const index = Math.floor((performance.now() - startedAt) / 4500) % messages.length;
  $('startup-message').textContent = messages[index];
  $('startup-phase').textContent = state.validating ? 'Comprobando recursos' : state.active ? `Preparando ${state.active}` : 'Preparando el estudio';
  if (state.validating || state.active || ready + errors.size < state.total) return;
  if (state.validationError || errors.size) {
    const detail = [state.validationError, ...[...errors].map(([id, error]) => `${id}: ${error}`)].filter(Boolean).join('\n');
    failStartup(errors.size ? `${errors.size} recursos no se pudieron preparar.` : 'No se pudieron comprobar las fuentes.', detail, previewReady && ready > 0);
    return;
  }
  if (previewReady) reveal();
}
export function previewSettled() { previewReady = true; if (latest) updateStartup(latest); }
$('startup-retry').onclick = () => location.reload();
$('startup-continue').onclick = reveal;
import('./studio.js').catch(error => {
  failStartup('No se pudo abrir el estudio.', error.message);
});
