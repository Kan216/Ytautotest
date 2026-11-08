// Harbour kit (history / war): an old colonial waterfront with a palace + verandas, a clock tower with working
// hands, a flag on a breakable pole, a whitewashed town, palms, a beach, five Victorian warships in line with port
// broadsides, a white royal yacht and a bow deck gun. Built for "The 38-Minute War" (Zanzibar 1896).
import * as THREE from "three";
import { rep, rng, planksHD, stoneHD, cobbleHD } from "../core/paint";
import { twoTone } from "../core/shade";
import { V3, V, quad, box, at, Batch, lam, col } from "../core/geo";
import { bayTex, clockTex, flagTex, smokeTex } from "../core/textures";
import { building, palm, Building } from "../core/builders";
import { toward } from "../core/cameras";
import { Anchor, Ctx, KitDef, KitWorld } from "../core/types";

const GROUND = 1.0, DECK = 5.6, SHIP_Z = 120;
const PALACE = { x0: -22, x1: 22, z0: -32, z1: -14, h: 13 };
const TOWER = { x: -30, z: -22, w: 7, h: 30, clockY: 24, clockR: 2.5 };
const POLE = { x: 9, z: -22, base: PALACE.h, h: 10, brk: 4.2 };
const SHIPS_X = [-148, -68, 12, 92, 172], SX = SHIPS_X[2];
const PALACE_C: V3 = [2, 8, -16];
const DECK_BOW: V3 = [SX + 17.4, DECK, SHIP_Z + 3.6], BRIDGE_WING: V3 = [SX + 13.2, DECK, SHIP_Z + 2.2];
const GUN_BASE: V3 = toward([DECK_BOW[0], DECK + 2.9, DECK_BOW[2]], PALACE_C, 7.2, 0, DECK);
const GUN: V3 = toward(GUN_BASE, PALACE_C, 3.7, 0, DECK + 1.75);
const HITS: V3[] = [[-12, 8, -13.6], [6, 10.5, -13.6], [15, 5.2, -13.6], [-4, 12.6, -18]];

type ShipKind = { L: number; B: number; hull: string; band: string; funnels: number[]; masts: number[]; big: boolean };
const WARSHIP: ShipKind = { L: 64, B: 11, hull: "#2a2b33", band: "#f1eee6", funnels: [-9, -2], masts: [-20, 3], big: true };
const YACHT: ShipKind = { L: 38, B: 6.5, hull: "#f3f0e8", band: "#c9a55c", funnels: [-2], masts: [-10, 7], big: false };
const hullShape = (L: number, B: number, s = 1) => {
  const sh = new THREE.Shape(), h = (B / 2) * s;
  sh.moveTo(-L / 2, -h * 0.82); sh.quadraticCurveTo(-L / 2 - 2, 0, -L / 2, h * 0.82);
  sh.lineTo(L * 0.22, h); sh.quadraticCurveTo(L * 0.42, h * 0.9, L / 2, 0); sh.quadraticCurveTo(L * 0.42, -h * 0.9, L * 0.22, -h); sh.closePath();
  return sh;
};
const extrude = (sh: THREE.Shape, y0: number, y1: number) => {
  const g = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 10 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); return g;
};
/** a ship along +x at (x, z); returns muzzle points of its port (shore-side, -z) battery */
const ship = (b: Batch, k: ShipKind, x: number, z: number, M: Record<string, THREE.Material>) => {
  const g = (geo: THREE.BufferGeometry, m: THREE.Material) => b.add(geo.translate(x, 0, z), m);
  const top = k.big ? DECK : 3.4, bandH = k.big ? 1.1 : 0.6;
  g(extrude(hullShape(k.L, k.B), -1.2, top - bandH), col(k.hull));
  g(extrude(hullShape(k.L, k.B), top - bandH, top), col(k.band));
  const deck = new THREE.ShapeGeometry(hullShape(k.L, k.B, 0.985), 10); deck.rotateX(-Math.PI / 2); deck.translate(0, top + 0.01, 0);
  g(deck, M.deck);
  // rail posts + top rail around the deck edge (white)
  const pts = hullShape(k.L, k.B, 0.97).getSpacedPoints(70);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], c = pts[i + 1], mx = (a.x + c.x) / 2, mz = -(a.y + c.y) / 2, len = Math.hypot(c.x - a.x, c.y - a.y), ang = Math.atan2(-(c.y - a.y), c.x - a.x);
    g(at(new THREE.BoxGeometry(len, 0.09, 0.09), mx, top + 1.0, mz, -ang), col("#f3f0e8"));
    if (i % 2 === 0) g(at(new THREE.BoxGeometry(0.07, 1.0, 0.07), a.x, top + 0.5, -a.y), col("#f3f0e8"));
  }
  // superstructure, bridge, funnels, masts
  const s = k.big ? 1 : 0.6;
  g(box(-16 * s, top, -2.2 * s, 6 * s, top + 2.8 * s, 2.2 * s), col("#f1eee6"));
  g(box(1 * s, top + 2.8 * s, -3.2 * s, 7 * s, top + 4.6 * s, 3.2 * s), col("#f1eee6"));
  g(box(1.4 * s, top + 3.4 * s, -3.21 * s, 6.6 * s, top + 4.0 * s, 3.21 * s), col("#33404c"));
  for (const fx of k.funnels) {
    g(at(new THREE.CylinderGeometry(1.25 * s, 1.35 * s, 7.5 * s, 16), fx * s, top + 2.8 * s + 3.75 * s, 0), col("#d6ad5e"));
    g(at(new THREE.CylinderGeometry(1.3 * s, 1.3 * s, 1.1 * s, 16), fx * s, top + 2.8 * s + 7.5 * s + 0.5 * s, 0), col("#25262c"));
  }
  for (const mx of k.masts) {
    g(at(new THREE.CylinderGeometry(0.16, 0.26, 22 * s, 8), mx * s, top + 11 * s, 0), col("#8a6a4a"));
    g(at(new THREE.BoxGeometry(0.18, 0.18, 9 * s), mx * s, top + 16 * s, 0), col("#8a6a4a"));
  }
  const muzzles: V3[] = [];
  if (k.big) {
    for (const tx of [-24, 24]) { // fore and aft gun turrets
      g(at(new THREE.CylinderGeometry(2.4, 2.6, 1.8, 18), tx, top + 0.9, 0), col("#9aa1a9"));
      g(at(new THREE.CylinderGeometry(0.28, 0.32, 5, 10), tx + Math.sign(tx) * 2.6, top + 1.2, 0, 0, 0, Math.PI / 2), col("#4a4f58"));
    }
    for (let gx = -15; gx <= 9; gx += 6) { // port broadside guns, pointing at the shore (-z)
      g(box(gx - 1, 2.4, -k.B / 2 - 0.4, gx + 1, 3.8, -k.B / 2 + 0.6), col("#f1eee6"));
      g(at(new THREE.CylinderGeometry(0.2, 0.24, 2.6, 10), gx, 3.1, -k.B / 2 - 1.5, 0, Math.PI / 2), col("#3c4048"));
      muzzles.push([x + gx, 3.1, z - k.B / 2 - 2.9]);
    }
  }
  return muzzles;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeIO = (x: number) => { const u = clamp01(x); return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; };

const build = (seed: number): KitWorld => {
  const root = new THREE.Group(), b = new Batch();
  // ---- ground: beach slope, town level, plaza, quay edge ----
  const sand = lam("sand", () => ({ map: rep(stoneHD("sandHD", ["#ecd9a8", "#e6d19c", "#f0dfb2", "#e2cb94"], "#e0c890"), 1, 1) }));
  const plaza = lam("plaza", () => ({ map: cobbleHD() }));
  b.add(quad(V(-700, -1.0, 12), V(700, -1.0, 12), V(700, GROUND - 0.6, -6), V(-700, GROUND - 0.6, -6), 140, 4), sand);
  b.add(quad(V(-700, GROUND, -5.9), V(700, GROUND, -5.9), V(700, GROUND, -700), V(-700, GROUND, -700), 140, 140), sand);
  b.add(quad(V(-46, GROUND + 0.02, -6), V(36, GROUND + 0.02, -6), V(36, GROUND + 0.02, -14), V(-46, GROUND + 0.02, -14), 16, 1.6), plaza);
  b.add(box(-700, GROUND - 0.7, -6.4, 700, GROUND + 0.05, -5.9), col("#cdbb93"));
  b.build(root);
  // ---- palace with two storeys of verandas ----
  const big = new Batch();
  const pw = lam("palaceBay", () => ({ map: bayTex("palace", "#f4ecdb", "#2f6f73", { band: "#e3d6bb" }) }));
  const pPlain = col("#f4ecdb"), pRoof = col("#d8cab0");
  building(big, { x0: PALACE.x0, x1: PALACE.x1, z0: PALACE.z0, z1: PALACE.z1, h: PALACE.h - GROUND }, pw, pPlain, pRoof, 4, 4, GROUND);
  const front = PALACE.z1, wood = col("#8e5b36"), white = col("#f6f1e6");
  for (const [y0, y1, yd] of [[GROUND, 8.6, 8.6], [9.0, 13, 13]] as const) {
    for (let x = PALACE.x0 + 1; x <= PALACE.x1 - 0.9; x += 3.5) big.add(box(x - 0.28, y0, front + 2.7, x + 0.28, y1, front + 3.26), white);
    big.add(box(PALACE.x0 - 0.3, yd, front, PALACE.x1 + 0.3, yd + 0.42, front + 3.5), white);
    big.add(box(PALACE.x0, yd + 0.42, front + 3.25, PALACE.x1, yd + 1.3, front + 3.42), wood);
  }
  big.add(box(PALACE.x0 - 0.5, PALACE.h, front - 0.2, PALACE.x1 + 0.5, PALACE.h + 0.45, front + 3.8), pPlain);
  // ---- clock tower ----
  const tw = lam("towerWall", () => ({ map: stoneHD("towerHD", ["#efe4cf", "#e8dcc4", "#f3eadb", "#e2d5bb"], "#cdbd9f") }));
  const { x: tx, z: tz, w: tW, h: tH } = TOWER, th = tW / 2;
  big.add(box(tx - th, GROUND - 0.5, tz - th, tx + th, tH, tz + th, 3), tw);
  for (const yb of [12, 21, 27.5]) big.add(box(tx - th - 0.3, yb, tz - th - 0.3, tx + th + 0.3, yb + 0.6, tz + th + 0.3), pPlain);
  const cap = new THREE.ConeGeometry(th * 1.45, 5.5, 4); cap.rotateY(Math.PI / 4);
  big.add(at(cap, tx, tH + 2.75, tz), col("#b8553a"));
  big.add(at(new THREE.CylinderGeometry(0.08, 0.12, 3, 6), tx, tH + 6.8, tz), col("#3a3a40"));
  const face = new THREE.Mesh(new THREE.CircleGeometry(TOWER.clockR, 48), twoTone(new THREE.MeshLambertMaterial({ map: clockTex() })));
  face.position.set(tx, TOWER.clockY, tz + th + 0.04); face.receiveShadow = true; root.add(face);
  const hand = (len: number, w: number) => {
    const g = new THREE.BoxGeometry(w, len, 0.08); g.translate(0, len / 2 - 0.25, 0);
    const m = new THREE.Mesh(g, col("#1c1720")); m.position.set(tx, TOWER.clockY, tz + th + 0.12); m.castShadow = true; root.add(m); return m;
  };
  const hourH = hand(TOWER.clockR * 0.55, 0.22), minH = hand(TOWER.clockR * 0.82, 0.14);
  // ---- flag pole (upper part + flag can fall) ----
  big.add(at(new THREE.CylinderGeometry(0.12, 0.16, POLE.brk, 8), POLE.x, POLE.base + POLE.brk / 2, POLE.z), col("#e9e4d8"));
  const poleTop = new THREE.Group(); poleTop.position.set(POLE.x, POLE.base + POLE.brk, POLE.z);
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, POLE.h - POLE.brk, 8).translate(0, (POLE.h - POLE.brk) / 2, 0), col("#e9e4d8"));
  upper.castShadow = true; poleTop.add(upper);
  const fg = new THREE.PlaneGeometry(5.2, 3.3, 16, 6); fg.translate(2.6 + 0.12, POLE.h - POLE.brk - 1.75, 0);
  const flag = new THREE.Mesh(fg, twoTone(new THREE.MeshLambertMaterial({ map: flagTex(), side: THREE.DoubleSide })));
  flag.castShadow = true; const flagPos = Float32Array.from(fg.attributes.position.array as Float32Array);
  poleTop.add(flag); root.add(poleTop);
  // ---- town ----
  const WALLS = [["#f3ead8", "#2f6f73"], ["#efdfc0", "#7a4a2a"], ["#e8d2ac", "#3d5f8a"], ["#f6f1e6", "#4f7d4a"], ["#ead8c4", "#2f6f73"]];
  const wallM = WALLS.map(([w, s], i) => lam("bay" + i, () => ({ map: bayTex("h" + i, w, s) })));
  const plainM = WALLS.map(([w]) => col(w)), roofM = col("#d9cbb0");
  const r = rng(7 + seed), houses: Building[] = [];
  const free = (B: Building) => houses.every((h) => B.x1 + 2 < h.x0 || B.x0 - 2 > h.x1 || B.z1 + 2 < h.z0 || B.z0 - 2 > h.z1)
    && (B.x1 < PALACE.x0 - 2 || B.x0 > PALACE.x1 + 2 || B.z1 < PALACE.z0 - 3 || B.z0 > PALACE.z1 + 4)
    && (B.x1 < TOWER.x - 6 || B.x0 > TOWER.x + 6 || B.z1 < TOWER.z - 6 || B.z0 > TOWER.z + 6);
  for (let i = 0; i < 900 && houses.length < 150; i++) {
    const w = 7 + r() * 9, d = 7 + r() * 7, x = -320 + r() * 640, z = -14 - r() * 170;
    const h = 5 + r() * (8 + 4 * (z > -30 ? 0 : 1));
    const B = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h };
    if (B.z1 > -9) continue;
    if (free(B)) houses.push(B);
  }
  houses.forEach((B, i) => building(big, B, wallM[i % 5], plainM[i % 5], roofM, 4, 4, GROUND));
  // ---- palms ----
  const trunk = col("#8a6a4a"), leafs = ["#4f9a3c", "#5aa843", "#43893a"].map((c) => col(c, THREE.DoubleSide));
  const rp = rng(11 + seed), pb = new Batch();
  const foot = (z: number) => GROUND - 0.3 - (z > -6 ? (z + 6) / 9 : 0);
  for (let i = 0; i < 80; i++) {
    const x = -300 + rp() * 600, z = -10 + rp() * 9;
    if (x > PALACE.x0 - 3 && x < PALACE.x1 + 3 && z > -12) continue;
    palm(pb, x, z, 9 + rp() * 6, i + 1, trunk, leafs, foot(z));
  }
  for (const [x, z] of [[-40, -30], [30, -40], [-60, -18], [44, -16], [-14, -42], [58, -60], [-80, -50]]) palm(pb, x, z, 11 + rp() * 4, x * 7 + z, trunk, leafs, foot(z));
  pb.build(root);
  // ---- ships ----
  const sb = new Batch(), M = { deck: lam("deck", () => ({ map: rep(planksHD(), 0.18, 0.18) })) };
  const muzzles: V3[] = [];
  SHIPS_X.forEach((x) => muzzles.push(...ship(sb, WARSHIP, x, SHIP_Z, M)));
  ship(sb, YACHT, 46, 40, M);
  sb.add(at(new THREE.CylinderGeometry(0.9, 1.05, 0.7, 14), GUN_BASE[0], DECK + 0.35, GUN_BASE[2]), col("#7d838c"));
  const gun = new THREE.Group(); gun.position.set(GUN_BASE[0], DECK + 1.3, GUN_BASE[2]);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 4.0, 12).rotateX(Math.PI / 2).translate(0, 0, 1.7), col("#3c4048"));
  const breech = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.9), col("#5d636c"));
  barrel.castShadow = breech.castShadow = true; gun.add(barrel, breech); gun.lookAt(...GUN); root.add(gun);
  const occ = [...big.build(root), ...sb.build(root)];

  const smokes = [0, 1, 2, 3].map((i) => smokeTex(i, true));
  const anchors: Record<string, Anchor> = {
    "clock": { p: [tx, TOWER.clockY, tz + th], size: 6.5, view: 8 },
    "tower": { p: [tx, 17, tz], size: 34, view: 15 },
    "palace": { p: PALACE_C, size: 22, view: 30, ground: GROUND },
    "palace-flag": { p: [POLE.x + 2, POLE.base + POLE.h - 1.5, POLE.z], size: 9, view: 35 },
    "palace-hits": { p: [4, 9, -14], size: 20, view: 30, points: HITS },
    "town": { p: [-30, 6, -70], size: 90, view: 20, ground: GROUND },
    "beach": { p: [0, 1, -3], size: 24, view: 10, ground: GROUND - 0.4 },
    "fleet": { p: [SX + 30, 3, SHIP_Z - 8], size: 70, view: -72 },
    "fleet-guns": { p: [SX, 3, SHIP_Z - 8], size: 200, view: 0, points: muzzles },
    "flagship": { p: [SX, DECK, SHIP_Z], size: 66, view: 160 },
    "yacht": { p: [46, 3, 40], size: 38, view: 150 },
    "deck": { p: DECK_BOW, size: 6, view: 180, ground: DECK, eye: 2.9 },
    "bridge-wing": { p: BRIDGE_WING, size: 6, view: 180, ground: DECK, eye: 1.75 },
    "deck-gun": { p: GUN, size: 6, view: 180, ground: DECK, points: [GUN] },
  };
  return {
    root, anchors, occluders: occ, water: { shoreZ: 2.9 },
    floor: (x, z) => (z < -6 ? GROUND : 0),
    update(ctx: Ctx) {
      const t = ctx.t;
      // clock: hands show 9:00 + minutes (clock-sweep action moves them)
      let m = 0;
      for (const a of ctx.actions) if (a.id === "clock-sweep") {
        const f0 = Number(a.p?.from ?? 0), f1 = Number(a.p?.to ?? 60), u = easeIO((ctx.f - a.f) / Math.max(1, (a.f1 ?? a.f + 30) - a.f));
        m = f0 + (f1 - f0) * u;
      }
      const hr = 9;
      minH.rotation.z = -(m / 60) * Math.PI * 2; hourH.rotation.z = -((hr + m / 60) / 12) * Math.PI * 2;
      // flag waves, then falls with the broken pole top
      const fa = ctx.actions.find((a) => a.id === "flag-fall");
      const pf = fa ? (() => { const u = clamp01((t - fa.f / ctx.fps - 0.12) / 0.75); return u * u; })() : 0;
      const pos = flag.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x0 = flagPos[i * 3], y0 = flagPos[i * 3 + 1], u = (x0 - 0.12) / 5.2, amp = 0.55 * u * (1 - 0.6 * pf);
        pos.setXYZ(i, x0 - 0.15 * u * u, y0 - 0.25 * u * u * (1 + pf), amp * Math.sin(u * 5.2 - t * 6.5) + 0.2 * u * Math.sin(y0 * 1.3 - t * 4.1));
      }
      pos.needsUpdate = true; flag.geometry.computeVertexNormals();
      poleTop.rotation.set(0, 0.35, -pf * 1.75);
      poleTop.position.set(POLE.x + pf * 0.6, POLE.base + POLE.brk - pf * pf * 2.2, POLE.z);
      // deck gun recoils on a "fire" at deck-gun
      const fire = ctx.actions.find((a) => a.id === "fire" && a.at === "deck-gun"), tf = fire ? fire.f / ctx.fps : 1e9;
      const rc = t >= tf ? Math.exp(-(t - tf) * 7) * Math.min(1, (t - tf) * 60) : 0;
      gun.position.set(GUN_BASE[0] + (GUN_BASE[0] - GUN[0]) * 0.12 * rc, DECK + 1.3, GUN_BASE[2] + (GUN_BASE[2] - GUN[2]) * 0.12 * rc);
      // funnel smoke drifting off every warship
      SHIPS_X.forEach((x, i) => {
        for (const [k, fx] of WARSHIP.funnels.entries()) for (let j = 0; j < 4; j++) {
          const u = (t * 0.22 + j / 4 + i * 0.13 + k * 0.37) % 1, s = 2.4 + u * 7;
          ctx.soft.next().show(ctx.cam, smokes[(i + j) % 4], [x + fx - u * 16, DECK + 13.5 + u * 9, SHIP_Z + u * 3], s, s, 0.55 * (1 - u) ** 1.4);
        }
      });
    },
  };
};

export const HARBOUR: KitDef = {
  id: "harbour",
  desc: "old colonial harbour: palace with verandas, clock tower, flag, white town, palms, beach, warships, yacht",
  ambience: "harbour",
  anchors: {
    "clock": "the clock face on the tower (close-ups of time)", "tower": "the whole clock tower",
    "palace": "the palace building", "palace-flag": "the flag on the palace roof", "palace-hits": "points on the palace front (explosions)",
    "town": "the whitewashed town behind the waterfront", "beach": "the beach and shoreline",
    "fleet": "a line of five warships (aerial view down the line)", "fleet-guns": "all the warships' broadside guns (fire)",
    "flagship": "the lead warship", "yacht": "a small white royal yacht",
    "deck": "standing on the flagship's bow deck, facing the palace (use with from-to)",
    "bridge-wing": "standing on the flagship near the bridge, facing the palace (use with from-to)",
    "deck-gun": "the bow deck gun's muzzle (fire)",
  },
  actions: { "clock-sweep": "clock hands sweep from p.from to p.to minutes past nine (on -> until)", "flag-fall": "the palace flagpole snaps and the flag falls" },
  build,
};
