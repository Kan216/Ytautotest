// Cartoon animals built from simple shapes (the ink pass outlines them). One generic quadruped (body, four legs on
// hip pivots, neck + head on a pivot, tail) with per-species extras. Gait cycle from the distance moved.
import * as THREE from "three";
import { ctex } from "../core/paint";
import { twoTone } from "../core/shade";
import type { PropDef, PropInst, PropState } from "./index";
import { M, mesh, ell, limb, cyl } from "./shapes";

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
  g.fillStyle = "#f6f4ef"; g.fillRect(0, 0, 512, 256); g.fillStyle = "#1e1c22";
  for (let x = 0; x < 512; x += 34) { g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 14, 128, x - 4, 256); g.lineTo(x + 14, 256); g.quadraticCurveTo(x + 30, 128, x + 16, 0); g.fill(); }
});
const patchTex = () => ctex("cowPatches", 512, 256, (g, r) => {
  g.fillStyle = "#f7f5f0"; g.fillRect(0, 0, 512, 256); g.fillStyle = "#26232a";
  for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(r() * 512, r() * 256, 30 + r() * 40, 20 + r() * 30, r() * 3, 0, 7); g.fill(); }
});

type Q = { L: number; H: number; legL: number; legR: number; neckL: number; neckA: number; headS: number };
const quadruped = (mat: THREE.Material, o: Q, extra?: (p: PropInst) => void): PropInst => {
  const g = new THREE.Group();
  g.add(ell(o.L / 2, o.H / 2, o.H * 0.42, mat, 0, o.legL + o.H * 0.35, 0));
  const legs: THREE.Object3D[] = [];
  for (const [x, z] of [[o.L * 0.33, o.H * 0.25], [o.L * 0.33, -o.H * 0.25], [-o.L * 0.33, o.H * 0.25], [-o.L * 0.33, -o.H * 0.25]]) {
    const l = limb(o.legL + o.H * 0.2, o.legR, o.legR * 0.8, mat); l.position.set(x, o.legL + o.H * 0.2, z); g.add(l); legs.push(l);
  }
  const neck = new THREE.Group(); neck.position.set(o.L * 0.42, o.legL + o.H * 0.55, 0); neck.rotation.z = -o.neckA; g.add(neck);
  neck.add(mesh(new THREE.CylinderGeometry(o.H * 0.16, o.H * 0.26, o.neckL, 12).translate(0, o.neckL / 2, 0), mat));
  const head = new THREE.Group(); head.position.y = o.neckL; head.rotation.z = o.neckA - 0.25; neck.add(head);
  head.add(ell(o.headS * 0.9, o.headS * 0.55, o.headS * 0.5, mat, o.headS * 0.5, 0, 0));
  for (const s of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(o.headS * 0.09, 8, 6), M("#1c1720"), o.headS * 0.55, o.headS * 0.2, s * o.headS * 0.42));
  const tail = limb(o.H * 0.7, o.legR * 0.25, o.legR * 0.15, mat); tail.position.set(-o.L * 0.5, o.legL + o.H * 0.6, 0); tail.rotation.z = -0.5; g.add(tail);
  const p: PropInst = { obj: g, parts: { legs, head, neck, tail }, stride: o.legL };
  extra?.(p);
  return p;
};
/** gait: legs swing with distance when moving, a slow idle shuffle otherwise; body bobs; head nods */
const gait = (p: PropInst, s: PropState, gallop = 0.55) => {
  const ph = s.moving ? s.d / ((p.stride ?? 1) * 1.1) : s.t * 0.6;
  const sw = s.moving ? gallop : 0.04;
  (p.parts.legs as THREE.Object3D[]).forEach((l, k) => { l.rotation.z = sw * Math.sin(ph * Math.PI * 2 + [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5][k]); });
  p.obj.children[0].position.y = (p.obj.children[0].userData.y0 ??= p.obj.children[0].position.y) + (s.moving ? Math.abs(Math.sin(ph * Math.PI * 2)) * 0.1 * (p.stride ?? 1) : 0.01 * Math.sin(s.t * 2));
  (p.parts.head as THREE.Object3D).rotation.x = 0.05 * Math.sin(s.t * 1.3);
  (p.parts.tail as THREE.Object3D).rotation.x = 0.3 * Math.sin(s.t * 2.2);
};
/** 0..1..0 pose curve for a one-shot action lasting `dur` s (fast in, hold, ease out) */
const pose = (u: number | undefined, dur: number) => (u === undefined || u < 0 || u > dur ? 0 : Math.sin(Math.min(1, u / 0.25) * Math.PI / 2) * Math.min(1, (dur - u) / 0.3));

export const ANIMALS: PropDef[] = [
  { id: "elephant", cat: "animal", desc: "grey elephant with big ears, trunk and tusks", h: 4.2, len: 6, move: "run", speed: 5,
    acts: { trumpet: "raises its trunk and trumpets" },
    build: () => { const g = M("#9b9aa3"); return quadruped(g, { L: 4.6, H: 2.8, legL: 1.9, legR: 0.42, neckL: 0.7, neckA: 1.25, headS: 1.25 }, (p) => {
      const head = p.parts.head as THREE.Object3D;
      for (const s of [-1, 1]) { const e = ell(0.12, 1.1, 0.9, g, 0.1, 0.15, s * 0.95); e.rotation.x = s * 0.25; head.add(e); }
      const trunk = new THREE.Group(); trunk.position.set(1.2, -0.2, 0); head.add(trunk); p.parts.trunk = trunk;
      let prev: THREE.Object3D = trunk;
      for (let k = 0; k < 5; k++) { const sg = limb(0.55, 0.26 - k * 0.035, 0.22 - k * 0.035, g); sg.rotation.z = 0.12; if (k) sg.position.y = -0.55; prev.add(sg); prev = sg; }
      for (const s of [-1, 1]) { const tk = mesh(new THREE.ConeGeometry(0.1, 0.9, 8), M("#f6f4ef"), 1.15, -0.55, s * 0.32); tk.rotation.z = -2.2; head.add(tk); }
    }); },
    animate: (p, s) => { gait(p, s, 0.4); (p.parts.trunk as THREE.Object3D).rotation.z = 2.2 * pose(s.since.trumpet, 2) + 0.08 * Math.sin(s.t * 1.1); } },
  { id: "giraffe", cat: "animal", desc: "tall spotted giraffe", h: 6, len: 3, move: "run", speed: 7,
    build: () => quadruped(twoTone(new THREE.MeshLambertMaterial({ map: spotTex() })), { L: 2.4, H: 1.3, legL: 2.6, legR: 0.13, neckL: 3.0, neckA: 0.35, headS: 0.55 }, (p) => {
      for (const s of [-1, 1]) (p.parts.head as THREE.Object3D).add(cyl(0.05, 0.06, 0.35, M("#8a4f22"), 0.2, 0.42, s * 0.12, 6));
    }), animate: (p, s) => gait(p, s, 0.45) },
  { id: "lion", cat: "animal", desc: "lion with a big mane", h: 1.9, len: 2.4, move: "run", speed: 9,
    acts: { roar: "rears its head and roars" },
    build: () => quadruped(M("#d9a55a"), { L: 2.1, H: 0.95, legL: 0.75, legR: 0.13, neckL: 0.35, neckA: 0.9, headS: 0.5 }, (p) => {
      const head = p.parts.head as THREE.Object3D, mane = M("#8a4f22");
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; head.add(ell(0.2, 0.2, 0.2, mane, 0.05, Math.cos(a) * 0.38, Math.sin(a) * 0.38)); }
      head.add(ell(0.15, 0.42, 0.42, mane, -0.05, 0, 0));
    }), animate: (p, s) => { gait(p, s); (p.parts.neck as THREE.Object3D).rotation.z = -0.9 + 0.55 * pose(s.since.roar, 1.6); } },
  { id: "zebra", cat: "animal", desc: "striped zebra", h: 2.2, len: 2.2, move: "run", speed: 8,
    build: () => quadruped(twoTone(new THREE.MeshLambertMaterial({ map: stripeTex() })), { L: 1.9, H: 1.0, legL: 1.0, legR: 0.11, neckL: 0.85, neckA: 0.7, headS: 0.45 }, (p) => {
      (p.parts.neck as THREE.Object3D).add(mesh(new THREE.BoxGeometry(0.08, 0.9, 0.12).translate(0, 0.45, 0), M("#1e1c22"), -0.08, 0, 0));
    }), animate: (p, s) => gait(p, s) },
  { id: "horse", cat: "animal", desc: "brown horse with a dark mane", h: 2.3, len: 2.4, move: "run", speed: 9,
    build: () => quadruped(M("#8a5a36"), { L: 2.0, H: 1.05, legL: 1.1, legR: 0.12, neckL: 0.95, neckA: 0.65, headS: 0.5 }, (p) => {
      (p.parts.neck as THREE.Object3D).add(mesh(new THREE.BoxGeometry(0.1, 1.0, 0.14).translate(0, 0.5, 0), M("#2e2018"), -0.1, 0, 0));
    }), animate: (p, s) => gait(p, s) },
  { id: "cow", cat: "animal", desc: "black-and-white cow", h: 1.9, len: 2.4, move: "run", speed: 4,
    acts: { moo: "lifts its head and moos" },
    build: () => quadruped(twoTone(new THREE.MeshLambertMaterial({ map: patchTex() })), { L: 2.2, H: 1.15, legL: 0.75, legR: 0.14, neckL: 0.4, neckA: 1.0, headS: 0.5 }, (p) => {
      for (const s of [-1, 1]) (p.parts.head as THREE.Object3D).add(mesh(new THREE.ConeGeometry(0.06, 0.3, 6), M("#f1ead8"), 0.15, 0.32, s * 0.25));
    }), animate: (p, s) => { gait(p, s, 0.35); (p.parts.neck as THREE.Object3D).rotation.z = -1.0 + 0.4 * pose(s.since.moo, 1.4); } },
  { id: "dog", cat: "animal", desc: "small friendly dog", h: 0.8, len: 0.9, move: "run", speed: 6,
    acts: { bark: "barks with a head bob" },
    build: () => quadruped(M("#c8874a"), { L: 0.8, H: 0.42, legL: 0.3, legR: 0.06, neckL: 0.2, neckA: 0.8, headS: 0.25 }, (p) => {
      for (const s of [-1, 1]) { const e = ell(0.05, 0.14, 0.08, M("#6a4022"), 0.05, 0.12, s * 0.18); e.rotation.x = s * 0.6; (p.parts.head as THREE.Object3D).add(e); }
    }), animate: (p, s) => { gait(p, s); (p.parts.tail as THREE.Object3D).rotation.x = 0.8 * Math.sin(s.t * 12); (p.parts.neck as THREE.Object3D).rotation.z = -0.8 + 0.3 * Math.abs(Math.sin((s.since.bark ?? -1) * 14)) * pose(s.since.bark, 1.2); } },
  { id: "camel", cat: "animal", desc: "camel with one hump", h: 3.0, len: 2.8, move: "run", speed: 5,
    build: () => quadruped(M("#c9a46a"), { L: 2.4, H: 1.1, legL: 1.5, legR: 0.12, neckL: 1.1, neckA: 0.5, headS: 0.45 }, (p) => {
      p.obj.add(ell(0.55, 0.6, 0.45, M("#c9a46a"), 0, 1.5 + 1.1 * 0.8, 0));
    }), animate: (p, s) => gait(p, s, 0.4) },
  { id: "birds", cat: "animal", desc: "a flock of seven birds flapping across the sky", h: 4, len: 8, move: "fly", speed: 7,
    build: () => {
      const g = new THREE.Group(), wings: THREE.Object3D[] = [], m = M("#2b2830", THREE.DoubleSide);
      for (let i = 0; i < 7; i++) {
        const b = new THREE.Group(); b.position.set(-Math.abs(i - 3) * 1.4, Math.sin(i * 2.1) * 0.8 + 2, (i - 3) * 1.2);
        b.add(ell(0.28, 0.1, 0.1, m));
        for (const s of [-1, 1]) { const w = new THREE.Group(); w.add(mesh(new THREE.PlaneGeometry(0.3, 0.7).translate(0, 0, s * 0.35).rotateX(-Math.PI / 2), m)); b.add(w); wings.push(w); w.userData.s = s; }
        g.add(b);
      }
      return { obj: g, parts: { wings } };
    },
    animate: (p, s) => (p.parts.wings as THREE.Object3D[]).forEach((w, k) => { w.rotation.x = w.userData.s * 0.8 * Math.sin(s.t * 9 + k * 0.7); }) },
];
