// Small shape helpers for props: every mesh is two-tone shaded (so it gets the toon look and ink lines) and casts
// shadows. Props are built facing +x with their base on y = 0.
import * as THREE from "three";
import { col } from "../core/geo";

export const M = (c: string, side: THREE.Side = THREE.FrontSide) => col(c, side);
export const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; return o;
};
export const ell = (rx: number, ry: number, rz: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const s = mesh(new THREE.SphereGeometry(1, 20, 14), m, x, y, z); s.scale.set(rx, ry, rz); return s;
};
export const boxM = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
export const cyl = (r0: number, r1: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 14) => mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m, x, y, z);
/** limb hanging from a pivot at its top (rotate the returned group to swing it) */
export const limb = (len: number, r0: number, r1: number, m: THREE.Material) => {
  const p = new THREE.Group(); p.add(mesh(new THREE.CylinderGeometry(r0, r1, len, 10).translate(0, -len / 2, 0), m)); return p;
};
/** wheel on the z axis (rotate about z to roll) */
export const wheel = (r: number, w: number, tyre = "#26262c", hub = "#c9ccd2") => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r, w, 18).rotateX(Math.PI / 2), M(tyre)));
  g.add(mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, w + 0.02, 10).rotateX(Math.PI / 2), M(hub)));
  g.add(mesh(new THREE.BoxGeometry(r * 1.6, r * 0.18, w + 0.04), M(hub))); // spoke so rolling reads
  return g;
};
