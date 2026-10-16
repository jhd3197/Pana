// Independent of Three.js: a failed module/GPU still leaves a useful retry.
const $ = id => document.getElementById(id);
let opened = false;
export function failStartup(message, detail) {
  if (opened) return;
  $('startup').setAttribute('aria-busy', 'false');
  $('startup-error').hidden = false;
  $('startup-error-message').textContent = message;
  $('startup-error-detail').textContent = detail;
}
export function previewSettled() {
  if (opened) return;
  opened = true;
  const moveFocus = $('startup').contains(document.activeElement);
  $('studio-app').inert = false; $('studio-app').removeAttribute('aria-hidden');
  $('startup').setAttribute('aria-busy', 'false'); $('startup').hidden = true;
  if (moveFocus) $('asset-list').focus({ preventScroll: true });
}
$('startup-retry').onclick = () => location.reload();
import('./studio.js').catch(error => failStartup('No se pudo abrir el estudio.', error.message));
