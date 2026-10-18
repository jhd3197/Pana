// Renderer-free, versioned house recipes. Cosmetic streams never move the shell.
import { HOUSE_VERSION, HOUSE_FAMILIES, HOUSE_PALETTES, HOUSE_PLANTING, HOUSE_WINDOWS, HOUSE_ROOFS, HOUSE_LAYOUTS, HOUSE_FINISHES } from './colonial-house-definitions.js';
const ROLLED_ROOFS = HOUSE_ROOFS.filter(r => r.pick !== false);

export function houseRandom(seed, channel) {
  let value = seed >>> 0;
  for (const letter of channel) value = Math.imul(value ^ letter.charCodeAt(0), 16777619);
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const choose = (values, random) => values[Math.floor(random() * values.length)];
function number(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(`${label}: ${min}–${max}`);
  return value;
}
function option(values, id, label) {
  const found = values.find(v => v.id === id);
  if (!found) throw new RangeError(`${label}: ${id}`);
  return found;
}

export function createHouseSpec(options = {}) {
  const seed = options.seed ?? 1;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('seed: 0–4294967295');
  const structure = houseRandom(seed, 'structure'), colors = houseRandom(seed, 'palette');
  const family = option(HOUSE_FAMILIES, options.family ?? choose(HOUSE_FAMILIES, structure).id, 'family');
  const width = number(options.width ?? options.lot?.width ?? Math.round((family.width - 0.4 + structure() * 0.8) * 10) / 10, family.id === 'casa-larga' ? 9 : 5.8, 12, 'width');
  const depth = number(options.depth ?? options.lot?.depth ?? Math.round((5.2 + structure() * 1.2) * 10) / 10, 4.5, 8, 'depth');
  const floors = options.floors ?? choose(family.floors, structure);
  if (!family.floors.includes(floors)) throw new RangeError(`floors: ${family.id}`);
  const floorHeight = number(options.floorHeight ?? 3.8, 3.6, 4.4, 'floorHeight');
  const palette = option(HOUSE_PALETTES, options.palette ?? choose(HOUSE_PALETTES, colors).id, 'palette').id;
  const planting = option(HOUSE_PLANTING, options.planting ?? (family.id === 'casa-balcon' ? 'balcon' : family.id === 'casa-remate' ? 'flores' : 'entrada'), 'planting').id;
  const plantSeed = options.plantSeed ?? seed;
  if (!Number.isSafeInteger(plantSeed) || plantSeed < 0 || plantSeed > 0xffffffff) throw new RangeError('plantSeed: 0–4294967295');
  const door = options.door ?? (family.id === 'casa-remate' || structure() > 0.65 ? 'arch' : 'square');
  if (!['arch', 'square'].includes(door)) throw new RangeError(`door: ${door}`);
  const windows = houseRandom(seed, 'windows'), roofChoice = houseRandom(seed, 'roof'), layoutChoice = houseRandom(seed, 'layout');
  const windowStyle = option(HOUSE_WINDOWS, options.windowStyle ?? choose(HOUSE_WINDOWS, windows).id, 'windowStyle').id;
  const roof = option(HOUSE_ROOFS, options.roof ?? choose(ROLLED_ROOFS, roofChoice).id, 'roof').id;
  const layout = option(HOUSE_LAYOUTS, options.layout ?? choose(HOUSE_LAYOUTS, layoutChoice).id, 'layout').id;
  const wallFinish = option(HOUSE_FINISHES, options.wallFinish ?? choose(HOUSE_FINISHES, houseRandom(seed, 'finish')).id, 'wallFinish').id;
  const finishSeed = options.finishSeed ?? seed;
  if (!Number.isSafeInteger(finishSeed) || finishSeed < 0 || finishSeed > 0xffffffff) throw new RangeError('finishSeed: 0–4294967295');
  const partyWalls = [...new Set(options.partyWalls ?? [])].sort();
  if (partyWalls.some(face => !['left', 'right', 'rear'].includes(face))) throw new RangeError('partyWalls: left, right, rear');
  const balcony = family.id === 'casa-balcon', porch = family.id === 'casa-portal';
  const base = 0.18, head = floorHeight * 0.81, sill = floorHeight * 0.16;
  const baySpacing = windowStyle === 'doble' || layout === 'amplia' ? 2.8 : 2.15;
  const bays = Math.max(2, Math.floor((width - 0.45) / baySpacing));
  const doorIndex = layout === 'lateral' ? bays - 1 : bays % 2 ? Math.floor(bays / 2) : 0;
  const faces = [], openings = [];
  const makeFace = (face, span, z, angle, position) => {
    const count = face === 'front' ? bays : Math.max(1, Math.floor((span - 0.6) / Math.max(2.3, baySpacing)));
    const slots = [];
    for (let floor = 0; floor < floors; floor++) for (let i = 0; i < count; i++) {
      if (face === 'front' && floor > 0 && balcony && count % 2 && i === Math.floor(count / 2)) continue;
      const isDoor = face === 'front' && (floor === 0 ? i === doorIndex || family.id === 'casa-larga' && i === count - 1 : balcony && (count === 2 || i !== Math.floor(count / 2)));
      const x = (i - (count - 1) / 2) * (span - 0.6) / count;
      const bottom = base + floor * floorHeight + (isDoor ? 0 : sill);
      const openingWidth = Math.min((span - 0.6) / count - 0.52, isDoor ? layout === 'amplia' ? 1.65 : 1.35 : windowStyle === 'doble' ? 1.9 : layout === 'amplia' ? 1.5 : 1.23);
      const slot = { id: `${face}-${floor}-${i}`, face, floor, x, bottom, width: openingWidth, height: head - (isDoor ? 0 : sill), kind: isDoor ? 'door' : 'window', windowStyle, arch: isDoor ? floor === 0 && door === 'arch' : windowStyle === 'arco' };
      slots.push(slot); openings.push(slot);
    }
    faces.push({ id: face, span, z, angle, position, openings: slots });
  };
  makeFace('front', width, porch ? depth / 2 - 0.95 : depth / 2, 0, [0, 0, porch ? depth / 2 - 0.95 : depth / 2]);
  for (const [id, span, angle, pos] of [
    ['rear', width, Math.PI, [0, 0, -depth / 2]],
    ['left', porch ? depth - 0.95 : depth, -Math.PI / 2, [-width / 2, 0, porch ? -0.475 : 0]],
    ['right', porch ? depth - 0.95 : depth, Math.PI / 2, [width / 2, 0, porch ? -0.475 : 0]],
  ]) {
    if (partyWalls.includes(id)) faces.push({ id, span, angle, position: pos, openings: [] });
    else makeFace(id, span, 0, angle, pos);
  }
  const doorX = openings.find(o => o.face === 'front' && o.floor === 0 && o.kind === 'door').x;
  const inputs = { seed, family: family.id, width, depth, floors, floorHeight, palette, planting, plantSeed, door, partyWalls, windowStyle, roof, layout, wallFinish, finishSeed };
  return {
    version: HOUSE_VERSION, ...inputs, inputs, base, bays, balcony, porch,
    crest: family.id === 'casa-remate', faces, openings,
    footprint: { width, depth },
    envelope: { min: [-width / 2 - 1.1, 0, -depth / 2 - 0.9], max: [width / 2 + 1.1, base + floors * floorHeight + 1.5, depth / 2 + 1.7] },
    entrance: { x: doorX, z: depth / 2, width: 1.95, depth: 1.3 },
  };
}

// Import only canonical resolved recipes; unknown versions cannot silently drift.
export function readHouseSpec(data) {
  if (data?.version === 1 && data.inputs) return createHouseSpec({ ...data.inputs, windowStyle: 'reja', roof: 'tejas', layout: 'clasica', wallFinish: 'lisa', finishSeed: data.inputs.seed });
  if (data?.version === 2 && data.inputs) {
    const migrated = createHouseSpec({ ...data.inputs, wallFinish: 'lisa', finishSeed: data.inputs.seed });
    const previous = { ...migrated, version: 2, inputs: { ...migrated.inputs } };
    for (const key of ['wallFinish', 'finishSeed']) { delete previous[key]; delete previous.inputs[key]; }
    if (JSON.stringify(previous) !== JSON.stringify(data)) throw new RangeError('House recipe does not match its inputs');
    return migrated;
  }
  if (!data || data.version !== HOUSE_VERSION || !data.inputs) throw new RangeError('Unsupported house recipe');
  const canonical = createHouseSpec(data.inputs);
  if (JSON.stringify(canonical) !== JSON.stringify(data)) throw new RangeError('House recipe does not match its inputs');
  return canonical;
}

export function rerollHouse(spec, seed, locks = {}) {
  const current = readHouseSpec(spec), next = { seed };
  if (locks.structure) Object.assign(next, Object.fromEntries(['family', 'width', 'depth', 'floors', 'floorHeight', 'door', 'partyWalls', 'windowStyle', 'roof', 'layout'].map(k => [k, current[k]])));
  if (locks.palette) next.palette = current.palette;
  if (locks.finish) { next.wallFinish = current.wallFinish; next.finishSeed = current.finishSeed; }
  if (locks.planting) { next.planting = current.planting; next.plantSeed = current.plantSeed; }
  else next.planting = choose(HOUSE_PLANTING.filter(v => v.id !== 'ninguna'), houseRandom(seed, 'planting')).id;
  return createHouseSpec(next);
}

export function createHouseBatch(seed = 1, count = 50) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('seed: 0–4294967295');
  number(count, 1, 50, 'count');
  if (!Number.isInteger(count)) throw new RangeError('count must be an integer');
  // Deliberately cover the architectural choices before repeating a combination.
  const specs = [];
  for (let i = 0; i < count; i++) {
    const family = HOUSE_FAMILIES[i % HOUSE_FAMILIES.length];
    specs.push(createHouseSpec({ seed: (seed + i * 7919) >>> 0, family: family.id,
      windowStyle: HOUSE_WINDOWS[(Math.floor(i / 6) + i) % HOUSE_WINDOWS.length].id,
      roof: ROLLED_ROOFS[(Math.floor(i / 12) + i) % ROLLED_ROOFS.length].id,
      layout: HOUSE_LAYOUTS[Math.floor(i / 18) % HOUSE_LAYOUTS.length].id,
      floors: family.floors[Math.floor(i / 6) % family.floors.length],
      planting: HOUSE_PLANTING[i % HOUSE_PLANTING.length].id,
      wallFinish: HOUSE_FINISHES[(i + Math.floor(i / 6)) % HOUSE_FINISHES.length].id,
    }));
  }
  return specs;
}

export function readHouseBatch(data) {
  if (data?.type !== 'colonial-house-batch' || ![2, HOUSE_VERSION].includes(data.version) || !Array.isArray(data.houses) || !data.houses.length || data.houses.length > 50) throw new RangeError('Invalid house collection');
  return data.houses.map(readHouseSpec);
}

export function saveHouseBatch(houses) {
  return { type: 'colonial-house-batch', version: HOUSE_VERSION, houses: readHouseBatch({ type: 'colonial-house-batch', version: HOUSE_VERSION, houses }) };
}
