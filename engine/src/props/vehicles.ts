// Cartoon vehicles. Wheels roll with the distance driven; propellers spin; boats bob; guns recoil on "fire".
import * as THREE from "three";
import type { PropDef, PropInst, PropState } from "./index";
import { M, mesh, boxM, cyl, wheel, ell } from "./shapes";

const roll = (p: PropInst, s: PropState) => (p.parts.wheels as THREE.Object3D[] | undefined)?.forEach((w) => { w.rotation.z = -s.d / (p.stride ?? 0.4); });
const recoil = (p: PropInst, s: PropState, key = "barrel", k = 0.4) => {
  const b = p.parts[key] as THREE.Object3D | undefined, u = s.since.fire;
  if (!b) return;
  b.position.x = (b.userData.x0 ??= b.position.x) - (u !== undefined && u >= 0 ? k * Math.exp(-u * 7) * Math.min(1, u * 60) : 0);
};
const car = (body: string, roof: string, L: number, W: number, H: number, bus = false): PropInst => {
  const g = new THREE.Group(), r = bus ? 0.55 : 0.38, wheels: THREE.Object3D[] = [];
  g.add(boxM(L, H * 0.5, W, M(body), 0, r + H * 0.25, 0));
  if (bus) g.add(boxM(L * 0.98, H * 0.42, W * 0.98, M(roof), 0, r + H * 0.71, 0));
  else g.add(boxM(L * 0.55, H * 0.42, W * 0.92, M(roof), -L * 0.05, r + H * 0.71, 0));
  const glass = M("#9fd0f0"), n = bus ? 6 : 2;
  for (const s of [-1, 1]) for (let k = 0; k < n; k++) {
    const w = bus ? (L * 0.85) / n : L * 0.22, x = bus ? -L * 0.42 + w * (k + 0.5) : -L * 0.17 + k * L * 0.25;
    g.add(boxM(w * 0.8, H * 0.28, 0.04, glass, x, r + H * 0.72, s * (bus ? W * 0.495 : W * 0.465)));
  }
  g.add(boxM(0.04, H * 0.28, W * 0.8, glass, bus ? L * 0.495 : L * 0.225, r + H * 0.72, 0));
  for (const s of [-1, 1]) g.add(mesh(new THREE.CircleGeometry(0.12, 12).rotateY(Math.PI / 2), M("#fff6c8"), L / 2 + 0.01, r + H * 0.3, s * W * 0.35));
  for (const [x, z] of [[L * 0.32, W / 2], [L * 0.32, -W / 2], [-L * 0.32, W / 2], [-L * 0.32, -W / 2]]) { const w = wheel(r, 0.28); w.position.set(x, r, z); g.add(w); wheels.push(w); }
  return { obj: g, parts: { wheels }, stride: r };
};

export const VEHICLES: PropDef[] = [
  { id: "car", cat: "vehicle", desc: "small red car", h: 1.6, len: 4, move: "drive", speed: 12, acts: { honk: "honks its horn" },
    build: () => car("#d2402f", "#e9e4da", 4, 1.8, 1.4), animate: roll },
  { id: "car-blue", cat: "vehicle", desc: "small blue car", h: 1.6, len: 4, move: "drive", speed: 12, acts: { honk: "honks its horn" },
    build: () => car("#3f6fb5", "#e9e4da", 4, 1.8, 1.4), animate: roll },
  { id: "taxi", cat: "vehicle", desc: "yellow taxi", h: 1.6, len: 4.2, move: "drive", speed: 12, acts: { honk: "honks its horn" },
    build: () => car("#f2c230", "#f2c230", 4.2, 1.8, 1.4), animate: roll },
  { id: "bus", cat: "vehicle", desc: "long green city bus", h: 3.2, len: 10, move: "drive", speed: 9, acts: { honk: "honks its horn" },
    build: () => car("#3d9a5a", "#f1efe6", 10, 2.5, 2.6, true), animate: roll },
  { id: "jeep", cat: "vehicle", desc: "open safari jeep", h: 2, len: 4, move: "drive", speed: 10,
    build: () => {
      const p = car("#7a8a4a", "#7a8a4a", 4, 1.9, 1.3); const g = p.obj; g.remove(g.children[1]);
      g.add(boxM(0.08, 0.6, 1.8, M("#3a3a40"), 0.4, 1.5, 0)); g.add(boxM(1.2, 0.08, 1.9, M("#d8c8a0"), -0.6, 1.95, 0));
      for (const [x, z] of [[-1.2, 0.9], [-1.2, -0.9], [0.0, 0.9], [0.0, -0.9]]) g.add(cyl(0.04, 0.04, 0.9, M("#3a3a40"), x, 1.5, z, 6));
      return p;
    }, animate: roll },
  { id: "cannon", cat: "vehicle", desc: "old field cannon on two wheels (fire)", h: 1.6, len: 2.6, muzzle: [1.75, 1.15, 0],
    build: () => {
      const g = new THREE.Group(), wheels: THREE.Object3D[] = [];
      const barrel = new THREE.Group(); barrel.position.set(0.1, 1.0, 0); barrel.rotation.z = 0.08; g.add(barrel);
      barrel.add(mesh(new THREE.CylinderGeometry(0.16, 0.24, 2.2, 14).rotateZ(-Math.PI / 2).translate(0.6, 0, 0), M("#2f3036")));
      barrel.add(ell(0.28, 0.28, 0.28, M("#2f3036"), -0.5, 0, 0));
      g.add(boxM(1.8, 0.2, 0.5, M("#7a4a2a"), -0.6, 0.55, 0)); g.children[g.children.length - 1].rotation.z = 0.35;
      for (const s of [-1, 1]) { const w = wheel(0.6, 0.12, "#6b4428", "#8a5a36"); w.position.set(0, 0.6, s * 0.55); g.add(w); wheels.push(w); }
      return { obj: g, parts: { barrel, wheels }, stride: 0.6 };
    }, animate: (p, s) => recoil(p, s) },
  { id: "rowboat", cat: "vehicle", desc: "small wooden rowboat (for water)", h: 0.9, len: 4, move: "drive", speed: 3,
    build: () => {
      const g = new THREE.Group(), hull = new THREE.Group(); g.add(hull);
      const h = ell(2, 0.5, 0.75, M("#9a6238"), 0, 0.15, 0); h.scale.y = 0.5; hull.add(h);
      hull.add(boxM(3.2, 0.12, 1.2, M("#c8a070"), 0, 0.42, 0)); hull.add(boxM(0.4, 0.15, 1.3, M("#7a4a2a"), 0.3, 0.55, 0));
      return { obj: g, parts: { hull } };
    }, animate: (p, s) => { const h = p.parts.hull as THREE.Object3D; h.rotation.x = 0.04 * Math.sin(s.t * 1.7); h.position.y = 0.06 * Math.sin(s.t * 1.3); } },
  { id: "sailboat", cat: "vehicle", desc: "white sailboat with a triangular sail (for water)", h: 8, len: 7, move: "drive", speed: 5,
    build: () => {
      const g = new THREE.Group(), hull = new THREE.Group(); g.add(hull);
      const h = ell(3.5, 0.9, 1.2, M("#f3f0e8"), 0, 0.2, 0); h.scale.y = 0.6; hull.add(h);
      hull.add(boxM(5.5, 0.12, 1.8, M("#b8865a"), 0, 0.72, 0)); hull.add(cyl(0.08, 0.1, 7.5, M("#8a6a4a"), 0.4, 4.4, 0, 8));
      const sail = new THREE.BufferGeometry(); sail.setAttribute("position", new THREE.Float32BufferAttribute([0.5, 1.2, 0, 0.5, 7.8, 0, -2.8, 1.2, 0], 3)); sail.computeVertexNormals();
      hull.add(mesh(sail, M("#fbf8f1", THREE.DoubleSide)));
      return { obj: g, parts: { hull } };
    }, animate: (p, s) => { const h = p.parts.hull as THREE.Object3D; h.rotation.x = 0.05 * Math.sin(s.t * 1.2); h.position.y = 0.1 * Math.sin(s.t * 1.0); } },
  { id: "plane", cat: "vehicle", desc: "old propeller plane (fly)", h: 2.5, len: 7, move: "fly", speed: 30,
    build: () => {
      const g = new THREE.Group(); g.position.y = 0;
      g.add(mesh(new THREE.CylinderGeometry(0.55, 0.3, 6, 16).rotateZ(Math.PI / 2), M("#d9c27a"), 0, 1.4, 0));
      g.add(boxM(1.4, 0.12, 9, M("#c8402f"), 0.6, 1.4, 0)); g.add(boxM(0.9, 0.1, 3, M("#c8402f"), -2.7, 1.6, 0)); g.add(boxM(0.9, 1.2, 0.1, M("#c8402f"), -2.7, 2.1, 0));
      g.add(ell(0.5, 0.35, 0.4, M("#9fd0f0"), 0.6, 1.9, 0));
      const prop = new THREE.Group(); prop.position.set(3.05, 1.4, 0); prop.add(boxM(0.08, 2.2, 0.2, M("#3a3a40"))); g.add(prop);
      for (const s of [-1, 1]) { const w = wheel(0.3, 0.15); w.position.set(1, 0.3, s * 0.8); g.add(w); g.add(cyl(0.04, 0.04, 0.9, M("#3a3a40"), 1, 0.75, s * 0.7, 6)); }
      return { obj: g, parts: { prop } };
    }, animate: (p, s) => { (p.parts.prop as THREE.Object3D).rotation.x = s.t * 40; } },
  { id: "tank", cat: "vehicle", desc: "green army tank with a turret gun (fire)", h: 2.6, len: 6.5, move: "drive", speed: 5, muzzle: [4.6, 2.05, 0],
    build: () => {
      const g = new THREE.Group(), olive = M("#5f6b3a"), dark = M("#2f3326");
      g.add(boxM(6, 1.1, 3.4, olive, 0, 1.0, 0));
      for (const s of [-1, 1]) g.add(boxM(6.2, 0.9, 0.7, dark, 0, 0.55, s * 1.75));
      const turret = new THREE.Group(); turret.position.set(-0.3, 1.55, 0); g.add(turret);
      turret.add(cyl(1.2, 1.35, 0.9, olive, 0, 0.45, 0, 16));
      const barrel = new THREE.Group(); barrel.position.set(1.2, 0.5, 0); turret.add(barrel);
      barrel.add(mesh(new THREE.CylinderGeometry(0.13, 0.16, 3.6, 12).rotateZ(-Math.PI / 2).translate(1.8, 0, 0), olive));
      return { obj: g, parts: { barrel }, stride: 0.45 };
    }, animate: (p, s) => recoil(p, s, "barrel", 0.5) },
];
