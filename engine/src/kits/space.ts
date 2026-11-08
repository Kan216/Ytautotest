// Space kit (science / space): a Moon base under a black starry sky - cratered grey ground, the Earth and a ringed
// planet hanging in the sky, a rocket on its launch pad with a service tower, a lunar lander, a dome base, a flag
// and a satellite crossing overhead. Kit action: "launch" (the rocket lifts off with flame, smoke and dust).
import * as THREE from "three";
import { ctex, rng } from "../core/paint";
import { twoTone } from "../core/shade";
import { V3, V, quad, box, at, Batch, lam, col } from "../core/geo";
import { flagTex } from "../core/textures";
import { burst, puff } from "../core/actions";
import { Anchor, Ctx, KitDef, KitWorld } from "../core/types";

const regolith = () => ctex("regolith", 1024, 1024, (g, r) => {
  g.fillStyle = "#a9a7a6"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "70,70,78" : "235,235,232"},${(0.04 + r() * 0.06).toFixed(3)})`; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, 4 + r() * 40, 3 + r() * 30, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 40; i++) { // small painted craters: dark rim on the lower side, light on the upper
    const x = r() * 1024, y = r() * 1024, rr = 10 + r() * 50;
    g.lineWidth = 3 + rr * 0.08; g.strokeStyle = "rgba(60,58,66,0.35)"; g.beginPath(); g.arc(x, y, rr, 0.2, Math.PI - 0.2); g.stroke();
    g.strokeStyle = "rgba(245,245,240,0.35)"; g.beginPath(); g.arc(x, y, rr, Math.PI + 0.2, -0.2); g.stroke();
  }
});
const earthTex = () => ctex("earth", 1024, 512, (g, r) => {
  g.fillStyle = "#2f6fd0"; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 26; i++) { // continents: lumpy green-brown blobs
    const cx = r() * 1024, cy = 90 + r() * 330, n = 6 + Math.floor(r() * 6);
    g.fillStyle = ["#4f9a4a", "#5fa84f", "#9a8a50", "#6aa45a"][i % 4];
    for (let k = 0; k < n; k++) { g.beginPath(); g.ellipse(cx + (r() - 0.5) * 120, cy + (r() - 0.5) * 70, 20 + r() * 50, 14 + r() * 34, r() * 3, 0, 7); g.fill(); }
  }
  g.fillStyle = "#f2f4f8"; g.fillRect(0, 0, 1024, 34); g.fillRect(0, 478, 1024, 34);
  for (let i = 0; i < 70; i++) { g.fillStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.ellipse(r() * 1024, r() * 512, 20 + r() * 70, 5 + r() * 10, r() * 0.6, 0, 7); g.fill(); }
});
const planetTex = () => ctex("ringPlanet", 512, 256, (g, r) => {
  const bands = ["#e8c48a", "#d9a86a", "#f0d8a8", "#c89058", "#e2bc80"];
  for (let y = 0; y < 256; y += 8) { g.fillStyle = bands[Math.floor(r() * bands.length)]; g.fillRect(0, y, 512, 8 + r() * 10); }
});
const ringTex = () => ctex("ring", 512, 16, (g, r) => {
  for (let x = 0; x < 512; x++) { g.fillStyle = `rgba(230,205,160,${(0.25 + 0.6 * r()).toFixed(2)})`; g.fillRect(x, 0, 1, 16); }
});

const PAD: V3 = [0, 0, 0], ROCKET_H = 34;
/** rocket height above the pad at time t: 0.7 s ignition, then accelerating climb */
const lift = (t: number, actions: { id: string; f: number }[], fps: number) => {
  const L = actions.find((a) => a.id === "launch");
  if (!L) return 0;
  const u = t - L.f / fps - 0.7;
  return u > 0 ? 2.2 * u * u + 1.5 * u : 0;
};

const build = (seed: number): KitWorld => {
  const root = new THREE.Group(), b = new Batch(), big = new Batch(), r = rng(31 + seed);
  // ---- ground + craters + boulders ----
  const ground = lam("regolith", () => ({ map: (() => { const t = regolith().clone(); t.repeat.set(1, 1); t.needsUpdate = true; return t; })() }));
  b.add(quad(V(-1500, 0, 1500), V(1500, 0, 1500), V(1500, 0, -1500), V(-1500, 0, -1500), 60, 60), ground);
  const rim = col("#9c9a9a"), rock = col("#8e8b8c");
  const craters: V3[] = [];
  for (let i = 0; i < 26; i++) {
    const x = (r() - 0.5) * 700, z = -40 - r() * 600, R = 6 + r() * 30;
    if (Math.hypot(x, z) < 60) continue;
    const t = new THREE.TorusGeometry(R, R * 0.16, 6, 28); t.rotateX(Math.PI / 2); t.scale(1, 0.55, 1);
    b.add(at(t, x, 0.2, z), rim); craters.push([x, 0, z]);
  }
  for (let i = 0; i < 60; i++) {
    const x = (r() - 0.5) * 500, z = 30 - r() * 520, s = 0.6 + r() * 3.2;
    if (Math.hypot(x - PAD[0], z - PAD[2]) < 22) continue;
    const g = new THREE.DodecahedronGeometry(s, 0); g.scale(1, 0.6, 1.1);
    b.add(at(g, x, s * 0.3, z, r() * 3), rock);
  }
  // ---- launch pad + service tower ----
  const steel = col("#c43c32"), conc = col("#cfcac4"), grey = col("#8a8f98");
  big.add(box(-14, 0, -14, 14, 2.2, 14), conc);
  big.add(box(-5, 2.2, -5, 5, 3.0, 5), grey);
  const TX = 11;
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) big.add(box(TX + dx - 0.3, 2.2, dz - 0.3, TX + dx + 0.3, 42, dz + 0.3), steel);
  for (let y = 6; y < 42; y += 4) { big.add(box(TX - 2.3, y, -2.3, TX + 2.3, y + 0.35, 2.3), steel); }
  for (const y of [14, 26, 36]) big.add(box(3.2, y, -0.6, TX - 2, y + 0.5, 0.6), steel); // swing arms
  // ---- rocket (moves on launch) ----
  const rocket = new THREE.Group(); rocket.position.set(PAD[0], 3.0, PAD[2]);
  const prof: THREE.Vector2[] = [[0, 0], [2.6, 0], [2.8, 2], [2.8, 22], [2.5, 26], [1.6, 30.5], [0.5, 33], [0, ROCKET_H]].map(([x, y]) => new THREE.Vector2(x, y));
  const white = twoTone(new THREE.MeshLambertMaterial({ color: "#f3f1ec" })), red = col("#d2402f"), dark = col("#2a2c38");
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), white); body.castShadow = true; rocket.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(2.83, 2.83, 1.6, 28).translate(0, 18, 0), dark); rocket.add(band);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 1.62, 3.5, 28).translate(0, 32.2, 0), red); rocket.add(nose);
  for (let k = 0; k < 4; k++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6, 3.4).translate(0, 3, 3.6), red);
    fin.rotation.y = (k * Math.PI) / 2 + Math.PI / 4; fin.castShadow = true; rocket.add(fin);
  }
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), col("#3a78c8")); win.position.set(0, 25, 2.62); win.rotation.x = -0.12; rocket.add(win);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.0, 1.6, 20).translate(0, -0.8, 0), dark); rocket.add(nozzle);
  root.add(rocket);
  // ---- lander, dome base, flag ----
  const LX = -46, LZ = -24, gold = col("#d8a83a");
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    const leg = new THREE.CylinderGeometry(0.12, 0.12, 4.6, 6); leg.rotateZ(dx > 0 ? -0.45 : 0.45); leg.rotateX(dz > 0 ? 0.45 : -0.45);
    big.add(at(leg, LX + dx * 0.7, 2.0, LZ + dz * 0.7), grey);
    big.add(at(new THREE.CylinderGeometry(0.7, 0.8, 0.2, 12), LX + dx * 1.05, 0.1, LZ + dz * 1.05), grey);
  }
  big.add(box(LX - 2.4, 2.4, LZ - 2.4, LX + 2.4, 5.0, LZ + 2.4), gold);
  big.add(at(new THREE.CylinderGeometry(1.9, 2.2, 2.6, 8), LX, 6.3, LZ), col("#d9dce2"));
  const DX = 54, DZ = -42;
  big.add(at(new THREE.SphereGeometry(13, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), DX, 0, DZ), col("#eef0f2"));
  big.add(at(new THREE.SphereGeometry(7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), DX + 22, 0, DZ + 6), col("#eef0f2"));
  big.add(at(new THREE.CylinderGeometry(2.2, 2.2, 12, 14).rotateZ(Math.PI / 2), DX + 14, 2.2, DZ + 3), col("#dfe2e6"));
  for (let k = 0; k < 6; k++) big.add(box(DX - 9 + k * 3.2, 4.5, DZ + 11.4, DX - 7.6 + k * 3.2, 6.2, DZ + 12.6), col("#3a78c8"));
  const FX = -18, FZ = 14;
  big.add(at(new THREE.CylinderGeometry(0.07, 0.07, 4.2, 6), FX, 2.1, FZ), col("#dcdcdc"));
  big.add(box(FX, 3.1, FZ - 0.02, FX + 2.2, 4.1, FZ + 0.02), col("#dcdcdc"));
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5).translate(1.25, 3.4, 0), twoTone(new THREE.MeshLambertMaterial({ map: flagTex("#2f6fd0"), side: THREE.DoubleSide })));
  flag.position.set(FX, 0, FZ + 0.05); root.add(flag);
  // ---- sky bodies: Earth, ringed planet, satellite ----
  const earth = new THREE.Mesh(new THREE.SphereGeometry(95, 48, 32), twoTone(new THREE.MeshLambertMaterial({ map: earthTex() })));
  earth.position.set(-260, 330, -900); earth.rotation.set(0.3, 2.2, 0.1); root.add(earth);
  const planet = new THREE.Group(); planet.position.set(380, 240, -1050); planet.rotation.set(0.35, 0, 0.4);
  planet.add(new THREE.Mesh(new THREE.SphereGeometry(70, 40, 24), twoTone(new THREE.MeshLambertMaterial({ map: planetTex() }))));
  const ring = new THREE.Mesh(new THREE.RingGeometry(95, 150, 64), new THREE.MeshBasicMaterial({ map: ringTex(), transparent: true, side: THREE.DoubleSide, fog: false }));
  ring.rotation.x = Math.PI / 2; planet.add(ring); root.add(planet);
  const sat = new THREE.Group();
  sat.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 3), gold));
  for (const s of [-1, 1]) sat.add(new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 2.2).translate(s * 4.2, 0, 0), col("#2f4f9a")));
  root.add(sat);
  b.build(root, false);
  const occ = big.build(root);

  const anchors: Record<string, Anchor> = {
    "rocket": { p: [PAD[0], 3 + ROCKET_H * 0.5, PAD[2]], size: 40, view: 200, ground: 2.2, track: (t, a, fps) => [0, lift(t, a, fps), 0] },
    "rocket-top": { p: [PAD[0], 3 + ROCKET_H - 4, PAD[2]], size: 10, view: 190, track: (t, a, fps) => [0, lift(t, a, fps), 0] },
    "rocket-base": { p: [PAD[0], 4, PAD[2]], size: 10, view: 200, ground: 2.2, points: [[PAD[0], 2.5, PAD[2]]] },
    "pad": { p: [PAD[0] + 4, 10, PAD[2]], size: 48, view: 215, ground: 2.2 },
    "earth": { p: [-260, 330, -900], size: 230, view: 0 },
    "planet": { p: [380, 240, -1050], size: 320, view: 0 },
    "lander": { p: [LX, 4, LZ], size: 12, view: 30, ground: 0 },
    "base": { p: [DX + 6, 6, DZ], size: 44, view: 20, ground: 0 },
    "moon-flag": { p: [FX + 1.2, 3, FZ], size: 5, view: 150, ground: 0 },
    "crater": { p: craters[0] ?? [0, 0, -120], size: 70, view: 10, ground: 0 },
    "surface": { p: [0, 2, -120], size: 260, view: 0, ground: 0 },
    "satellite": { p: [40, 120, -200], size: 14, view: 0 },
    "lookout": { p: [-20, 0, 70], size: 6, view: 0, ground: 0, eye: 1.7 },
  };
  return {
    root, anchors, occluders: occ,
    sky: { c: ["#262a44", "#171a33", "#0d1026", "#080a1c", "#04050f"], e: [0, 4, 12, 28, 70], fog: "#151829", fogNear: 400, fogFar: 2600, stars: true, clouds: false },
    floor: (x, z) => (Math.abs(x) < 14 && Math.abs(z) < 14 ? 2.2 : 0),
    update(ctx: Ctx) {
      const t = ctx.t;
      // satellite crosses the sky slowly
      const sa = t * 0.05;
      sat.position.set(40 + Math.cos(sa) * 60, 120 + Math.sin(sa * 2) * 6, -200 + Math.sin(sa) * 30); sat.rotation.set(0.3, t * 0.2, 0.1);
      anchors.satellite.p = [sat.position.x, sat.position.y, sat.position.z];
      flag.rotation.y = 0.15 * Math.sin(t * 0.6);
      // launch: ignition rumble (0.7 s), then lift-off accelerating upward with flame and billowing smoke
      const L = ctx.actions.find((a) => a.id === "launch");
      const h = lift(t, ctx.actions, ctx.fps);
      if (L) {
        const t0 = L.f / ctx.fps;
        rocket.position.set(PAD[0] + (t > t0 ? Math.sin(t * 60) * 0.03 : 0), 3.0 + h, PAD[2]);
        if (t > t0) {
          const fy = 3.0 + h - 2.2, k = Math.floor((t * ctx.fps) % 8);
          burst(ctx, t - k / ctx.fps, [PAD[0], fy, PAD[2]], 7 + Math.min(4, h * 0.2), true);
          for (let j = 0; j < 10; j++) {
            const ts = t0 + j * 0.25;
            if (t > ts) puff(ctx, ts, [PAD[0] + (j % 2 ? 6 : -6), 3.5, PAD[2] + (j % 3) * 3 - 3], 12 + j, [(j % 2 ? 1 : -1) * 2, 0.15, (j % 3) - 1], j, false, 6);
          }
        }
      }
    },
  };
};

export const SPACE: KitDef = {
  id: "space",
  desc: "Moon base under a starry sky: rocket on a launch pad, Earth and a ringed planet in the sky, lander, dome base, flag, satellite",
  ambience: "space",
  anchors: {
    "rocket": "the whole rocket (follows it after launch)", "rocket-top": "the rocket's nose and window", "rocket-base": "the rocket's engines at the bottom",
    "pad": "the launch pad with its red service tower", "earth": "the Earth hanging in the sky", "planet": "a ringed planet in the sky",
    "lander": "a gold lunar lander on legs", "base": "white dome moon base", "moon-flag": "a flag planted in the dust",
    "crater": "a large crater", "surface": "wide view of the grey cratered surface", "satellite": "a satellite crossing the sky",
    "lookout": "standing on the surface facing the launch pad (use with from-to)",
  },
  actions: { "launch": "the rocket ignites and lifts off: flame, smoke clouds, shaking (on -> keeps rising)" },
  build,
};
