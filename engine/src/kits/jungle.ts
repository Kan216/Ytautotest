// Jungle kit (nature / adventure): a green river winding between mossy banks, giant rainforest trees, ferns,
// a stepped stone temple ruin in a clearing, a cliff with a waterfall, and birds. Props add animals and explorers.
import * as THREE from "three";
import { ctex, rng, stoneHD } from "../core/paint";
import { twoTone } from "../core/shade";
import { V, quad, box, at, Batch, lam, col } from "../core/geo";
import { Anchor, Ctx, KitDef, KitWorld } from "../core/types";
import { placeProps } from "../props/place";

const moss = () => ctex("moss", 1024, 1024, (g, r) => {
  g.fillStyle = "#4f8a3c"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 1800; i++) { g.fillStyle = ["#3f7a32", "#5f9a48", "#467f38", "#6aa452"][i % 4]; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 6 + r() * 20, 4 + r() * 12, r() * 3, 0, 7); g.fill(); }
});
const fallTex = () => ctex("waterfall", 128, 512, (g, r) => {
  g.fillStyle = "#bfe8f4"; g.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${(0.4 + r() * 0.5).toFixed(2)})`; g.fillRect(r() * 128, r() * 512, 3 + r() * 6, 30 + r() * 80); }
});

const build = (seed: number): KitWorld => {
  const root = new THREE.Group(), b = new Batch(), big = new Batch(), r = rng(111 + seed);
  const ground = lam("moss", () => ({ map: moss() })), bank = col("#7a5a3a");
  // banks either side of the river (river runs along x, water between z = -7 and 7)
  b.add(quad(V(-1500, 0.6, -7), V(1500, 0.6, -7), V(1500, 0.6, -1500), V(-1500, 0.6, -1500), 100, 100), ground);
  b.add(quad(V(-1500, 0.6, 1500), V(1500, 0.6, 1500), V(1500, 0.6, 7), V(-1500, 0.6, 7), 100, 100), ground);
  b.add(quad(V(-1500, -1, -7), V(1500, -1, -7), V(1500, 0.6, -7), V(-1500, 0.6, -7)), bank);
  b.add(quad(V(-1500, 0.6, 7), V(1500, 0.6, 7), V(1500, -1, 7), V(-1500, -1, 7)), bank);
  // giant rainforest trees: tall trunks with buttress roots and layered canopy blobs
  const trunkM = col("#6b5440"), leaf = [col("#2f7a3a"), col("#3f8a44"), col("#2a6a34")];
  const giant = (x: number, z: number, h: number) => {
    big.add(at(new THREE.CylinderGeometry(0.7, 1.4, h, 9), x, h / 2, z), trunkM);
    for (let k = 0; k < 4; k++) { const fin = new THREE.BoxGeometry(0.3, 3, 2.2); big.add(at(fin, x + Math.cos(k * 1.57) * 1.2, 1.5, z + Math.sin(k * 1.57) * 1.2, k * 1.57), trunkM); }
    for (let k = 0; k < 5; k++) { const c = new THREE.SphereGeometry(4 + r() * 3, 12, 8); c.scale(1, 0.55, 1); big.add(at(c, x + (r() - 0.5) * 7, h - 1 + r() * 3, z + (r() - 0.5) * 7), leaf[k % 3]); }
  };
  for (let i = 0; i < 70; i++) { const x = (r() - 0.5) * 500, z = (r() < 0.5 ? -1 : 1) * (14 + r() * 200); if (Math.hypot(x - 30, z + 50) < 28) continue; giant(x, z, 18 + r() * 14); }
  // ferns along the banks
  const fern = col("#5aa848", THREE.DoubleSide);
  for (let i = 0; i < 160; i++) {
    const x = (r() - 0.5) * 300, z = (r() < 0.5 ? -1 : 1) * (8 + r() * 30);
    for (let k = 0; k < 5; k++) { const f = new THREE.PlaneGeometry(0.5, 2.2); f.translate(0, 1.1, 0); f.rotateX(-0.7); b.add(at(f, x, 0.6, z, (k / 5) * Math.PI * 2), fern); }
  }
  // temple ruin: five stepped tiers + stair + shrine
  const stone = lam("templeStone", () => ({ map: stoneHD("templeHD", ["#9a9a82", "#8a8c74", "#a6a68c", "#7e806a"], "#5f6250") }));
  const TX = 30, TZ = -50;
  for (let k = 0; k < 5; k++) { const s = 16 - k * 2.8; big.add(box(TX - s, 0.6 + k * 3, TZ - s, TX + s, 3.6 + k * 3, TZ + s, 3), stone); }
  big.add(box(TX - 2.5, 0.6, TZ + 2, TX + 2.5, 15, TZ + 17), stone);
  big.add(box(TX - 3.5, 15.6, TZ - 3.5, TX + 3.5, 20.6, TZ + 3.5, 3), stone); big.add(box(TX - 1.2, 15.6, TZ + 3.45, TX + 1.2, 18.6, TZ + 3.55), col("#2a2a26"));
  // cliff + waterfall
  const WX = -60, WZ = -30;
  for (const [dx, h] of [[-12, 26], [0, 30], [12, 24]]) big.add(box(WX + dx - 7, 0, WZ - 14, WX + dx + 7, h, WZ - 2), col("#8a7e6e"));
  const fallMap = fallTex(); fallMap.wrapS = fallMap.wrapT = THREE.RepeatWrapping;
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(7, 29), new THREE.MeshBasicMaterial({ map: fallMap, color: new THREE.Color(1.15, 1.15, 1.15) }));
  fall.position.set(WX, 14.5, WZ - 1.9); root.add(fall);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(9, 30), twoTone(new THREE.MeshLambertMaterial({ color: "#5fb8b0" })));
  pool.rotation.x = -Math.PI / 2; pool.position.set(WX, 0.65, WZ + 4); root.add(pool);
  b.build(root, false);
  const occ = big.build(root);

  const anchors: Record<string, Anchor> = {
    "river": { p: [0, 1, 0], size: 30, view: 80, ground: 0.6 },
    "temple": { p: [TX, 10, TZ], size: 36, view: 15, ground: 0.6 },
    "temple-top": { p: [TX, 18, TZ], size: 10, view: 10, ground: 15.6 },
    "waterfall": { p: [WX, 14, WZ - 2], size: 32, view: 10, ground: 0.6 },
    "canopy": { p: [0, 22, -40], size: 50, view: 0, ground: 0.6 },
    "clearing": { p: [TX, 1.5, TZ + 26], size: 22, view: 10, ground: 0.6 },
    "trail": { p: [TX - 4, 0.6, TZ + 44], size: 6, view: 180, ground: 0.6, eye: 1.7 },
    "riverbank": { p: [-10, 0.6, 11], size: 6, view: 180, ground: 0.6, eye: 1.7 },
  };
  const world: KitWorld = {
    root, anchors, occluders: occ, floor: (x, z) => (Math.abs(z) < 7 ? 0 : 0.6),
    water: { shoreZ: null, pal: { near: "#3f9a7a", mid: "#2f8070", far: "#2a6a60", shallow: "#5fb8a0", crest: "#c8f0e0", trough: "#1f5a50", glint: "#ffffff" } },
    sky: { c: ["#e4f0e0", "#c6e0d8", "#9cc8de", "#74aedc", "#4f92d4"], e: [0, 4, 12, 26, 60], fog: "#cfe2d4", fogNear: 120, fogFar: 900 },
    update(ctx: Ctx) { fallMap.offset.y = ctx.t * 1.4; residents.update(ctx); },
  };
  const residents = placeProps(world, [
    { id: "birds", name: "parrots", at: "canopy", dy: 4, dx: -30, yaw: 10 },
    { id: "rowboat", name: "canoe", at: "river", dx: -8, yaw: 0 },
    { id: "campfire", at: "clearing", dx: -5, dz: 3 }, { id: "tent", at: "clearing", dx: 6, dz: 4, yaw: 200 },
  ]);
  return world;
};

export const JUNGLE: KitDef = {
  id: "jungle",
  desc: "rainforest: green river, giant trees, ferns, stepped stone temple ruin in a clearing, cliff with a waterfall, parrots, canoe, camp",
  ambience: "jungle",
  anchors: {
    "river": "the jungle river", "temple": "the stepped stone temple ruin", "temple-top": "the shrine on top of the temple",
    "waterfall": "a waterfall pouring from a cliff", "canopy": "the tree canopy", "clearing": "a clearing at the temple's foot with a camp",
    "trail": "standing on the trail facing the temple (use with from-to)", "riverbank": "standing on the riverbank (use with from-to)",
    "parrots": "a flock of birds (fly)", "canoe": "a small boat on the river (drive)",
  },
  actions: {},
  build,
};
