import { ICONS, icon } from '/engine/icons.js';
import { applyWardrobe } from '/engine/models/characters/pana/wardrobe-look.js';
import * as ae from 'three';
import { OrbitControls as _o } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment as fo } from 'three/addons/environments/RoomEnvironment.js';
import { buildSoftCharacter as so } from '/engine/models/characters/pana/model.js';
import { createAccessories as lo } from '/engine/models/characters/pana/accessories.js';
import { FUR_CHOICES as Nt, COLOR_CHOICES as Gt, COLOR_LABELS as Yo, WARDROBE as ge, wardrobeItem as Ft, wardrobeMeta as Le, DEFAULT_WARDROBE as ut, cloneWardrobe as we, wardrobeColor as pt, normalizeWardrobe } from '/engine/wardrobe.js';
import { loadAvatar, saveAvatar, loadName, avatarToWardrobe, wardrobeToAvatar } from '/engine/avatar.js';
const dt = look => normalizeWardrobe(look, { history: true });
// Hosted Pana supplies ownership and account persistence; local Pana is free.
const account = window.PanaWardrobe;
if (account) {
  document.body.classList.add('hosted-wardrobe');
  try { await account.ready; }
  catch { document.getElementById('loading').textContent = 'No pudimos cargar tus artículos. Recarga para intentar otra vez.'; throw new Error('Wardrobe account unavailable'); }
}
// Ownership: a paid piece the account does not own shows locked and is never equipped here (the gateway rejects it on save too).
const LOCK = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><rect x="4" y="10" width="16" height="12" rx="3" fill="currentColor"/></svg>';
const lockBadge = lock => `<span class="lock">${LOCK}${lock ? `<b>${lock.price}</b>${ICONS.mango}` : ''}</span>`;
const lockOf = (slot, value) => (account?.locked && value !== undefined ? account.locked(slot, value) : null);
const SLOTS = ['hat', 'glasses', 'face', 'top', 'print', 'neck', 'back'];
const lockedIn = look => [...SLOTS.map(s => lockOf(s, look[s])), ...Object.keys(look.extras || {}).filter(k => look.extras[k]).map(k => lockOf('extras', k))].filter(Boolean);
function unlocked(look) {
  if (!account?.locked) return look;
  const r = we(look);
  for (const s of SLOTS) if (lockOf(s, r[s])) r[s] = ut[s];
  for (const k of Object.keys(r.extras || {})) if (r.extras[k] && lockOf('extras', k)) r.extras[k] = false;
  return r;
}
var Ht = [
    {
      id: "pelaje",
      label: "Pelaje",
      view: "body",
      icon: 'wardrobe-pelaje',
    },
    {
      id: "cara",
      label: "Cara",
      view: "face",
      icon: 'wardrobe-cara',
    },
    {
      id: "cabeza",
      label: "Cabeza",
      view: "head",
      icon: 'wardrobe-cabeza',
    },
    {
      id: "lentes",
      label: "Lentes",
      view: "face",
      icon: 'wardrobe-lentes',
    },
    {
      id: "ropa",
      label: "Ropa",
      view: "chest",
      icon: 'wardrobe-ropa',
    },
    {
      id: "cuello",
      label: "Cuello",
      view: "chest",
      icon: 'wardrobe-cuello',
    },
    {
      id: "espalda",
      label: "Espalda",
      view: "back",
      icon: 'wardrobe-espalda',
    },
  ],
  Zo = e => ICONS[e];
const draftKey = 'pana:wardrobe-draft:' + (account?.draftKey || 'local');
let savedBaseline = JSON.stringify(loadAvatar());
function initialLook() {
  const current = avatarToWardrobe(loadAvatar(), loadName());
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey));
    if (draft?.baseline === savedBaseline) return dt(unlocked(dt(draft.look)));
  } catch { /* A disabled session store leaves the saved avatar intact. */ }
  return dt(unlocked(current));
}
var X = initialLook(),
  Ve = [we(X)],
  Ie = 0,
  xt = [
    ["Original", {}],
    [
      "Piloto",
      {
        hat: "casco",
        top: "sport",
        wrist: !0,
        neck: "medalla",
        face: "smile",
        colors: { "top:sport:main": "#ff4b4b" },
      },
    ],
    [
      "Llanero",
      {
        hat: "llanero",
        top: "shirt",
        neck: "bandana",
        extras: { bigote: !0 },
        colors: { "top:shirt:main": "#f3e9d7" },
      },
    ],
    [
      "Playero",
      {
        hat: "pesca",
        top: "tropical",
        glasses: "sun",
        neck: "collar",
        face: "smile",
        colors: { "top:tropical:main": "#2ad1b2" },
      },
    ],
    [
      "Rey",
      {
        hat: "corona",
        top: "shirt",
        neck: "cadena",
        back: "capa",
        colors: { "top:shirt:main": "#8e4de8" },
      },
    ],
    [
      "Rockero",
      {
        hat: "audifonos",
        glasses: "cuadrados",
        top: "hoodie",
        print: "rayo",
        colors: {
          "top:hoodie:main": "#2b2d42",
          "hat:audifonos:main": "#ff4b4b",
        },
      },
    ],
    [
      "Fiesta",
      {
        hat: "fiesta",
        glasses: "estrella",
        top: "shirt",
        print: "estrella",
        neck: "corbatin",
        face: "laugh",
        extras: { mejillas: !0 },
        colors: {
          "top:shirt:main": "#2ad1b2",
          "print:estrella:main": "#ffc629",
        },
      },
    ],
    [
      "Explorador",
      {
        hat: "pesca",
        glasses: "piloto",
        top: "shirt",
        back: "mochila",
        neck: "bufanda",
        colors: {
          "top:shirt:main": "#5fc93a",
          "hat:pesca:main": "#b9a06a",
          "back:mochila:main": "#ff8a1f",
        },
      },
    ],
    [
      "Superpana",
      {
        glasses: "visor",
        top: "sport",
        print: "estrella",
        back: "capa",
        colors: {
          "top:sport:main": "#3d7bf2",
          "print:estrella:main": "#ff4b4b",
        },
      },
    ],
    [
      "Abuelo",
      {
        hat: "boina",
        glasses: "cuadrados",
        top: "hoodie",
        neck: "bufanda",
        extras: { bigote: !0 },
        colors: {
          "top:hoodie:main": "#8a5a32",
          "hat:boina:main": "#2b2d42",
          "neck:bufanda:main": "#ff4b4b",
        },
      },
    ],
    [
      "Guacamaya",
      {
        hat: "orquidea",
        top: "tropical",
        back: "alas",
        face: "smile",
        extras: { mejillas: !0 },
        colors: { "top:tropical:main": "#ffc629" },
      },
    ],
    [
      "Astronauta",
      {
        hat: "casco",
        top: "base",
        back: "cohete",
        neck: "medalla",
        colors: { "hat:casco:main": "#f3e9d7", "hat:casco:stripe": "#3d7bf2" },
      },
    ],
  ],
  bt = (e) =>
    dt({
      ...we(ut),
      ...we(e),
      name: X.name,
      fur: X.fur,
      extras: { ...ut.extras, ...(e.extras || {}) },
    }),
  gt = document.getElementById("stage"),
  Ne = new ae.WebGLRenderer({ antialias: !0, alpha: !0 });
Ne.setPixelRatio(Math.min(devicePixelRatio, 2));
Ne.toneMapping = ae.ACESFilmicToneMapping;
Ne.toneMappingExposure = 1.05;
Ne.shadowMap.enabled = !0;
Ne.shadowMap.type = ae.PCFShadowMap;
gt.prepend(Ne.domElement);
var Ce = new ae.Scene(),
  Jo = new ae.PMREMGenerator(Ne);
const roomEnvironment = new fo();
const environment = Jo.fromScene(roomEnvironment, 0.04);
Ce.environment = environment.texture; roomEnvironment.dispose(); Jo.dispose();
Ce.environmentIntensity = 0.55;
Ce.add(new ae.HemisphereLight("#fff0d6", "#d9a066", 1));
var st = new ae.DirectionalLight("#fff1dc", 2.3);
st.position.set(3.5, 7, 5);
st.castShadow = !0;
st.shadow.mapSize.set(2048, 2048);
Object.assign(st.shadow.camera, {
  left: -3,
  right: 3,
  top: 4.5,
  bottom: -1,
  near: 1,
  far: 20,
});
st.shadow.bias = -5e-4;
st.shadow.normalBias = 0.02;
Ce.add(st);
var mo = new ae.DirectionalLight("#cfe0ff", 1.1);
mo.position.set(-4, 4, -5);
Ce.add(mo);
var Eo = new ae.DirectionalLight("#ffd2b0", 0.5);
Eo.position.set(-4, 2, 4);
Ce.add(Eo);
var tt = new ae.Group();
Ce.add(tt);
{
  let e = new ae.Mesh(
    new ae.CylinderGeometry(1.7, 1.8, 0.28, 72),
    new ae.MeshStandardMaterial({ color: "#e39a52", roughness: 0.7 }),
  );
  ((e.position.y = -0.14), (e.receiveShadow = !0), tt.add(e));
  let t = new ae.Mesh(
    new ae.TorusGeometry(1.72, 0.055, 16, 120),
    new ae.MeshStandardMaterial({
      color: "#ffc629",
      roughness: 0.3,
      metalness: 0.4,
      emissive: "#5a3c00",
    }),
  );
  ((t.rotation.x = Math.PI / 2), (t.position.y = 0), tt.add(t));
  let n = new ae.Mesh(
    new ae.CircleGeometry(1.66, 72),
    new ae.ShadowMaterial({ opacity: 0.35 }),
  );
  ((n.rotation.x = -Math.PI / 2),
    (n.position.y = 0.002),
    (n.receiveShadow = !0),
    tt.add(n));
}
var Ue = new ae.PerspectiveCamera(30, 1, 0.1, 100),
  ve = new _o(Ue, Ne.domElement);
ve.enableDamping = !0;
ve.enablePan = !1;
ve.minDistance = 2.2;
ve.maxDistance = 12;
ve.maxPolarAngle = Math.PI * 0.6;
ve.autoRotateSpeed = 2;
var ho = 168,
  ot = new ae.WebGLRenderer({
    antialias: !0,
    alpha: !0,
    preserveDrawingBuffer: !0,
  });
ot.setSize(ho, ho);
ot.setPixelRatio(1);
ot.toneMapping = ae.ACESFilmicToneMapping;
ot.toneMappingExposure = 1.05;
function thumbnailEnvironment() {
  const generator = new ae.PMREMGenerator(ot), room = new fo();
  const target = generator.fromScene(room, .04); room.dispose(); generator.dispose();
  return target;
}
var zt = new ae.PerspectiveCamera(30, 1, 0.1, 100),
  Qo = thumbnailEnvironment(),
  bo = {
    body: { pos: [2.8, 3, 10.8], target: [0, 1.8, 0] },
    head: { pos: [2.4, 3.7, 8.4], target: [0, 2.75, 0] },
    face: { pos: [1.9, 3.15, 7.2], target: [0, 2.6, 0] },
    chest: { pos: [1.9, 2.4, 7], target: [0, 1.75, 0] },
    back: { pos: [-4, 2.9, -7.6], target: [0, 1.65, 0] },
  },
  Ko = {
    body: { pos: [1.7, 2.3, 7.4], target: [0, 1.72, 0] },
    head: { pos: [1.4, 3.4, 4.6], target: [0, 2.92, 0] },
    face: { pos: [0.75, 2.85, 3.75], target: [0, 2.66, 0] },
    chest: { pos: [0.95, 2, 3.9], target: [0, 1.66, 0] },
    back: { pos: [-2.4, 2.25, -4.6], target: [0, 1.5, 0] },
  },
  Te = null,
  ze = null,
  De = null;
function go(e) {
  (Te && (Ce.remove(Te.group), ze.dispose(), Te.dispose()),
    (Te = so({ quality: "studio", furColor: e })),
    Te.group.traverse((t) => {
      t.isMesh && (t.castShadow = !0);
    }),
    Ce.add(Te.group),
    (ze = lo(Te)),
    (De = { fur: e, top: null, print: null, face: null }));
}
function Bt(e) {
  if (!Te || De.fur !== e.fur) go(e.fur);
  applyWardrobe(Te, ze, e, De);
}
var Mo = X;
function qe(e) {
  ((Mo = e), Bt(e));
}
var ft = new Map(),
  Rt = [];
function wo(e, t, n) {
  let r = we(e);
  if (t === "extras") r.extras[n] = !0;
  else {
    if (t === "preset") return bt(xt[n][1]);
    r[
      {
        hat: "hat",
        glasses: "glasses",
        face: "face",
        top: "top",
        print: "print",
        neck: "neck",
        back: "back",
      }[t]
    ] = n;
  }
  return (
    (t === "hat" || t === "glasses" || t === "face" || t === "extras") &&
      (r.neck = e.neck),
    r
  );
}
function en(e, t) {
  let n = Mo,
    r = tt.visible;
  (Bt(t),
    Te.update(1e-4, { pose: "idle", manualArms: !1 }),
    t.face !== n.face && Te.setExpression(t.face, { immediate: !0 }),
    ze.update(It.getElapsed()));
  let c = Ko[e];
  (zt.position.set(...c.pos), zt.lookAt(...c.target));
  let s = Ce.environment;
  ((Ce.environment = Qo.texture), (tt.visible = !1), ot.render(Ce, zt));
  let f = ot.domElement.toDataURL("image/png");
  return (
    (tt.visible = r),
    (Ce.environment = s),
    Bt(n),
    t.face !== n.face && Te.setExpression(n.face, { immediate: !0 }),
    f
  );
}
function yo(e, t, n, r) {
  let c = n === "preset" ? bt(xt[r][1]) : wo(X, n, r),
    s = t + JSON.stringify(c);
  if (((e.dataset.key = s), ft.has(s))) {
    ((e.src = ft.get(s)), e.classList.add("ready"));
    return;
  }
  (e.classList.remove("ready"), Rt.push({ img: e, view: t, s: c, k: s }));
}
function tn() {
  let e = performance.now();
  for (; Rt.length && performance.now() - e < 24;) {
    let t = Rt.shift();
    !t.img.isConnected ||
      t.img.dataset.key !== t.k ||
      (ft.has(t.k) || ft.set(t.k, en(t.view, t.s)), ft.size > 180 && ft.delete(ft.keys().next().value),
      (t.img.src = ft.get(t.k)),
      t.img.classList.add("ready"));
  }
}
var le = (e) => document.getElementById(e),
  Be = "cabeza",
  To = "idle",
  Ot = () => Ht.find((e) => e.id === Be).view;
function Re(e) {
  ((X = dt(unlocked(e))),
    Ve.splice(Ie + 1),
    Ve.push(we(X)),
    (Ie = Ve.length - 1),
    Ve.length > 60 && (Ve.shift(), Ie--),
    qe(X),
    at(),
    Mt());
}
function Mt() {
  try {
    sessionStorage.setItem(draftKey, JSON.stringify({ baseline: savedBaseline, look: X }));
  } catch {}
}
function Ro(e, t, n, r = {}) {
  let c = document.createElement("button");
  ((c.type = "button"), (c.className = "tile"));
  c.dataset.slot = e; c.dataset.item = t;
  let s = r.selected ?? (e === "extras" ? X.extras[t] : X[e] === t);
  (c.setAttribute("aria-pressed", String(!!s)),
    r.disabled && ((c.disabled = !0), (c.title = r.disabled)));
  let lk = e === "preset" ? null : lockOf(e, t), pl = e === "preset" ? lockedIn(bt(xt[t][1])) : [], f = lk ? null : Le(e === "preset" ? "x" : e, t).badge;
  return (
    (c.innerHTML = `<span class="thumb"><img alt=""><span class="spin" aria-hidden="true"></span></span><span class="tlabel">${n}</span>${lk ? lockBadge(lk) : pl.length ? lockBadge(null) : f ? `<span class="badge ${f === "Nuevo" ? "new" : "up"}">${f}</span>` : ""}${e === "extras" ? '<span class="check" aria-hidden="true"></span>' : ""}`),
    lk && (c.classList.add("locked"), c.title = lk.name + " \u00B7 " + lk.price + " mangos", c.setAttribute("aria-label", n + ", " + lk.price + " mangos")),
    pl.length && (c.classList.add("partlock"), c.title = pl.map(p => p.name).join(", ") + " \u00B7 bloqueado"),
    yo(c.querySelector("img"), r.view || Ot(), e, t),
    (c.onclick =
      r.onClick ||
      (() => {
        if (lk) return void (location.href = lk.href);
        let b = we(X);
        (e === "extras" ? (b.extras[t] = !b.extras[t]) : (b[e] = t),
          e === "top" &&
            t === "chef" &&
            b.print !== "none" &&
            (b.print = "none"),
          Re(b));
      })),
    (c.onpointerenter = (b) => {
      b.pointerType === "mouse" &&
        !c.disabled &&
        qe(r.preview ? r.preview() : wo(X, e, t));
    }),
    (c.onpointerleave = (b) => {
      b.pointerType === "mouse" && qe(X);
    }),
    c
  );
}
function Ye(e, t, n, r = {}) {
  let c = document.createElement("section");
  ((c.className = "block"),
    (c.innerHTML = `<h3>${e}</h3>`));
  let s = document.createElement("div");
  s.className = "grid";
  for (let [f, b] of n)
    s.appendChild(Ro(t, f, b, { view: r.view, disabled: r.disabled?.(f) }));
  return (c.appendChild(s), c);
}
function et(e, t, n, r) {
  let c = document.createElement("div");
  c.className = "colors";
  for (let s of n) {
    let f = pt(X, e, t, s),
      b = document.createElement("div");
    b.className = "crow";
    let w =
      Gt.find((E) => E[0] === f)?.[1] ||
      (f === Le(e, t).slots?.[s] ? "Original" : "A tu gusto");
    b.innerHTML = `<span class="clabel">${r || ""}${r ? " \xB7 " : ""}${Yo[s]} <b>${w}</b></span><div class="swatches"></div>`;
    let H = b.querySelector(".swatches");
    for (let [E, I] of Gt) {
      let l = document.createElement("button");
      ((l.type = "button"),
        (l.className = "sw"),
        l.style.setProperty("--c", E),
        (l.title = I),
        l.setAttribute("aria-label", I),
        l.setAttribute("aria-pressed", String(f === E)),
        (l.onclick = () => {
          let C = we(X);
          ((C.colors[`${e}:${t}:${s}`] = E), Re(C));
        }),
        (l.onpointerenter = (C) => {
          if (C.pointerType === "mouse") {
            let v = we(X);
            ((v.colors[`${e}:${t}:${s}`] = E), qe(dt(v)));
          }
        }),
        (l.onpointerleave = (C) => {
          C.pointerType === "mouse" && qe(X);
        }),
        H.appendChild(l));
    }
    let k = document.createElement("label");
    ((k.className = "sw custom"),
      (k.title = "Elegir otro color"),
      (k.innerHTML = `<input type="color" value="${f}" aria-label="Elegir otro color">`));
    let m = k.querySelector("input");
    ((m.oninput = () => {
      let E = we(X);
      ((E.colors[`${e}:${t}:${s}`] = m.value), qe(dt(E)));
    }),
      (m.onchange = () => {
        let E = we(X);
        ((E.colors[`${e}:${t}:${s}`] = m.value), Re(E));
      }),
      H.appendChild(k),
      c.appendChild(b));
  }
  return c;
}
var Ge = (e, t) => Object.keys(Le(e, t).slots || {});
function on() {
  document.getElementById("tabbody").setAttribute("aria-labelledby", "tab-" + Be);
  let e = le("tabbody");
  e.innerHTML = "";
  let t = (n) => e.appendChild(n);
  if (Be === "pelaje") {
    let n = document.createElement("section");
    ((n.className = "block"),
      (n.innerHTML =
        '<h3>Color del pelaje</h3><div class="furs"></div>'));
    let r = n.querySelector(".furs");
    for (let [c, s] of Nt) {
      let f = document.createElement("button");
      ((f.type = "button"),
        (f.className = "fur"),
        f.style.setProperty("--c", c),
        f.setAttribute("aria-pressed", String(X.fur === c)),
        (f.innerHTML = `<span class="dot"></span><span>${s}</span>`),
        (f.onclick = () => {
          X.fur !== c &&
            (po(!0),
            setTimeout(() => {
              (Re({ ...X, fur: c }), ft.clear(), po(!1));
            }, 30));
        }),
        r.appendChild(f));
    }
    t(n);
  }
  if (Be === "cara") {
    (t(Ye("Expresi\xF3n", "face", ge.face)),
      t(
        Ye("Detalles", "extras", ge.extras),
      ));
    let n = ge.extras.filter(([r]) => X.extras[r] && Ge("extras", r).length);
    for (let [r, c] of n) t(et("extras", r, Ge("extras", r), c));
  }
  if (
    (Be === "cabeza" &&
      (t(Ye("Gorros y sombreros", "hat", ge.hat)),
      Ge("hat", X.hat).length && t(et("hat", X.hat, Ge("hat", X.hat)))),
    Be === "lentes" &&
      (t(Ye("Lentes", "glasses", ge.glasses)),
      Ge("glasses", X.glasses).length &&
        t(et("glasses", X.glasses, Ge("glasses", X.glasses)))),
    Be === "ropa")
  ) {
    (t(Ye("Camisa", "top", ge.top)),
      Ge("top", X.top).length && t(et("top", X.top, ["main"])),
      t(
        Ye("Estampado", "print", ge.print, {
          disabled: (r) =>
            X.top === "chef" && r !== "none"
              ? "El delantal de chef no lleva estampado"
              : null,
        }),
      ),
      Ge("print", X.print).length && t(et("print", X.print, ["main"])));
    let n = document.createElement("label");
    ((n.className = "toggle"),
      (n.innerHTML = `<input type="checkbox" id="wrist" ${X.wrist ? "checked" : ""}><span class="knob" aria-hidden="true"></span><span>Mu\xF1equeras</span>`),
      (n.querySelector("input").onchange = (r) =>
        Re({ ...X, wrist: r.target.checked })),
      t(n));
  }
  (Be === "cuello" &&
    (t(Ye("Cuello", "neck", ge.neck)),
    Ge("neck", X.neck).length && t(et("neck", X.neck, Ge("neck", X.neck)))),
    Be === "espalda" &&
      (t(
        Ye("Espalda", "back", ge.back),
      ),
      Ge("back", X.back).length && t(et("back", X.back, Ge("back", X.back)))));
}
function nn() {
  let e = le("tabs");
  e.innerHTML = "";
  for (let t of Ht) {
    let n = document.createElement("button");
    ((n.type = "button"),
      (n.className = "tab"),
      n.setAttribute("role", "tab"),
      n.setAttribute("aria-controls", "tabbody"),
      (n.id = "tab-" + t.id),
      (n.tabIndex = t.id === Be ? 0 : -1),
      n.setAttribute("aria-selected", String(t.id === Be)));
    let r = {
      cabeza: X.hat !== "none",
      lentes: X.glasses !== "none",
      cuello: X.neck !== "none",
      espalda: X.back !== "none",
      cara: Object.values(X.extras).some(Boolean),
      ropa: X.print !== "none" || X.wrist,
    }[t.id];
    ((n.innerHTML = `${Zo(t.icon)}<span>${t.label}</span>${r ? '<i class="dotmark" aria-hidden="true"></i>' : ""}`),
      (n.onclick = () => {
        ((Be = t.id), at(), mt(t.view), (le("tabbody").scrollTop = 0));
      }),
      e.appendChild(n));
  }
}
function sn() {
  let e = X,
    t = [],
    n = (c, s) => Ft(c, s)?.[1];
  (t.push(["pelaje", `Pelaje ${Nt.find((c) => c[0] === e.fur)[1]}`, null]),
    t.push([
      "ropa",
      n("top", e.top) +
        (e.print !== "none" ? ` con ${n("print", e.print).toLowerCase()}` : ""),
      null,
    ]),
    e.hat !== "none" &&
      t.push(["cabeza", n("hat", e.hat), () => Re({ ...e, hat: "none" })]),
    e.glasses !== "none" &&
      t.push([
        "lentes",
        n("glasses", e.glasses),
        () => Re({ ...e, glasses: "none" }),
      ]));
  for (let [c, s] of ge.extras)
    e.extras[c] &&
      t.push(["cara", s, () => Re({ ...e, extras: { ...e.extras, [c]: !1 } })]);
  (e.neck !== "none" &&
    t.push(["cuello", n("neck", e.neck), () => Re({ ...e, neck: "none" })]),
    e.back !== "none" &&
      t.push(["espalda", n("back", e.back), () => Re({ ...e, back: "none" })]),
    e.wrist &&
      t.push(["ropa", "Mu\xF1equeras", () => Re({ ...e, wrist: !1 })]));
  let r = le("chips");
  r.innerHTML = "";
  for (let [c, s, f] of t) {
    let b = document.createElement("span");
    b.className = "chip";
    let w = document.createElement("button");
    if (
      ((w.type = "button"),
      (w.textContent = s),
      (w.onclick = () => {
        ((Be = c), at(), mt(Ht.find((H) => H.id === c).view));
      }),
      b.appendChild(w),
      f)
    ) {
      let H = document.createElement("button");
      ((H.type = "button"),
        (H.className = "x"),
        H.setAttribute("aria-label", `Quitar ${s}`),
        (H.innerHTML = ICONS.close),
        (H.onclick = f),
        b.appendChild(H));
    }
    r.appendChild(b);
  }
  ((le("undo").disabled = Ie === 0),
    (le("redo").disabled = Ie >= Ve.length - 1));
}
function an() {
  let e = le("presets");
  if (e.childElementCount) {
    e.querySelectorAll("img").forEach((t, n) => yo(t, "body", "preset", n));
    return;
  }
  xt.forEach(([t, n], r) => {
    let c = Ro("preset", r, t, {
      view: "body",
      selected: !1,
      onClick: () => {
        (Re(bt(n)), mt("body"), lockedIn(bt(n)).length && nt("Sin " + lockedIn(bt(n)).map(p => p.name).join(", ") + " \u00B7 en la tienda"));
      },
      preview: () => bt(n),
    });
    (c.classList.add("preset"), e.appendChild(c));
  });
}
function at() {
  Rt.length = 0;
  account?.describe(X, document.getElementById("wardrobe-store"));
  (nn(),
    on(),
    sn(),
    an(),
    (le("nametag").textContent = X.name || "pana"),
    (le("name").value = X.name));
}
le("undo").onclick = () => {
  Ie > 0 && (Ie--, (X = we(Ve[Ie])), qe(X), at(), Mt());
};
le("redo").onclick = () => {
  Ie < Ve.length - 1 && (Ie++, (X = we(Ve[Ie])), qe(X), at(), Mt());
};
var Ze = (e) => e[Math.floor(Math.random() * e.length)];
const pick = (slot, list, none) => { const free = list.filter(([v]) => !lockOf(slot, v)); return free.length ? Ze(free)[0] : none; };
le("random").onclick = () => {
  let e = we(ut);
  e.name = X.name; e.fur = X.fur;
  e.hat = Math.random() < 0.8 ? pick("hat", ge.hat.slice(1), "none") : "none";
  e.glasses = Math.random() < 0.6 ? pick("glasses", ge.glasses.slice(1), "none") : "none";
  e.top = pick("top", ge.top.slice(0, 5), ut.top);
  e.print = e.top !== "chef" && Math.random() < 0.5 ? pick("print", ge.print.slice(1), "none") : "none";
  e.neck = Math.random() < 0.55 ? pick("neck", ge.neck.slice(1), "none") : "none";
  e.back = Math.random() < 0.4 ? pick("back", ge.back.slice(1), "none") : "none";
  e.face = pick("face", ge.face, ut.face);
  for (let [n] of ge.extras) e.extras[n] = Math.random() < 0.18 && !lockOf("extras", n);
  e.wrist = Math.random() < 0.25;
  let t = () => Ze(Gt)[0];
  e.colors[`top:${e.top}:main`] = t();
  e.colors[`hat:${e.hat}:main`] = t();
  e.colors[`neck:${e.neck}:main`] = t();
  e.colors[`back:${e.back}:main`] = t();
  e.colors[`print:${e.print}:main`] = t();
  Re(e);
};
le("reset").onclick = () => Re({ ...we(ut), name: X.name });
le("name").oninput = (e) => {
  ((X.name = e.target.value.slice(0, 16)),
    (le("nametag").textContent = X.name || "pana"),
    (Ve[Ie] = we(X)),
    Mt());
};
var nt = (e) => {
    let t = le("toast");
    ((t.textContent = e),
      t.classList.add("on"),
      clearTimeout(nt.t),
      (nt.t = setTimeout(() => t.classList.remove("on"), 2600)));
  },
  Ho = () => "PANA2-" + btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(X))));
le("save").onclick = async () => {
  const button = le('save'); button.disabled = true; button.textContent = 'Guardando…';
  try {
    const avatar = wardrobeToAvatar(X), name = X.name.trim() || 'pana';
    if (account) await account.save(avatar, name);
    if (!saveAvatar(avatar)) throw new Error('El navegador no permitió guardar. Activa el almacenamiento local.');
    localStorage.setItem('pana:name', name);
    savedBaseline = JSON.stringify(avatar);
    Mt();
    window.dispatchEvent(new CustomEvent('pana:avatar', { detail: avatar }));
    try {
      const { portrait } = await import('/engine/portrait.js');
      await portrait(avatar, { current: true });
    } catch { /* The saved wardrobe remains usable if a portrait cannot render. */ }
    nt('Pana guardado. \u00A1A jugar!');
  } catch (error) { nt(error.message || 'No se pudo guardar. Intenta otra vez.'); }
  finally { button.disabled = false; button.textContent = 'Guardar para jugar'; }
};
le("copy").onclick = async () => {
  let e = Ho();
  le("codebox").value = e;
  try {
    (await navigator.clipboard.writeText(e),
      nt("C\xF3digo copiado."));
  } catch {
    (le("codebox").select(), nt("Selecciona el c\xF3digo y c\xF3pialo."));
  }
};
le("load").onclick = () => {
  try {
    let e = le("codebox")
      .value.trim()
      .replace(/^PANA2-/, "");
    const decoded = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(e), char => char.charCodeAt(0))));
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new Error('Invalid wardrobe');
    Re(dt(decoded)); nt("Pana cargado.");
  } catch {
    nt("Ese c\xF3digo no funciona. Revisa que est\xE9 completo.");
  }
};
le("openload").onclick = () => {
  let e = le("codepanel");
  ((e.hidden = !e.hidden),
    le("openload").setAttribute("aria-expanded", String(!e.hidden)),
    e.hidden || ((le("codebox").value = Ho()), le("codebox").select()));
};
document.querySelectorAll("[data-pose]").forEach(
  (e) =>
    (e.onclick = () => {
      ((To = e.dataset.pose),
        document
          .querySelectorAll("[data-pose]")
          .forEach((t) => t.setAttribute("aria-pressed", String(t === e))));
    }),
);
document
  .querySelectorAll("[data-view]")
  .forEach((e) => (e.onclick = () => mt(e.dataset.view)));
le("spin").onclick = () => {
  ((ve.autoRotate = !ve.autoRotate),
    le("spin").setAttribute("aria-pressed", String(ve.autoRotate)));
};
function po(e) {
  le("busy").hidden = !e;
}
var $e = null;
function mt(e) {
  let t = bo[e],
    n = Math.max(
      1,
      (gt.clientWidth < 600 ? 1.15 : 0.9) / Math.max(0.3, Ue.aspect),
    ),
    r = new ae.Vector3(...t.target),
    c = new ae.Vector3(...t.pos).sub(r).multiplyScalar(n);
  $e = {
    p0: Ue.position.clone(),
    t0: ve.target.clone(),
    p1: r.clone().add(c),
    t1: r,
    start: performance.now(),
    ms: matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 750,
  };
}
function xo() {
  let e = gt.clientWidth,
    t = gt.clientHeight;
  (Ne.setSize(e, t, !1),
    (Ne.domElement.style.width = e + "px"),
    (Ne.domElement.style.height = t + "px"),
    (Ue.aspect = e / t),
    Ue.updateProjectionMatrix());
}
const resizeObserver = new ResizeObserver(xo); resizeObserver.observe(gt);
let animationFrame, disposed = false;
var It = new ae.Timer().reset(),
  rn = matchMedia("(prefers-reduced-motion: reduce)").matches;
function ko() {
  if (disposed) return;
  let e = It.update().getDelta(),
    t = It.getElapsed();
  if ($e) {
    let n = Math.min(1, (performance.now() - $e.start) / $e.ms),
      r = 1 - Math.pow(1 - n, 3);
    (Ue.position.lerpVectors($e.p0, $e.p1, r),
      ve.target.lerpVectors($e.t0, $e.t1, r),
      n >= 1 && ($e = null));
  }
  (Te && (Te.update(rn ? 0 : e, { pose: To }), ze.update(rn ? 0 : t)),
    ve.update(),
    Ne.render(Ce, Ue),
    tn(),
    animationFrame = requestAnimationFrame(ko));
}
xo();
go(X.fur);
qe(X);
var Co = bo.body;
Ue.position.set(...Co.pos);
ve.target.set(...Co.target);
mt("body");
at();
le("loading").hidden = !0;
ko();
window.panaEditor = {
  get state() {
    return X;
  },
  commit: Re,
  refresh: at,
  setTab: (e) => {
    ((Be = e), at(), mt(Ht.find((t) => t.id === e).view));
  },
  queue: Rt,
  PRESETS: xt,
  presetState: bt,
  lock: lockOf,
  controls: ve,
  camera: Ue,
  get character() { return Te; },
  get accessories() { return ze; },
  renderer: Ne,
};
window.PANA_PREPARED = true;

document.querySelectorAll('[data-shared-icon]').forEach(host => host.append(icon(host.dataset.sharedIcon)));

document.getElementById('tabs').addEventListener('keydown', event => {
  const tabs = [...document.querySelectorAll('[role=tab]')], i = tabs.indexOf(document.activeElement);
  if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (i + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[index].click(); document.querySelectorAll('[role=tab]')[index].focus();
});

const selectedItem = new URLSearchParams(location.search);
const requestedSlot = selectedItem.get('slot'), requestedValue = selectedItem.get('item');
if (Ft(requestedSlot, requestedValue)) {
  const tab = { hat: 'cabeza', glasses: 'lentes', top: 'ropa', print: 'ropa', extras: 'cara', neck: 'cuello', back: 'espalda' }[requestedSlot], lock = lockOf(requestedSlot, requestedValue);
  if (lock) {
    // Not owned: it is tried on the pana (never equipped), with a way to the shop.
    const bar = le('trybar'); bar.hidden = false; bar.href = lock.href; bar.innerHTML = `<span>${lock.name}</span><b>${lock.price}</b>${ICONS.mango}`;
    qe(wo(X, requestedSlot, requestedValue));
  } else Re(requestedSlot === 'extras' ? { ...X, extras: { ...X.extras, [requestedValue]: true } } : { ...X, [requestedSlot]: requestedValue });
  if (tab) window.panaEditor.setTab(tab);
}

addEventListener('pagehide', event => {
  if (event.persisted) return;
  disposed = true; cancelAnimationFrame(animationFrame); resizeObserver.disconnect();
  ve.dispose(); ze?.dispose(); Te?.dispose();
  tt.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
  environment.dispose(); Qo.dispose(); Ne.dispose(); ot.dispose();
  ft.clear(); Rt.length = 0;
});
