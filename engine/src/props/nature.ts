// Nature props: trees, bushes, rocks, cactus, log, flowers. Foliage sways gently.
import * as THREE from "three";
import { rng } from "../core/paint";
import type { PropDef, PropInst, PropState } from "./index";
import { M, mesh, cyl, ell } from "./shapes";

const sway = (p: PropInst, s: PropState) => { const c = p.parts.crown as THREE.Object3D | undefined; if (c) c.rotation.z = 0.02 * Math.sin(s.t * 0.9 + (c.userData.ph ??= Math.random() * 6)); };
const tree = (build: (g: THREE.Group, crown: THREE.Group, r: () => number) => void) => (seed: number): PropInst => {
  const g = new THREE.Group(), crown = new THREE.Group(); g.add(crown); build(g, crown, rng(seed + 3)); return { obj: g, parts: { crown } };
};

export const NATURE: PropDef[] = [
  { id: "acacia", cat: "nature", desc: "flat-topped acacia tree", h: 8, build: tree((g, c) => {
    g.add(cyl(0.35, 0.6, 7.5, M("#6b4a33"), 0, 3.75, 0, 8));
    for (const [dx, dz, s, k] of [[0.8, 0, 1, 0], [2.6, 0.4, 0.7, 1], [-1.4, -0.3, 0.75, 0]] as const) { const e = ell(4.1 * s, 0.9 * s, 4.1 * s, M(k ? "#6c9c44" : "#5f8f3c"), dx, 7.8, dz); c.add(e); }
  }), animate: sway },
  { id: "palm", cat: "nature", desc: "palm tree", h: 11, build: tree((g, c, r) => {
    const lean = 0.6 + r() * 0.4;
    for (let i = 0; i < 6; i++) g.add(cyl(0.3 - i * 0.025, 0.34 - i * 0.025, 1.9, M("#8a6a4a"), lean * (i / 6) ** 2, 0.95 + i * 1.8, 0, 8));
    c.position.set(lean, 10.6, 0);
    for (let k = 0; k < 8; k++) { const f = ell(2.6, 0.12, 0.6, M(k % 2 ? "#4f9a3c" : "#5aa843"), 2.2, -0.6, 0); const pv = new THREE.Group(); pv.rotation.y = (k / 8) * Math.PI * 2; pv.rotation.z = -0.35; pv.add(f); c.add(pv); }
  }), animate: sway },
  { id: "pine", cat: "nature", desc: "dark green pine tree", h: 9, build: tree((g, c) => {
    g.add(cyl(0.25, 0.35, 2.5, M("#6b4a33"), 0, 1.25, 0, 8));
    for (let k = 0; k < 3; k++) c.add(mesh(new THREE.ConeGeometry(2.6 - k * 0.7, 3.2, 9), M(k % 2 ? "#2f6a3c" : "#3a7a45"), 0, 3.2 + k * 1.9, 0));
  }), animate: sway },
  { id: "oak", cat: "nature", desc: "round leafy tree", h: 8, build: tree((g, c, r) => {
    g.add(cyl(0.35, 0.55, 4, M("#6b4a33"), 0, 2, 0, 8));
    for (let k = 0; k < 6; k++) c.add(ell(1.8 + r(), 1.6 + r() * 0.6, 1.8 + r(), M(k % 2 ? "#5a9a45" : "#4c8a3c"), (r() - 0.5) * 2.4, 5.2 + r() * 1.8, (r() - 0.5) * 2.4));
  }), animate: sway },
  { id: "bush", cat: "nature", desc: "small round bush", h: 1.4, build: tree((_, c, r) => {
    for (let k = 0; k < 4; k++) c.add(ell(0.8 + r() * 0.3, 0.6 + r() * 0.2, 0.8 + r() * 0.3, M(k % 2 ? "#5a9a45" : "#6aa84f"), (r() - 0.5) * 1.2, 0.5, (r() - 0.5) * 1.2));
  }), animate: sway },
  { id: "rock", cat: "nature", desc: "big boulder", h: 3, build: (seed) => {
    const g = new THREE.Group(), r = rng(seed + 9);
    for (let k = 0; k < 3; k++) { const d = new THREE.DodecahedronGeometry(1.4 + r() * 0.8, 0); d.scale(1.2, 0.8, 1); g.add(mesh(d, M(k ? "#a69580" : "#b39878"), (r() - 0.5) * 2, 1 + k * 0.2, (r() - 0.5) * 2)); }
    return { obj: g, parts: {} };
  } },
  { id: "cactus", cat: "nature", desc: "desert cactus with two arms", h: 4, build: () => {
    const g = new THREE.Group(), m = M("#4f8a4a");
    g.add(cyl(0.4, 0.45, 4, m, 0, 2, 0, 10)); g.add(ell(0.4, 0.3, 0.4, m, 0, 4, 0));
    for (const [s, y] of [[1, 1.8], [-1, 2.4]] as const) { g.add(cyl(0.25, 0.25, 0.9, m, s * 0.6, y, 0, 8).rotateZ(Math.PI / 2)); g.add(cyl(0.25, 0.25, 1.2, m, s * 1.0, y + 0.5, 0, 8)); }
    return { obj: g, parts: {} };
  } },
  { id: "log", cat: "nature", desc: "fallen log", h: 0.8, len: 4, build: () => {
    const g = new THREE.Group(); g.add(mesh(new THREE.CylinderGeometry(0.4, 0.45, 4, 12).rotateZ(Math.PI / 2), M("#7a5a3a"), 0, 0.4, 0));
    for (const s of [-1, 1]) g.add(mesh(new THREE.CircleGeometry(0.4, 12).rotateY(s * Math.PI / 2), M("#d8b88a"), s * 2.01, 0.4, 0));
    return { obj: g, parts: {} };
  } },
  { id: "flowers", cat: "nature", desc: "patch of colourful flowers", h: 0.6, build: (seed) => {
    const g = new THREE.Group(), r = rng(seed + 5), cols = ["#e2453c", "#f2c230", "#c25a7a", "#f6f4ef", "#7b5ac9"];
    for (let k = 0; k < 24; k++) { const x = (r() - 0.5) * 3, z = (r() - 0.5) * 3; g.add(cyl(0.02, 0.02, 0.5, M("#4f8a3c"), x, 0.25, z, 4)); g.add(ell(0.12, 0.08, 0.12, M(cols[k % 5]), x, 0.52, z)); }
    return { obj: g, parts: {} };
  } },
];
