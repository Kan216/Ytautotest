// Castle kit (history / medieval): green meadow, a stone castle with crenellated curtain walls, four round corner
// towers, a tall keep, a gatehouse with a drawbridge over a moat, banners, a village of cottages, a windmill,
// forest edges and an open field in front (battles, tournaments). Kit action: "drawbridge" (lowers).
import * as THREE from "three";
import { ctex, rng, stoneHD } from "../core/paint";
import { twoTone } from "../core/shade";
import { V, quad, box, at, Batch, lam, col } from "../core/geo";
import { flagTex } from "../core/textures";
import { Anchor, Ctx, KitDef, KitWorld } from "../core/types";
import { placeProps } from "../props/place";

const meadow = () => ctex("meadow", 1024, 1024, (g, r) => {
  g.fillStyle = "#7fb04f"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 2500; i++) { const x = r() * 1024, y = r() * 1024; g.strokeStyle = ["#6fa044", "#8fbe5a", "#76a84a"][i % 3]; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 5, y - 8 - r() * 10); g.stroke(); }
});
const C = { x: 0, z: -60, half: 26, wallH: 11 };

const build = (seed: number): KitWorld => {
  const root = new THREE.Group(), b = new Batch(), big = new Batch(), r = rng(91 + seed);
  b.add(quad(V(-1500, 0, 1500), V(1500, 0, 1500), V(1500, 0, -1500), V(-1500, 0, -1500), 120, 120), lam("meadow", () => ({ map: meadow() })));
  // moat ring + dirt road to the gate
  const moat = new THREE.Mesh(new THREE.RingGeometry(C.half + 4, C.half + 10, 4, 1), twoTone(new THREE.MeshLambertMaterial({ color: "#3a86b0" })));
  moat.rotation.x = -Math.PI / 2; moat.rotation.z = Math.PI / 4; moat.scale.setScalar(Math.SQRT2); moat.position.set(C.x, 0.05, C.z); root.add(moat);
  b.add(quad(V(-3, 0.03, 120), V(3, 0.03, 120), V(3, 0.03, C.z + C.half + 10), V(-3, 0.03, C.z + C.half + 10), 1, 20), col("#b49a6a"));
  // curtain walls with crenellations (gap in the front wall for the gatehouse)
  const stone = lam("castleStone", () => ({ map: stoneHD("castleHD", ["#b8b0a2", "#aaa294", "#c2baac", "#a0988a"], "#8a8274") }));
  const H = C.half, W = 2.4, x0 = C.x - H, x1 = C.x + H, z0 = C.z - H, z1 = C.z + H;
  const wall = (ax: number, az: number, bx: number, bz: number) => {
    big.add(box(Math.min(ax, bx) - W / 2, 0, Math.min(az, az === bz ? az : bz) - (az === bz ? W / 2 : 0), Math.max(ax, bx) + W / 2, C.wallH, Math.max(az, bz) + (az === bz ? W / 2 : 0), 3), stone);
    const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 2.4);
    for (let k = 0; k <= n; k += 2) { const u = k / n, x = ax + (bx - ax) * u, z = az + (bz - az) * u; big.add(box(x - 0.6, C.wallH, z - 0.6, x + 0.6, C.wallH + 1.3, z + 0.6), stone); }
  };
  wall(x0, z0, x1, z0); wall(x0, z0, x0, z1); wall(x1, z0, x1, z1); wall(x0, z1, C.x - 6, z1); wall(C.x + 6, z1, x1, z1);
  // gatehouse + drawbridge
  big.add(box(C.x - 7, 0, z1 - 4, C.x - 3.2, 16, z1 + 3, 3), stone); big.add(box(C.x + 3.2, 0, z1 - 4, C.x + 7, 16, z1 + 3, 3), stone);
  big.add(box(C.x - 7, 9, z1 - 4, C.x + 7, 16, z1 + 3, 3), stone);
  big.add(box(C.x - 3.2, 0, z1 + 2.9, C.x + 3.2, 9, z1 + 3.0), col("#2a2226"));
  const bridge = new THREE.Group(); bridge.position.set(C.x, 9, z1 + 3.1); root.add(bridge);
  const plank = new THREE.Mesh(new THREE.BoxGeometry(6.2, 9, 0.4).translate(0, -4.5, 0.2), col("#7a4a2a")); plank.castShadow = true; bridge.add(plank);
  // keep
  big.add(box(C.x - 9, 0, C.z - 14, C.x + 9, 26, C.z + 2, 3), stone);
  for (let k = 0; k < 8; k++) for (const [ax, az] of [[C.x - 9 + k * 2.4, C.z - 14], [C.x - 9 + k * 2.4, C.z + 2]]) big.add(box(ax, 26, az - 0.6, ax + 1.2, 27.4, az + 0.6), stone);
  for (const y of [8, 14, 20]) for (const x of [C.x - 4, C.x + 4]) big.add(box(x - 0.5, y, C.z + 2.02, x + 0.5, y + 2, C.z + 2.1), col("#2c3a46"));
  b.build(root, false);
  const occ = big.build(root);
  // banners on the keep
  const banners: THREE.Mesh[] = [];
  for (const [x, c] of [[C.x - 5, "#c0353a"], [C.x + 5, "#2f6fd0"]] as const) {
    const fg = new THREE.PlaneGeometry(3, 1.8, 10, 3); fg.translate(1.55, 0, 0);
    const m = new THREE.Mesh(fg, twoTone(new THREE.MeshLambertMaterial({ map: flagTex(c), side: THREE.DoubleSide }))); m.position.set(x, 33, C.z - 6); root.add(m); banners.push(m);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 6), col("#e9e4d8")); pole.position.set(x, 30, C.z - 6); root.add(pole);
    m.userData.p0 = Float32Array.from(fg.attributes.position.array as Float32Array);
  }

  const anchors: Record<string, Anchor> = {
    "castle": { p: [C.x, 12, C.z], size: 70, view: 25, ground: 0 },
    "gate": { p: [C.x, 6, z1 + 3], size: 18, view: 5, ground: 0 },
    "keep": { p: [C.x, 18, C.z - 6], size: 30, view: 15, ground: 0 },
    "wall": { p: [x1 - 10, 7, z1 + 1], size: 16, view: 30, ground: 0 },
    "moat": { p: [C.x + 18, 0.5, z1 + 7], size: 18, view: 20, ground: 0 },
    "field": { p: [0, 2, 40], size: 60, view: 180, ground: 0 },
    "village": { p: [-70, 4, 10], size: 50, view: 40, ground: 0 },
    "hill": { p: [80, 2, 10], size: 40, view: 300, ground: 0 },
    "gate-road": { p: [0, 0, 30], size: 6, view: 180, ground: 0, eye: 1.7 },
  };
  const world: KitWorld = {
    root, anchors, occluders: occ, floor: () => 0,
    sky: { c: ["#e4eef2", "#c6dcec", "#94bde6", "#6aa2dc", "#4a86d0"], e: [0, 4, 12, 26, 60], fog: "#d6e2e6", fogNear: 200, fogFar: 1400 },
    update(ctx: Ctx) {
      const db = ctx.actions.find((a) => a.id === "drawbridge"), u = db ? Math.min(1, Math.max(0, (ctx.t - db.f / ctx.fps) / 2.5)) : 0;
      bridge.rotation.x = -(u * u * (3 - 2 * u)) * (Math.PI / 2);
      for (const m of banners) {
        const pos = m.geometry.attributes.position as THREE.BufferAttribute, p0 = m.userData.p0 as Float32Array;
        for (let i = 0; i < pos.count; i++) { const uu = p0[i * 3] / 3.1; pos.setZ(i, 0.35 * uu * Math.sin(uu * 5 - ctx.t * 5)); }
        pos.needsUpdate = true; m.geometry.computeVertexNormals();
      }
      residents.update(ctx);
    },
  };
  const residents = placeProps(world, [
    ...[[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z], i) => ({ id: "castle-tower", name: `tower-${i + 1}`, at: "castle", dx: x - C.x, dz: z - C.z })),
    ...Array.from({ length: 7 }, (_, i) => ({ id: "house", at: "village", dx: (i % 4) * 13 - 20 + r() * 3, dz: Math.floor(i / 4) * 16 - 8, yaw: 90 + r() * 30 - 15, scale: 0.85 })),
    { id: "windmill", at: "hill", dx: 10, dz: -10, yaw: 200 },
    { id: "well", at: "village", dx: 6, dz: 14 },
    ...Array.from({ length: 30 }, (_, i) => ({ id: i % 3 ? "pine" : "oak", at: "castle", dx: (r() - 0.5) * 300, dz: -60 - r() * 120, scale: 0.9 + r() * 0.5 })),
    { id: "tent", at: "field", dx: -18, dz: 10, yaw: 20 }, { id: "tent", at: "field", dx: 18, dz: 12, yaw: 160 }, { id: "campfire", at: "field", dx: 0, dz: 14 },
  ]);
  return world;
};

export const CASTLE: KitDef = {
  id: "castle",
  desc: "medieval castle: stone walls with battlements, four round towers, a tall keep with banners, gatehouse + drawbridge over a moat, village, windmill, field with tents",
  ambience: "countryside",
  anchors: {
    "castle": "the whole castle", "gate": "the gatehouse and drawbridge", "keep": "the tall central keep with banners", "wall": "a section of the battlements",
    "moat": "the moat", "field": "the open field in front of the castle (battles, camps)", "village": "the village of cottages", "hill": "a hill with a windmill",
    "gate-road": "standing on the road facing the castle gate (use with from-to)",
    "tower-1": "a corner tower (back left)", "tower-2": "a corner tower (back right)", "tower-3": "a corner tower (front left)", "tower-4": "a corner tower (front right)",
  },
  actions: { "drawbridge": "the drawbridge lowers over the moat" },
  build,
};
