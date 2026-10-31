// Aiming down a sight or a scope: a 0..1 blend that eases in and out, the
// narrowed field of view, a slower look while zoomed, and the full-screen scope
// overlay (dark vignette, crosshair lines, a centre dot). The numbers are pure;
// only `createScopeOverlay` touches the DOM.
//
//   const scope = createScope({ zoom: 3.5 });
//   const t = scope.update(dt, aiming);                 // every frame
//   camera.fov = scope.fov(72);
//   look(yaw * scope.sensitivity(), pitch * scope.sensitivity());
//   overlay.set(scope.scoped ? t : 0);

// Field of view at blend t: magnification grows linearly from 1× to `zoom`×.
export const scopedFov = (base, zoom = 1, t = 0) => base / (1 + (Math.max(1, zoom) - 1) * Math.min(1, Math.max(0, t)));
// Look speed follows the view: at 4× zoom a mouse sweep turns a quarter as far.
export const lookScale = (zoom = 1, t = 0) => 1 / (1 + (Math.max(1, zoom) - 1) * Math.min(1, Math.max(0, t)));

// inTime / outTime: seconds to raise and lower the sight. `scopedAt` is the blend past
// which the view counts as "through the scope" (overlay up, held weapon hidden).
export function createScope({ zoom = 3.5, inTime = .2, outTime = .12, scopedAt = .7 } = {}) {
  let t = 0, level = zoom;
  return {
    update(dt, aiming) { t = Math.min(1, Math.max(0, t + (aiming ? dt / inTime : -dt / outTime))); return t; },
    // A weapon change may set a different zoom (a sniper scope vs iron sights).
    setZoom(value) { level = Math.max(1, value || 1); },
    get zoom() { return level; },
    get amount() { return t; },
    get scoped() { return level > 1.5 && t >= scopedAt; },
    fov: base => scopedFov(base, level, t),
    sensitivity: () => lookScale(level, t),
    reset() { t = 0; },
  };
}

// The scope picture over the canvas. `set(amount)` fades it (0 hides it).
export function createScopeOverlay(doc = document, { parent = doc.body, tint = '#ff3b3b' } = {}) {
  const root = doc.createElement('div');
  root.className = 'pk-scope'; root.setAttribute('aria-hidden', 'true');
  Object.assign(root.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2', opacity: '0', display: 'none',
    background: 'radial-gradient(circle at 50% 50%, transparent 0, transparent 36vmin, rgba(0,0,0,.55) 37vmin, rgba(4,6,8,.96) 38.5vmin)' });
  const line = (css) => { const el = doc.createElement('i'); Object.assign(el.style, { position: 'absolute', background: 'rgba(8,10,12,.9)', ...css }); root.append(el); return el; };
  // Thick posts from the rim, thin hairlines through the middle, a lit dot at the centre.
  line({ left: '50%', top: '12vmin', width: '.5vmin', height: 'calc(50% - 15vmin)', transform: 'translateX(-50%)' });
  line({ left: '50%', bottom: '12vmin', width: '.5vmin', height: 'calc(50% - 15vmin)', transform: 'translateX(-50%)' });
  line({ top: '50%', left: '12vmin', height: '.5vmin', width: 'calc(50% - 15vmin)', transform: 'translateY(-50%)' });
  line({ top: '50%', right: '12vmin', height: '.5vmin', width: 'calc(50% - 15vmin)', transform: 'translateY(-50%)' });
  line({ left: '50%', top: '50%', width: '1px', height: '36vmin', transform: 'translate(-50%, -50%)' });
  line({ left: '50%', top: '50%', height: '1px', width: '36vmin', transform: 'translate(-50%, -50%)' });
  line({ left: '50%', top: '50%', width: '.7vmin', height: '.7vmin', borderRadius: '50%', background: tint, boxShadow: `0 0 1vmin ${tint}`, transform: 'translate(-50%, -50%)' });
  parent.append(root);
  let shown = -1;
  return {
    element: root,
    set(amount = 0) {
      const a = Math.round(Math.min(1, Math.max(0, amount)) * 20) / 20; if (a === shown) return; shown = a;
      root.style.display = a > 0 ? 'block' : 'none'; root.style.opacity = String(a);
    },
    dispose() { root.remove(); },
  };
}
