// Savanna kit (nature / animals): golden grassland with flat-topped acacias, a snow-capped mountain, a waterhole,
// a big rock, and resident animals from the props library: an elephant, a giraffe, a lion and a zebra herd
// (anchors elephant / giraffe / lion / zebras; they run, roar, trumpet via prop actions).
import * as THREE from "three";
import { ctex, rng } from "../core/paint";
import { twoTone } from "../core/shade";
import { V3, V, quad, at, Batch, lam, col } from "../core/geo";
import { Anchor, Ctx, KitDef, KitWorld } from "../core/types";
import { placeProps } from "../props/place";

const grassTex = () => ctex("savannaGrass", 1024, 1024, (g, r) => {
  g.fillStyle = "#d6bf6a"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 3000; i++) {
    const x = r() * 1024, y = r() * 1024, h = 8 + r() * 18;
    g.strokeStyle = ["#c4a958", "#e3cf80", "#b39a4a", "#cdb865"][i % 4]; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y - h); g.stroke();
  }
});
const build = (seed: number): KitWorld => {
  const root = new THREE.Group(), b = new Batch(), big = new Batch(), r = rng(53 + seed);
  // ---- ground, waterhole, mountain, rocks, acacias ----
  const grass = lam("savannaGrass", () => ({ map: grassTex() }));
  b.add(quad(V(-1500, 0, 1500), V(1500, 0, 1500), V(1500, 0, -1500), V(-1500, 0, -1500), 70, 70), grass);
  const water = new THREE.Mesh(new THREE.CircleGeometry(16, 40), twoTone(new THREE.MeshLambertMaterial({ color: "#3aa7c4" })));
  water.rotation.x = -Math.PI / 2; water.scale.set(1.6, 1, 1); water.position.set(-30, 0.06, -40); water.receiveShadow = true; root.add(water);
  const mud = new THREE.Mesh(new THREE.RingGeometry(16, 19, 40), col("#a8865a")); mud.rotation.x = -Math.PI / 2; mud.scale.set(1.6, 1, 1); mud.position.set(-30, 0.05, -40); root.add(mud);
  const mtn = new THREE.ConeGeometry(260, 200, 9); b.add(at(mtn, 120, 90, -900), col("#8a7fa0"));
  b.add(at(new THREE.ConeGeometry(78, 60, 9), 120, 162, -900), col("#f4f6fa"));
  b.add(at(new THREE.ConeGeometry(180, 110, 7), -380, 45, -1000), col("#9a8fae"));
  const rockM = col("#b39878");
  for (const [x, z, s] of [[48, -70, 9], [56, -64, 6], [42, -60, 5], [60, -76, 4]] as const) {
    const g = new THREE.DodecahedronGeometry(s, 0); g.scale(1.3, 0.8, 1); big.add(at(g, x, s * 0.5, z, s), rockM);
  }
  const trunkM = col("#6b4a33"), leafM = [col("#5f8f3c"), col("#6c9c44")];
  const acacia = (x: number, z: number, h: number) => {
    const t = new THREE.CylinderGeometry(0.35, 0.6, h, 8); big.add(at(t, x, h / 2, z, 0, 0, 0.1), trunkM);
    for (const [dx, dz, s] of [[0, 0, 1], [h * 0.25, 0.4, 0.7], [-h * 0.22, -0.3, 0.75]] as const) {
      const c = new THREE.SphereGeometry(h * 0.55 * s, 14, 8); c.scale(1, 0.22, 1);
      big.add(at(c, x + dx + h * 0.1, h + 0.3, z + dz), leafM[(dx > 0 ? 1 : 0)]);
    }
  };
  acacia(14, -30, 7.5);
  for (let i = 0; i < 40; i++) { const x = (r() - 0.5) * 700, z = -60 - r() * 600; if (Math.abs(x) > 30 || z < -120) acacia(x, z, 5 + r() * 4); }
  for (let i = 0; i < 200; i++) { const x = (r() - 0.5) * 600, z = 40 - r() * 500; const g = new THREE.SphereGeometry(0.6 + r() * 0.9, 7, 5); g.scale(1, 0.5, 1); b.add(at(g, x, 0.15, z), col(i % 2 ? "#8c9a48" : "#a3a052")); }
  b.build(root, false);
  const occ = big.build(root);

  const anchors: Record<string, Anchor> = {
    "waterhole": { p: [-30, 1, -40], size: 40, view: 10, ground: 0 },
    "acacia": { p: [15, 6, -30], size: 12, view: 20, ground: 0 },
    "rock": { p: [50, 5, -68], size: 22, view: 15, ground: 0 },
    "mountain": { p: [120, 120, -900], size: 380, view: 0 },
    "plain": { p: [0, 3, -60], size: 120, view: 10, ground: 0 },
    "lookout": { p: [-8, 0, 12], size: 6, view: 0, ground: 0, eye: 1.7 },
    "herd-spot": { p: [-56, 0, -14], size: 14, view: 40, ground: 0 },
  };
  const world: KitWorld = {
    root, anchors, occluders: occ, floor: () => 0,
    sky: { c: ["#f6dca8", "#cfe1ea", "#8fbde4", "#5d9edc", "#3a7fcf"], e: [0, 3, 10, 22, 60], fog: "#efdcb0", fogNear: 220, fogFar: 1700 },
    update(ctx: Ctx) { animals.update(ctx); },
  };
  // resident animals from the props library (stories can add more with "props")
  const animals = placeProps(world, [
    { id: "elephant", at: "acacia", dx: -9, dz: -16, yaw: 34 },
    { id: "giraffe", at: "acacia", dx: 9, dz: -6, yaw: 143 },
    { id: "lion", at: "rock", dx: -16, dz: 14, yaw: -70 },
    ...Array.from({ length: 9 }, (_, i) => ({ id: "zebra", name: `zebra-${i + 1}`, group: "zebras", at: "herd-spot", dx: (i % 3) * 4 + r() * 2 - 4, dz: -Math.floor(i / 3) * 3.5 + r() * 1.5 + 4, yaw: 9 + r() * 11 })),
  ]);
  return world;
};

export const SAVANNA: KitDef = {
  id: "savanna",
  desc: "African savanna: golden grass, acacia trees, snowy mountain, waterhole, big rock, elephant, giraffe, lion, zebra herd",
  ambience: "savanna",
  anchors: {
    "elephant": "an elephant", "giraffe": "a giraffe", "lion": "a lion in front of the rocks", "zebras": "a herd of nine zebras",
    "waterhole": "a waterhole", "acacia": "a flat-topped acacia tree", "rock": "a big rock outcrop", "mountain": "a snow-capped mountain far away",
    "plain": "wide view of the grassland", "lookout": "standing in the grass facing the animals (use with from-to)",
    "herd-spot": "open grass where the zebra herd grazes",
  },
  actions: {},
  build,
};
