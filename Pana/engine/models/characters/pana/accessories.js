import { signedPower as pe, surface as fe, mesh as U, ellipsoid as ie, curve as Q, patch as ye } from './geometry.js';
import { clothFront as it } from './cloth-front.js';
// Accessory geometry from the supplied Mi Pana Editor; uses the shared sculpt.
import * as R from "three";
import { RoundedBoxGeometry as At } from "three/addons/geometries/RoundedBoxGeometry.js";
var be = Math.PI * 2,
  ce = (e, t, n) => new R.Vector3(e, t, n);
function co(e) {
  let t = pe(R.MathUtils.clamp(e / 0.8, -1, 1), 1.1111111111111112),
    n = Math.sqrt(Math.max(0, 1 - t * t)) ** 0.85;
  return {
    width: 0.94 * (1 - 0.17 * t) * n,
    depth: 0.74 * n,
    z: 0.04 - 0.06 * t,
  };
}
var Wo = (e) => 0.15 * Math.exp(-(((e + 0.49) / 0.36) ** 2));
function _e(e, t) {
  let { width: n, depth: r, z: c } = co(t),
    s = Math.max(0, 1 - (Math.abs(e) / Math.max(0.001, n)) ** (2 / 0.88));
  return c + r * s ** (0.88 / 2) + Wo(t) * s ** 0.45;
}
function io(e, t) {
  let n = pe(R.MathUtils.clamp((t + 0.045) / 0.405, -1, 1), 1.2048192771084338),
    r = Math.sqrt(Math.max(0, 1 - n * n)) ** 0.79,
    c = 1 - (Math.abs(e) / Math.max(0.001, 0.405 * r)) ** (2 / 0.84);
  return c > 0 ? 0.775 + 0.335 * r * c ** 0.4 : -9;
}
var Xo = (e, t) => Math.max(_e(e, t), io(e, t));
function Fe(
  e,
  {
    oval: t = 0.88,
    zs: n = 0.02,
    cols: r = 72,
    rows: c = 24,
    displace: s,
  } = {},
) {
  let f = new R.SplineCurve(e.map(([b, w]) => new R.Vector2(b, w)));
  return fe(
    (b, w) => {
      let H = b * be,
        k = f.getPoint(w),
        m = k.x,
        E = k.y;
      return (
        s && ([m, E] = s(m, E, H, w)),
        [Math.sin(H) * m, E, Math.cos(H) * m * t + n]
      );
    },
    r,
    c,
  );
}
var Xe = (e, t, n = 0.88, r = 0.02, c = 64, s) =>
  Array.from({ length: c }, (f, b) => {
    let w = (b / c) * be;
    return [Math.sin(w) * e, s ? s(w) : t, Math.cos(w) * e * n + r];
  });
function yt(e, t) {
  let n = e.attributes.position,
    r = new R.Color(),
    c = new Float32Array(n.count * 3);
  for (let s = 0; s < n.count; s++)
    (t(r, n.getX(s), n.getY(s), n.getZ(s), s), c.set([r.r, r.g, r.b], s * 3));
  return (e.setAttribute("color", new R.BufferAttribute(c, 3)), e);
}
function Pe(e) {
  let t = new R.Shape();
  return (
    e.forEach(([n, r], c) => t[c ? "lineTo" : "moveTo"](n, r)),
    t.closePath(),
    t
  );
}
function Ke(e, t, n, r = Math.PI / 2, c = 0, s = 0) {
  return Array.from({ length: e * 2 }, (f, b) => {
    let w = r + (b * Math.PI) / e,
      H = b % 2 ? n : t;
    return [c + Math.cos(w) * H, s + Math.sin(w) * H];
  });
}
function ao(e, t = 0, n = 0, r = 48) {
  return Array.from({ length: r }, (c, s) => {
    let f = (s / r) * be;
    return [
      t + 16 * Math.sin(f) ** 3 * e,
      n +
        (13 * Math.cos(f) -
          5 * Math.cos(2 * f) -
          2 * Math.cos(3 * f) -
          Math.cos(4 * f)) *
          e,
    ];
  });
}
var Oe = (e, t = 0, n = 0, r = 40, c = e) =>
    Array.from({ length: r }, (s, f) => [
      t + Math.cos((f / r) * be) * e,
      n + Math.sin((f / r) * be) * c,
    ]),
  ro = 9,
  Tt = () => (ro = (ro * 16807) % 2147483647) / 2147483647;
export function createAccessories(e, selection = null) {
  const wanted = (slot, id) => !selection || (slot === "face" ? selection.extras[id] : selection[slot] === id);
  const roots = [];
  let { head: t, body: n, wardrobe: r } = e,
    c = new Set(),
    s = (o, i, a = {}) => {
      let M = new R.MeshPhysicalMaterial({
        color: i,
        roughness: 0.86,
        sheen: 0.25,
        sheenRoughness: 0.7,
        sheenColor: "#ffffff",
        ...a,
      });
      return ((M.name = o), c.add(M), M);
    },
    f = (o, i = {}) => s("cloth", o, { side: R.DoubleSide, ...i }),
    b = () =>
      s("gold", "#f5b819", {
        metalness: 0.85,
        roughness: 0.28,
        sheen: 0,
        emissive: "#2a1a00",
      }),
    w = (o, i = {}) =>
      s("plastic", o, {
        roughness: 0.3,
        clearcoat: 0.8,
        clearcoatRoughness: 0.2,
        sheen: 0,
        ...i,
      }),
    H = (o) =>
      s("lens", o, {
        roughness: 0.08,
        metalness: 0.1,
        transparent: !0,
        opacity: 0.72,
        sheen: 0,
        clearcoat: 1,
        side: R.DoubleSide,
        depthWrite: !1,
      }),
    k = (o, i = 0.07) => (r.foundation.fitPoint(o, i), o),
    m = (o, i) =>
      -0.015 +
      0.5 *
        Math.sqrt(
          Math.max(0.02, 1 - (o / 0.78) ** 2 - ((i - 1.13) / 0.74) ** 2),
        ),
    E = (o, i) => {
      let a = new R.Group();
      return ((a.name = i), (a.visible = !1), o.add(a), roots.push(a), a);
    },
    I = t.children.filter((o) => o.name === "Cupped ear"),
    l = {},
    C = {},
    v = {},
    A = {},
    D = {};
  if (wanted("hat", "pesca")) {
    let o = E(t, "hat:pesca"),
      i = f("#e0c48f"),
      a = f("#7a5a32");
    (U(
      o,
      "Bucket crown",
      Fe([
        [0.8, 0.52],
        [0.8, 0.7],
        [0.72, 0.93],
        [0.5, 1.07],
        [0, 1.11],
      ]),
      i,
    ),
      U(
        o,
        "Bucket brim",
        Fe(
          [
            [0.79, 0.54],
            [0.98, 0.47],
            [1.16, 0.39],
            [1.22, 0.36],
          ],
          { rows: 10 },
        ),
        i,
      ),
      Q(o, "Brim edge", Xe(1.22, 0.36), 0.022, i, !0, 96),
      Q(o, "Hat band", Xe(0.805, 0.59), 0.04, a, !0, 96));
    for (let M of [0.98, 1.1])
      Q(
        o,
        "Brim stitch",
        Xe(M, 0.47 - (M - 0.98) * 0.62 + 0.004),
        0.006,
        a,
        !0,
        96,
      );
    l.pesca = { root: o, colors: { main: [i], dark: [a] } };
  }
  if (wanted("hat", "lana")) {
    let o = E(t, "hat:lana"),
      i = f("#ff4b4b"),
      a = f("#d23b3b"),
      M = f("#f3e9d7", { roughness: 1, sheen: 0.6 });
    (U(
      o,
      "Beanie crown",
      Fe(
        [
          [0.78, 0.46],
          [0.8, 0.64],
          [0.72, 0.88],
          [0.45, 1.05],
          [0, 1.1],
        ],
        { displace: (h, u, y) => [h * (1 + 0.012 * Math.cos(y * 34)), u] },
      ),
      i,
    ),
      U(
        o,
        "Beanie cuff",
        Fe(
          [
            [0.81, 0.38],
            [0.85, 0.44],
            [0.85, 0.56],
            [0.8, 0.61],
          ],
          {
            rows: 8,
            displace: (h, u, y) => [h * (1 + 0.014 * Math.cos(y * 48)), u],
          },
        ),
        a,
      ));
    let d = new R.IcosahedronGeometry(0.2, 4),
      p = d.attributes.position;
    for (let h = 0; h < p.count; h++) {
      let u = ce(p.getX(h), p.getY(h), p.getZ(h));
      (u.multiplyScalar(
        1 + 0.12 * Math.sin(u.x * 60) * Math.sin(u.y * 55) * Math.sin(u.z * 50),
      ),
        p.setXYZ(h, u.x, u.y, u.z));
    }
    (d.computeVertexNormals(),
      U(o, "Pompom", d, M, [0, 1.2, 0.02]),
      (l.lana = { root: o, colors: { main: [i], dark: [a] } }));
  }
  if (wanted("hat", "llanero")) {
    let o = E(t, "hat:llanero"),
      i = f("#8a5a32", { roughness: 0.95 }),
      a = f("#2b1d14");
    (U(
      o,
      "Llanero crown",
      Fe(
        [
          [0.64, 0.6],
          [0.63, 0.86],
          [0.6, 1.1],
          [0.5, 1.2],
          [0.22, 1.18],
          [0, 1.13],
        ],
        {
          displace: (d, p, h, u) => [
            d * (1 - 0.06 * Math.cos(h) ** 2 * u),
            p -
              (u > 0.65
                ? 0.08 * Math.max(0, Math.cos(h)) ** 3 * (u - 0.65) * 3
                : 0),
          ],
        },
      ),
      i,
    ),
      U(
        o,
        "Llanero band",
        Fe(
          [
            [0.66, 0.6],
            [0.655, 0.74],
          ],
          { rows: 3 },
        ),
        a,
      ));
    let M = fe(
      (d, p) => {
        let h = d * be,
          u = 0.62 + p * 0.9,
          y = Math.sin(h) ** 2;
        return [
          Math.sin(h) * u,
          0.6 + 0.2 * y * p * p - 0.04 * p * (1 - y),
          Math.cos(h) * u * 0.92 + 0.02,
        ];
      },
      80,
      10,
    );
    (U(o, "Llanero brim", M, i),
      Q(
        o,
        "Brim edge",
        Xe(
          1.52,
          0,
          0.92,
          0.02,
          80,
          (d) => 0.6 + 0.2 * Math.sin(d) ** 2 - 0.04 * (1 - Math.sin(d) ** 2),
        ),
        0.02,
        a,
        !0,
        120,
      ),
      (l.llanero = { root: o, colors: { main: [i], dark: [a] } }));
  }
  if (wanted("hat", "corona")) {
    let o = E(t, "hat:corona"),
      i = b(),
      a = f("#b3122e", { roughness: 0.7, sheen: 1, sheenColor: "#ff6a8a" }),
      M = w("#e0283a", { roughness: 0.1 }),
      d = w("#2ad1b2", { roughness: 0.1 }),
      p = (h) => Math.max(0, Math.cos(h * 5)) ** 2.4;
    (U(
      o,
      "Crown band",
      fe(
        (h, u) => {
          let y = h * be,
            S = 0.9 + 0.32 * p(y),
            F = 0.64 + (S - 0.64) * u,
            O = 0.6 + 0.07 * u;
          return [Math.sin(y) * O, F, Math.cos(y) * O * 0.9 + 0.02];
        },
        120,
        8,
      ),
      i,
    ),
      U(
        o,
        "Velvet cap",
        Fe([
          [0.6, 0.7],
          [0.58, 0.92],
          [0.34, 1.05],
          [0, 1.08],
        ]),
        a,
      ),
      Q(o, "Crown rim", Xe(0.605, 0.64, 0.9), 0.035, i, !0, 96),
      Q(o, "Crown top rim", Xe(0.67, 0.9, 0.9), 0.02, i, !0, 96));
    for (let h = 0; h < 5; h++) {
      let u = (h / 5) * be;
      ie(
        o,
        "Point pearl",
        i,
        [Math.sin(u) * 0.67, 1.24, Math.cos(u) * 0.67 * 0.9 + 0.02],
        [0.055, 0.055, 0.055],
      );
      let y = u + Math.PI / 5;
      (ie(
        o,
        "Gem",
        h % 2 ? d : M,
        [Math.sin(u) * 0.645, 0.78, Math.cos(u) * 0.645 * 0.9 + 0.02],
        [0.06, 0.075, 0.035],
      ),
        ie(
          o,
          "Small gem",
          h % 2 ? M : d,
          [Math.sin(y) * 0.64, 0.76, Math.cos(y) * 0.64 * 0.9 + 0.02],
          [0.035, 0.04, 0.02],
        ),
        o.children
          .slice(-2)
          .forEach((S) => S.lookAt(S.position.clone().multiplyScalar(2))));
    }
    l.corona = { root: o, colors: { main: [a] } };
  }
  if (wanted("hat", "casco")) {
    let o = E(t, "hat:casco"),
      i = w("#ffffff", { vertexColors: !0, roughness: 0.22 }),
      a = s("rubber", "#1d1b26", { roughness: 0.6, sheen: 0 }),
      M = H("#2b3a4a"),
      d = ce(0, 0.08, -0.05),
      p = ce(1.12, 1.08, 1.03),
      h = (te, Z) => (Math.abs(Z) < 0.92 && te > 0.86 && te < 2.3) || te > 2.5,
      u = [],
      y = [],
      S = 96,
      F = 64,
      O = [];
    for (let te = 0; te <= F; te++)
      for (let Z = 0; Z <= S; Z++) {
        let J = (te / F) * Math.PI,
          se = (Z / S - 0.5) * be;
        (u.push(
          d.x + Math.sin(J) * Math.sin(se) * p.x,
          d.y + Math.cos(J) * p.y,
          d.z + Math.sin(J) * Math.cos(se) * p.z,
        ),
          O.push(!h(J, se)));
      }
    for (let te = 0; te < F; te++)
      for (let Z = 0; Z < S; Z++) {
        let J = te * (S + 1) + Z,
          se = J + S + 1;
        O[J] &&
          O[se] &&
          O[J + 1] &&
          O[se + 1] &&
          y.push(J, se, J + 1, se, se + 1, J + 1);
      }
    let T = new R.BufferGeometry();
    (T.setAttribute("position", new R.Float32BufferAttribute(u, 3)),
      T.setIndex(y),
      T.computeVertexNormals());
    let B = new R.Color("#ff4b4b"),
      _ = new R.Color("#ffffff"),
      q = () =>
        yt(T, (te, Z, J, se) => {
          let de =
            (Math.abs(Z) < 0.13 && J > 0.3) ||
            (Math.abs(Math.abs(Z) - 0.26) < 0.04 && J > 0.45)
              ? _
              : B;
          te.copy(de);
        });
    (q(),
      U(o, "Helmet shell", T, i),
      (i.side = R.FrontSide),
      U(
        o,
        "Helmet padding",
        T,
        s("padding", "#1d1b26", {
          roughness: 0.9,
          sheen: 0.3,
          side: R.BackSide,
        }),
      ));
    let oe = [];
    for (let te = 0; te <= 60; te++) {
      let Z = te / 60,
        J,
        se;
      (Z < 0.25
        ? ((J = 0.86), (se = (Z / 0.25 - 0.5) * 1.84))
        : Z < 0.5
          ? ((J = 0.86 + ((Z - 0.25) / 0.25) * 1.44), (se = 0.92))
          : Z < 0.75
            ? ((J = 2.3), (se = 0.92 - ((Z - 0.5) / 0.25) * 1.84))
            : ((J = 2.3 - ((Z - 0.75) / 0.25) * 1.44), (se = -0.92)),
        oe.push([
          d.x + Math.sin(J) * Math.sin(se) * p.x,
          d.y + Math.cos(J) * p.y,
          d.z + Math.sin(J) * Math.cos(se) * p.z,
        ]));
    }
    (Q(o, "Face opening trim", oe, 0.035, a, !0, 160),
      Q(
        o,
        "Neck trim",
        Array.from({ length: 64 }, (te, Z) => {
          let J = (Z / 64) * be,
            se = 2.5;
          return [
            d.x + Math.sin(se) * Math.sin(J) * p.x,
            d.y + Math.cos(se) * p.y,
            d.z + Math.sin(se) * Math.cos(J) * p.z,
          ];
        }),
        0.04,
        a,
        !0,
        96,
      ));
    let ne = fe(
      (te, Z) => {
        let J = (te - 0.5) * 2,
          se = 0.5 + Z * 0.36,
          de = 1.04;
        return [
          d.x + Math.sin(se) * Math.sin(J) * p.x * de,
          d.y + Math.cos(se) * p.y * de,
          d.z + Math.sin(se) * Math.cos(J) * p.z * de,
        ];
      },
      40,
      8,
    );
    U(o, "Visor", ne, M);
    for (let te of [-1, 1])
      ie(o, "Visor pivot", a, [te * 0.98, 0.42, 0.28], [0.03, 0.08, 0.08]);
    l.casco = {
      root: o,
      hideEars: !0,
      colors: { main: [] },
      recolor: {
        main: (te) => {
          ((B = new R.Color(te)), q());
        },
        stripe: (te) => {
          ((_ = new R.Color(te)), q());
        },
      },
    };
  }
  if (wanted("hat", "audifonos")) {
    let o = E(t, "hat:audifonos"),
      i = w("#2ad1b2"),
      a = s("pads", "#26232e", { roughness: 0.7, sheen: 0.4 }),
      M = w("#26232e"),
      d = Array.from({ length: 25 }, (p, h) => {
        let u = (h / 24) * Math.PI;
        return [-Math.cos(u) * 0.93, 0.5 + Math.sin(u) * 0.62, -0.06];
      });
    (Q(o, "Headband", d, 0.05, M, !1, 80),
      Q(
        o,
        "Headband pad",
        d.slice(6, 19).map(([p, h, u]) => [p * 0.95, h - 0.04, u]),
        0.055,
        a,
        !1,
        60,
      ));
    for (let p of [-1, 1]) {
      let h = new R.Group();
      (h.position.set(p * 0.93, 0.48, -0.06),
        (h.rotation.z = (p * -Math.PI) / 2),
        o.add(h),
        U(h, "Ear cup", new R.CylinderGeometry(0.27, 0.25, 0.18, 40), i, [
          0,
          p * 0.05,
          0,
        ]),
        U(h, "Cup cap", new R.CylinderGeometry(0.17, 0.2, 0.05, 40), M, [
          0,
          p * 0.16,
          0,
        ]));
      let u = U(h, "Cushion", new R.TorusGeometry(0.2, 0.07, 14, 40), a, [
        0,
        -p * 0.06,
        0,
      ]);
      u.rotation.x = Math.PI / 2;
    }
    l.audifonos = { root: o, hideEars: !0, colors: { main: [i] } };
  }
  if (wanted("hat", "boina")) {
    let o = E(t, "hat:boina"),
      i = f("#c0262d", { roughness: 0.95 }),
      a = new R.Group();
    ((a.rotation.z = -0.2),
      a.position.set(0.02, 0, 0),
      o.add(a),
      U(
        a,
        "Beret",
        Fe([
          [0.7, 0.6],
          [0.92, 0.76],
          [0.9, 0.86],
          [0.5, 0.97],
          [0, 0.99],
        ]),
        i,
      ),
      Q(a, "Beret band", Xe(0.71, 0.61), 0.035, i, !0, 96),
      U(
        a,
        "Beret stem",
        new R.CylinderGeometry(0.02, 0.03, 0.1, 10),
        i,
        [0, 1.03, 0],
      ),
      (l.boina = { root: o, colors: { main: [i] } }));
  }
  if (wanted("hat", "copa")) {
    let o = E(t, "hat:copa"),
      i = s("satin", "#2b2d42", { roughness: 0.45, sheen: 0.6 }),
      a = f("#ff4b4b"),
      M = new R.Group();
    (M.position.set(0.16, 0.72, -0.02),
      (M.rotation.z = -0.24),
      o.add(M),
      U(
        M,
        "Top hat crown",
        Fe(
          [
            [0.4, 0],
            [0.37, 0.05],
            [0.35, 0.62],
            [0.38, 0.66],
            [0, 0.67],
          ],
          { oval: 0.9, zs: 0 },
        ),
        i,
      ),
      U(
        M,
        "Top hat brim",
        Fe(
          [
            [0.36, 0.02],
            [0.6, 0],
            [0.66, 0.05],
          ],
          { oval: 0.9, zs: 0, rows: 6 },
        ),
        i,
      ),
      U(
        M,
        "Ribbon",
        Fe(
          [
            [0.37, 0.07],
            [0.365, 0.2],
          ],
          { oval: 0.9, zs: 0, rows: 3, displace: (d, p) => [d + 0.008, p] },
        ),
        a,
      ),
      (l.copa = { root: o, colors: { main: [i], accent: [a] } }));
  }
  if (wanted("hat", "fiesta")) {
    let o = E(t, "hat:fiesta"),
      i = s("paper", "#ffffff", { vertexColors: !0, roughness: 0.6, sheen: 0 }),
      a = f("#ffc629", { roughness: 1 }),
      M = new R.Group();
    (M.position.set(0.18, 0.84, 0.02), (M.rotation.z = -0.28), o.add(M));
    let d = new R.ConeGeometry(0.32, 0.82, 48, 12, !0);
    d.translate(0, 0.41, 0);
    let p = new R.Color("#8e4de8"),
      h = new R.Color("#f3e9d7"),
      u = () =>
        yt(d, (y, S, F, O) =>
          y.copy(Math.sin(Math.atan2(O, S) * 3 + F * 18) > 0 ? p : h),
        );
    (u(), U(M, "Party cone", d, i));
    for (let y = 0; y < 7; y++) {
      let S = Tt();
      ie(
        M,
        "Pompom tuft",
        a,
        [(Tt() - 0.5) * 0.12, 0.84 + Tt() * 0.06, (Tt() - 0.5) * 0.12],
        [0.07, 0.07, 0.07],
      );
    }
    (Q(M, "Cone rim", Xe(0.32, 0.005, 1, 0, 48), 0.02, a, !0, 64),
      (l.fiesta = {
        root: o,
        colors: { main: [] },
        recolor: {
          main: (y) => {
            ((p = new R.Color(y)), u());
          },
        },
      }));
  }
  if (wanted("hat", "orquidea")) {
    let o = E(t, "hat:orquidea"),
      i = s("petal", "#d68ae8", {
        roughness: 0.6,
        sheen: 0.8,
        sheenColor: "#fff0ff",
        side: R.DoubleSide,
      }),
      a = s("lip", "#a1287f", { roughness: 0.5, side: R.DoubleSide }),
      M = s("throat", "#ffcf3a", { roughness: 0.5 }),
      d = s("leaf", "#4f8a36", { side: R.DoubleSide }),
      p = new R.Group();
    (p.position.set(0.68, 0.5, 0.34),
      p.lookAt(ce(2.2, 1.3, 2.6)),
      p.scale.setScalar(1.55),
      o.add(p));
    let h = (O, T) => {
        let B = O.attributes.position;
        for (let _ = 0; _ < B.count; _++) {
          let q = B.getX(_),
            oe = B.getY(_);
          B.setZ(_, T * (q * q * 4 + oe * oe * 0.6));
        }
        return (O.computeVertexNormals(), O);
      },
      u = (O, T, B = 0) =>
        Pe(
          Array.from({ length: 30 }, (_, q) => {
            let oe = (q / 30) * be,
              ne = 1 + B * Math.sin(oe * 9);
            return [
              Math.cos(oe) * T * ne * (0.6 + 0.4 * Math.sin(oe) ** 2),
              (Math.sin(oe) * 0.5 + 0.5) * O * ne,
            ];
          }),
        );
    for (let O = 0; O < 5; O++) {
      let T = O === 1 || O === 4,
        B = new R.Mesh(
          h(
            new R.ShapeGeometry(
              u(T ? 0.3 : 0.28, T ? 0.13 : 0.055, T ? 0.05 : 0),
              8,
            ),
            0.25,
          ),
          i,
        );
      ((B.rotation.z = [0, 1.1, 2.2, -2.2, -1.1][O] + Math.PI),
        (B.position.z = T ? 0.01 : 0),
        p.add(B));
    }
    let y = h(new R.ShapeGeometry(u(0.24, 0.1, 0.07), 8), 1.4),
      S = new R.Mesh(y, a);
    ((S.rotation.z = 0),
      (S.position.z = 0.03),
      p.add(S),
      ie(p, "Throat", M, [0, 0.06, 0.05], [0.04, 0.05, 0.02]));
    let F = new R.Mesh(new R.ShapeGeometry(u(0.34, 0.07), 6), d);
    ((F.rotation.z = 2.6),
      (F.position.z = -0.03),
      p.add(F),
      (l.orquidea = { root: o, colors: { main: [i], accent: [a] } }));
  }
  if (wanted("hat", "lazo")) {
    let o = E(t, "hat:lazo"),
      i = s("bow", "#f15bb5", { roughness: 0.4, sheen: 0.8 }),
      a = new R.Group();
    (a.position.set(0.36, 0.86, 0.14),
      a.rotation.set(-0.3, 0.3, -0.45),
      o.add(a));
    for (let M of [-1, 1]) {
      let d = ie(
        a,
        "Bow lobe",
        i,
        [M * 0.17, 0, 0],
        [0.17, 0.12, 0.06],
        0.7,
        32,
      );
      ((d.rotation.z = M * 0.25),
        Q(
          a,
          "Ribbon tail",
          [
            [M * 0.03, -0.03, 0.02],
            [M * 0.08, -0.14, 0.03],
            [M * 0.12, -0.24, 0.02],
          ],
          0.03,
          i,
          !1,
          20,
        ));
    }
    (ie(a, "Bow knot", i, [0, 0, 0.02], [0.06, 0.07, 0.06]),
      (l.lazo = { root: o, colors: { main: [i] } }));
  }
  function x(o, i) {
    let a = new R.Group();
    return (
      a.position.set(i * 0.6, 0.26, _e(i * 0.6, 0.26) + 0.095),
      (a.rotation.y = i * 0.47),
      (a.rotation.z = i * 0.1),
      o.add(a),
      a.updateMatrix(),
      a
    );
  }
  function z(
    o,
    i,
    {
      frame: a,
      lens: M,
      thick: d = 0.02,
      doubleBridge: p = !1,
      temples: h = !0,
      lensFor: u,
    } = {},
  ) {
    let y = E(t, `glasses:${o}`);
    for (let S of [-1, 1]) {
      let F = x(y, S),
        O = i(S);
      Q(
        F,
        "Rim",
        O.map(([Z, J]) => [Z, J, 0]),
        d,
        a,
        !0,
        96,
      );
      let T = u ? u(S) : M;
      if (T) {
        let Z = U(F, "Lens", new R.ShapeGeometry(Pe(O), 24), T, [0, 0, -0.006]);
        ((Z.castShadow = !1), (Z.renderOrder = 2));
      }
      let B = O.map((Z) => Z[0]),
        _ = Math.max(...B.map(Math.abs)),
        q = O.reduce((Z, J) => (S * J[0] > S * Z[0] ? J : Z)),
        oe = O.reduce((Z, J) => (S * J[0] < S * Z[0] ? J : Z)),
        ne = ce(q[0], q[1] * 0.3 + 0.03, 0).applyMatrix4(F.matrix);
      h &&
        Q(
          y,
          "Temple",
          [
            ne.toArray(),
            [S * 0.88, 0.31, 0.36],
            [S * 0.91, 0.4, 0.04],
            [S * 0.86, 0.4, -0.15],
          ],
          d * 0.8,
          a,
          !1,
          40,
        );
      let te = ce(oe[0], 0.07, 0).applyMatrix4(F.matrix);
      if (
        (Q(
          y,
          "Bridge",
          [
            te.toArray(),
            [S * 0.26, 0.39, 0.85],
            [S * 0.12, 0.405, 0.91],
            [0, 0.405, 0.92],
          ],
          d * 0.8,
          a,
          !1,
          32,
        ),
        p)
      ) {
        let Z = ce(
          oe[0] * 0.8,
          Math.max(...O.map((J) => J[1])) - 0.02,
          0,
        ).applyMatrix4(F.matrix);
        Q(
          y,
          "Top bar",
          [Z.toArray(), [S * 0.22, 0.52, 0.9], [0, 0.53, 0.93]],
          d * 0.7,
          a,
          !1,
          32,
        );
      }
    }
    return y;
  }
  if (wanted("glasses", "aviador")) {
    let o = b(),
      i = s("aviator lens", "#ffffff", {
        vertexColors: !0,
        transparent: !0,
        opacity: 0.8,
        roughness: 0.05,
        metalness: 0.2,
        clearcoat: 1,
        sheen: 0,
        side: R.DoubleSide,
        depthWrite: !1,
      }),
      a = (h) =>
        Array.from({ length: 64 }, (u, y) => {
          let S = (y / 64) * be,
            F = Math.sin(S),
            O = Math.cos(S),
            T = O * 0.25,
            B = F * 0.18;
          return (
            F < 0 &&
              ((B *= 1.35), (T *= 1 - 0.22 * -F * (h * O < 0 ? 1 : 0.2))),
            [T, B + 0.02]
          );
        }),
      M = new R.Color("#3f6b8a"),
      d = z("aviador", a, { frame: o, lens: i, thick: 0.014 }),
      p = () =>
        d.traverse((h) => {
          h.name === "Lens" &&
            yt(h.geometry, (u, y, S) =>
              u
                .copy(M)
                .lerp(
                  new R.Color("#ffd9a8"),
                  R.MathUtils.clamp(0.4 - S * 2, 0, 0.7),
                ),
            );
        });
    (p(),
      (C.aviador = {
        root: d,
        colors: { frame: [o] },
        recolor: {
          lens: (h) => {
            ((M = new R.Color(h)), p());
          },
        },
      }));
  }
  if (wanted("glasses", "cuadrados")) {
    let o = w("#1d1b26"),
      i = H("#cfe3ff");
    i.opacity = 0.25;
    let a = z(
      "cuadrados",
      () =>
        Array.from({ length: 64 }, (M, d) => {
          let p = (d / 64) * be;
          return [pe(Math.cos(p), 0.3) * 0.25, pe(Math.sin(p), 0.35) * 0.18];
        }),
      { frame: o, lens: i, thick: 0.04 },
    );
    C.cuadrados = { root: a, colors: { frame: [o], lens: [i] } };
  }
  if (wanted("glasses", "corazon")) {
    let o = w("#f15bb5"),
      i = H("#ff7ac0"),
      a = z("corazon", () => ao(0.0145, 0, 0.02, 64), {
        frame: o,
        lens: i,
        thick: 0.026,
      });
    C.corazon = { root: a, colors: { frame: [o], lens: [i] } };
  }
  if (wanted("glasses", "estrella")) {
    let o = w("#ffc629"),
      i = H("#8e4de8"),
      a = z(
        "estrella",
        () => {
          let M = Ke(5, 0.28, 0.14),
            d = [];
          return (
            M.forEach((p, h) => {
              let u = M[(h + 1) % M.length];
              for (let y = 0; y < 6; y++)
                d.push([
                  p[0] + ((u[0] - p[0]) * y) / 6,
                  p[1] + ((u[1] - p[1]) * y) / 6,
                ]);
            }),
            d
          );
        },
        { frame: o, lens: i, thick: 0.022 },
      );
    C.estrella = { root: a, colors: { frame: [o], lens: [i] } };
  }
  if (wanted("glasses", "tresd")) {
    let o = s("card", "#f7f3ea", { roughness: 0.9, sheen: 0 }),
      i = H("#ff3048"),
      a = H("#28d7ff"),
      M = z(
        "tresd",
        () =>
          Array.from({ length: 48 }, (d, p) => {
            let h = (p / 48) * be;
            return [pe(Math.cos(h), 0.2) * 0.24, pe(Math.sin(h), 0.2) * 0.16];
          }),
        { frame: o, thick: 0.035, lensFor: (d) => (d < 0 ? i : a) },
      );
    C.tresd = { root: M, colors: { frame: [o] } };
  }
  if (wanted("glasses", "visor")) {
    let o = E(t, "glasses:visor"),
      i = s("visor", "#2ad1b2", {
        metalness: 0.6,
        roughness: 0.12,
        iridescence: 1,
        iridescenceIOR: 1.6,
        transparent: !0,
        opacity: 0.85,
        side: R.DoubleSide,
        clearcoat: 1,
        sheen: 0,
      }),
      a = w("#26232e"),
      M = Math.max(...[0.28, 0.36, 0.44, 0.52].map((p) => Xo(0, p))) + 0.06,
      d = (p) => {
        let h = _e(0.68, 0.3) + 0.12;
        return M - (M - h) * (p / 0.68) ** 2;
      };
    (U(
      o,
      "Visor",
      fe(
        (p, h) => {
          let u = (p - 0.5) * 1.9,
            y = Math.abs(u),
            S =
              0.2 +
              h * 0.32 +
              0.06 * (y / 0.95) ** 2 +
              (1 - h) * 0.06 * (1 - y),
            F = y < 0.68 ? d(y) : d(0.68) - (y - 0.68) * 1.9;
          return [u, S, F];
        },
        60,
        8,
      ),
      i,
    ),
      Q(
        o,
        "Visor top",
        Array.from({ length: 31 }, (p, h) => {
          let u = (h / 30 - 0.5) * 1.9,
            y = Math.abs(u);
          return [
            u,
            0.52 + 0.06 * (y / 0.95) ** 2,
            (y < 0.68 ? d(y) : d(0.68) - (y - 0.68) * 1.9) + 0.01,
          ];
        }),
        0.022,
        a,
        !1,
        80,
      ));
    for (let p of [-1, 1])
      Q(
        o,
        "Visor temple",
        [
          [p * 0.95, 0.46, d(0.68) - 0.52],
          [p * 0.93, 0.46, -0.05],
          [p * 0.86, 0.46, -0.2],
        ],
        0.02,
        a,
        !1,
        20,
      );
    C.visor = { root: o, colors: { lens: [i], frame: [a] } };
  }
  if (wanted("glasses", "piloto")) {
    let o = E(t, "glasses:piloto"),
      i = s("brass", "#c9a14a", { metalness: 0.85, roughness: 0.3, sheen: 0 }),
      a = s("leather", "#6b4226", { roughness: 0.8, sheen: 0.2 }),
      M = H("#ffb347");
    for (let p of [-1, 1]) {
      let h = x(o, p),
        u = U(
          h,
          "Goggle cup",
          new R.CylinderGeometry(0.21, 0.23, 0.1, 40, 1, !0),
          a,
          [0, 0.01, -0.03],
        );
      u.rotation.x = Math.PI / 2;
      let y = U(
        h,
        "Brass ring",
        new R.TorusGeometry(0.21, 0.03, 12, 48),
        i,
        [0, 0.01, 0.025],
      );
      U(
        h,
        "Goggle lens",
        new R.CircleGeometry(0.2, 40),
        M,
        [0, 0.01, 0.02],
      ).renderOrder = 2;
    }
    Q(
      o,
      "Goggle bridge",
      [
        [-0.38, 0.36, 0.86],
        [0, 0.42, 0.97],
        [0.38, 0.36, 0.86],
      ],
      0.03,
      a,
      !1,
      20,
    );
    let d = Array.from({ length: 40 }, (p, h) => {
      let u = 0.55 * Math.PI + (h / 39) * 0.9 * Math.PI,
        y = co(0.3);
      return [
        Math.sin(u) * (y.width + 0.04),
        0.3 + 0.08 * Math.cos(u),
        Math.cos(u) * (y.depth + 0.04) + y.z,
      ];
    });
    (Q(
      o,
      "Leather strap",
      [
        [0.84, 0.3, 0.42],
        ...d.map((p) => [-p[0] * -1, p[1], p[2]]),
        [-0.84, 0.3, 0.42],
      ],
      0.045,
      a,
      !1,
      80,
    ),
      (C.piloto = { root: o, colors: { lens: [M], frame: [a] } }));
  }
  if (wanted("face", "mejillas")) {
    let o = E(t, "face:mejillas"),
      i = s("blush", "#ff7f9c", {
        transparent: !0,
        opacity: 0.55,
        roughness: 1,
        sheen: 0,
        depthWrite: !1,
        polygonOffset: !0,
        polygonOffsetFactor: -2,
      });
    for (let a of [-1, 1])
      ye(
        o,
        "Blush",
        Pe(Oe(0.13, a * 0.64, -0.06, 32, 0.085)),
        i,
        (M, d) => _e(M, d) + 0.006,
        12,
      );
    v.mejillas = { root: o, colors: { main: [i] } };
  }
  if (wanted("face", "pecas")) {
    let o = E(t, "face:pecas"),
      i = s("freckle", "#7a3d14", {
        roughness: 1,
        sheen: 0,
        polygonOffset: !0,
        polygonOffsetFactor: -2,
      });
    for (let a of [-1, 1])
      for (let [M, d] of [
        [0.5, 0.02],
        [0.58, 0.07],
        [0.6, -0.02],
        [0.68, 0.03],
        [0.53, -0.07],
      ])
        ye(
          o,
          "Freckle",
          Pe(Oe(0.018, a * M, d, 12)),
          i,
          (p, h) => _e(p, h) + 0.004,
          4,
        );
    v.pecas = { root: o, colors: {} };
  }
  if (wanted("face", "bigote")) {
    let o = E(t, "face:bigote"),
      i = s("mustache", "#3b2414", {
        roughness: 0.9,
        sheen: 0.5,
        sheenColor: "#7a5030",
      });
    for (let a of [-1, 1]) {
      let M = new R.CatmullRomCurve3([
        ce(0, 0.02, 0),
        ce(a * 0.12, 0, 0),
        ce(a * 0.26, -0.02, 0),
        ce(a * 0.38, 0, 0),
        ce(a * 0.44, 0.07, 0),
        ce(a * 0.4, 0.12, 0),
      ]);
      for (let d = 0; d <= 46; d++) {
        let p = d / 46,
          h = M.getPoint(p),
          u = 0.042 * (1 - p) ** 0.7 + 0.01,
          y = Math.max(io(h.x, h.y), _e(h.x, h.y)) + u * 0.6;
        ie(o, "Mustache tuft", i, [h.x, h.y, y], [u * 1.1, u, u * 0.75], 1, 14);
      }
    }
    v.bigote = { root: o, colors: { main: [i] } };
  }
  if (wanted("face", "curita")) {
    let o = E(t, "face:curita"),
      i = s("bandage", "#f0b37e", {
        roughness: 0.8,
        sheen: 0,
        polygonOffset: !0,
        polygonOffsetFactor: -2,
      }),
      a = s("bandage pad", "#fbe3c8", {
        roughness: 1,
        sheen: 0,
        polygonOffset: !0,
        polygonOffsetFactor: -3,
      }),
      M = (p, h, u, y) =>
        p.map(([S, F]) => [
          u + S * Math.cos(h) - F * Math.sin(h),
          y + S * Math.sin(h) + F * Math.cos(h),
        ]),
      d = Array.from({ length: 40 }, (p, h) => {
        let u = (h / 40) * be;
        return [pe(Math.cos(u), 0.4) * 0.17, pe(Math.sin(u), 0.4) * 0.055];
      });
    (ye(
      o,
      "Bandage",
      Pe(M(d, 0.6, -0.62, 0)),
      i,
      (p, h) => _e(p, h) + 0.006,
      14,
    ),
      ye(
        o,
        "Bandage pad",
        Pe(
          M(
            d.map(([p, h]) => [p * 0.35, h * 0.75]),
            0.6,
            -0.62,
            0,
          ),
        ),
        a,
        (p, h) => _e(p, h) + 0.009,
        8,
      ),
      (v.curita = { root: o, colors: {} }));
  }
  let g = (o, i = 0.075, a = 0.24, M = 0) =>
    Array.from({ length: o }, (d, p) => {
      let h = (p / o) * be,
        u = ((1 + Math.cos(h)) / 2) ** 1.6;
      return k(
        ce(Math.sin(h) * 0.36, 1.86 + M - a * u, Math.cos(h) * 0.3 - 0.02),
        i,
      );
    });
  if (wanted("neck", "cadena")) {
    let o = E(n, "neck:cadena"),
      i = b(),
      a = g(72, 0.07, 0.28),
      M = new R.CatmullRomCurve3(a, !0),
      d = 70,
      p = new R.TorusGeometry(0.03, 0.009, 6, 14);
    for (let y = 0; y < d; y++) {
      let S = y / d,
        F = M.getPointAt(S),
        O = M.getTangentAt(S),
        T = new R.Mesh(p, i);
      (T.position.copy(F),
        T.lookAt(F.clone().add(O)),
        T.rotateY(Math.PI / 2),
        y % 2 && T.rotateX(Math.PI / 2),
        T.scale.set(1.3, 1, 1),
        o.add(T));
    }
    let h = a.reduce((y, S) => (S.z > y.z ? S : y)),
      u = new R.Group();
    (u.position.copy(h).add(ce(0, -0.1, 0.03)),
      (u.rotation.x = -0.25),
      o.add(u),
      (U(
        u,
        "Medallion",
        new R.CylinderGeometry(0.1, 0.1, 0.025, 40),
        i,
      ).rotation.x = Math.PI / 2),
      U(
        u,
        "Medallion star",
        new R.ExtrudeGeometry(Pe(Ke(5, 0.07, 0.03)), {
          depth: 0.012,
          bevelEnabled: !1,
        }),
        i,
        [0, 0, 0.012],
      ),
      (A.cadena = { root: o, colors: {} }));
  }
  if (wanted("neck", "bufanda")) {
    let o = E(n, "neck:bufanda"),
      i = f("#2ad1b2", { roughness: 1, sheen: 0.5 }),
      a = f("#f3e9d7", { roughness: 1 }),
      M = g(64, 0.1, 0.12, 0.02);
    U(
      o,
      "Scarf wrap",
      new R.TubeGeometry(new R.CatmullRomCurve3(M, !0), 120, 0.1, 16, !0),
      i,
    );
    let d = M[6],
      p = [
        d,
        k(d.clone().add(ce(0.06, -0.2, 0.1)), 0.1),
        k(ce(d.x + 0.04, 1.25, 0.6), 0.1),
        k(ce(d.x + 0.02, 1, 0.62), 0.1),
      ],
      h = new R.CatmullRomCurve3(p);
    U(
      o,
      "Scarf tail",
      fe(
        (y, S) => {
          let F = h.getPoint(S),
            O = (y - 0.5) * 0.22;
          return [F.x + O, F.y, F.z + 0.02 + Math.abs(O) * -0.1];
        },
        6,
        20,
      ),
      i,
    );
    let u = h.getPoint(1);
    for (let y = 0; y < 7; y++)
      Q(
        o,
        "Fringe",
        [
          [u.x - 0.1 + y * 0.033, u.y, u.z + 0.02],
          [u.x - 0.1 + y * 0.033, u.y - 0.09, u.z + 0.03],
        ],
        0.008,
        a,
        !1,
        4,
      );
    for (let y of [0.55, 0.75]) {
      let S = h.getPoint(y);
      Q(
        o,
        "Tail stripe",
        [
          [S.x - 0.11, S.y, S.z + 0.03],
          [S.x + 0.11, S.y, S.z + 0.03],
        ],
        0.018,
        a,
        !1,
        6,
      );
    }
    A.bufanda = { root: o, colors: { main: [i], accent: [a] } };
  }
  if (wanted("neck", "corbatin")) {
    let o = E(n, "neck:corbatin"),
      i = s("bowtie", "#ff4b4b", { roughness: 0.45, sheen: 0.7 }),
      a = g(64, 0.06, 0.04, -0.06).reduce((d, p) => (p.z > d.z ? p : d)),
      M = new R.Group();
    (M.position.copy(a).add(ce(0, 0, 0.04)), (M.rotation.x = -0.35), o.add(M));
    for (let d of [-1, 1]) {
      let p = new R.Mesh(
        new R.ExtrudeGeometry(
          Pe([
            [0, 0.03],
            [d * 0.2, 0.1],
            [d * 0.22, -0.1],
            [0, -0.03],
          ]),
          {
            depth: 0.04,
            bevelEnabled: !0,
            bevelThickness: 0.02,
            bevelSize: 0.02,
            bevelSegments: 4,
          },
        ),
        i,
      );
      ((p.position.z = -0.02), M.add(p));
    }
    (ie(M, "Bow knot", i, [0, 0, 0.04], [0.05, 0.055, 0.04]),
      (A.corbatin = { root: o, colors: { main: [i] } }));
  }
  if (wanted("neck", "collar")) {
    let o = E(n, "neck:collar"),
      i = ["#ff7ac0", "#ffc629", "#fff3e0", "#ff8a1f"].map((h) =>
        s("lei flower", h, { roughness: 0.6, sheen: 0.6, side: R.DoubleSide }),
      ),
      a = s("lei leaf", "#3f8a34", { side: R.DoubleSide }),
      M = s("lei heart", "#ffcf3a"),
      d = g(26, 0.11, 0.3, 0.02),
      p = new R.ShapeGeometry(
        Pe(
          Array.from({ length: 50 }, (h, u) => {
            let y = (u / 50) * be,
              S = 0.075 * (0.7 + 0.3 * Math.abs(Math.cos(y * 2.5)));
            return [Math.cos(y) * S, Math.sin(y) * S];
          }),
        ),
        4,
      );
    (d.forEach((h, u) => {
      let y = h
          .clone()
          .sub(ce(0, h.y, 0))
          .normalize(),
        S = new R.Mesh(p, i[u % i.length]);
      if (
        (S.position.copy(h),
        S.lookAt(
          h
            .clone()
            .add(y)
            .add(ce(0, 0.4, 0)),
        ),
        S.rotateZ(u),
        o.add(S),
        ie(
          o,
          "Flower heart",
          M,
          h.clone().addScaledVector(y, 0.01).toArray(),
          [0.02, 0.02, 0.02],
        ),
        u % 2)
      ) {
        let F = new R.Mesh(new R.CircleGeometry(0.05, 8), a);
        (F.scale.set(1.6, 0.6, 1),
          F.position
            .copy(h)
            .addScaledVector(y, -0.02)
            .add(ce(0, -0.05, 0)),
          F.lookAt(F.position.clone().add(y)),
          F.rotateZ(0.6),
          o.add(F));
      }
    }),
      (A.collar = { root: o, colors: {} }));
  }
  if (wanted("neck", "bandana")) {
    let o = E(n, "neck:bandana"),
      i = document.createElement("canvas");
    i.width = i.height = 128;
    let a = i.getContext("2d"),
      M = new R.CanvasTexture(i);
    ((M.colorSpace = R.SRGBColorSpace),
      (M.wrapS = M.wrapT = R.RepeatWrapping),
      M.repeat.set(3, 3));
    let d = (O) => {
      ((a.fillStyle = O),
        a.fillRect(0, 0, 128, 128),
        (a.fillStyle = "#fff6e6"));
      for (let T = 0; T < 4; T++)
        for (let B = 0; B < 4; B++)
          (a.beginPath(),
            a.arc(B * 32 + (T % 2) * 16 + 8, T * 32 + 8, 4.5, 0, be),
            a.fill());
      M.needsUpdate = !0;
    };
    d("#ff4b4b");
    let p = f("#ffffff", { map: M, roughness: 0.95 }),
      h = g(64, 0.08, 0.1, -0.02),
      u = new R.CatmullRomCurve3(h, !0);
    U(o, "Bandana roll", new R.TubeGeometry(u, 100, 0.045, 10, !0), p);
    let y = (O) => u.getPointAt((1 + (O - 0.5) * 0.36) % 1),
      S = 1.3;
    U(
      o,
      "Bandana front",
      fe(
        (O, T) => {
          let B = y(O),
            _ = 1 - T,
            q = B.x * _,
            oe =
              B.y +
              (S - B.y) * T * (0.4 + 0.6 * (1 - Math.abs(O - 0.5) * 2) ** 0.4),
            ne = k(ce(q, oe, m(q, oe) - 0.04), 0.08 + 0.012 * T);
          return [ne.x, ne.y, ne.z];
        },
        24,
        14,
      ),
      p,
    );
    let F = u.getPointAt(0.5);
    ie(o, "Bandana knot", p, F.toArray(), [0.06, 0.05, 0.05]);
    for (let O of [-1, 1])
      Q(
        o,
        "Knot end",
        [
          F.toArray(),
          [F.x + O * 0.08, F.y - 0.08, F.z - 0.06],
          [F.x + O * 0.12, F.y - 0.16, F.z - 0.05],
        ],
        0.03,
        p,
        !1,
        12,
      );
    A.bandana = { root: o, colors: {}, recolor: { main: (O) => d(O) } };
  }
  if (wanted("neck", "medalla")) {
    let o = E(n, "neck:medalla"),
      i = b(),
      a = f("#3d7bf2"),
      M = g(40, 0.07, 0.05, -0.02),
      d = k(ce(0, 1.42, 0.5), 0.08);
    for (let u of [-1, 1]) {
      let y = M.filter((F) => Math.sign(F.x) === u && F.z > -0.05).sort(
          (F, O) => F.z - O.z,
        )[0],
        S = new R.CatmullRomCurve3([
          y,
          k(y.clone().lerp(d, 0.5), 0.08),
          d.clone().add(ce(u * 0.03, 0.06, 0)),
        ]);
      U(
        o,
        "Ribbon",
        fe(
          (F, O) => {
            let T = S.getPoint(O),
              B = (F - 0.5) * 0.08;
            return [T.x + B, T.y, T.z + 0.005];
          },
          3,
          16,
        ),
        a,
      );
    }
    let p = M.filter((u) => u.z < 0);
    U(
      o,
      "Ribbon back",
      new R.TubeGeometry(
        new R.CatmullRomCurve3(p.sort((u, y) => u.x - y.x)),
        40,
        0.025,
        6,
      ),
      a,
    );
    let h = new R.Group();
    (h.position.copy(d).add(ce(0, -0.06, 0.04)),
      o.add(h),
      (U(
        h,
        "Medal",
        new R.CylinderGeometry(0.13, 0.13, 0.03, 48),
        i,
      ).rotation.x = Math.PI / 2),
      U(
        h,
        "Medal rim",
        new R.TorusGeometry(0.125, 0.015, 8, 48),
        i,
        [0, 0, 0.012],
      ),
      U(
        h,
        "Medal star",
        new R.ExtrudeGeometry(Pe(Ke(5, 0.08, 0.035)), {
          depth: 0.012,
          bevelEnabled: !1,
        }),
        i,
        [0, 0, 0.014],
      ),
      (A.medalla = { root: o, colors: { main: [a] } }));
  }
  let N = (o) => [
    k(ce(o * 0.26, 1.62, -0.5), 0.07),
    k(ce(o * 0.33, 1.88, -0.2), 0.07),
    k(ce(o * 0.36, 1.86, 0.15), 0.07),
    k(ce(o * 0.38, 1.55, 0.42), 0.07),
    k(ce(o * 0.44, 1.2, 0.45), 0.07),
  ];
  if (wanted("back", "mochila")) {
    let o = E(n, "back:mochila"),
      i = f("#ffc629", { roughness: 0.9 }),
      a = f("#26232e"),
      M = s("zip", "#d9d4c8", { metalness: 0.7, roughness: 0.3, sheen: 0 }),
      d = k(ce(0, 1.2, -0.3), 0.06).z;
    (U(o, "Backpack body", new At(0.78, 0.86, 0.34, 6, 0.12), i, [
      0,
      1.22,
      d - 0.19,
    ]),
      U(o, "Front pocket", new At(0.56, 0.34, 0.14, 5, 0.06), i, [
        0,
        1.02,
        d - 0.4,
      ]),
      Q(
        o,
        "Pocket zip",
        [
          [-0.24, 1.17, d - 0.47],
          [0, 1.18, d - 0.475],
          [0.24, 1.17, d - 0.47],
        ],
        0.012,
        M,
        !1,
        16,
      ),
      Q(
        o,
        "Top zip",
        Array.from({ length: 13 }, (p, h) => {
          let u = (h / 12 - 0.5) * Math.PI;
          return [
            Math.sin(u) * 0.36,
            1.6 + Math.cos(u) * 0.04,
            d - 0.19 + Math.cos(u) * -0.1,
          ];
        }),
        0.012,
        M,
        !1,
        30,
      ),
      Q(
        o,
        "Handle",
        [
          [-0.1, 1.64, d - 0.18],
          [0, 1.73, d - 0.18],
          [0.1, 1.64, d - 0.18],
        ],
        0.025,
        a,
        !1,
        16,
      ));
    for (let p of [-1, 1])
      Q(
        o,
        "Strap",
        N(p).map((h) => h.toArray()),
        0.04,
        a,
        !1,
        40,
      );
    D.mochila = { root: o, colors: { main: [i], dark: [a] } };
  }
  if (wanted("back", "capa")) {
    let o = E(n, "back:capa"),
      i = f("#b3122e", { roughness: 0.6, sheen: 0.8, side: R.BackSide }),
      a = f("#ffc629", { side: R.FrontSide, roughness: 0.6, sheen: 0.8 }),
      M = b(),
      d = (O) => {
        let T = Math.PI * (1.4 - O * 0.8);
        return k(ce(Math.sin(T) * 0.42, 1.88, Math.cos(T) * 0.36), 0.09);
      },
      p = Array.from({ length: 31 }, (O, T) => d(T / 30)),
      h = [],
      u = 30,
      y = 26;
    for (let O = 0; O <= y; O++)
      for (let T = 0; T <= u; T++) {
        let B = T / u,
          _ = O / y,
          q = p[T],
          oe = ce((B - 0.5) * 2, 0.28, -0.7 - 0.25 * Math.sin(Math.PI * B)),
          ne = q.clone().lerp(oe, _);
        ((ne.z -= Math.sin(_ * Math.PI) * 0.12),
          (ne.z += Math.sin(B * Math.PI * 6) * 0.04 * _),
          k(ne, 0.1),
          h.push(ne.x, ne.y, ne.z));
      }
    let S = fe(() => [0, 0, 0], u, y);
    (S.attributes.position.array.set(h),
      S.computeVertexNormals(),
      U(o, "Cape", S, i),
      U(o, "Cape lining", S, a));
    for (let O of [-1, 1])
      ie(
        o,
        "Clasp",
        M,
        k(ce(O * 0.3, 1.82, 0.3), 0.1).toArray(),
        [0.06, 0.06, 0.03],
      );
    Q(
      o,
      "Clasp chain",
      [
        k(ce(-0.3, 1.8, 0.3), 0.1).toArray(),
        k(ce(0, 1.72, 0.4), 0.1).toArray(),
        k(ce(0.3, 1.8, 0.3), 0.1).toArray(),
      ],
      0.01,
      M,
      !1,
      20,
    );
    let F = S.attributes.position;
    D.capa = {
      root: o,
      colors: { main: [i], accent: [a] },
      update(O) {
        for (let T = 0; T <= y; T++)
          for (let B = 0; B <= u; B++) {
            let _ = T * (u + 1) + B,
              q = T / y,
              oe = B / u;
            (F.setZ(
              _,
              h[_ * 3 + 2] - Math.sin(O * 1.8 + oe * 3) * 0.05 * q * q,
            ),
              F.setX(_, h[_ * 3] + Math.sin(O * 1.3 + q * 2) * 0.03 * q * q));
          }
        F.needsUpdate = !0;
      },
    };
  }
  if (wanted("back", "alas")) {
    let o = E(n, "back:alas"),
      i = s("feather red", "#d8262f", {
        side: R.DoubleSide,
        roughness: 0.6,
        sheen: 0.5,
      }),
      a = s("feather yellow", "#ffc629", {
        side: R.DoubleSide,
        roughness: 0.6,
      }),
      M = s("feather blue", "#2d6fe0", {
        side: R.DoubleSide,
        roughness: 0.55,
        sheen: 0.5,
      }),
      d = s("feather teal", "#22a7c9", { side: R.DoubleSide, roughness: 0.55 }),
      p = (y, S) => {
        let F = Pe(
            Array.from({ length: 24 }, (B, _) => {
              let q = (_ / 24) * be;
              return [
                Math.sin(q) *
                  S *
                  (0.55 + 0.45 * Math.cos(q / 2) ** 2) *
                  (Math.cos(q) > 0.85 ? 0.6 : 1),
                (1 - Math.cos(q)) * 0.5 * y,
              ];
            }),
          ),
          O = new R.ShapeGeometry(F, 4),
          T = O.attributes.position;
        for (let B = 0; B < T.count; B++)
          T.setZ(B, -0.06 * (T.getY(B) / y) ** 2);
        return (O.computeVertexNormals(), O);
      },
      h = k(ce(0, 1.55, -0.3), 0.08).z,
      u = [];
    for (let y of [-1, 1]) {
      let S = new R.Group();
      (S.position.set(y * 0.18, 1.58, h - 0.04),
        o.add(S),
        u.push(S),
        [
          [M, 9, 1.05, 0.11, -0.2],
          [d, 8, 0.75, 0.1, -0.1],
          [a, 8, 0.5, 0.1, -0.05],
          [i, 9, 0.34, 0.09, 0],
        ].forEach(([O, T, B, _, q], oe) => {
          for (let ne = 0; ne < T; ne++) {
            let te = ne / (T - 1),
              Z = new R.Mesh(
                p(B * (0.75 + 0.35 * Math.sin(te * Math.PI)), _),
                O,
              ),
              J = y * (0.25 + te * 1.45) + Math.PI;
            (Z.position.set(
              y * (0.05 + te * 0.55) * (1 - oe * 0.12),
              0.06 + oe * 0.03 - te * 0.12,
              q - oe * 0.012 - 0.01 * ne,
            ),
              Z.rotation.set(0, y * 0.35, J),
              S.add(Z));
          }
        }));
    }
    D.alas = {
      root: o,
      colors: {},
      update(y) {
        u.forEach((S, F) => {
          S.rotation.y = (F ? -1 : 1) * (0.25 + Math.sin(y * 2.4) * 0.12);
        });
      },
    };
  }
  if (wanted("back", "cohete")) {
    let o = E(n, "back:cohete"),
      i = s("jet metal", "#c9ced8", {
        metalness: 0.75,
        roughness: 0.3,
        sheen: 0,
      }),
      a = w("#ff4b4b"),
      M = w("#26232e"),
      d = new R.MeshBasicMaterial({
        color: "#ffb02e",
        transparent: !0,
        opacity: 0.85,
        blending: R.AdditiveBlending,
        depthWrite: !1,
      });
    c.add(d);
    let p = new R.MeshBasicMaterial({
      color: "#fff3b0",
      transparent: !0,
      opacity: 0.9,
      blending: R.AdditiveBlending,
      depthWrite: !1,
    });
    c.add(p);
    let h = k(ce(0, 1.3, -0.3), 0.06).z;
    U(o, "Jet plate", new At(0.42, 0.62, 0.1, 4, 0.04), M, [0, 1.3, h - 0.05]);
    let u = [];
    for (let y of [-1, 1]) {
      let S = y * 0.22,
        F = h - 0.2;
      (U(o, "Tank", new R.CylinderGeometry(0.15, 0.15, 0.66, 32), i, [
        S,
        1.3,
        F,
      ]),
        ie(o, "Tank nose", a, [S, 1.63, F], [0.15, 0.17, 0.15]),
        U(o, "Tank stripe", new R.CylinderGeometry(0.153, 0.153, 0.08, 32), a, [
          S,
          1.2,
          F,
        ]),
        U(o, "Nozzle", new R.CylinderGeometry(0.09, 0.13, 0.12, 24, 1, !0), M, [
          S,
          0.92,
          F,
        ]));
      let O = new R.Group();
      (O.position.set(S, 0.86, F), o.add(O), u.push(O));
      let T = new R.Mesh(new R.ConeGeometry(0.1, 0.42, 20, 1, !0), d);
      ((T.rotation.x = Math.PI), (T.position.y = -0.21), O.add(T));
      let B = new R.Mesh(new R.ConeGeometry(0.05, 0.24, 16, 1, !0), p);
      ((B.rotation.x = Math.PI), (B.position.y = -0.12), O.add(B));
    }
    for (let y of [-1, 1])
      Q(
        o,
        "Strap",
        N(y).map((S) => S.toArray()),
        0.035,
        M,
        !1,
        40,
      );
    D.cohete = {
      root: o,
      colors: { main: [a] },
      update(y) {
        u.forEach((S, F) => {
          let O =
            0.8 + 0.25 * Math.sin(y * 31 + F * 2) + 0.15 * Math.sin(y * 17 + F);
          S.scale.set(1, O, 1);
        });
      },
    };
  }
  if (wanted("back", "morrocoy")) {
    let o = E(n, "back:morrocoy"),
      i = s("shell", "#ffffff", {
        vertexColors: !0,
        roughness: 0.55,
        clearcoat: 0.4,
        sheen: 0,
      }),
      a = f("#5a4130"),
      M = k(ce(0, 1.15, -0.3), 0.05).z,
      d = [
        [0, 0.1],
        [0, 0.45],
        [0, -0.28],
        [-0.42, 0.25],
        [0.42, 0.25],
        [-0.45, -0.18],
        [0.45, -0.18],
        [-0.75, 0.05],
        [0.75, 0.05],
        [0, 0.78],
        [0, -0.62],
      ],
      p = new R.Color("#3b2a1f"),
      h = new R.Color("#e8a33a"),
      u = fe(
        (S, F) => {
          let O = (S - 0.5) * Math.PI * 0.98,
            T = (F - 0.5) * Math.PI * 0.96,
            B = Math.sin(O) * Math.cos(T) * 0.78,
            _ = Math.sin(T) * 0.72,
            oe = Math.cos(O) * Math.cos(T) * 0.36,
            ne = d
              .map(([te, Z]) => Math.hypot(B / 0.78 - te * 0.9, _ / 0.72 - Z))
              .sort((te, Z) => te - Z);
          return (
            (oe -= Math.max(0, 0.05 - (ne[1] - ne[0])) * 0.5),
            [B, 1.15 + _, M - 0.02 - oe]
          );
        },
        64,
        48,
      ),
      y = () =>
        yt(u, (S, F, O) => {
          let T = d
              .map(([q, oe]) =>
                Math.hypot(F / 0.78 - q * 0.9, (O - 1.15) / 0.72 - oe),
              )
              .sort((q, oe) => q - oe),
            B = R.MathUtils.smoothstep(T[1] - T[0], 0.02, 0.08),
            _ = 1 - R.MathUtils.smoothstep(T[0], 0.05, 0.16);
          S.copy(p)
            .multiplyScalar(0.6 + 0.4 * B)
            .lerp(h, _ * B);
        });
    (y(),
      (U(o, "Shell", u, i).material.side = R.DoubleSide),
      Q(
        o,
        "Shell rim",
        Array.from({ length: 49 }, (S, F) => {
          let O = (F / 48) * be;
          return [Math.cos(O) * 0.78, 1.15 + Math.sin(O) * 0.72, M - 0.03];
        }),
        0.04,
        s("rim", "#2a1d15", { roughness: 0.6 }),
        !0,
        96,
      ));
    for (let S of [-1, 1])
      Q(
        o,
        "Strap",
        N(S).map((F) => F.toArray()),
        0.035,
        a,
        !1,
        40,
      );
    D.morrocoy = {
      root: o,
      colors: {},
      recolor: {
        main: (S) => {
          ((h = new R.Color(S)), y());
        },
      },
    };
  }
  let P = E(n, "print"),
    G = {
      main: s("print", "#ffc629", {
        roughness: 0.9,
        sheen: 0,
        polygonOffset: !0,
        polygonOffsetFactor: -2,
      }),
      white: s("print white", "#fff8e9", {
        roughness: 0.9,
        sheen: 0,
        polygonOffset: !0,
        polygonOffsetFactor: -3,
      }),
      dark: s("print dark", "#26232e", {
        roughness: 0.9,
        sheen: 0,
        polygonOffset: !0,
        polygonOffsetFactor: -4,
      }),
      arepa: s("print arepa", "#e9bb6e", {
        roughness: 0.9,
        sheen: 0,
        polygonOffset: !0,
        polygonOffsetFactor: -2,
      }),
      toast: s("print toast", "#b7742f", {
        roughness: 0.9,
        sheen: 0,
        polygonOffset: !0,
        polygonOffsetFactor: -3,
      }),
      yellow: s("flag yellow", "#ffcc00", {
        roughness: 0.9,
        sheen: 0,
        polygonOffset: !0,
        polygonOffsetFactor: -2,
      }),
      blue: s("flag blue", "#00247d", {
        roughness: 0.9,
        sheen: 0,
        polygonOffset: !0,
        polygonOffsetFactor: -2,
      }),
      red: s("flag red", "#cf142b", {
        roughness: 0.9,
        sheen: 0,
        polygonOffset: !0,
        polygonOffsetFactor: -2,
      }),
    },
    L = {},
    ee = (o) => {
      if (L[o]) return L[o];
      let i = r.tops[o];
      if (i) {
        let a = it(i.garment.geometry);
        L[o] = a;
      } else L[o] = (a, M) => k(ce(a, M, m(a, M) - 0.04), 0.012).z;
      return L[o];
    },
    V = {
      estrella: (o) => [
        ["main", Ke(5, o, o * 0.45)],
        ["white", Ke(5, o * 0.42, o * 0.19)],
      ],
      rayo: (o) => [
        [
          "main",
          [
            [-0.35, 1],
            [0.45, 1],
            [0.05, 0.15],
            [0.5, 0.15],
            [-0.4, -1],
            [-0.02, -0.1],
            [-0.45, -0.1],
          ].map(([i, a]) => [i * o, a * o]),
        ],
      ],
      corazon: (o) => [
        ["main", ao(o / 16)],
        ["white", Oe(o * 0.13, -o * 0.38, o * 0.3, 16)],
      ],
      sol: (o) => [
        ["main", Ke(12, o, o * 0.7)],
        ["white", Oe(o * 0.55)],
        ["main", Oe(o * 0.45)],
      ],
      arepa: (o) => [
        ["arepa", Oe(o, 0, 0, 40, o * 0.82)],
        ...[
          [0.35, 0.3],
          [-0.4, 0.2],
          [0.05, -0.35],
          [-0.2, 0.45],
          [0.5, -0.25],
        ].map(([i, a]) => ["toast", Oe(o * 0.1, i * o, a * o, 12)]),
        ["dark", Oe(o * 0.5, 0, -o * 0.05, 30, o * 0.08)],
      ],
      tricolor: (o) => [
        [
          "yellow",
          [
            [-1.3, 0.33],
            [1.3, 0.33],
            [1.3, 1],
            [-1.3, 1],
          ].map(([i, a]) => [i * o, a * o * 0.75]),
        ],
        [
          "blue",
          [
            [-1.3, -0.33],
            [1.3, -0.33],
            [1.3, 0.33],
            [-1.3, 0.33],
          ].map(([i, a]) => [i * o, a * o * 0.75]),
        ],
        [
          "red",
          [
            [-1.3, -1],
            [1.3, -1],
            [1.3, -0.33],
            [-1.3, -0.33],
          ].map(([i, a]) => [i * o, a * o * 0.75]),
        ],
        ...Array.from({ length: 8 }, (i, a) => {
          let M = Math.PI * (0.85 - a * 0.1);
          return [
            "white",
            Ke(
              5,
              o * 0.09,
              o * 0.04,
              Math.PI / 2,
              Math.cos(M) * o * 0.55,
              -o * 0.18 + Math.sin(M) * o * 0.4,
            ),
          ];
        }),
      ],
      numero: (o) => [
        ["white", Oe(o)],
        ["main", Oe(o * 0.86)],
        ["white", Oe(o * 0.72)],
        [
          "dark",
          [
            [-0.35, 0.5],
            [0.4, 0.5],
            [0.4, 0.35],
            [-0.05, -0.55],
            [-0.25, -0.55],
            [0.15, 0.32],
            [-0.35, 0.32],
          ].map(([i, a]) => [i * o, a * o]),
        ],
      ],
    };
  function $(o, i) {
    if (
      (P.traverse(child => child.geometry?.dispose()), P.clear(),
      (P.visible = o !== "none" && i !== "chef"),
      Object.values(r.tops).forEach((p) =>
        p.group.traverse((h) => {
          h.name === "Pana crown emblem" && (h.visible = o === "none");
        }),
      ),
      !P.visible)
    )
      return;
    let a = ee(i),
      M = i === "hoodie" ? 1.52 : 1.36,
      d = o === "tricolor" ? 0.14 : 0.16;
    V[o](d).forEach(([p, h], u) =>
      ye(
        P,
        `Print ${o}`,
        Pe(h.map(([y, S]) => [y, S + M])),
        G[p],
        (y, S) => a(y, S) + 0.004 + u * 0.0015,
        10,
      ),
    );
  }
  let j = { hat: l, glasses: C, neck: A, back: D };
  function Y(o, i) {
    for (let [a, M] of Object.entries(j[o])) M.root.visible = a === i;
    o === "hat" &&
      I.forEach((a) => {
        a.visible = !l[i]?.hideEars;
      });
  }
  function K(o, i, a, M) {
    let d = j[o]?.[i] || (o === "face" ? v[i] : null);
    if (!(!d || !M)) {
      if (d.recolor?.[a]) return d.recolor[a](M);
      for (let p of d.colors?.[a] || [])
        (p.color.set(M),
          p.sheenColor &&
            a !== "lens" &&
            p.sheenColor.set(M).lerp(new R.Color("#ffffff"), 0.5),
          a === "main" &&
            d.colors.dark &&
            d.colors.dark.forEach((h) => h.color.set(M).multiplyScalar(0.62)));
    }
  }
  return {
    hats: l,
    glasses: C,
    face: v,
    neck: A,
    back: D,
    show: Y,
    color: K,
    setFace(o, i) {
      v[o] && (v[o].root.visible = i);
    },
    setPrint: $,
    printColor: (o) => {
      G.main.color.set(o);
    },
    update(o) {
      for (let i of [D])
        for (let a of Object.values(i))
          a.root.visible && a.update && a.update(o);
    },
    dispose() {
      for (const root of roots) { root.traverse(child => child.geometry?.dispose()); root.removeFromParent(); }
      c.forEach((o) => {
        (o.map?.dispose(), o.dispose());
      });
    },
  };
}
