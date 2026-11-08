// Desert kit (history / adventure): rolling sand dunes under a hot pale sky, three pyramids, a sphinx-like statue,
// an oasis pool ringed by palms, a camel caravan, a nomad camp and a heat-haze horizon.
import * as THREE from "three";
import { ctex, rng } from "../core/paint";
import { twoTone } from "../core/shade";
import { box, at, Batch, lam, col } from "../core/geo";
import { Anchor, Ctx, KitDef, KitWorld } from "../core/types";
import { placeProps } from "../props/place";

const sandTex = () => ctex("desertSand", 1024, 1024, (g, r) => {
  g.fillStyle = "#e6c88a"; g.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 14) { g.strokeStyle = `rgba(${r() < 0.5 ? "190,150,90" : "250,230,180"},0.35)`; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin(x * 0.02 + y) * 5); g.stroke(); }
});
/** dune height field */
const dune = (x: number, z: number) => {
  const flat = Math.exp(-((x - 0) ** 2 + (z + 40) ** 2) / 9000); // a flat plain around the pyramids and oasis
  return (1 - flat) * (3.5 * Math.sin(x * 0.03 + z * 0.012) + 2.2 * Math.sin(z * 0.045 - x * 0.01) + 1.4 * Math.sin((x + z) * 0.07)) + 1.5 * (1 - flat);
};

const build = (seed: number): KitWorld => {
  const root = new THREE.Group(), big = new Batch(), r = rng(131 + seed);
  const g = new THREE.PlaneGeometry(1600, 1600, 200, 200); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, dune(pos.getX(i), pos.getZ(i)));
  g.computeVertexNormals();
  const sandMap = sandTex(); sandMap.repeat.set(60, 60);
  const ground = new THREE.Mesh(g, lam("desertSand", () => ({ map: sandMap }))); ground.receiveShadow = true; root.add(ground);
  // oasis pool
  const OX = -40, OZ = 10;
  const pool = new THREE.Mesh(new THREE.CircleGeometry(12, 36), twoTone(new THREE.MeshLambertMaterial({ color: "#3aa7c4" })));
  pool.rotation.x = -Math.PI / 2; pool.position.set(OX, dune(OX, OZ) + 0.08, OZ); root.add(pool);
  const rimM = new THREE.Mesh(new THREE.RingGeometry(12, 15, 36), col("#9a9a50")); rimM.rotation.x = -Math.PI / 2; rimM.position.set(OX, dune(OX, OZ) + 0.06, OZ); root.add(rimM);
  // sphinx-like statue: lying body, raised head block, paws
  const SX = 40, SZ = -30, lime = col("#d9bd84");
  big.add(box(SX - 12, 0, SZ - 4, SX + 6, 6, SZ + 4), lime);
  big.add(box(SX + 4, 5, SZ - 3, SX + 10, 13, SZ + 3), lime);
  big.add(box(SX + 6, 0, SZ - 3.6, SX + 16, 2.2, SZ - 1.2), lime); big.add(box(SX + 6, 0, SZ + 1.2, SX + 16, 2.2, SZ + 3.6), lime);
  big.add(box(SX + 9.9, 9, SZ - 2.2, SX + 10.1, 11.5, SZ + 2.2), col("#b89a64"));
  const occ = big.build(root);

  const anchors: Record<string, Anchor> = {
    "pyramids": { p: [0, 22, -160], size: 200, view: 10, ground: 0 },
    "pyramid": { p: [0, 20, -140], size: 70, view: 15, ground: 0 },
    "statue": { p: [SX + 2, 7, SZ], size: 30, view: 60, ground: 0 },
    "oasis": { p: [OX, 3, OZ], size: 34, view: 20, ground: dune(OX, OZ) },
    "dunes": { p: [120, 4, 60], size: 120, view: 220, ground: 0 },
    "caravan-route": { p: [60, 0, 30], size: 30, view: 10, ground: 0 },
    "camp": { p: [-70, 1, -20], size: 24, view: 30, ground: dune(-70, -20) },
    "lookout": { p: [10, dune(10, 60), 60], size: 6, view: 0, ground: dune(10, 60), eye: 1.7 },
  };
  const world: KitWorld = {
    root, anchors, occluders: occ, floor: (x, z) => dune(x, z),
    sky: { c: ["#f6e6c4", "#f0dcb8", "#cfe0ea", "#9cc6e8", "#6aa6dc"], e: [0, 3, 10, 24, 60], fog: "#f2e2c0", fogNear: 160, fogFar: 1300 },
    update(ctx: Ctx) { residents.update(ctx); },
  };
  const residents = placeProps(world, [
    { id: "pyramid", name: "great-pyramid", at: "pyramid", dx: 0, dz: 0 },
    { id: "pyramid", name: "pyramid-2", at: "pyramid", dx: 95, dz: -60, scale: 0.75 },
    { id: "pyramid", name: "pyramid-3", at: "pyramid", dx: -80, dz: -40, scale: 0.55 },
    ...Array.from({ length: 9 }, (_, i) => ({ id: "palm", at: "oasis", dx: Math.cos(i * 0.7) * (15 + r() * 3), dz: Math.sin(i * 0.7) * (15 + r() * 3), scale: 0.8 + r() * 0.3 })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: "camel", name: `camel-${i + 1}`, group: "caravan", at: "caravan-route", dx: -i * 4.5, dz: i * 0.6, yaw: 168 })),
    { id: "tent", at: "camp", dx: -4, yaw: 30 }, { id: "tent", at: "camp", dx: 5, dz: -2, yaw: 140 }, { id: "campfire", at: "camp", dx: 0, dz: 5 },
  ]);
  return world;
};

export const DESERT: KitDef = {
  id: "desert",
  desc: "sand desert: rolling dunes, three pyramids, a sphinx-like statue, an oasis with palms, a camel caravan, a nomad camp",
  ambience: "desert",
  anchors: {
    "pyramids": "all three pyramids (wide)", "pyramid": "the great pyramid", "great-pyramid": "the great pyramid itself", "statue": "a lion-bodied stone statue",
    "oasis": "an oasis pool with palm trees", "dunes": "rolling sand dunes", "caravan-route": "the track the caravan walks", "caravan": "a caravan of five camels (run)",
    "camp": "a nomad camp with tents and a fire", "lookout": "standing on a dune facing the pyramids (use with from-to)",
  },
  actions: {},
  build,
};
