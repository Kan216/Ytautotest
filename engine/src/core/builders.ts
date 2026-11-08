// Reusable builders: flat-roofed buildings with painted window bays and parapets, curved palm trees.
import * as THREE from "three";
import { rng } from "./paint";
import { Batch, V, quad, box, at } from "./geo";
export type Building = { x0: number; x1: number; z0: number; z1: number; h: number };
export const building = (b: Batch, B: Building, wall: THREE.Material, plain: THREE.Material, roof: THREE.Material, bayW = 4, bayH = 4, GROUND = 0) => {
  const { x0, x1, z0, z1, h } = B, y0 = GROUND - 0.5, y1 = GROUND + h;
  const uw = (w: number) => Math.max(1, Math.round(w / bayW)), vh = (y1 - GROUND) / bayH;
  b.add(quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), uw(x1 - x0), vh + 0.125, 0, 0), wall);
  b.add(quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), uw(x1 - x0), vh + 0.125), wall);
  b.add(quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), uw(z1 - z0), vh + 0.125), wall);
  b.add(quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), uw(z1 - z0), vh + 0.125), wall);
  b.add(quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), (x1 - x0) / 6, (z1 - z0) / 6), roof);
  const p = 0.35, ph = 0.7; // parapet
  b.add(box(x0 - 0.1, y1, z1 - p, x1 + 0.1, y1 + ph, z1 + 0.1), plain);
  b.add(box(x0 - 0.1, y1, z0 - 0.1, x1 + 0.1, y1 + ph, z0 + p), plain);
  b.add(box(x0 - 0.1, y1, z0, x0 + p, y1 + ph, z1), plain);
  b.add(box(x1 - p, y1, z0, x1 + 0.1, y1 + ph, z1), plain);
};
/** curved palm: trunk segments + drooping ribbon fronds */
/** y0 = height of the ground at the trunk foot */
export const palm = (b: Batch, x: number, z: number, h: number, seed: number, trunk: THREE.Material, leaf: THREE.Material[], y0 = 0) => {
  const r = rng(seed), lean = (r() - 0.5) * 0.5, dir = r() * Math.PI * 2;
  const pt = (u: number) => V(x + Math.cos(dir) * lean * h * u * u, y0 + h * u, z + Math.sin(dir) * lean * h * u * u);
  const N = 7;
  for (let i = 0; i < N; i++) {
    const a = pt(i / N), c = pt((i + 1) / N), len = a.distanceTo(c), rad0 = 0.34 - 0.13 * (i / N);
    const g = new THREE.CylinderGeometry(rad0 * 0.9, rad0, len * 1.04, 8, 1);
    g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), c.clone().sub(a).normalize()), V(1, 1, 1)));
    b.add(g, trunk);
  }
  const top = pt(1), F = 9;
  for (let k = 0; k < F; k++) {
    const az = (k / F) * Math.PI * 2 + r() * 0.4, len = h * (0.36 + r() * 0.12), droop = 0.55 + r() * 0.35, S = 8;
    const pos: number[] = [], uv: number[] = [];
    const ctr = (u: number) => V(Math.cos(az) * len * u, len * (0.35 * u - droop * u * u), Math.sin(az) * len * u);
    const side = V(-Math.sin(az), 0, Math.cos(az));
    for (let i = 0; i < S; i++) {
      const u0 = i / S, u1 = (i + 1) / S, w0 = 0.9 * Math.sin(Math.PI * Math.min(1, u0 * 1.1 + 0.08)) * (1 - u0 * 0.6), w1 = 0.9 * Math.sin(Math.PI * Math.min(1, u1 * 1.1 + 0.08)) * (1 - u1 * 0.6);
      const c0 = ctr(u0), c1 = ctr(u1);
      const a = c0.clone().addScaledVector(side, -w0), bq = c0.clone().addScaledVector(side, w0), c = c1.clone().addScaledVector(side, w1), d = c1.clone().addScaledVector(side, -w1);
      a.y -= w0 * 0.25; bq.y -= w0 * 0.25; c.y -= w1 * 0.25; d.y -= w1 * 0.25; // a slight V fold
      for (const v of [a, bq, c, a, c, d]) pos.push(v.x + top.x, v.y + top.y, v.z + top.z);
      uv.push(0, u0, 1, u0, 1, u1, 0, u0, 1, u1, 0, u1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    b.add(g, leaf[k % leaf.length]);
  }
  b.add(at(new THREE.SphereGeometry(0.45, 8, 6), top.x, top.y - 0.2, top.z), trunk);
};
