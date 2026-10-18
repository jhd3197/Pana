// Actual preparation work, shared by each game's entry point. No timer-based completion.
export async function prepareScene({ renderer, scene, camera }) {
  if (!renderer || !scene || !camera) throw new Error('La escena todavía no está preparada.');
  document.dispatchEvent(new CustomEvent('pana:load-stage', { detail: 'Preparando las texturas…' }));
  const images = new Set();
  scene.traverse(object => {
    for (const material of [object.material].flat().filter(Boolean)) {
      for (const value of Object.values(material)) if (value?.isTexture && value.image instanceof HTMLImageElement) images.add(value.image);
    }
  });
  await Promise.all([...images].map(image => image.decode()));
  document.dispatchEvent(new CustomEvent('pana:load-stage', { detail: 'Preparando los gráficos…' }));
  await renderer.compileAsync(scene, camera);
  const render = renderer.render.bind(renderer);
  render(scene, camera); // Upload geometry/textures and draw before calling this ready.
  if (document.getElementById('pana-lobby-shell')) {
    // Game simulation/networking continue; the illustrated lobby needs no live world render.
    renderer.render = (...args) => { if (!document.body.classList.contains('pana-in-lobby')) return render(...args); };
  }
  document.dispatchEvent(new CustomEvent('pana:load-stage', { detail: 'Juego preparado' }));
}
