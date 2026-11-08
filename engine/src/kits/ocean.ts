// Ocean kit (nature / adventure): open sea to the horizon, a small sandy island with palms and a hut, a rocky islet
// with a lighthouse, a sailboat, a rowboat, a whale, gulls and a distant cargo steamer.
import * as THREE from "three";
import { rng } from "../core/paint";
import { at, Batch, col } from "../core/geo";
import { Anchor, Ctx, KitDef, KitWorld } from "../core/types";
import { placeProps } from "../props/place";

const build = (seed: number): KitWorld => {
  const root = new THREE.Group(), b = new Batch(), r = rng(151 + seed);
  // island: a low sand mound, a grass cap; islet: rocks
  const IX = 0, IZ = -40;
  const mound = new THREE.SphereGeometry(30, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2); mound.scale(1, 0.12, 1); b.add(at(mound, IX, -0.6, IZ), col("#ecd9a8"));
  const cap = new THREE.SphereGeometry(18, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.14, 1); b.add(at(cap, IX - 4, 0.6, IZ - 4), col("#7fb04f"));
  const LX = 90, LZ = -90;
  for (let k = 0; k < 8; k++) { const d = new THREE.DodecahedronGeometry(4 + r() * 4, 0); d.scale(1.2, 0.7, 1); b.add(at(d, LX + (r() - 0.5) * 12, 1, LZ + (r() - 0.5) * 12), col(k % 2 ? "#8e8b8c" : "#a29f9e")); }
  b.build(root);
  const anchors: Record<string, Anchor> = {
    "island": { p: [IX, 4, IZ], size: 50, view: 20, ground: 2.2 },
    "hut": { p: [IX - 6, 3, IZ - 8], size: 8, view: 20, ground: 2.6 },
    "lighthouse-rock": { p: [LX, 10, LZ], size: 34, view: 10, ground: 5 },
    "sea": { p: [0, 1, 40], size: 120, view: 0, ground: 0 },
    "horizon": { p: [0, 8, -600], size: 300, view: 0, ground: 0 },
    "beach": { p: [IX + 12, 1.6, IZ + 20], size: 8, view: 180, ground: 1.6, eye: 1.7 },
    "open-water": { p: [-40, 0, 30], size: 20, view: 70, ground: 0 },
  };
  const ground = (x: number, z: number) => { const d = Math.hypot(x - IX, z - IZ); return d < 30 ? Math.max(0, 3.0 * Math.sqrt(Math.max(0, 1 - (d / 30) ** 2)) - 0.6) : 0; };
  const world: KitWorld = {
    root, anchors, occluders: [], floor: ground, water: { shoreZ: null },
    sky: { c: ["#e8f2f6", "#c8e2f0", "#94c6ea", "#62a6e0", "#3f88d4"], e: [0, 4, 12, 26, 60], fog: "#d8e8f0", fogNear: 300, fogFar: 1600 },
    update(ctx: Ctx) { residents.update(ctx); },
  };
  const residents = placeProps(world, [
    ...Array.from({ length: 6 }, (_, i) => ({ id: "palm", at: "island", dx: Math.cos(i * 1.1) * (8 + r() * 10), dz: Math.sin(i * 1.1) * (8 + r() * 10), scale: 0.8 + r() * 0.3 })),
    { id: "hut", at: "hut", dx: 0, dz: 0, yaw: 270 },
    { id: "lighthouse", at: "lighthouse-rock", dx: 0, dz: 0 },
    { id: "sailboat", at: "sea", dx: 30, dz: -10, yaw: 160 },
    { id: "rowboat", at: "island", dx: 14, dz: 32, yaw: 20 },
    { id: "whale", at: "open-water", dx: 0, dz: 0, yaw: 10 },
    { id: "birds", name: "gulls", at: "sea", dy: 18, dx: -40, yaw: 5 },
  ]);
  return world;
};

export const OCEAN: KitDef = {
  id: "ocean",
  desc: "open ocean: a small palm island with a hut, a rocky islet with a lighthouse, a sailboat, a rowboat, a whale, gulls",
  ambience: "ocean",
  anchors: {
    "island": "the small palm island", "hut": "the hut on the island", "lighthouse-rock": "the lighthouse on its rocky islet",
    "sea": "the open sea (wide)", "horizon": "the far horizon", "beach": "standing on the island beach facing the sea (use with from-to)",
    "open-water": "open water where the whale swims", "whale": "a whale (spout, dive, drive to swim)", "sailboat": "a sailboat (drive)", "rowboat": "a rowboat (drive)", "gulls": "seagulls (fly)",
  },
  actions: {},
  build,
};
