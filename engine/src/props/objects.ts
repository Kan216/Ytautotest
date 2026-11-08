// Object props: small things that dress a scene. Campfire flickers, flag waves, traffic light cycles.
import * as THREE from "three";
import { flagTex } from "../core/textures";
import { twoTone } from "../core/shade";
import type { PropDef } from "./index";
import { M, mesh, boxM, cyl, ell } from "./shapes";

const glow = (c: [number, number, number]) => new THREE.MeshBasicMaterial({ color: new THREE.Color(...c) });

export const OBJECTS: PropDef[] = [
  { id: "crate", cat: "object", desc: "wooden crate", h: 1.2, build: () => {
    const g = new THREE.Group(); g.add(boxM(1.2, 1.2, 1.2, M("#b8865a"), 0, 0.6, 0));
    for (const y of [0.1, 1.1]) g.add(boxM(1.24, 0.12, 1.24, M("#8a5a36"), 0, y, 0));
    return { obj: g, parts: {} };
  } },
  { id: "barrel", cat: "object", desc: "wooden barrel", h: 1.3, build: () => {
    const g = new THREE.Group(); g.add(cyl(0.5, 0.45, 1.3, M("#9a6238"), 0, 0.65, 0, 14));
    for (const y of [0.2, 1.1]) g.add(cyl(0.53, 0.53, 0.08, M("#3a3a40"), 0, y, 0, 14));
    return { obj: g, parts: {} };
  } },
  { id: "campfire", cat: "object", desc: "crackling campfire with stones", h: 1.4, build: () => {
    const g = new THREE.Group();
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; g.add(ell(0.22, 0.16, 0.22, M("#8e8b8c"), Math.cos(a) * 0.8, 0.12, Math.sin(a) * 0.8)); }
    for (let k = 0; k < 3; k++) { const l = cyl(0.09, 0.09, 1.2, M("#6b4428"), 0, 0.2, 0, 6); l.rotation.set(1.2, (k * Math.PI) / 1.5, 0); g.add(l); }
    const flames: THREE.Object3D[] = [];
    for (const [s, c] of [[1, [3.2, 1.6, 0.4]], [0.6, [3.4, 2.8, 1.0]]] as const) { const f = mesh(new THREE.ConeGeometry(0.45 * s, 1.3 * s, 8), glow(c as [number, number, number]), 0, 0.65 * s + 0.1, 0); g.add(f); flames.push(f); }
    return { obj: g, parts: { flames } };
  }, animate: (p, s) => (p.parts.flames as THREE.Object3D[]).forEach((f, k) => { f.scale.set(1 + 0.12 * Math.sin(s.t * 17 + k), 1 + 0.25 * Math.sin(s.t * 13 + k * 2), 1); f.rotation.y = s.t * 3; }) },
  { id: "flagpole", cat: "object", desc: "tall flagpole with a waving flag (plain colour)", h: 8, build: () => {
    const g = new THREE.Group(); g.add(cyl(0.08, 0.12, 8, M("#e9e4d8"), 0, 4, 0, 8));
    const fg = new THREE.PlaneGeometry(2.6, 1.6, 12, 4); fg.translate(1.35, 7, 0);
    const flag = mesh(fg, twoTone(new THREE.MeshLambertMaterial({ map: flagTex("#2f6fd0"), side: THREE.DoubleSide }))); g.add(flag);
    flag.userData.p0 = Float32Array.from(fg.attributes.position.array as Float32Array);
    return { obj: g, parts: { flag } };
  }, animate: (p, s) => {
    const f = p.parts.flag as THREE.Mesh, pos = f.geometry.attributes.position as THREE.BufferAttribute, p0 = f.userData.p0 as Float32Array;
    for (let i = 0; i < pos.count; i++) { const u = p0[i * 3] / 2.7; pos.setZ(i, 0.3 * u * Math.sin(u * 5 - s.t * 6)); }
    pos.needsUpdate = true; f.geometry.computeVertexNormals();
  } },
  { id: "lamppost", cat: "object", desc: "old street lamp", h: 4.5, build: () => {
    const g = new THREE.Group(); g.add(cyl(0.08, 0.14, 4, M("#2f3036"), 0, 2, 0, 8));
    g.add(boxM(0.5, 0.6, 0.5, M("#2f3036"), 0, 4.2, 0)); g.add(boxM(0.4, 0.45, 0.4, glow([2.6, 2.3, 1.4]), 0, 4.2, 0));
    return { obj: g, parts: {} };
  } },
  { id: "bench", cat: "object", desc: "park bench", h: 1, len: 2, build: () => {
    const g = new THREE.Group(), w = M("#9a6238"), m = M("#2f3036");
    for (const [y, z, rx] of [[0.45, 0, 0], [0.8, -0.28, 0.25]] as const) { const b = boxM(2, 0.08, 0.55, w, 0, y, z); b.rotation.x = rx; g.add(b); }
    for (const x of [-0.85, 0.85]) g.add(boxM(0.08, 0.45, 0.5, m, x, 0.22, 0));
    return { obj: g, parts: {} };
  } },
  { id: "signpost", cat: "object", desc: "wooden signpost with two blank arrows", h: 2.6, build: () => {
    const g = new THREE.Group(); g.add(cyl(0.08, 0.1, 2.6, M("#7a4a2a"), 0, 1.3, 0, 6));
    for (const [y, s] of [[2.2, 1], [1.7, -1]] as const) g.add(boxM(1.2, 0.3, 0.06, M("#c8a070"), s * 0.5, y, 0));
    return { obj: g, parts: {} };
  } },
  { id: "table", cat: "object", desc: "wooden table", h: 0.9, build: () => {
    const g = new THREE.Group(); g.add(boxM(1.8, 0.08, 1, M("#9a6238"), 0, 0.85, 0));
    for (const [x, z] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]]) g.add(boxM(0.08, 0.85, 0.08, M("#7a4a2a"), x, 0.42, z));
    return { obj: g, parts: {} };
  } },
  { id: "chest", cat: "object", desc: "treasure chest (opens)", h: 1, acts: { open: "the lid opens and gold glows" }, build: () => {
    const g = new THREE.Group(); g.add(boxM(1.2, 0.6, 0.8, M("#8a5a36"), 0, 0.3, 0));
    const gold = boxM(1.05, 0.15, 0.65, glow([2.4, 1.9, 0.6]), 0, 0.55, 0); g.add(gold);
    const lid = new THREE.Group(); lid.position.set(0, 0.6, -0.4); g.add(lid);
    lid.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), M("#8a5a36"), 0, 0, 0.4));
    return { obj: g, parts: { lid } };
  }, animate: (p, s) => { const u = s.since.open; (p.parts.lid as THREE.Object3D).rotation.x = u !== undefined && u > 0 ? -1.6 * Math.min(1, u / 0.5) : 0; } },
  { id: "well", cat: "object", desc: "stone well with a little roof", h: 3, build: () => {
    const g = new THREE.Group(); g.add(cyl(1, 1, 1, M("#a69580"), 0, 0.5, 0, 16));
    for (const x of [-0.9, 0.9]) g.add(boxM(0.12, 2.2, 0.12, M("#7a4a2a"), x, 1.6, 0));
    const r = new THREE.CylinderGeometry(0.01, 1.2, 2.4, 4); r.rotateY(Math.PI / 4); r.rotateZ(Math.PI / 2); r.scale(1, 0.5, 1); g.add(mesh(r, M("#c0503a"), 0, 2.8, 0));
    return { obj: g, parts: {} };
  } },
  { id: "traffic-light", cat: "object", desc: "traffic light that cycles red-amber-green", h: 4.5, build: () => {
    const g = new THREE.Group(); g.add(cyl(0.1, 0.12, 3.4, M("#2f3036"), 0, 1.7, 0, 8)); g.add(boxM(0.5, 1.4, 0.5, M("#2f3036"), 0, 3.9, 0));
    const lights = [[3, 0.3, 0.3], [3, 2.2, 0.4], [0.4, 2.8, 0.8]].map((c, k) => { const m = mesh(new THREE.SphereGeometry(0.16, 10, 8), glow(c as [number, number, number]), 0.26, 4.35 - k * 0.45, 0); g.add(m); m.userData.c = c; return m; });
    return { obj: g, parts: { lights } };
  }, animate: (p, s) => {
    const on = Math.floor(s.t / 2.5) % 3, idx = [2, 1, 0][on];
    (p.parts.lights as THREE.Mesh[]).forEach((m, k) => { const c = m.userData.c as number[]; (m.material as THREE.MeshBasicMaterial).color.setRGB(...(k === idx ? c : c.map((x) => x * 0.12)) as [number, number, number]); });
  } },
  { id: "telescope", cat: "object", desc: "brass telescope on a tripod", h: 1.8, build: () => {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) { const l = cyl(0.03, 0.03, 1.4, M("#5a3b2a"), 0, 0.65, 0, 6); l.rotation.set(0.3 * Math.cos(k * 2.1), 0, 0.3 * Math.sin(k * 2.1)); g.add(l); }
    const tube = mesh(new THREE.CylinderGeometry(0.08, 0.13, 1.4, 12).rotateZ(-Math.PI / 2 + 0.5), M("#c9a04a"), 0.2, 1.5, 0); g.add(tube);
    return { obj: g, parts: {} };
  } },
];
