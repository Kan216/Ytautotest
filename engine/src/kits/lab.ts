// Lab kit (science): a big open-top laboratory hall (walls on three sides, so the sun still models the scene) with
// a tiled floor, benches of glowing beakers, a blackboard of abstract chalk diagrams (no text), a tesla coil that
// sparks, a big machine with dials, shelves and a window wall. Kit actions: "spark" (coil arcs), "bubble" (beakers).
import * as THREE from "three";
import { ctex, rng } from "../core/paint";
import { V, quad, box, at, Batch, lam, col } from "../core/geo";
import { burst, puff } from "../core/actions";
import { Anchor, Ctx, KitDef, KitWorld } from "../core/types";

const tiles = () => ctex("labTiles", 512, 512, (g) => {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? "#e9e6df" : "#cfd8dc"; g.fillRect(x * 64, y * 64, 64, 64); }
});
const board = () => ctex("blackboard", 1024, 512, (g, r) => {
  g.fillStyle = "#2f4a3c"; g.fillRect(0, 0, 1024, 512); g.strokeStyle = "rgba(240,240,230,0.85)"; g.lineWidth = 4;
  for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(120 + k * 160, 160 + (k % 2) * 140, 40 + r() * 30, 0, Math.PI * 2); g.stroke(); }
  g.beginPath(); g.moveTo(60, 440); for (let x = 60; x < 980; x += 10) g.lineTo(x, 380 - Math.sin(x * 0.02) * 60); g.stroke();
  for (let k = 0; k < 8; k++) { g.beginPath(); g.moveTo(80 + k * 120, 60); g.lineTo(140 + k * 120, 100); g.lineTo(80 + k * 120, 120); g.stroke(); }
});
const glow = (c: [number, number, number]) => new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), transparent: true, opacity: 0.9 });

const build = (seed: number): KitWorld => {
  const root = new THREE.Group(), b = new Batch(), big = new Batch(), r = rng(171 + seed);
  const W = 22, D = 16, H = 7, wall = col("#e7e1d4"), trim = col("#7a8a9a");
  b.add(quad(V(-W, 0, D), V(W, 0, D), V(W, 0, -D), V(-W, 0, -D), 6, 4), lam("labTiles", () => ({ map: tiles() })));
  big.add(box(-W, 0, -D - 0.4, W, H, -D), wall); big.add(box(-W - 0.4, 0, -D, -W, H, D), wall); big.add(box(W, 0, -D, W + 0.4, H, D), wall);
  for (const z of [-D + 0.01]) big.add(box(-W, 0, z, W, 0.5, z + 0.05), trim);
  // window wall strips on the right wall
  for (let k = 0; k < 4; k++) big.add(box(W - 0.05, 2, -12 + k * 7, W + 0.01, 5.6, -8 + k * 7), col("#9fd0f0"));
  // blackboard
  const bb = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), new THREE.MeshLambertMaterial({ map: board() })); bb.position.set(-6, 3.6, -D + 0.05); root.add(bb);
  // benches with beakers
  const beakers: THREE.Mesh[] = [];
  for (const [x, z] of [[-10, -4], [2, -4], [-10, 5], [2, 5]]) {
    big.add(box(x - 4, 0, z - 1, x + 4, 1.0, z + 1), col("#8a9aa6")); big.add(box(x - 4.1, 1.0, z - 1.1, x + 4.1, 1.12, z + 1.1), col("#2f3036"));
    for (let k = 0; k < 4; k++) {
      const c: [number, number, number] = [[0.6, 2.2, 0.8], [2.4, 0.6, 1.8], [0.6, 1.4, 2.6], [2.6, 2.0, 0.5]][k] as [number, number, number];
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.6 + r() * 0.4, 12), glow(c)); m.position.set(x - 3 + k * 2, 1.45, z + (r() - 0.5)); root.add(m); beakers.push(m);
    }
  }
  // tesla coil + big machine + shelves
  const CX = 14, CZ = -8;
  big.add(at(new THREE.CylinderGeometry(0.9, 1.2, 1.2, 16), CX, 0.6, CZ), col("#5d636c"));
  big.add(at(new THREE.CylinderGeometry(0.35, 0.35, 4.2, 16), CX, 3.3, CZ), col("#c98a3a"));
  big.add(at(new THREE.TorusGeometry(1.1, 0.4, 10, 24).rotateX(Math.PI / 2), CX, 5.6, CZ), col("#c9ccd2"));
  big.add(box(-18, 0, -12, -13, 4.5, -8), col("#5f7a8a"));
  for (let k = 0; k < 6; k++) big.add(at(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 14).rotateX(Math.PI / 2), -17 + (k % 3) * 1.6, 2.4 + Math.floor(k / 3) * 1.2, -7.95), col(k % 2 ? "#f3f1ec" : "#e8c45a"));
  for (let k = 0; k < 3; k++) big.add(box(8, 1 + k * 1.6, -D + 0.05, 14, 1.15 + k * 1.6, -D + 1.2), col("#7a4a2a"));
  b.build(root); const occ = big.build(root);

  const anchors: Record<string, Anchor> = {
    "lab": { p: [0, 3, -4], size: 34, view: 10, ground: 0 },
    "bench": { p: [2, 1.5, -4], size: 9, view: 20, ground: 0 },
    "beakers": { p: [2, 1.5, -4], size: 4, view: 15, ground: 0 },
    "coil": { p: [CX, 4, CZ], size: 7, view: -20, ground: 0, points: [[CX, 5.8, CZ]] },
    "machine": { p: [-15.5, 2.3, -10], size: 7, view: 30, ground: 0 },
    "blackboard": { p: [-6, 3.6, -D], size: 11, view: 0, ground: 0 },
    "window": { p: [W, 3.8, 0], size: 16, view: -90, ground: 0 },
    "doorway": { p: [0, 0, 13], size: 6, view: 180, ground: 0, eye: 1.7 },
  };
  return {
    root, anchors, occluders: occ, floor: () => 0,
    sky: { c: ["#e8eef2", "#d0e0ec", "#a8c8e4", "#80b0dc", "#5a96d4"], e: [0, 4, 12, 26, 60], fog: "#e6ecf0", fogNear: 200, fogFar: 900, clouds: true },
    update(ctx: Ctx) {
      for (const a of ctx.actions) {
        const t0 = a.f / ctx.fps;
        if (a.id === "spark") for (let k = 0; k < 6; k++) burst(ctx, t0 + k * 0.18, [CX + Math.sin(k * 2.3) * 1.2, 5.9 + Math.cos(k * 1.7) * 0.6, CZ + Math.cos(k * 2.3) * 1.2], 2.6, false);
        if (a.id === "bubble") for (let k = 0; k < 10; k++) { const b0 = beakers[k % beakers.length]; puff(ctx, t0 + k * 0.15, [b0.position.x, b0.position.y + 0.6, b0.position.z], 0.5, [0, 0.4, 0], k, false, 1.5); }
      }
      beakers.forEach((m, k) => { (m.material as THREE.MeshBasicMaterial).opacity = 0.8 + 0.15 * Math.sin(ctx.t * 3 + k); });
    },
  };
};

export const LAB: KitDef = {
  id: "lab",
  desc: "science lab hall: benches with glowing beakers, blackboard of diagrams, tesla coil, big machine with dials, shelves, window wall",
  ambience: "lab",
  anchors: {
    "lab": "the whole lab (wide)", "bench": "a lab bench", "beakers": "glowing beakers on a bench (bubble)", "coil": "a tesla coil (spark)",
    "machine": "a big machine with dials", "blackboard": "a blackboard covered in diagrams", "window": "the window wall",
    "doorway": "standing in the doorway facing the lab (use with from-to)",
  },
  actions: { "spark": "the tesla coil throws bright sparks", "bubble": "the beakers bubble and fizz" },
  build,
};
