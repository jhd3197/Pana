// Conuco's page: the bed buttons over the 3D plot and the one side sheet (tienda,
// casa, adornos, semillas). Reads plot.view() and calls plot actions through `act`;
// no rules here. The pictures are the real models, drawn once by object-thumb.js.
import { icon } from '/engine/icons.js';
import { loc } from '/engine/i18n.js';
import { CROPS, DECOR, TIERS, formatLeft, rankOfDecor } from './rules.js';

const $ = id => document.getElementById(id);
const el = (name, cls, text) => { const node = document.createElement(name); if (cls) node.className = cls; if (text != null) node.textContent = text; return node; };
const stat = (name, text) => { const span = el('span'); span.append(icon(name), ` ${text}`); return span; };

// Pictures load their models only when a sheet first needs them.
const THUMB = { width: 112, height: 112 };
const pictures = async () => {
  const [thumbs, conuco, pueblo, llano, palms] = await Promise.all([
    import('/engine/object-thumb.js'), import('/engine/models/props/conuco.js'), import('/engine/models/props/pueblo.js'),
    import('/engine/models/props/llano-life.js'), import('/engine/models/vegetation/palm.js'),
  ]);
  return { ...thumbs, ...conuco, decor: {
    banca: () => pueblo.parkBench(), espantapajaros: () => conuco.conucoScarecrow(), banderines: () => conuco.conucoBunting({ span: 4, flags: 6 }),
    fogon: () => llano.campfire(), chinchorro: () => llano.chinchorro(), palma: () => palms.palm({ h: 4, seed: 7, detail: 'low' }),
  } };
};

export function createConucoUi({ plot, wallet, act, world, now }) {
  const beds = $('beds'), sheet = $('sheet'), body = $('sheet-body'), title = $('sheet-title'), note = $('sheet-note');
  let openSheet = null, pickedBed = null, modelKit = null;
  const models = () => (modelKit ??= pictures());

  async function thumb(img, key, make, options) {
    try {
      const kit = await models();
      img.src = await kit.objectThumb(`conuco:${key}`, () => make(kit), { ...THUMB, ...options });
    } catch { /* the row still reads without its picture */ }
  }
  const cropImg = id => {
    const img = el('img', 'row-thumb'); img.alt = '';
    thumb(img, `crop:${id}`, kit => kit.conucoCrop({ crop: id, stage: 'ready' }));
    return img;
  };

  function row({ picture, name, stats = [], action, off = false }) {
    const node = el('div', 'row' + (off ? ' is-off' : ''));
    if (picture) node.append(picture);
    const text = el('div', 'row-text');
    const label = el('span', 'row-name', name); text.append(label);
    if (stats.length) { const line = el('div', 'row-stats'); line.append(...stats); text.append(line); }
    node.append(text);
    if (action) node.append(action);
    return node;
  }
  function button(text, onClick, { kind = '', disabled = false, id, iconName } = {}) {
    const node = el('button', `pk-btn pk-btn--sm ${kind}`.trim(), text); node.type = 'button';
    if (iconName) node.prepend(icon(iconName));
    node.disabled = disabled; if (id) node.id = id;
    node.addEventListener('click', onClick);
    return node;
  }

  // ---------- sheets ----------
  const SHEETS = {
    shop() {
      const shelf = plot.stock(), balance = wallet.peek();
      title.textContent = loc('Tienda'); note.textContent = formatLeft(shelf.endsAt - now());
      body.dataset.window = shelf.window;
      body.replaceChildren(...shelf.items.map(item => row({
        picture: cropImg(item.id), name: loc(item.crop.name), off: item.left <= 0,
        stats: [stat('mango', `+${item.crop.mangos}`), el('span', '', formatLeft(item.crop.growMs)), el('span', '', `x${item.left}`)],
        action: button(String(item.price), () => act(plot.buy(item.id), 'buy'), { disabled: item.left <= 0 || balance < item.price, iconName: 'mango', kind: 'pk-btn--primary' }),
      })));
      for (const [i, item] of shelf.items.entries()) body.children[i].dataset.item = item.id;
    },
    house() {
      const view = plot.view(), tier = TIERS[view.tier - 1], next = TIERS[view.tier];
      title.textContent = loc('Casa'); note.textContent = `${view.tier}/${TIERS.length}`;
      const pips = el('div', 'house-tiers'); pips.append(...TIERS.map((_, i) => el('i', i < view.tier ? 'is-on' : '')));
      const picture = el('img', 'house-picture'); picture.alt = '';
      const target = next ? view.tier + 1 : view.tier;
      thumb(picture, `house:${target}`, kit => kit.conucoHouse({ tier: target }), { width: 320, height: 200, tilt: .2 });
      const rows = [pips, picture, el('div', 'house-now', loc(next ? next.name : tier.name))];
      if (next) {
        const wrap = el('div', 'house-next'), gain = next.beds - tier.beds, afford = wallet.peek() >= next.cost;
        const verb = view.tier === 1 ? loc('Reparar') : loc('Mejorar');
        const go = button(`${verb} ${next.cost}`, () => act(plot.upgrade(), 'upgrade'), { kind: 'pk-btn--primary', disabled: !afford, iconName: 'mango', id: 'upgrade' });
        wrap.append(go);
        if (gain > 0) wrap.append(stat('sprout', `+${gain}`));
        rows.push(wrap);
      }
      body.replaceChildren(...rows);
    },
    decor() {
      const view = plot.view();
      title.textContent = loc('Adornos'); note.textContent = '';
      body.replaceChildren(...DECOR.map(item => {
        const open = plot.isDecorUnlocked(item.id), placed = view.decor.includes(item.id), picture = el('img', 'row-thumb'); picture.alt = '';
        thumb(picture, `decor:${item.id}`, kit => kit.decor[item.id]());
        const node = row({
          picture, name: loc(item.name), off: !open,
          stats: open ? [] : [stat('lock', loc(rankOfDecor(item.id)?.title ?? ''))],
          action: open ? button(placed ? loc('Quitar') : loc('Poner'), () => act(plot.setDecor(item.id, !placed), 'decor'), { kind: placed ? '' : 'pk-btn--teal' }) : null,
        });
        node.dataset.item = item.id;
        return node;
      }));
    },
    // The seeds this player holds, plus the crop that is always free.
    seeds() {
      const view = plot.view();
      title.textContent = loc('Sembrar'); note.textContent = '';
      const usable = CROPS.filter(crop => crop.free || view.seeds[crop.id] > 0);
      body.replaceChildren(...usable.map(crop => {
        const node = row({
          picture: cropImg(crop.id), name: loc(crop.name),
          stats: [stat('mango', `+${crop.mangos}`), el('span', '', formatLeft(crop.growMs)), el('span', '', crop.free ? loc('Gratis') : `x${view.seeds[crop.id]}`)],
          action: button(loc('Sembrar'), () => act(plot.plant(pickedBed, crop.id), 'plant'), { kind: 'pk-btn--primary' }),
        });
        node.dataset.item = crop.id;
        return node;
      }));
    },
  };
  function show(name) {
    openSheet = name; sheet.hidden = !name;
    if (!name) { pickedBed = null; markPicked(); return; }
    SHEETS[name]();
    for (const [id, sheetName] of [['open-shop', 'shop'], ['open-house', 'house'], ['open-decor', 'decor']]) $(id).setAttribute('aria-pressed', String(name === sheetName));
  }
  function toggle(name) { show(openSheet === name ? null : name); }
  const markPicked = () => { for (const node of beds.children) node.classList.toggle('is-picked', Number(node.dataset.bed) === pickedBed); };

  // ---------- beds ----------
  const tags = [];
  function buildBeds(count) {
    while (tags.length < count) {
      const index = tags.length, node = el('button', 'bed'), tag = el('span', 'bed-tag');
      node.type = 'button'; node.dataset.bed = index; node.append(tag);
      node.addEventListener('click', () => pressBed(index));
      beds.append(node); tags.push({ node, tag, key: '' });
    }
    while (tags.length > count) tags.pop().node.remove();
    place();
  }
  function place() {
    tags.forEach(({ node }, i) => {
      const r = world.bedRect(i);
      Object.assign(node.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
    });
  }
  function drawBeds(view) {
    if (tags.length !== view.beds.length) buildBeds(view.beds.length);
    view.beds.forEach((bed, i) => {
      const { node, tag } = tags[i];
      const state = !bed ? 'empty' : bed.stage === 'wilted' ? 'wilted' : bed.ready ? 'ready' : 'growing';
      const clock = bed && !bed.ready ? formatLeft(bed.remaining) : '';
      const key = `${state}:${clock}:${bed?.crop ?? ''}`;
      if (state === 'growing') {
        const bar = tag.querySelector('.pk-bar i');
        if (bar) bar.parentElement.style.setProperty('--pk-value', String(bed.growth));
      }
      if (tags[i].key === key) return;
      tags[i].key = key; node.dataset.state = state;
      const name = bed ? loc(bed.def.name) : '';
      if (state === 'empty') { tag.replaceChildren(icon('plus')); node.setAttribute('aria-label', loc('Sembrar')); }
      else if (state === 'growing') {
        const bar = el('div', 'pk-bar'); bar.append(el('i')); bar.style.setProperty('--pk-value', String(bed.growth));
        tag.replaceChildren(el('span', '', clock), bar); node.setAttribute('aria-label', `${name} · ${clock}`);
      } else { tag.replaceChildren(icon('basket')); node.setAttribute('aria-label', loc('Cosechar {name}', { name })); }
    });
  }
  function pressBed(index) {
    const bed = plot.view().beds[index];
    world.visitBed(index);
    if (!bed) { pickedBed = index; markPicked(); show('seeds'); return; }
    if (bed.ready) act(plot.harvest(index), 'harvest');
  }

  // ---------- the bar ----------
  const labelled = (id, name, text) => { const node = $(id); node.replaceChildren(icon(name), el('span', '', text)); };
  labelled('open-shop', 'crate', loc('Tienda')); labelled('open-house', 'house', loc('Casa')); labelled('open-decor', 'flower', loc('Adornos'));
  $('open-shop').addEventListener('click', () => toggle('shop'));
  $('open-house').addEventListener('click', () => toggle('house'));
  $('open-decor').addEventListener('click', () => toggle('decor'));
  $('sheet-close').append(icon('close'));
  $('sheet-close').addEventListener('click', () => show(null));
  $('mango-icon').append(icon('mango'));
  $('harvest-all').addEventListener('click', () => act(plot.harvestAll(), 'harvest-all'));
  world.onResize = () => place();

  function render() {
    const view = plot.view(), ready = view.beds.filter(bed => bed?.ready).length;
    $('mangos').textContent = String(wallet.peek());
    drawBeds(view);
    const all = $('harvest-all');
    all.hidden = ready < 2;
    if (ready >= 2) { all.replaceChildren(icon('basket'), el('span', '', `${loc('Cosechar')} ${ready}`)); }
    world.sync(view);
  }
  // Each second: the clocks, stages and the shelf's countdown, with no list rebuilt
  // unless the shelf itself changed.
  function tick() {
    render();
    if (openSheet === 'shop') {
      const shelf = plot.stock();
      if (String(shelf.window) !== body.dataset.window) SHEETS.shop();
      else note.textContent = formatLeft(shelf.endsAt - now());
    }
  }
  return {
    render, tick, show, place,
    get sheet() { return openSheet; },
    // A bought seed, a new tier: the open sheet shows the new numbers. A planted bed closes it.
    refresh(closing) { if (closing) show(null); else if (openSheet) SHEETS[openSheet](); render(); },
  };
}
