// Geometry helpers shared by every scene kit: quads/boxes with tiled UVs, placement, a static mesh batcher and
// cached two-tone materials (shade.ts) so every kit gets the same toon shading and ink.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { twoTone } from "./shade";
export type V3 = [number, number, number];
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------- geometry helpers ----------------
export const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, a.itemSize);
};
export const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u1 = 1, v1 = 1, u0 = 0, v0 = 0) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2, 3, 4, 5].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  return g;
};
export const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tile = 0) => {
  const t = (a: number) => (tile ? a / tile : 1), w = x1 - x0, h = y1 - y0, d = z1 - z0;
  return mergeGeometries([
    quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), t(w), t(h)),
    quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), t(w), t(h)),
    quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), t(d), t(h)),
    quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), t(d), t(h)),
    quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), t(w), t(d)),
  ], false);
};
export const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) =>
  g.applyMatrix4(new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")), V(1, 1, 1)));

/** collects pieces by material, merges into one static mesh per material */
export class Batch {
  private g = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material) {
    const src = geo.index ? geo.toNonIndexed() : geo, x = new THREE.BufferGeometry();
    x.setAttribute("position", f32(src.attributes.position));
    if (src.attributes.normal) x.setAttribute("normal", f32(src.attributes.normal)); else x.computeVertexNormals();
    x.setAttribute("uv", src.attributes.uv ? f32(src.attributes.uv) : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    const l = this.g.get(mat); if (l) l.push(x); else this.g.set(mat, [x]);
  }
  build(parent: THREE.Object3D, cast = true) {
    const out: THREE.Mesh[] = [];
    for (const [mat, list] of this.g) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      mesh.castShadow = cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      parent.add(mesh); out.push(mesh);
    }
    this.g.clear();
    return out;
  }
}
export const mats = new Map<string, THREE.Material>();
export const lam = (key: string, p: () => THREE.MeshLambertMaterialParameters, liftK = 1) => {
  let m = mats.get(key);
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(p()), liftK); mats.set(key, m); }
  return m;
};
export const col = (c: string, side: THREE.Side = THREE.FrontSide) => lam("c" + c + side, () => ({ color: c, side }));
