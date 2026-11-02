// In-page HUD checks shared by the browser suites: which HUD pieces are on
// screen, whether two of them overlap, and whether one reads as a controls
// list (instructions belong to the pause menu's Instrucciones page).
//
//   const report = await page.evaluate(hudReport);
//   report.overlaps  → [['#score', '#timer', 1200], …]
//   report.lists     → ['#keys: "W A S D moverte · Espacio saltar"']
//   report.empties   → ['div.keys (180×240)']   a painted box with nothing in it

// Runs inside the page (page.evaluate(hudReport)); keep it self-contained.
export function hudReport() {
  const W = innerWidth, H = innerHeight;
  const label = el => el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}${[...el.classList].slice(0, 2).map(c => `.${c}`).join('')}`;
  const shown = el => el.checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true }) ?? true;
  const inline = el => /translate|left|top/.test(el.getAttribute?.('style') || '');
  // Transient or full-screen layers are not HUD pieces: toasts, shouts,
  // banners, the loading cover, menus, dialogs, results.
  const SKIP = 'dialog, canvas, .pk-cover, .pk-results, .pk-toast, .pana-toast, .pk-banner, .pk-pop, .pana-pad-cursor, [role=status], [role=alert], [aria-live], [data-hud-transient], .pana-menu, #pana-lobby-shell, .pk-lobby, .perf-overlay, #perf';
  const onScreen = r => r.width >= 4 && r.height >= 4 && r.right > 0 && r.bottom > 0 && r.left < W && r.top < H;
  // Labels pinned to the 3D world (name tags, station tags) move with the
  // camera through an inline position; they are scene, not HUD layout.
  const pinned = el => { for (let n = el; n && n !== document.body; n = n.parentElement) if (inline(n) && getComputedStyle(n).position !== 'static') return true; return false; };
  const paintsItself = (el, style) => (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') ||
    style.backgroundImage !== 'none' || parseFloat(style.borderTopWidth) > 0 || parseFloat(style.borderBottomWidth) > 0 || el.matches('img, svg, video, input, progress');
  // The boxes a piece really paints: its own box if it has a background or a
  // border, else its text and painting descendants. A transparent header
  // spanning the screen with buttons at both ends paints only the buttons.
  function painted(el, out = []) {
    if (!shown(el) || el.matches(SKIP)) return out;
    const style = getComputedStyle(el), r = el.getBoundingClientRect();
    if (inline(el) && style.position !== 'static') return out;   // a label pinned to the world
    if (paintsItself(el, style)) { if (onScreen(r)) out.push(r); return out; }
    for (const node of el.childNodes) {
      if (node.nodeType === 3 && node.textContent.trim()) {
        const range = document.createRange(); range.selectNodeContents(node);
        for (const t of range.getClientRects()) if (onScreen(t)) out.push(t);
      } else if (node.nodeType === 1) painted(node, out);
    }
    return out;
  }
  const pieces = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest(SKIP) || !shown(el)) continue;
    const style = getComputedStyle(el);
    if (style.position !== 'fixed' && style.position !== 'absolute') continue;
    if (pinned(el)) continue;
    const r = el.getBoundingClientRect();
    if (!onScreen(r) || r.width < 8 || r.height < 8) continue;
    // A layer that covers most of the screen is a stage, not a piece.
    if (paintsItself(el, style) && (r.width * r.height > W * H * .35 || (r.width > W * .9 && r.height > H * .5))) continue;
    pieces.push({ el, r });
  }
  // The outermost positioned piece of each nested group: a panel and its contents are one piece.
  const top = pieces.filter(p => !pieces.some(q => q !== p && q.el.contains(p.el))).map(p => ({ ...p, boxes: painted(p.el) })).filter(p => p.boxes.length);
  const overlaps = [];
  for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) {
    let area = 0;
    for (const a of top[i].boxes) for (const b of top[j].boxes) {
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 4 && h > 4) area += w * h;
    }
    if (area) overlaps.push([label(top[i].el), label(top[j].el), Math.round(area)]);
  }
  // A controls list: several key caps in one HUD piece, or controls phrasing.
  const LIST = /\bWASD\b|\bW\s?A\s?S\s?D\b|\b[Pp]ulsa\s+\S+\s+para\b|\b[Mm]antén\s+\S+\s+para\b|\b[Ss]ost[eé]n\s+\S+\s+para\b|\b[Aa]rrastra para\b|\b(?:Clic|Espacio|Shift|Flechas|Ratón)\b[^.·]{0,20}·[^.]{0,30}\b(?:Clic|Espacio|Shift|Flechas|Ratón|[A-Z])\b/;
  const lists = [];
  for (const { el } of top) {
    const caps = [...el.querySelectorAll('kbd')].filter(shown);
    const text = el.innerText.replace(/\s+/g, ' ').trim();
    if (caps.length >= 3 || LIST.test(text)) lists.push(`${label(el)}: "${text.slice(0, 80)}"`);
  }
  // An empty panel: a box that paints a background or a border but shows
  // nothing in it (no text, picture, canvas, control or painted child). These
  // are leftovers from removed content; hide them until they have something.
  const MEDIA = 'img, svg, canvas, video, input, select, textarea, progress, meter, [role=progressbar], [role=meter], [role=img], .pk-bar, .pk-pips, [class*=swatch]';  // a colour swatch is its own content
  const pseudo = (el, which) => { const c = getComputedStyle(el, which).content; return c && c !== 'none' && c !== 'normal' && c !== '""'; };
  const hasContent = el => !!el.innerText?.trim() || pseudo(el, '::before') || pseudo(el, '::after') || el.matches(MEDIA) ||
    [...el.querySelectorAll('*')].some(child => shown(child) && (child.matches(MEDIA) || getComputedStyle(child).backgroundImage !== 'none' ||
      pseudo(child, '::before') || pseudo(child, '::after') ||
      (paintsItself(child, getComputedStyle(child)) && child.getBoundingClientRect().width > 2 && child.getBoundingClientRect().height > 2)));
  const empties = [];
  for (const { el } of top) for (const node of [el, ...el.querySelectorAll('*')]) {
    if (!shown(node) || node.closest(SKIP) || (node !== el && pinned(node))) continue;
    const style = getComputedStyle(node), r = node.getBoundingClientRect();
    if (!onScreen(r) || r.width < 24 || r.height < 24 || r.width * r.height < 4000) continue;
    if (style.backgroundImage !== 'none' || !paintsItself(node, style) || node.matches(MEDIA)) continue;
    if (!hasContent(node)) empties.push(`${label(node)} (${Math.round(r.width)}×${Math.round(r.height)})`);
  }
  return { pieces: top.map(p => label(p.el)), overlaps, lists, empties };
}
