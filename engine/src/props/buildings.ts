// Building props: drop-in structures for any scene. Windmill blades turn; lighthouse lamp glows.
import * as THREE from "three";
import { bayTex } from "../core/textures";
import { lam } from "../core/geo";
import type { PropDef } from "./index";
import { M, mesh, boxM, cyl } from "./shapes";

const gable = (L: number, W: number, H: number, wall: THREE.Material, roof: string) => {
  const g = new THREE.Group(); g.add(boxM(L, H, W, wall, 0, H / 2, 0));
  const rg = new THREE.CylinderGeometry(0.01, W * 0.62, L + 0.6, 4, 1); rg.rotateY(Math.PI / 4); rg.rotateZ(Math.PI / 2); rg.scale(1, 0.75, 1);
  g.add(mesh(rg, M(roof), 0, H + W * 0.3, 0));
  return g;
};

export const BUILDINGS: PropDef[] = [
  { id: "house", cat: "building", desc: "cottage with a red gable roof", h: 7, len: 8, solid: true,
    build: () => { const g = gable(8, 6, 4.2, lam("bayCottage", () => ({ map: bayTex("cottage", "#f3ead8", "#3d5f8a") })), "#c0503a"); g.add(boxM(1.1, 2.1, 0.1, M("#7a4a2a"), 0, 1.05, 3.02)); return { obj: g, parts: {} }; } },
  { id: "barn", cat: "building", desc: "big red barn", h: 9, len: 12, solid: true,
    build: () => { const g = gable(12, 9, 5.5, M("#b8352f"), "#5a4a40"); g.add(boxM(3.4, 3.6, 0.1, M("#f1efe6"), 0, 1.8, 4.52)); return { obj: g, parts: {} }; } },
  { id: "hut", cat: "building", desc: "round hut with a thatched roof", h: 5, len: 5,
    build: () => { const g = new THREE.Group(); g.add(cyl(2.4, 2.5, 2.4, M("#c49a6a"), 0, 1.2, 0, 18)); g.add(mesh(new THREE.ConeGeometry(3.2, 2.8, 18), M("#d8b25a"), 0, 3.8, 0)); g.add(boxM(0.1, 1.6, 1, M("#3a2a20"), 2.46, 0.8, 0)); return { obj: g, parts: {} }; } },
  { id: "tent", cat: "building", desc: "canvas army tent", h: 3, len: 5,
    build: () => {
      const g = new THREE.Group(), t = new THREE.CylinderGeometry(0.01, 2.2, 5, 3, 1); t.rotateZ(Math.PI / 2); t.rotateX(Math.PI / 6);
      g.add(mesh(t, M("#b9a875"), 0, 1.1, 0)); g.add(cyl(0.05, 0.05, 3.2, M("#6b4a33"), 2.5, 1.6, 0, 6));
      return { obj: g, parts: {} };
    } },
  { id: "castle-tower", cat: "building", desc: "round stone castle tower with battlements", h: 16, len: 7, solid: true,
    build: () => {
      const g = new THREE.Group(), st = M("#b8b0a2");
      g.add(cyl(3.2, 3.5, 14, st, 0, 7, 0, 20));
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; g.add(boxM(1.1, 1.3, 1.1, st, Math.cos(a) * 3.1, 14.6, Math.sin(a) * 3.1)); }
      for (const y of [5, 9.5]) g.add(boxM(0.1, 1.4, 0.7, M("#2c3a46"), 3.42, y, 0));
      g.add(boxM(0.1, 2.6, 1.6, M("#5a3b2a"), 3.5, 1.3, 0));
      return { obj: g, parts: {} };
    } },
  { id: "lighthouse", cat: "building", desc: "red-and-white striped lighthouse", h: 20, len: 6, solid: true,
    build: () => {
      const g = new THREE.Group();
      for (let k = 0; k < 6; k++) g.add(cyl(2.4 - k * 0.22, 2.6 - k * 0.22, 2.8, M(k % 2 ? "#f6f4ef" : "#c8352f"), 0, 1.4 + k * 2.8, 0, 18));
      g.add(cyl(1.7, 1.7, 0.4, M("#2f3036"), 0, 17, 0, 18));
      const lamp = mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 1.4) }), 0, 18, 0); g.add(lamp);
      g.add(mesh(new THREE.ConeGeometry(1.6, 1.6, 16), M("#2f3036"), 0, 19.6, 0));
      return { obj: g, parts: { lamp } };
    }, animate: (p, s) => { ((p.parts.lamp as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setScalar(1).multiply(new THREE.Color(3, 2.6, 1.4)).multiplyScalar(0.7 + 0.3 * Math.sin(s.t * 2)); } },
  { id: "windmill", cat: "building", desc: "white windmill with turning sails", h: 14, len: 6, solid: true,
    build: () => {
      const g = new THREE.Group(); g.add(cyl(2, 3, 9, M("#f1efe6"), 0, 4.5, 0, 16)); g.add(mesh(new THREE.ConeGeometry(2.4, 2.4, 16), M("#5a4a40"), 0, 10.2, 0));
      const sails = new THREE.Group(); sails.position.set(2.4, 8.6, 0); g.add(sails);
      for (let k = 0; k < 4; k++) { const arm = new THREE.Group(); arm.rotation.x = (k * Math.PI) / 2; arm.add(boxM(0.1, 5.5, 1.3, M("#e9e4d8"), 0, 3, 0.4)); sails.add(arm); }
      return { obj: g, parts: { sails } };
    }, animate: (p, s) => { (p.parts.sails as THREE.Object3D).rotation.x = s.t * 0.8; } },
  { id: "pyramid", cat: "building", desc: "sandstone pyramid", h: 40, len: 60, solid: true,
    build: () => { const g = new THREE.Group(), c = new THREE.ConeGeometry(42, 40, 4); c.rotateY(Math.PI / 4); g.add(mesh(c, M("#dcc08a"), 0, 20, 0)); return { obj: g, parts: {} }; } },
];
