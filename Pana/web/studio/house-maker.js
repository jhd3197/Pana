import { HOUSE_FAMILIES, HOUSE_PALETTES, HOUSE_PLANTING, HOUSE_WINDOWS, HOUSE_ROOFS, HOUSE_LAYOUTS, HOUSE_FINISHES } from '/engine/models/props/colonial-house-definitions.js';
import { createHouseSpec, readHouseSpec, rerollHouse, createHouseBatch, readHouseBatch, saveHouseBatch } from '/engine/models/props/colonial-house-spec.js';

export function createHouseMaker({ container, copy, change }) {
  const panel = document.createElement('section'); panel.id = 'house-maker'; panel.className = 'house-maker'; panel.hidden = true;
  const choices = values => values.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
  panel.innerHTML = `<h3>Creador de casas</h3><p>Combina ventanas, techos, fachadas y jardines. Guarda las recetas para usarlas en un mapa.</p>
    <div class="house-batch">
      <label>Semilla de la colección<input id="house-batch-seed" type="number" min="0" max="4294967295" step="1" value="103" required></label>
      <button id="house-generate-batch" type="button">Generar 50 casas</button>
      <p>Recorre todas las familias y estilos; los bloqueos de abajo se aplican a «Otra casa».</p>
      <label id="house-batch-choice" hidden>Ver o editar<select id="house-batch-select" aria-label="Casa de la colección"></select></label>
    </div>
    <form id="house-form">
      <label>Familia<select name="family">${choices(HOUSE_FAMILIES)}</select></label>
      <div class="house-fields"><label>Semilla<input name="seed" type="number" min="0" max="4294967295" step="1" required></label><label>Pisos<select name="floors"><option value="1">1 piso</option><option value="2">2 pisos</option></select></label></div>
      <div class="house-fields"><label>Ancho<input name="width" type="number" min="5.8" max="12" step="0.1" required></label><label>Fondo<input name="depth" type="number" min="4.5" max="8" step="0.1" required></label></div>
      <label>Ventanas<select name="windowStyle">${choices(HOUSE_WINDOWS)}</select></label>
      <label>Techo<select name="roof">${choices(HOUSE_ROOFS)}</select></label>
      <label>Distribución<select name="layout">${choices(HOUSE_LAYOUTS)}</select></label>
      <label>Colores<select name="palette">${choices(HOUSE_PALETTES)}</select></label>
      <label>Acabado de paredes<select name="wallFinish">${choices(HOUSE_FINISHES)}</select></label>
      <label>Plantas<select name="planting">${choices(HOUSE_PLANTING)}</select></label>
      <label>Puerta<select name="door"><option value="square">Rectangular</option><option value="arch">Arco</option></select></label>
      <button type="submit">Aplicar cambios</button>
    </form>
    <fieldset class="house-locks"><legend>Fijar al generar otra</legend><label><input type="checkbox" name="structure"> Estructura</label><label><input type="checkbox" name="palette"> Colores</label><label><input type="checkbox" name="finish"> Acabado</label><label><input type="checkbox" name="planting"> Plantas</label></fieldset>
    <div class="house-actions"><button id="house-reroll" type="button">Otra casa</button><button id="house-copy" type="button">Copiar receta</button></div>
    <details><summary>Guardar o cargar JSON</summary><p>Guarda aquí tus cambios. El enlace de Studio abre el modelo base.</p><textarea id="house-recipe" rows="6" spellcheck="false" aria-label="Receta de casa o colección en JSON"></textarea><button id="house-import" type="button">Cargar JSON</button><button id="house-download" type="button">Guardar JSON</button></details>
    <a class="house-street-link" href="/studio/assets/colonial-street" data-route>Ver la calle de las flores</a>
    <p id="house-status" role="status" aria-live="polite"></p>`;
  container.prepend(panel);
  const form = panel.querySelector('form'), field = name => form.elements.namedItem(name), status = panel.querySelector('#house-status'), recipe = panel.querySelector('textarea');
  const batchSelect = panel.querySelector('#house-batch-select'), batchSeed = panel.querySelector('#house-batch-seed');
  let current, collection = null, selected = null, asset, busy = false, revision = 0;
  const value = () => selected === -1 ? saveHouseBatch(collection) : current;
  function fill() {
    const overview = selected === -1;
    form.hidden = overview; panel.querySelector('.house-locks').hidden = overview; panel.querySelector('#house-reroll').hidden = overview;
    panel.querySelector('#house-copy').textContent = overview ? 'Copiar colección' : 'Copiar receta';
    panel.querySelector('#house-batch-choice').hidden = !collection;
    if (collection) {
      batchSelect.replaceChildren(new Option(`Todas · ${collection.length} casas`, '-1'), ...collection.map((s, i) => new Option(`${String(i + 1).padStart(2, '0')} · ${HOUSE_FAMILIES.find(f => f.id === s.family).name} · ${HOUSE_WINDOWS.find(w => w.id === s.windowStyle).name}`, String(i))));
      batchSelect.value = String(selected);
    }
    if (!overview) {
      for (const key of ['seed', 'family', 'floors', 'width', 'depth', 'palette', 'planting', 'door', 'windowStyle', 'roof', 'layout', 'wallFinish']) field(key).value = String(current[key]);
      const family = HOUSE_FAMILIES.find(f => f.id === current.family);
      field('floors').disabled = family.floors.length === 1;
      field('width').min = current.family === 'casa-larga' ? '9' : '5.8';
    }
    recipe.value = JSON.stringify(value(), null, 2);
  }
  async function apply(next, index = selected, nextCollection = collection) {
    if (busy || !asset) return;
    busy = true; const ticket = revision; panel.setAttribute('aria-busy', 'true'); status.textContent = 'Preparando la vista…';
    try {
      const ok = await change(asset, next);
      if (ticket !== revision) return;
      if (!ok) throw Error('No se pudo construir la vista.');
      if (Array.isArray(next)) { collection = next; selected = -1; current = null; }
      else {
        current = next; selected = index; collection = nextCollection;
        if (collection && selected >= 0) collection = collection.map((s, i) => i === selected ? next : s);
      }
      fill(); status.textContent = selected === -1 ? `${collection.length} casas listas. Elige una para editarla; Guardar JSON conserva toda la colección.` : `Casa lista · semilla ${current.seed}${collection ? ` · ${selected + 1} de ${collection.length}` : ''}.`;
    } catch (error) { if (ticket === revision) { fill(); status.textContent = 'Revisa la receta: ' + error.message; } }
    finally { if (ticket === revision) { busy = false; panel.removeAttribute('aria-busy'); } }
  }
  const safely = fn => { if (busy || !asset) return; try { fn(); } catch (error) { status.textContent = 'Revisa la receta: ' + error.message; } };
  form.onsubmit = event => {
    event.preventDefault(); safely(() => apply(createHouseSpec({ ...current.inputs,
      ...Object.fromEntries(['family', 'palette', 'planting', 'door', 'windowStyle', 'roof', 'layout', 'wallFinish'].map(k => [k, field(k).value])),
      ...Object.fromEntries(['seed', 'floors', 'width', 'depth'].map(k => [k, Number(field(k).value)])),
      plantSeed: Number(field('seed').value),
      finishSeed: Number(field('seed').value) === current.seed ? current.finishSeed : Number(field('seed').value),
    })));
  };
  field('family').onchange = () => {
    const family = HOUSE_FAMILIES.find(f => f.id === field('family').value);
    field('floors').value = family.floors[0]; field('floors').disabled = family.floors.length === 1;
    field('width').value = family.width; field('width').min = family.id === 'casa-larga' ? '9' : '5.8';
  };
  panel.querySelector('#house-reroll').onclick = () => safely(() => {
    const locks = Object.fromEntries([...panel.querySelectorAll('.house-locks input')].map(input => [input.name, input.checked]));
    apply(rerollHouse(current, (current.seed + 1) >>> 0, locks));
  });
  panel.querySelector('#house-generate-batch').onclick = () => safely(() => { if (batchSeed.reportValidity()) apply(createHouseBatch(Number(batchSeed.value))); });
  batchSelect.onchange = () => safely(() => {
    const index = Number(batchSelect.value); apply(index === -1 ? collection : collection[index], index);
  });
  panel.querySelector('#house-copy').onclick = async () => { if (!busy && asset) status.textContent = await copy(JSON.stringify(value(), null, 2)) ? 'JSON copiado.' : 'Selecciona el JSON para copiarlo.'; };
  panel.querySelector('#house-import').onclick = () => safely(() => {
    const data = JSON.parse(recipe.value);
    apply(data.type === 'colonial-house-batch' ? readHouseBatch(data) : readHouseSpec(data), null, null);
  });
  panel.querySelector('#house-download').onclick = () => {
    if (busy || !asset) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(value(), null, 2) + '\n'], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = selected === -1 ? `coleccion-${collection.length}-casas.json` : `casa-${current.seed}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return {
    show(nextAsset, spec) {
      revision++; asset = nextAsset; collection = Array.isArray(spec) ? spec : null; selected = collection ? -1 : null; current = collection ? null : spec;
      busy = false; panel.hidden = false; status.textContent = collection ? 'Elige una casa para editarla o guarda las 50 recetas.' : ''; panel.removeAttribute('aria-busy'); fill();
    },
    clear() { revision++; asset = null; current = null; collection = null; selected = null; busy = false; panel.hidden = true; panel.removeAttribute('aria-busy'); },
    dispose() { revision++; panel.remove(); },
  };
}
