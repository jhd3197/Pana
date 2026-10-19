try {
  await import('./editor.js');
  document.querySelector('.panel').inert = false;
} catch (error) {
  const status = document.getElementById('loading');
  status.hidden = false;
  status.textContent = 'No pudimos preparar tu pana. Revisa la conexión y vuelve a intentar.';
  const retry = document.createElement('button'); retry.className = 'ghost';
  retry.textContent = 'Volver a intentar'; retry.onclick = () => location.reload();
  status.append(retry);
  console.warn('Mi pana could not start:', error.message);
}
