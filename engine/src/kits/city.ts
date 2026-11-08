// City kit (everyday / modern): a straight avenue with lanes and a zebra crossing, sidewalks, colourful mid-rise
// blocks with shopfronts and awnings, skyscrapers behind, street trees, lamps, benches, a traffic light, a bus stop,
// and resident traffic from the props library (cars, a taxi, a bus) that drives when told to.
import * as THREE from "three";
import { ctex, rng } from "../core/paint";
import { V, quad, box, at, Batch, lam, col } from "../core/geo";
import { bayTex } from "../core/textures";
import { building } from "../core/builders";
import { Anchor, Ctx, KitDef, KitWorld } from "../core/types";
import { placeProps } from "../props/place";

const asphalt = () => ctex("asphalt", 512, 512, (g, r) => {
  g.fillStyle = "#4a4d55"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "30,30,35" : "120,120,128"},0.25)`; g.fillRect(r() * 512, r() * 512, 2, 2); }
});
const paving = () => ctex("paving", 512, 512, (g, r) => {
  g.fillStyle = "#cfc8bc"; g.fillRect(0, 0, 512, 512); g.strokeStyle = "rgba(90,80,70,0.45)"; g.lineWidth = 3;
  for (let x = 0; x <= 512; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  for (let y = 0; y <= 512; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(255,255,255,${(r() * 0.08).toFixed(3)})`; g.fillRect(r() * 512, r() * 512, 30, 30); }
});

const ROAD = 8, WALK = 5; // half road width (z), sidewalk width

const build = (seed: number): KitWorld => {
  const root = new THREE.Group(), b = new Batch(), big = new Batch(), r = rng(71 + seed);
  // ---- road, lane lines, crossing, sidewalks, kerbs ----
  const road = lam("asphalt", () => ({ map: asphalt() })), walk = lam("paving", () => ({ map: paving() })), white = col("#f1efe6"), kerb = col("#9a958c");
  b.add(quad(V(-600, 0, ROAD), V(600, 0, ROAD), V(600, 0, -ROAD), V(-600, 0, -ROAD), 240, 3.2), road);
  for (let x = -600; x < 600; x += 6) b.add(quad(V(x, 0.02, 0.12), V(x + 3, 0.02, 0.12), V(x + 3, 0.02, -0.12), V(x, 0.02, -0.12)), white);
  for (let z = -ROAD + 0.8; z < ROAD - 0.6; z += 1.4) b.add(quad(V(-3, 0.02, z + 0.7), V(3, 0.02, z + 0.7), V(3, 0.02, z), V(-3, 0.02, z)), white);
  for (const s of [-1, 1]) {
    const z0 = s * ROAD, z1 = s * (ROAD + WALK);
    b.add(s > 0 ? quad(V(-600, 0.18, z1), V(600, 0.18, z1), V(600, 0.18, z0), V(-600, 0.18, z0), 240, 2) : quad(V(-600, 0.18, z0), V(600, 0.18, z0), V(600, 0.18, z1), V(-600, 0.18, z1), 240, 2), walk);
    b.add(box(-600, 0, s > 0 ? ROAD : -ROAD - 0.25, 600, 0.2, s > 0 ? ROAD + 0.25 : -ROAD), kerb);
  }
  b.add(quad(V(-1500, -0.05, 1500), V(1500, -0.05, 1500), V(1500, -0.05, -1500), V(-1500, -0.05, -1500), 300, 300), col("#8a8f86"));
  // ---- blocks along both sides: shopfront storey + painted upper storeys + awnings ----
  const PAL = [["#e8a87c", "#2f5f6a"], ["#9fc5d8", "#3a3a40"], ["#f2d48a", "#7a4a2a"], ["#c9a0c8", "#2f3036"], ["#a8d0a0", "#3d5f8a"], ["#f3ead8", "#b8352f"]];
  const walls = PAL.map(([w, s], i) => lam("cityBay" + i, () => ({ map: bayTex("city" + i, w, s, { arch: false, band: "#e9e4da" }) })));
  const plains = PAL.map(([w]) => col(w)), roof = col("#8a8580"), glass = col("#7fb4d8");
  const awn = ["#d2402f", "#2f6fd0", "#3d9a5a", "#f2c230"].map((c) => col(c));
  for (const s of [-1, 1]) {
    let x = -220;
    while (x < 220) {
      const w = 12 + r() * 10, d = 14, h = 12 + r() * 16, z0 = s > 0 ? ROAD + WALK + 0.2 : -ROAD - WALK - 0.2 - d, k = Math.floor(r() * PAL.length);
      building(big, { x0: x, x1: x + w - 0.6, z0, z1: z0 + d, h }, walls[k], plains[k], roof, 4, 4, 0.18);
      const fz = s > 0 ? z0 - 0.02 : z0 + d + 0.02;
      big.add(box(x + 0.6, 0.2, Math.min(fz, fz - s * 0.05), x + w - 1.2, 3.2, Math.max(fz, fz - s * 0.05)), glass);
      big.add(box(x + 0.4, 3.4, s > 0 ? z0 - 1.8 : z0 + d, x + w - 1.0, 3.6, s > 0 ? z0 : z0 + d + 1.8), awn[k % 4]);
      x += w;
    }
  }
  // ---- skyline: tall towers far behind ----
  for (let i = 0; i < 40; i++) {
    const x = (r() - 0.5) * 900, s = r() < 0.5 ? -1 : 1, z = s * (80 + r() * 300), w = 18 + r() * 20, h = 50 + r() * 140;
    big.add(box(x, 0, z, x + w, h, z + w), col(["#7f9bb8", "#9aaabb", "#b8c4cf", "#6f8aa8"][i % 4]));
    for (let y = 8; y < h - 4; y += 6) big.add(box(x - 0.05, y, z - 0.05, x + w + 0.05, y + 1.2, z + w + 0.05), col("#d8e6f2"));
  }
  b.build(root, false);
  const occ = big.build(root);

  const anchors: Record<string, Anchor> = {
    "street": { p: [0, 4, 0], size: 40, view: 60, ground: 0 },
    "crossing": { p: [0, 1, 0], size: 16, view: 70, ground: 0 },
    "shop": { p: [10, 3, -ROAD - WALK], size: 14, view: 10, ground: 0.18 },
    "building": { p: [-30, 14, ROAD + WALK + 7], size: 34, view: 170, ground: 0.18 },
    "skyline": { p: [0, 80, -260], size: 300, view: 0, ground: 0 },
    "sidewalk": { p: [-14, 0.18, ROAD + 2.5], size: 6, view: 120, ground: 0.18, eye: 1.7 },
    "corner": { p: [6, 0.18, -ROAD - 2.5], size: 6, view: 30, ground: 0.18, eye: 1.7 },
    "lane-east": { p: [-40, 0, 4], size: 8, view: 60, ground: 0 },
    "lane-west": { p: [40, 0, -4], size: 8, view: 240, ground: 0 },
  };
  const world: KitWorld = {
    root, anchors, occluders: occ, floor: (x, z) => (Math.abs(z) > ROAD ? 0.18 : 0),
    sky: { c: ["#dfe8f0", "#c3d8ec", "#94bde6", "#6aa2dc", "#4a86d0"], e: [0, 4, 12, 26, 60], fog: "#d4dde6", fogNear: 180, fogFar: 1300 },
    update(ctx: Ctx) { residents.update(ctx); },
  };
  const residents = placeProps(world, [
    { id: "traffic-light", at: "crossing", dx: -4, dz: -ROAD - 0.8, yaw: 90 },
    { id: "taxi", name: "taxi", at: "lane-east", dx: 6, yaw: 0 },
    { id: "car", name: "red-car", at: "lane-east", dx: -10, yaw: 0 },
    { id: "bus", name: "bus", at: "lane-west", dx: 10, yaw: 180 },
    { id: "car-blue", name: "blue-car", at: "lane-west", dx: -6, yaw: 180 },
    ...[-60, -30, 30, 60].flatMap((x) => [{ id: "oak", at: "street", dx: x, dz: ROAD + 1.2, scale: 0.7 }, { id: "lamppost", at: "street", dx: x + 15, dz: -ROAD - 0.8 }]),
    { id: "bench", at: "street", dx: -20, dz: ROAD + 2, yaw: 90 },
  ]);
  return world;
};

export const CITY: KitDef = {
  id: "city",
  desc: "modern city avenue: road with a zebra crossing, sidewalks, shopfronts with awnings, skyscrapers, traffic light, cars, taxi, bus",
  ambience: "city",
  anchors: {
    "street": "the avenue (wide)", "crossing": "the zebra crossing", "shop": "a shopfront with a coloured awning",
    "building": "a mid-rise building across the street", "skyline": "skyscrapers in the distance",
    "sidewalk": "standing on the sidewalk facing the street (use with from-to)", "corner": "standing at the corner by the crossing (use with from-to)",
    "lane-east": "the eastbound lane", "lane-west": "the westbound lane",
    "taxi": "a yellow taxi (drive, honk)", "red-car": "a red car (drive, honk)", "bus": "a green bus (drive, honk)", "blue-car": "a blue car (drive, honk)",
    "traffic-light": "the traffic light by the crossing",
  },
  actions: {},
  build,
};
