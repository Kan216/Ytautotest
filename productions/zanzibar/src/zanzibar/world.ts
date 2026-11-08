// The Zanzibar harbour, 27 August 1896, in the flat-characters-in-a-3D-toon-world style (look modules from the
// bridge short: two-tone shading, ink pass, painted textures, card characters). Built once; update(id, f, cam)
// poses everything for shot `id` at frame f as a pure function of (id, f).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ctex, rep, rng, planksHD, cloudHD, waterNear, waterFar, stoneHD, cobbleHD } from "./paint";
import { Pen, INK, bodySide, fxBurst, Outfit, Expr, SKINS } from "./toon";
import { LIGHTS, LOOK } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";
import {
  FPS, SHOTS, T, GROUND, PALACE, TOWER, POLE, SHIP_Z, SHIPS_X, FLAG_SHIP, DECK, GUN, GUN_BASE, SAILORS, ADMIRAL, PALACE_HITS,
  SUN_SHOT, V3, camAt, clockMin, poleFall, clamp01, smooth,
} from "./story";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------- geometry helpers ----------------
const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, a.itemSize);
};
const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u1 = 1, v1 = 1, u0 = 0, v0 = 0) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2, 3, 4, 5].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  return g;
};
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tile = 0) => {
  const t = (a: number) => (tile ? a / tile : 1), w = x1 - x0, h = y1 - y0, d = z1 - z0;
  return mergeGeometries([
    quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), t(w), t(h)),
    quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), t(w), t(h)),
    quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), t(d), t(h)),
    quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), t(d), t(h)),
    quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), t(w), t(d)),
  ], false);
};
const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) =>
  g.applyMatrix4(new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "YXZ")), V(1, 1, 1)));

/** collects pieces by material, merges into one static mesh per material */
class Batch {
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
const mats = new Map<string, THREE.Material>();
const lam = (key: string, p: () => THREE.MeshLambertMaterialParameters, liftK = 1) => {
  let m = mats.get(key);
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(p()), liftK); mats.set(key, m); }
  return m;
};
const col = (c: string, side: THREE.Side = THREE.FrontSide) => lam("c" + c + side, () => ({ color: c, side }));

// ---------------- painted textures ----------------
const INKL = "rgba(36,23,38,0.9)";
/** one 4 x 4 m wall bay: plaster with soft mottling, an arched window with shutters, sill, floor band */
const bayTex = (key: string, wall: string, shutter: string, opts: { door?: boolean; arch?: boolean; band?: string } = {}) =>
  ctex("bay" + key, 512, 512, (g, r) => {
    g.fillStyle = wall; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) { // plaster mottling
      g.fillStyle = `rgba(${r() < 0.5 ? "120,100,80" : "255,250,240"},${(0.02 + r() * 0.04).toFixed(3)})`;
      g.beginPath(); g.ellipse(r() * 512, r() * 512, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, Math.PI * 2); g.fill();
    }
    if (opts.band) { g.fillStyle = opts.band; g.fillRect(0, 0, 512, 26); g.strokeStyle = INKL; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 26); g.lineTo(512, 26); g.stroke(); }
    const w = opts.door ? 170 : 140, h = opts.door ? 330 : 230, x = 256 - w / 2, y = opts.door ? 512 - h : 150, arch = opts.arch !== false;
    const path = () => {
      g.beginPath(); g.moveTo(x, y + h);
      if (arch) { g.lineTo(x, y + w / 2); g.arc(256, y + w / 2, w / 2, Math.PI, 0); } else { g.lineTo(x, y); g.lineTo(x + w, y); }
      g.lineTo(x + w, y + h); g.closePath();
    };
    path(); g.fillStyle = "#2c3a46"; g.fill();
    if (!opts.door) { // open shutters either side
      for (const s of [-1, 1]) {
        const sx = s < 0 ? x - 62 : x + w + 6;
        g.fillStyle = shutter; g.fillRect(sx, y + 30, 56, h - 30);
        g.strokeStyle = INKL; g.lineWidth = 5; g.strokeRect(sx, y + 30, 56, h - 30);
        g.lineWidth = 2.5; for (let k = 1; k < 7; k++) { g.beginPath(); g.moveTo(sx + 6, y + 30 + k * (h - 30) / 7); g.lineTo(sx + 50, y + 30 + k * (h - 30) / 7); g.stroke(); }
      }
      g.fillStyle = "#e9e1cf"; g.fillRect(x - 12, y + h, w + 24, 16); g.strokeStyle = INKL; g.lineWidth = 4; g.strokeRect(x - 12, y + h, w + 24, 16);
    } else {
      g.fillStyle = "#7a4a2a"; g.fillRect(x + 8, y + w / 2, w - 16, h - w / 2);
      g.strokeStyle = INKL; g.lineWidth = 4; g.beginPath(); g.moveTo(256, y + w / 2); g.lineTo(256, 512); g.stroke();
    }
    path(); g.strokeStyle = INKL; g.lineWidth = 7; g.stroke();
  });
const clockTex = () => ctex("clockFace", 512, 512, (g) => {
  g.fillStyle = "#c9b48a"; g.beginPath(); g.arc(256, 256, 250, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#f7f2e4"; g.beginPath(); g.arc(256, 256, 214, 0, Math.PI * 2); g.fill();
  g.strokeStyle = INK; g.lineWidth = 16; g.beginPath(); g.arc(256, 256, 216, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 248, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, big = i % 15 === 0, mid = i % 5 === 0, r0 = big ? 160 : mid ? 176 : 192;
    g.lineWidth = big ? 16 : mid ? 9 : 4; g.lineCap = "round";
    g.beginPath(); g.moveTo(256 + Math.sin(a) * r0, 256 - Math.cos(a) * r0); g.lineTo(256 + Math.sin(a) * 200, 256 - Math.cos(a) * 200); g.stroke();
  }
});
const flagTex = () => ctex("redFlag", 256, 160, (g) => {
  g.fillStyle = "#cf2f2c"; g.fillRect(0, 0, 256, 160);
  for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(90,0,10,${0.05 + 0.03 * (i % 2)})`; g.fillRect(i * 44, 0, 22, 160); }
});
const smokeTex = (i: number, dark: boolean) => ctex(`smoke${i}${dark}`, 256, 256, (g, r) => {
  const p = new Pen(g), base = dark ? ["#6f6b74", "#86828c", "#5e5a63"] : ["#f4f2ee", "#e2dfdc", "#d2cfd2"];
  const blobs: [number, number, number][] = [];
  for (let k = 0; k < 7; k++) blobs.push([128 + (r() - 0.5) * 120, 140 + (r() - 0.5) * 90, 34 + r() * 30]);
  for (const [x, y, rr] of blobs) p.ell(x, y + 6, rr, rr * 0.85, base[2], 0);
  for (const [x, y, rr] of blobs) p.ell(x - 4, y, rr * 0.92, rr * 0.8, base[1], 0);
  for (const [x, y, rr] of blobs.slice(0, 4)) p.ell(x - 10, y - 8, rr * 0.6, rr * 0.5, base[0], 0);
});
const burstTex = (k: number, colr: string) => ctex(`burst${colr}${k}`, 500, 500, (g) => fxBurst(new Pen(g), k / 7, colr, 11, 50, 235));
const blobTex = () => ctex("contactBlob", 128, 128, (g) => {
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "#5b5f80"); gr.addColorStop(0.45, "#7d80a0"); gr.addColorStop(0.8, "#e6e6f0"); gr.addColorStop(1, "#ffffff");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});

// ---------------- characters ----------------
const SAILOR = (v: number): Outfit => ({ jacket: "#26385f", pants: "#f2efe6", boots: INK, hat: "cap", cap: "#f4f1ea", belt: null, buttons: "#e8e4da", skin: SKINS[v % 4], moustache: v === 1 ? "#4a3426" : undefined });
const ADMIRAL_O: Outfit = { jacket: "#1c2640", pants: "#1c2640", boots: INK, hat: "cap", cap: "#1c2640", buttons: "#e8c45a", moustache: "#ece6da", sword: true, build: "stout", skin: SKINS[0] };
const SU = 0.00216;
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
class Card {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; cv: HTMLCanvasElement; tex: THREE.CanvasTexture; key = ""; blob: THREE.Mesh;
  constructor(parent: THREE.Object3D) {
    this.cv = document.createElement("canvas"); this.cv.width = 1080; this.cv.height = 1800;
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 8;
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: this.tex, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mesh = new THREE.Mesh(BODY, this.mat);
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.receiveShadow = true; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK); this.mesh.visible = false;
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), blobMaterial(blobTex()));
    this.blob.rotation.x = -Math.PI / 2; this.blob.layers.set(NOINK); this.blob.visible = false; this.blob.renderOrder = 0.5;
    parent.add(this.mesh, this.blob);
  }
  pose(cam: THREE.Camera, p: V3, o: Outfit, expr: Expr, mirror: boolean, seed: number) {
    const key = JSON.stringify([o.jacket, o.skin, expr, mirror, seed]);
    if (key !== this.key) {
      const g = this.cv.getContext("2d")!;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1800); g.setTransform(1.8, 0, 0, 1.8, 0, 0);
      if (mirror) { g.translate(600, 0); g.scale(-1, 1); }
      bodySide(new Pen(g), o, { mode: "stand", expr, seed, light: -2.4 });
      this.tex.needsUpdate = true; this.key = key;
    }
    this.mesh.position.set(...p);
    this.mesh.rotation.set(0, Math.atan2(cam.position.x - p[0], cam.position.z - p[2]), 0);
    this.blob.position.set(p[0], p[1] + 0.02, p[2]);
    this.mesh.visible = this.blob.visible = true;
  }
  hide() { this.mesh.visible = this.blob.visible = false; }
}

/** camera-facing effect card (unlit): bursts are cut-outs, smoke is soft */
class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial;
  constructor(parent: THREE.Object3D, soft: boolean) {
    this.mat = soft ? new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: true })
      : new THREE.MeshBasicMaterial({ alphaTest: 0.5, fog: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.mat);
    this.mesh.layers.set(NOINK); this.mesh.visible = false; this.mesh.renderOrder = soft ? 3 : 2;
    parent.add(this.mesh);
  }
  show(cam: THREE.Camera, map: THREE.Texture, p: V3, w: number, h: number, opacity = 1, tint?: THREE.Color, spin = 0) {
    this.mat.map = map; this.mat.opacity = opacity;
    if (tint) this.mat.color.copy(tint); else this.mat.color.setRGB(1, 1, 1);
    this.mesh.position.set(...p); this.mesh.quaternion.copy(cam.quaternion); this.mesh.rotateZ(spin);
    this.mesh.scale.set(w, h, 1); this.mesh.visible = true;
  }
}
class FxPool {
  private list: Fx[] = []; private n = 0;
  constructor(private parent: THREE.Object3D, private soft: boolean) {}
  next() { if (this.n >= this.list.length) this.list.push(new Fx(this.parent, this.soft)); return this.list[this.n++]; }
  reset() { this.n = 0; for (const f of this.list) f.mesh.visible = false; }
}

// ---------------- water ----------------
const SHORE_Z = 2.9; // where the beach slope meets the sea
const waterMat = () => new THREE.ShaderMaterial({
  uniforms: {
    cNear: { value: new THREE.Color() }, cMid: { value: new THREE.Color() }, cFar: { value: new THREE.Color() }, cShallow: { value: new THREE.Color() },
    cCrest: { value: new THREE.Color() }, cTrough: { value: new THREE.Color() }, cGlint: { value: new THREE.Color() }, cFog: { value: new THREE.Color() },
    mNear: { value: waterNear() }, mFar: { value: waterFar() }, time: { value: 0 }, camPos: { value: new THREE.Vector3() },
    fogNear: { value: 200 }, fogFar: { value: 900 },
  },
  vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
  fragmentShader: /* glsl */ `
    uniform vec3 cNear, cMid, cFar, cShallow, cCrest, cTrough, cGlint, cFog; uniform sampler2D mNear, mFar;
    uniform float time, fogNear, fogFar; uniform vec3 camPos; varying vec3 vW;
    void main(){
      float d = length(vW.xz - camPos.xz);
      vec3 c = mix(cNear, cMid, smoothstep(15.0, 140.0, d));
      c = mix(c, cFar, smoothstep(140.0, 700.0, d));
      float sh = smoothstep(${(SHORE_Z + 34).toFixed(1)}, ${(SHORE_Z + 2).toFixed(1)}, vW.z);
      c = mix(c, cShallow, sh * 0.9);
      vec4 m = texture2D(mNear, vW.xz / 14.0 + vec2(time * 0.018, time * 0.009));
      vec4 mf = texture2D(mFar, vW.xz / 42.0 + vec2(time * 0.006, -time * 0.004));
      float k = 1.0 - smoothstep(35.0, 110.0, d);
      float crest = mix(mf.r, m.r, k), trough = mix(mf.g, m.g, k), glint = mix(mf.b, m.b, k);
      c = mix(c, cTrough, trough * 0.3);
      c = mix(c, cCrest, crest * mix(0.6, 0.22, k));
      c = mix(c, cGlint, glint * mix(0.55, 0.25, k));
      float foam = smoothstep(${(SHORE_Z + 3.2).toFixed(1)}, ${SHORE_Z.toFixed(1)}, vW.z) * (0.55 + 0.45 * sin(vW.x * 0.7 + time * 1.3));
      c = mix(c, cCrest, clamp(foam, 0.0, 1.0) * 0.8);
      c = mix(c, cFog, smoothstep(fogNear, fogFar, d));
      gl_FragColor = vec4(c, 1.0);
    }`,
});
const WATER = { near: "#1fa5bd", mid: "#1680b4", far: "#2d6aa8", shallow: "#36d0c8", crest: "#b9f2ef", trough: "#0f5a8a", glint: "#ffffff" };

// ---------------- builders ----------------
type Building = { x0: number; x1: number; z0: number; z1: number; h: number };
const building = (b: Batch, B: Building, wall: THREE.Material, plain: THREE.Material, roof: THREE.Material, bayW = 4, bayH = 4) => {
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
const palm = (b: Batch, x: number, z: number, h: number, seed: number, trunk: THREE.Material, leaf: THREE.Material[]) => {
  const r = rng(seed), lean = (r() - 0.5) * 0.5, dir = r() * Math.PI * 2, y0 = GROUND - 0.3 - (z > -6 ? (z + 6) / 9 : 0);
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
type ShipKind = { L: number; B: number; hull: string; band: string; funnels: number[]; masts: number[]; big: boolean };
const WARSHIP: ShipKind = { L: 64, B: 11, hull: "#2a2b33", band: "#f1eee6", funnels: [-9, -2], masts: [-20, 3], big: true };
const YACHT: ShipKind = { L: 38, B: 6.5, hull: "#f3f0e8", band: "#c9a55c", funnels: [-2], masts: [-10, 7], big: false };
const hullShape = (L: number, B: number, s = 1) => {
  const sh = new THREE.Shape(), h = (B / 2) * s;
  sh.moveTo(-L / 2, -h * 0.82); sh.quadraticCurveTo(-L / 2 - 2, 0, -L / 2, h * 0.82);
  sh.lineTo(L * 0.22, h); sh.quadraticCurveTo(L * 0.42, h * 0.9, L / 2, 0); sh.quadraticCurveTo(L * 0.42, -h * 0.9, L * 0.22, -h); sh.closePath();
  return sh;
};
const extrude = (sh: THREE.Shape, y0: number, y1: number) => {
  const g = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 10 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0); return g;
};
/** a ship along +x at (x, z); returns muzzle points of its port (shore-side, -z) battery */
const ship = (b: Batch, k: ShipKind, x: number, z: number, M: Record<string, THREE.Material>) => {
  const g = (geo: THREE.BufferGeometry, m: THREE.Material) => b.add(geo.translate(x, 0, z), m);
  const top = k.big ? DECK : 3.4, bandH = k.big ? 1.1 : 0.6;
  g(extrude(hullShape(k.L, k.B), -1.2, top - bandH), col(k.hull));
  g(extrude(hullShape(k.L, k.B), top - bandH, top), col(k.band));
  const deck = new THREE.ShapeGeometry(hullShape(k.L, k.B, 0.985), 10); deck.rotateX(-Math.PI / 2); deck.translate(0, top + 0.01, 0);
  g(deck, M.deck);
  // rail posts + top rail around the deck edge (white)
  const pts = hullShape(k.L, k.B, 0.97).getSpacedPoints(70);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], c = pts[i + 1], mx = (a.x + c.x) / 2, mz = -(a.y + c.y) / 2, len = Math.hypot(c.x - a.x, c.y - a.y), ang = Math.atan2(-(c.y - a.y), c.x - a.x);
    g(at(new THREE.BoxGeometry(len, 0.09, 0.09), mx, top + 1.0, mz, -ang), col("#f3f0e8"));
    if (i % 2 === 0) g(at(new THREE.BoxGeometry(0.07, 1.0, 0.07), a.x, top + 0.5, -a.y), col("#f3f0e8"));
  }
  // superstructure, bridge, funnels, masts
  const s = k.big ? 1 : 0.6;
  g(box(-16 * s, top, -2.2 * s, 6 * s, top + 2.8 * s, 2.2 * s), col("#f1eee6"));
  g(box(1 * s, top + 2.8 * s, -3.2 * s, 7 * s, top + 4.6 * s, 3.2 * s), col("#f1eee6"));
  g(box(1.4 * s, top + 3.4 * s, -3.21 * s, 6.6 * s, top + 4.0 * s, 3.21 * s), col("#33404c"));
  for (const fx of k.funnels) {
    g(at(new THREE.CylinderGeometry(1.25 * s, 1.35 * s, 7.5 * s, 16), fx * s, top + 2.8 * s + 3.75 * s, 0), col("#d6ad5e"));
    g(at(new THREE.CylinderGeometry(1.3 * s, 1.3 * s, 1.1 * s, 16), fx * s, top + 2.8 * s + 7.5 * s + 0.5 * s, 0), col("#25262c"));
  }
  for (const mx of k.masts) {
    g(at(new THREE.CylinderGeometry(0.16, 0.26, 22 * s, 8), mx * s, top + 11 * s, 0), col("#8a6a4a"));
    g(at(new THREE.BoxGeometry(0.18, 0.18, 9 * s), mx * s, top + 16 * s, 0), col("#8a6a4a"));
  }
  const muzzles: V3[] = [];
  if (k.big) {
    for (const tx of [-24, 24]) { // fore and aft gun turrets
      g(at(new THREE.CylinderGeometry(2.4, 2.6, 1.8, 18), tx, top + 0.9, 0), col("#9aa1a9"));
      g(at(new THREE.CylinderGeometry(0.28, 0.32, 5, 10), tx + Math.sign(tx) * 2.6, top + 1.2, 0, 0, 0, Math.PI / 2), col("#4a4f58"));
    }
    for (let gx = -15; gx <= 9; gx += 6) { // port broadside guns, pointing at the shore (-z)
      g(box(gx - 1, 2.4, -k.B / 2 - 0.4, gx + 1, 3.8, -k.B / 2 + 0.6), col("#f1eee6"));
      g(at(new THREE.CylinderGeometry(0.2, 0.24, 2.6, 10), gx, 3.1, -k.B / 2 - 1.5, 0, Math.PI / 2), col("#3c4048"));
      muzzles.push([x + gx, 3.1, z - k.B / 2 - 2.9]);
    }
  }
  return muzzles;
};

// ---------------- world ----------------
export class World {
  root = new THREE.Group();
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private fog = new THREE.Fog("#b8d0ec", 200, 900);
  private clouds: THREE.Mesh[] = [];
  private water: THREE.Mesh; private wmat: THREE.ShaderMaterial;
  private minute: THREE.Mesh; private hour: THREE.Mesh;
  private poleTop = new THREE.Group(); private flag: THREE.Mesh; private flagPos: Float32Array;
  private muzzles: V3[][] = [];
  private cards: Card[]; private fx: FxPool; private soft: FxPool;
  private bursts: { gold: THREE.Texture[]; fire: THREE.Texture[] };
  private smokes: { light: THREE.Texture[]; dark: THREE.Texture[] };
  private gunBarrel: THREE.Group;

  constructor() {
    const R = this.root, b = new Batch();
    // ---- sky, light, clouds ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el)); c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el)); c = mix(c, c4, smoothstep(e.z, e.w, el)); gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1300, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK); R.add(this.sky);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.0);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
    const cmaps = [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.2, d = 700 + (i % 3) * 80, w = 150 + (i % 4) * 40;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cmaps[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      m.position.set(Math.cos(a) * d, 110 + (i % 4) * 40, Math.sin(a) * d); m.scale.set(w, w / 2, 1); m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }
    // ---- sea, beach, town ground ----
    this.wmat = waterMat();
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), this.wmat);
    this.water.receiveShadow = false; R.add(this.water);
    const sand = lam("sand", () => ({ map: rep(stoneHD("sandHD", ["#ecd9a8", "#e6d19c", "#f0dfb2", "#e2cb94"], "#e0c890"), 1, 1) }));
    const plaza = lam("plaza", () => ({ map: cobbleHD() }));
    b.add(quad(V(-700, -1.0, 12), V(700, -1.0, 12), V(700, GROUND - 0.6, -6), V(-700, GROUND - 0.6, -6), 140, 4), sand);
    b.add(quad(V(-700, GROUND, -5.9), V(700, GROUND, -5.9), V(700, GROUND, -700), V(-700, GROUND, -700), 140, 140), sand);
    b.add(quad(V(-46, GROUND + 0.02, -6), V(36, GROUND + 0.02, -6), V(36, GROUND + 0.02, -14), V(-46, GROUND + 0.02, -14), 16, 1.6), plaza);
    b.add(box(-700, GROUND - 0.7, -6.4, 700, GROUND + 0.05, -5.9), col("#cdbb93")); // low quay edge
    // ---- palace ----
    const pw = lam("palaceBay", () => ({ map: bayTex("palace", "#f4ecdb", "#2f6f73", { band: "#e3d6bb" }) }));
    const pPlain = col("#f4ecdb"), pRoof = col("#d8cab0");
    building(b, { x0: PALACE.x0, x1: PALACE.x1, z0: PALACE.z0, z1: PALACE.z1, h: PALACE.h - GROUND }, pw, pPlain, pRoof, 4, 4);
    const front = PALACE.z1, wood = col("#8e5b36"), white = col("#f6f1e6");
    for (const [y0, y1, yd] of [[GROUND, 8.6, 8.6], [9.0, 13, 13]] as const) { // two storeys of verandas on columns
      for (let x = PALACE.x0 + 1; x <= PALACE.x1 - 0.9; x += 3.5) b.add(box(x - 0.28, y0, front + 2.7, x + 0.28, y1, front + 3.26), white);
      b.add(box(PALACE.x0 - 0.3, yd, front, PALACE.x1 + 0.3, yd + 0.42, front + 3.5), white);
      b.add(box(PALACE.x0, yd + 0.42, front + 3.25, PALACE.x1, yd + 1.3, front + 3.42), wood);
    }
    b.add(box(PALACE.x0 - 0.5, PALACE.h, front - 0.2, PALACE.x1 + 0.5, PALACE.h + 0.45, front + 3.8), pPlain);
    // ---- clock tower ----
    const tw = lam("towerWall", () => ({ map: stoneHD("towerHD", ["#efe4cf", "#e8dcc4", "#f3eadb", "#e2d5bb"], "#cdbd9f") }));
    const { x: tx, z: tz, w: tW, h: tH } = TOWER, th = tW / 2;
    b.add(box(tx - th, GROUND - 0.5, tz - th, tx + th, tH, tz + th, 3), tw);
    for (const yb of [12, 21, 27.5]) b.add(box(tx - th - 0.3, yb, tz - th - 0.3, tx + th + 0.3, yb + 0.6, tz + th + 0.3), pPlain);
    const cap = new THREE.ConeGeometry(th * 1.45, 5.5, 4); cap.rotateY(Math.PI / 4);
    b.add(at(cap, tx, tH + 2.75, tz), col("#b8553a"));
    b.add(at(new THREE.CylinderGeometry(0.08, 0.12, 3, 6), tx, tH + 6.8, tz), col("#3a3a40"));
    const face = new THREE.Mesh(new THREE.CircleGeometry(TOWER.clockR, 48), new THREE.MeshLambertMaterial({ map: clockTex() }));
    twoTone(face.material as THREE.MeshLambertMaterial);
    face.position.set(tx, TOWER.clockY, tz + th + 0.04); face.receiveShadow = true; R.add(face);
    const hand = (len: number, w: number) => {
      const g = new THREE.BoxGeometry(w, len, 0.08); g.translate(0, len / 2 - 0.25, 0);
      const m = new THREE.Mesh(g, col("#1c1720")); m.position.set(tx, TOWER.clockY, tz + th + 0.12); m.castShadow = true; R.add(m); return m;
    };
    this.hour = hand(TOWER.clockR * 0.55, 0.22); this.minute = hand(TOWER.clockR * 0.82, 0.14);
    // ---- flag pole (lower part static, upper part + flag can fall) ----
    b.add(at(new THREE.CylinderGeometry(0.12, 0.16, POLE.brk, 8), POLE.x, POLE.base + POLE.brk / 2, POLE.z), col("#e9e4d8"));
    this.poleTop.position.set(POLE.x, POLE.base + POLE.brk, POLE.z);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, POLE.h - POLE.brk, 8).translate(0, (POLE.h - POLE.brk) / 2, 0), col("#e9e4d8"));
    upper.castShadow = true; this.poleTop.add(upper);
    const fg = new THREE.PlaneGeometry(5.2, 3.3, 16, 6); fg.translate(2.6 + 0.12, POLE.h - POLE.brk - 1.75, 0);
    this.flag = new THREE.Mesh(fg, twoTone(new THREE.MeshLambertMaterial({ map: flagTex(), side: THREE.DoubleSide })));
    this.flag.castShadow = true; this.flagPos = Float32Array.from(fg.attributes.position.array as Float32Array);
    this.poleTop.add(this.flag); R.add(this.poleTop);
    // ---- town ----
    const WALLS = [["#f3ead8", "#2f6f73"], ["#efdfc0", "#7a4a2a"], ["#e8d2ac", "#3d5f8a"], ["#f6f1e6", "#4f7d4a"], ["#ead8c4", "#2f6f73"]];
    const wallM = WALLS.map(([w, s], i) => lam("bay" + i, () => ({ map: bayTex("h" + i, w, s) })));
    const plainM = WALLS.map(([w]) => col(w)), roofM = col("#d9cbb0");
    const r = rng(7), houses: Building[] = [];
    const free = (B: Building) => houses.every((h) => B.x1 + 2 < h.x0 || B.x0 - 2 > h.x1 || B.z1 + 2 < h.z0 || B.z0 - 2 > h.z1)
      && (B.x1 < PALACE.x0 - 2 || B.x0 > PALACE.x1 + 2 || B.z1 < PALACE.z0 - 3 || B.z0 > PALACE.z1 + 4)
      && (B.x1 < TOWER.x - 6 || B.x0 > TOWER.x + 6 || B.z1 < TOWER.z - 6 || B.z0 > TOWER.z + 6);
    for (let i = 0; i < 900 && houses.length < 150; i++) {
      const w = 7 + r() * 9, d = 7 + r() * 7, x = -320 + r() * 640, z = -14 - r() * 170;
      const nearShore = z > -30 ? 1 : 0, h = 5 + r() * (8 + 4 * (1 - nearShore));
      const B = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h };
      if (B.z1 > -9) continue;
      if (free(B)) houses.push(B);
    }
    houses.forEach((B, i) => building(b, B, wallM[i % 5], plainM[i % 5], roofM));
    // ---- palms ----
    const trunk = col("#8a6a4a"), leafs = ["#4f9a3c", "#5aa843", "#43893a"].map((c) => col(c, THREE.DoubleSide));
    const rp = rng(11);
    for (let i = 0; i < 80; i++) {
      const x = -300 + rp() * 600, z = -10 + rp() * 9;
      if (x > PALACE.x0 - 3 && x < PALACE.x1 + 3 && z > -12) continue;
      palm(b, x, z, 9 + rp() * 6, i + 1, trunk, leafs);
    }
    for (const [x, z] of [[-40, -30], [30, -40], [-60, -18], [44, -16], [-14, -42], [58, -60], [-80, -50]]) palm(b, x, z, 11 + rp() * 4, x * 7 + z, trunk, leafs);
    // ---- ships ----
    const M = { deck: lam("deck", () => ({ map: rep(planksHD(), 0.18, 0.18) })) };
    SHIPS_X.forEach((x) => this.muzzles.push(ship(b, WARSHIP, x, SHIP_Z, M)));
    ship(b, YACHT, 46, 40, M);
    // flagship bow deck gun: mount + shield (static), barrel group recoils
    const gb = GUN_BASE;
    b.add(at(new THREE.CylinderGeometry(0.9, 1.05, 0.7, 14), gb[0], DECK + 0.35, gb[2]), col("#7d838c"));
    this.gunBarrel = new THREE.Group(); this.gunBarrel.position.set(gb[0], DECK + 1.3, gb[2]);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 4.0, 12).rotateX(Math.PI / 2).translate(0, 0, 1.7), col("#3c4048"));
    const breech = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.9), col("#5d636c")); breech.castShadow = true;
    this.gunBarrel.add(breech);
    barrel.castShadow = true; this.gunBarrel.add(barrel);
    this.gunBarrel.lookAt(GUN[0], GUN[1], GUN[2]);
    R.add(this.gunBarrel);
    b.build(R);
    // ---- cards, effects ----
    this.cards = [new Card(R), new Card(R), new Card(R)];
    this.fx = new FxPool(R, false); this.soft = new FxPool(R, true);
    this.bursts = { gold: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => burstTex(k, "#fff2a6")), fire: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => burstTex(k, "#ffb347")) };
    this.smokes = { light: [0, 1, 2, 3].map((i) => smokeTex(i, false)), dark: [0, 1, 2, 3].map((i) => smokeTex(i, true)) };
  }

  private sunDir(id: number) {
    const s = SHOTS[id - 1], c = camAt(id, s.a), o = SUN_SHOT[id];
    const fw = V(c.look[0] - c.pos[0], 0, c.look[2] - c.pos[2]).normalize(), rt = fw.clone().cross(V(0, 1, 0)).normalize();
    const az = THREE.MathUtils.degToRad(o.az), el = THREE.MathUtils.degToRad(o.el);
    return fw.multiplyScalar(Math.cos(az)).addScaledVector(rt, Math.sin(az)).normalize().multiplyScalar(Math.cos(el)).add(V(0, Math.sin(el), 0)).normalize();
  }

  /** gun / broadside smoke: expands, drifts with the wind, fades */
  private puff(cam: THREE.Camera, t: number, t0: number, p: V3, size: number, dir: V3, k: number, dark = false) {
    const u = (t - t0) / 3.2;
    if (u < 0 || u > 1) return;
    const e = 1 - (1 - u) ** 2, s = size * (0.45 + 1.4 * e);
    this.soft.next().show(cam, (dark ? this.smokes.dark : this.smokes.light)[k % 4], [p[0] + dir[0] * e * 4 + u * 3, p[1] + dir[1] * e * 4 + u * 2.5, p[2] + dir[2] * e * 4], s, s, 0.95 * (1 - u) ** 1.3);
  }
  private burst(cam: THREE.Camera, t: number, t0: number, p: V3, size: number, fire = false) {
    const n = Math.floor((t - t0) * FPS);
    if (n < 0 || n > 7) return;
    this.fx.next().show(cam, (fire ? this.bursts.fire : this.bursts.gold)[n], p, size, size, 1, new THREE.Color(fire ? 2.4 : 3.2, fire ? 1.7 : 3.0, fire ? 1.0 : 2.2), n * 0.05);
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, L = LIGHTS.day, K = LOOK.day;
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 2600; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    // ---- light rig: camera-relative sun frozen per shot, two-tone uniforms ----
    const sd = this.sunDir(id);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 0.9 + 10, 14, 90);
    this.sun.position.copy(focus).addScaledVector(sd, 300); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 50; sc.far = 600; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, clouds, sea ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((d) => THREE.MathUtils.degToRad(d)); su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = 260; this.fog.far = 1500;
    scene.fog = this.fog; scene.background = null;
    for (const m of this.clouds) m.lookAt(cam.position.x, m.position.y, cam.position.z);
    const wu = this.wmat.uniforms;
    untone(WATER.near, wu.cNear.value); untone(WATER.mid, wu.cMid.value); untone(WATER.far, wu.cFar.value); untone(WATER.shallow, wu.cShallow.value);
    untone(WATER.crest, wu.cCrest.value); untone(WATER.trough, wu.cTrough.value); untone(WATER.glint, wu.cGlint.value); untone(L.fog, wu.cFog.value);
    wu.time.value = t; wu.camPos.value.copy(cam.position); wu.fogNear.value = 300; wu.fogFar.value = 1400;
    // ---- clock ----
    const m = clockMin(t);
    this.minute.rotation.z = -(m / 60) * Math.PI * 2;
    this.hour.rotation.z = -((9 + m / 60) / 12) * Math.PI * 2;
    // ---- flag: waves, then falls with its broken pole top ----
    const pf = poleFall(t), pos = this.flag.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x0 = this.flagPos[i * 3], y0 = this.flagPos[i * 3 + 1], u = (x0 - 0.12) / 5.2, amp = 0.55 * u * (1 - 0.6 * pf);
      pos.setXYZ(i, x0 - 0.15 * u * u, y0 - 0.25 * u * u * (1 + pf), amp * Math.sin(u * 5.2 - t * 6.5) + 0.2 * u * Math.sin(y0 * 1.3 - t * 4.1));
    }
    pos.needsUpdate = true; this.flag.geometry.computeVertexNormals();
    this.poleTop.rotation.set(0, 0.35, -pf * 1.75);
    this.poleTop.position.set(POLE.x + pf * 0.6, POLE.base + POLE.brk - pf * pf * 2.2, POLE.z);
    this.poleTop.visible = pf < 1 || t < T.hit + 2;
    // ---- deck gun recoil ----
    const rc = t >= T.fire ? Math.exp(-(t - T.fire) * 7) * Math.min(1, (t - T.fire) * 60) : 0;
    this.gunBarrel.position.set(GUN_BASE[0] + (GUN_BASE[0] - GUN[0]) * 0.12 * rc, DECK + 1.3, GUN_BASE[2] + (GUN_BASE[2] - GUN[2]) * 0.12 * rc);
    // ---- characters ----
    for (const cd of this.cards) cd.hide();
    const LEAD = 2 / FPS;
    if (id === 4) {
      const after = t >= T.fire - LEAD;
      this.cards[0].pose(cam, SAILORS[0], SAILOR(0), after ? "grin" : "stern", false, 3);
      this.cards[1].pose(cam, SAILORS[1], SAILOR(1), after ? "shock" : "stern", true, 5);
    }
    if (id === 6) this.cards[2].pose(cam, ADMIRAL, ADMIRAL_O, t >= T.ever - LEAD ? "smile" : "neutral", false, 2);
    // ---- effects ----
    this.fx.reset(); this.soft.reset();
    if (id === 2 || id === 4 || id === 6) { // funnel smoke drifting off every ship
      SHIPS_X.forEach((x, i) => {
        for (const [k, fx] of WARSHIP.funnels.entries()) for (let j = 0; j < 4; j++) {
          const u = ((t * 0.22 + j / 4 + i * 0.13 + k * 0.37) % 1);
          const s = 2.4 + u * 7;
          this.soft.next().show(cam, this.smokes.dark[(i + j) % 4], [x + fx - u * 16, DECK + 13.5 + u * 9, SHIP_Z + u * 3], s, s, 0.55 * (1 - u) ** 1.4);
        }
      });
    }
    if (id === 4 || id === 6 || id === 5) {
      this.burst(cam, t, T.fire, GUN, 3.2);
      this.puff(cam, t, T.fire, GUN, 3.5, [0, 0.2, -1], 0);
      this.puff(cam, t, T.fire + 0.05, [GUN[0], GUN[1] + 0.4, GUN[2] - 1.5], 4.2, [0.3, 0.3, -1], 1);
      this.muzzles.forEach((ms, si) => ms.forEach((p, k) => {
        const t0 = T.ripple + 0.08 * k + 0.15 * Math.abs(si - FLAG_SHIP) + (si === FLAG_SHIP ? -0.1 : 0.2);
        this.burst(cam, t, t0, p, 4.5);
        this.puff(cam, t, t0, p, 6, [0, 0.15, -1], k + si);
      }));
    }
    if (t >= T.hit - 0.2) { // palace hits: fire bursts, then rising smoke columns
      PALACE_HITS.forEach((p, i) => {
        const t0 = T.hit + [0, 0.12, 0.3, 0.45][i];
        this.burst(cam, t, t0, p, 10, true);
        this.puff(cam, t, t0 + 0.05, p, 9, [0, 0.4, 0.3], i, true);
        if (t > t0) for (let j = 0; j < 6; j++) {
          const u = ((t - t0) * 0.16 + j / 6) % 1, age = t - t0, s = (3 + u * 12) * Math.min(1, age * 1.4);
          this.soft.next().show(cam, this.smokes.dark[(i + j) % 4], [p[0] + u * 9, p[1] + 1 + u * 20, p[2] - 2 - u * 2], s, s, 0.8 * (1 - u) ** 1.2 * Math.min(1, age * 2));
        }
      });
    }
    return focus;
  }
}
