var Nt = [
    ["#cf7d22", "Caramelo"],
    ["#d4914f", "Miel"],
    ["#e0a463", "Dorado"],
    ["#c47f42", "Canela"],
    ["#e8b97f", "Arena"],
    ["#b06d3b", "Tostado"],
    ["#9a6038", "Chocolate"],
  ],
  Gt = [
    ["#ff4b4b", "Coral"],
    ["#ee3024", "Rojo"],
    ["#ff8a1f", "Naranja"],
    ["#ffc629", "Amarillo"],
    ["#5fc93a", "Verde"],
    ["#2ad1b2", "Turquesa"],
    ["#3d7bf2", "Azul"],
    ["#8e4de8", "Morado"],
    ["#f15bb5", "Rosado"],
    ["#f3e9d7", "Crema"],
    ["#8a5a32", "Marr\xF3n"],
    ["#2b2d42", "Noche"],
  ],
  Yo = {
    main: "Color",
    accent: "Detalle",
    frame: "Marco",
    lens: "Lente",
    stripe: "Franja",
  },
  ge = {
    hat: [
      ["none", "Nada"],
      ["gorra", "Gorra", { repo: "cap", slots: { main: "#3479cb" } }],
      [
        "gorra-atras",
        "Gorra al rev\xE9s",
        { repo: "cap", slots: { main: "#3479cb" } },
      ],
      [
        "cinta",
        "Cinta deportiva",
        { repo: "band", slots: { main: "#ee3024" } },
      ],
      ["chef", "Gorro de chef", { repo: "chef", slots: { main: "#ee3024" } }],
      ["pesca", "Pescador", { badge: "Mejorado", slots: { main: "#e0c48f" } }],
      [
        "lana",
        "Gorro de lana",
        { badge: "Mejorado", slots: { main: "#ff4b4b" } },
      ],
      ["llanero", "Llanero", { badge: "Mejorado", slots: { main: "#8a5a32" } }],
      ["corona", "Corona", { badge: "Mejorado", slots: { main: "#b3122e" } }],
      [
        "casco",
        "Casco de kart",
        { badge: "Nuevo", slots: { main: "#ff4b4b", stripe: "#ffffff" } },
      ],
      [
        "audifonos",
        "Aud\xEDfonos",
        { badge: "Nuevo", slots: { main: "#2ad1b2" } },
      ],
      ["boina", "Boina", { badge: "Nuevo", slots: { main: "#c0262d" } }],
      [
        "copa",
        "Sombrero de copa",
        { badge: "Nuevo", slots: { main: "#2b2d42", accent: "#ff4b4b" } },
      ],
      [
        "fiesta",
        "Gorro de fiesta",
        { badge: "Nuevo", slots: { main: "#8e4de8" } },
      ],
      [
        "orquidea",
        "Flor de mayo",
        { badge: "Nuevo", slots: { main: "#d68ae8", accent: "#a1287f" } },
      ],
      ["lazo", "Lazo", { badge: "Nuevo", slots: { main: "#f15bb5" } }],
    ],
    glasses: [
      ["none", "Nada"],
      ["round", "Redondos", { repo: "round" }],
      ["sun", "De sol", { repo: "sun" }],
      ["aviador", "Aviador", { badge: "Nuevo", slots: { lens: "#3f6b8a" } }],
      [
        "cuadrados",
        "Cuadrados",
        { badge: "Nuevo", slots: { frame: "#1d1b26" } },
      ],
      [
        "corazon",
        "Coraz\xF3n",
        { badge: "Nuevo", slots: { frame: "#f15bb5", lens: "#ff7ac0" } },
      ],
      [
        "estrella",
        "Estrella",
        { badge: "Nuevo", slots: { frame: "#ffc629", lens: "#8e4de8" } },
      ],
      ["visor", "Visor", { badge: "Nuevo", slots: { lens: "#2ad1b2" } }],
      [
        "piloto",
        "Gafas de piloto",
        { badge: "Nuevo", slots: { lens: "#ffb347" } },
      ],
      ["tresd", "Lentes 3D", { badge: "Nuevo" }],
    ],
    face: [
      ["natural", "Tranquilo"],
      ["smile", "Feliz"],
      ["talk", "Hablando"],
      ["laugh", "Riendo"],
    ],
    extras: [
      ["mejillas", "Mejillas", { badge: "Nuevo", slots: { main: "#ff7f9c" } }],
      ["pecas", "Pecas", { badge: "Nuevo" }],
      ["bigote", "Bigote", { badge: "Nuevo", slots: { main: "#3b2414" } }],
      ["curita", "Curita", { badge: "Nuevo" }],
    ],
    top: [
      ["shirt", "Franela", { slots: { main: "#ee3024" } }],
      ["sport", "Deportiva", { slots: { main: "#ee3024" } }],
      ["hoodie", "Su\xE9ter", { slots: { main: "#3479cb" } }],
      ["tropical", "Camisa tropical", { slots: { main: "#3479cb" } }],
      ["chef", "Chef", { slots: { main: "#ee3024" } }],
      ["base", "Sin camisa"],
    ],
    print: [
      ["none", "Sin estampado"],
      ["estrella", "Estrella", { badge: "Nuevo", slots: { main: "#ffc629" } }],
      ["rayo", "Rayo", { badge: "Nuevo", slots: { main: "#ffc629" } }],
      ["corazon", "Coraz\xF3n", { badge: "Nuevo", slots: { main: "#ffc629" } }],
      ["sol", "Sol", { badge: "Nuevo", slots: { main: "#ffc629" } }],
      ["arepa", "Arepa", { badge: "Nuevo" }],
      ["tricolor", "Bandera", { badge: "Nuevo" }],
      ["numero", "N\xFAmero 7", { badge: "Nuevo", slots: { main: "#ff4b4b" } }],
    ],
    neck: [
      ["none", "Nada"],
      ["cadena", "Cadena", { badge: "Mejorado" }],
      [
        "bufanda",
        "Bufanda",
        { badge: "Nuevo", slots: { main: "#2ad1b2", accent: "#f3e9d7" } },
      ],
      [
        "corbatin",
        "Corbat\xEDn",
        { badge: "Nuevo", slots: { main: "#ff4b4b" } },
      ],
      ["collar", "Collar de flores", { badge: "Nuevo" }],
      ["bandana", "Pa\xF1uelo", { badge: "Nuevo", slots: { main: "#ff4b4b" } }],
      ["medalla", "Medalla", { badge: "Nuevo", slots: { main: "#3d7bf2" } }],
    ],
    back: [
      ["none", "Nada"],
      ["mochila", "Morral", { badge: "Nuevo", slots: { main: "#ffc629" } }],
      [
        "capa",
        "Capa",
        { badge: "Nuevo", slots: { main: "#b3122e", accent: "#ffc629" } },
      ],
      ["alas", "Alas de guacamaya", { badge: "Nuevo" }],
      ["cohete", "Cohete", { badge: "Nuevo", slots: { main: "#ff4b4b" } }],
      [
        "morrocoy",
        "Concha de morrocoy",
        { badge: "Nuevo", slots: { main: "#e8a33a" } },
      ],
    ],
  },
  Ft = (e, t) => Object.hasOwn(ge, e) ? ge[e].find((n) => n[0] === t) : undefined,
  Le = (e, t) => Ft(e, t)?.[2] || {},
  ut = {
    name: "pana",
    fur: "#cf7d22",
    face: "natural",
    extras: { mejillas: !1, pecas: !1, bigote: !1, curita: !1 },
    hat: "none",
    glasses: "none",
    top: "shirt",
    print: "none",
    wrist: !1,
    neck: "none",
    back: "none",
    colors: {},
  },
  we = (e) => JSON.parse(JSON.stringify(e)),
  pt = (e, t, n, r) => e.colors[`${t}:${n}:${r}`] || Le(t, n).slots?.[r];
function dt(e, { history = false } = {}) {
  let t = we(ut);
  if (!e || typeof e != "object") return t;
  (typeof e.name == "string" && (t.name = e.name.slice(0, 16)),
    Nt.some((n) => n[0] === e.fur) && (t.fur = e.fur));
  for (let [n, r] of [
    ["hat", "hat"],
    ["glasses", "glasses"],
    ["face", "face"],
    ["top", "top"],
    ["print", "print"],
    ["neck", "neck"],
    ["back", "back"],
  ])
    Ft(r, e[n]) && (t[n] = e[n]);
  if (((t.wrist = !!e.wrist), e.extras))
    for (let n of Object.keys(t.extras)) t.extras[n] = !!e.extras[n];
  // Keep only colors used by the current look. This bounds multiplayer payloads
  // even after hundreds of wardrobe edits or an untrusted imported code.
  for (const slot of ['hat', 'glasses', 'top', 'print', 'neck', 'back', 'extras']) {
    const ids = history ? ge[slot].map(([id]) => id)
      : slot === 'extras' ? Object.keys(t.extras).filter(id => t.extras[id]) : [t[slot]];
    for (const id of ids) for (const channel of Object.keys(Le(slot, id).slots || {})) {
      const key = `${slot}:${id}:${channel}`, value = e.colors?.[key];
      if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) t.colors[key] = value.toLowerCase();
    }
  }
  if (t.top === 'chef') t.print = 'none';
  return t;
}

export { Nt as FUR_CHOICES, Gt as COLOR_CHOICES, Yo as COLOR_LABELS, ge as WARDROBE, Ft as wardrobeItem, Le as wardrobeMeta, ut as DEFAULT_WARDROBE, we as cloneWardrobe, pt as wardrobeColor, dt as normalizeWardrobe };
