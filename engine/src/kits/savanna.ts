// Savanna kit (nature / animals): golden grassland with flat-topped acacias, a snow-capped mountain, a waterhole,
// a big rock, and cartoon animals built from simple shapes (ink-outlined): an elephant, a giraffe, a lion and a
// zebra herd. Kit actions: "run" (an animal or the herd gallops along its heading, kicking up dust), "roar"
// (the lion rears its head), "trumpet" (the elephant raises its trunk).
import * as THREE from "three";
import { ctex, rng } from "../core/paint";
import { twoTone } from "../core/shade";
import { V3, V, quad, at, Batch, lam, col } from "../core/geo";
import { puff } from "../core/actions";
import { Action, Anchor, Ctx, KitDef, KitWorld } from "../core/types";

const grassTex = () => ctex("savannaGrass", 1024, 1024, (g, r) => {
  g.fillStyle = "#d6bf6a"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 3000; i++) {
    const x = r() * 1024, y = r() * 1024, h = 8 + r() * 18;
    g.strokeStyle = ["#c4a958", "#e3cf80", "#b39a4a", "#cdb865"][i % 4]; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y - h); g.stroke();
  }
});
const spotTex = () => ctex("giraffeSpots", 512, 512, (g, r) => {
  g.fillStyle = "#f2d9a0"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = "#b8652e"; g.beginPath();
    const x = r() * 512, y = r() * 512, s = 18 + r() * 22;
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, rr = s * (0.7 + r() * 0.4); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.fill();
  }
});
const stripeTex = () => ctex("zebraStripes", 512, 256, (g) => {
  g.fillStyle = "#f6f4ef"; g.fillRect(0, 0, 512, 256);
  g.fillStyle = "#1e1c22";
  for (let x = 0; x < 512; x += 34) { g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 14, 128, x - 4, 256); g.lineTo(x + 14, 256); g.quadraticCurveTo(x + 30, 128, x + 16, 0); g.fill(); }
});

type Beast = { g: THREE.Group; legs: THREE.Object3D[]; head: THREE.Object3D; neck?: THREE.Object3D; trunk?: THREE.Object3D; home: V3; yaw: number; stride: number; kind: string };
const ell = (rx: number, ry: number, rz: number, m: THREE.Material) => { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), m); s.scale.set(rx, ry, rz); s.castShadow = true; return s; };
const limb = (len: number, r0: number, r1: number, m: THREE.Material) => {
  const p = new THREE.Group(), c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 10).translate(0, -len / 2, 0), m);
  c.castShadow = true; p.add(c); return p;
};
/** four-legged animal: body, legs on hip pivots, neck + head on a pivot; size by the kind's numbers */
const quadruped = (kind: string, M: THREE.Material, extra: (b: Beast) => void, o: { L: number; H: number; legL: number; legR: number; neckL: number; neckA: number; headS: number }) => {
  const g = new THREE.Group(), body = ell(o.L / 2, o.H / 2, o.H * 0.42, M);
  body.position.y = o.legL + o.H * 0.35; g.add(body);
  const legs: THREE.Object3D[] = [];
  for (const [x, z] of [[o.L * 0.33, o.H * 0.25], [o.L * 0.33, -o.H * 0.25], [-o.L * 0.33, o.H * 0.25], [-o.L * 0.33, -o.H * 0.25]]) {
    const l = limb(o.legL + o.H * 0.2, o.legR, o.legR * 0.8, M); l.position.set(x, o.legL + o.H * 0.2, z); g.add(l); legs.push(l);
  }
  const neck = new THREE.Group(); neck.position.set(o.L * 0.42, o.legL + o.H * 0.55, 0); neck.rotation.z = -o.neckA; g.add(neck);
  const nk = new THREE.Mesh(new THREE.CylinderGeometry(o.H * 0.16, o.H * 0.26, o.neckL, 12).translate(0, o.neckL / 2, 0), M); nk.castShadow = true; neck.add(nk);
  const head = new THREE.Group(); head.position.y = o.neckL; head.rotation.z = o.neckA - 0.25; neck.add(head);
  const hd = ell(o.headS * 0.9, o.headS * 0.55, o.headS * 0.5, M); hd.position.x = o.headS * 0.5; head.add(hd);
  const eyeM = col("#1c1720");
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(o.headS * 0.09, 8, 6), eyeM); e.position.set(o.headS * 0.55, o.headS * 0.2, s * o.headS * 0.42); head.add(e); }
  const tail = limb(o.H * 0.7, o.legR * 0.25, o.legR * 0.15, M); tail.position.set(-o.L * 0.5, o.legL + o.H * 0.6, 0); tail.rotation.z = -0.5; g.add(tail);
  const b: Beast = { g, legs, head, neck, home: [0, 0, 0], yaw: 0, stride: o.legL, kind };
  extra(b);
  return b;
};

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
  // ---- animals ----
  const grey = col("#9b9aa3"), tan = col("#d9a55a"), mane = col("#8a4f22"), white = col("#f6f4ef");
  const spots = twoTone(new THREE.MeshLambertMaterial({ map: spotTex() })), stripes = twoTone(new THREE.MeshLambertMaterial({ map: stripeTex() }));
  const beasts: Record<string, Beast> = {};
  const put = (name: string, b0: Beast, p: V3, yaw: number) => { b0.g.position.set(...p); b0.g.rotation.y = yaw; b0.home = p; b0.yaw = yaw; root.add(b0.g); beasts[name] = b0; };
  put("elephant", quadruped("elephant", grey, (bb) => {
    for (const s of [-1, 1]) { const e = ell(0.12, 1.1, 0.9, grey); e.position.set(0.1, 0.15, s * 0.95); e.rotation.x = s * 0.25; bb.head.add(e); }
    const trunk = new THREE.Group(); trunk.position.set(1.2, -0.2, 0); bb.head.add(trunk); bb.trunk = trunk;
    let prev: THREE.Object3D = trunk;
    for (let k = 0; k < 5; k++) { const sg = limb(0.55, 0.26 - k * 0.035, 0.22 - k * 0.035, grey); sg.rotation.z = 0.12; if (k) sg.position.y = -0.55; prev.add(sg); prev = sg; }
    for (const s of [-1, 1]) { const tk = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.9, 8), white); tk.position.set(1.15, -0.55, s * 0.32); tk.rotation.z = -2.2; bb.head.add(tk); }
  }, { L: 4.6, H: 2.8, legL: 1.9, legR: 0.42, neckL: 0.7, neckA: 1.25, headS: 1.25 }), [6, 0, -46], 0.6);
  put("giraffe", quadruped("giraffe", spots, (bb) => {
    for (const s of [-1, 1]) { const o = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.35, 6), col("#8a4f22")); o.position.set(0.2, 0.42, s * 0.12); bb.head.add(o); }
  }, { L: 2.4, H: 1.3, legL: 2.6, legR: 0.13, neckL: 3.0, neckA: 0.35, headS: 0.55 }), [24, 0, -36], 2.5);
  put("lion", quadruped("lion", tan, (bb) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), mane); m.position.set(0.15, 0.05, 0); m.castShadow = true; bb.head.add(m);
  }, { L: 2.1, H: 0.95, legL: 0.75, legR: 0.13, neckL: 0.35, neckA: 0.9, headS: 0.5 }), [34, 0, -54], -1.22);
  const herd: V3[] = [];
  for (let i = 0; i < 9; i++) {
    const p: V3 = [-60 + (i % 3) * 4 + r() * 2, 0, -10 - Math.floor(i / 3) * 3.5 + r() * 1.5];
    put("zebra" + i, quadruped("zebra", stripes, (bb) => {
      const mn = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.12).translate(0, 0.45, 0), col("#1e1c22")); mn.position.set(-0.08, 0, 0); bb.neck!.add(mn);
    }, { L: 1.9, H: 1.0, legL: 1.0, legR: 0.11, neckL: 0.85, neckA: 0.7, headS: 0.45 }), p, 0.15 + r() * 0.2);
    herd.push([p[0], 1.4, p[2]]);
  }
  b.build(root, false);
  const occ = big.build(root);

  // ---- motion: "run" moves an animal (or the herd) along its heading from the action's frame ----
  const runOf = (name: string, actions: Action[], fps: number, t: number) => {
    const herdName = name.startsWith("zebra") ? "zebras" : name;
    const a = actions.find((x) => x.id === "run" && (x.at === herdName || x.at === name));
    if (!a) return 0;
    const sp = Number(a.p?.speed ?? (name === "elephant" ? 5 : name === "lion" ? 9 : 8)), u = t - a.f / fps;
    return u > 0 ? sp * (u - 0.4 * (1 - Math.exp(-u / 0.4))) : 0;
  };
  const heading = (yaw: number): V3 => [Math.cos(yaw), 0, -Math.sin(yaw)];
  const trackOf = (name: string) => (t: number, a: Action[], fps: number): V3 => { const d = runOf(name, a, fps, t), h = heading(beasts[name].yaw); return [h[0] * d, 0, h[2] * d]; };
  const anchors: Record<string, Anchor> = {
    "elephant": { p: [6, 2.8, -46], size: 7, view: 70, ground: 0, track: trackOf("elephant") },
    "giraffe": { p: [24, 3.8, -36], size: 7, view: 40, ground: 0, track: trackOf("giraffe") },
    "lion": { p: [34, 1.1, -54], size: 3.6, view: 20, ground: 0, track: trackOf("lion") },
    "zebras": { p: [-56, 1.2, -14], size: 14, view: 40, ground: 0, points: herd, track: trackOf("zebra4") },
    "waterhole": { p: [-30, 1, -40], size: 40, view: 10, ground: 0 },
    "acacia": { p: [15, 6, -30], size: 12, view: 20, ground: 0 },
    "rock": { p: [50, 5, -68], size: 22, view: 15, ground: 0 },
    "mountain": { p: [120, 120, -900], size: 380, view: 0 },
    "plain": { p: [0, 3, -60], size: 120, view: 10, ground: 0 },
    "lookout": { p: [-8, 0, 12], size: 6, view: 0, ground: 0, eye: 1.7 },
  };
  return {
    root, anchors, occluders: occ, floor: () => 0,
    sky: { c: ["#f6dca8", "#cfe1ea", "#8fbde4", "#5d9edc", "#3a7fcf"], e: [0, 3, 10, 22, 60], fog: "#efdcb0", fogNear: 220, fogFar: 1700 },
    update(ctx: Ctx) {
      const t = ctx.t;
      for (const [name, bb] of Object.entries(beasts)) {
        const d = runOf(name, ctx.actions, ctx.fps, t), h = heading(bb.yaw), moving = d > 0.01;
        bb.g.position.set(bb.home[0] + h[0] * d, bb.home[1], bb.home[2] + h[2] * d);
        const ph = moving ? d / (bb.stride * 1.1) : t * 0.6 + bb.home[0];
        const sw = moving ? 0.55 : 0.04;
        bb.legs.forEach((l, k) => { l.rotation.z = sw * Math.sin(ph * Math.PI * 2 + [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5][k]); });
        bb.g.position.y = bb.home[1] + (moving ? Math.abs(Math.sin(ph * Math.PI * 2)) * 0.12 * bb.stride : 0);
        bb.head.rotation.x = 0.05 * Math.sin(t * 1.3 + bb.home[2]);
        if (moving && Math.floor(ph * 2) !== Math.floor((ph - 0.05) * 2)) { /* footfall */ }
        if (moving) puff(ctx, t - ((t * 3) % 1) / 3, [bb.g.position.x - h[0] * bb.stride, 0.4, bb.g.position.z - h[2] * bb.stride], 1.6 + bb.stride, [-h[0], 0.2, -h[2]], Math.floor(t * 3), false, 1.2);
      }
      const roar = ctx.actions.find((a) => a.id === "roar"), lion = beasts["lion"];
      if (roar && lion.neck) { const u = t - roar.f / ctx.fps; lion.neck.rotation.z = -0.9 + (u > 0 && u < 1.6 ? 0.55 * Math.sin(Math.min(1, u / 0.25) * Math.PI / 2) * (u < 1.3 ? 1 : (1.6 - u) / 0.3) : 0); }
      const tr = ctx.actions.find((a) => a.id === "trumpet"), el = beasts["elephant"];
      if (tr && el.trunk) { const u = t - tr.f / ctx.fps; el.trunk.rotation.z = u > 0 && u < 2 ? 2.2 * Math.sin(Math.min(1, u / 0.35) * Math.PI / 2) * (u < 1.6 ? 1 : (2 - u) / 0.4) : 0; }
    },
  };
};

export const SAVANNA: KitDef = {
  id: "savanna",
  desc: "African savanna: golden grass, acacia trees, snowy mountain, waterhole, big rock, elephant, giraffe, lion, zebra herd",
  ambience: "savanna",
  anchors: {
    "elephant": "an elephant", "giraffe": "a giraffe", "lion": "a lion in front of the rocks", "zebras": "a herd of nine zebras",
    "waterhole": "a waterhole", "acacia": "a flat-topped acacia tree", "rock": "a big rock outcrop", "mountain": "a snow-capped mountain far away",
    "plain": "wide view of the grassland", "lookout": "standing in the grass facing the animals (use with from-to)",
  },
  actions: { "run": "the animal or herd at the anchor gallops forward, kicking up dust (p.speed m/s)", "roar": "the lion rears its head and roars", "trumpet": "the elephant raises its trunk and trumpets" },
  build,
};
