// Flat cartoon characters as lit cards in the 3D world (cardShade), plus camera-facing effect cards and pools.
import * as THREE from "three";
import { Pen, bodySide, bodyFront, Outfit, Expr } from "./toon";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";
import { blobTex } from "./textures";
import { V3 } from "./geo";
export const SU = 0.00216;
export const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
export class Card {
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
  /** view "side" faces screen-right (mirror flips it), "front" faces the lens; scale 1 = 2.16 m tall card */
  pose(cam: THREE.Camera, p: V3, o: Outfit, expr: Expr, mirror: boolean, seed: number, view: "side" | "front" = "side", scale = 1) {
    const key = JSON.stringify([o, expr, mirror, seed, view]);
    if (key !== this.key) {
      const g = this.cv.getContext("2d")!;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1800); g.setTransform(1.8, 0, 0, 1.8, 0, 0);
      if (mirror) { g.translate(600, 0); g.scale(-1, 1); }
      if (view === "side") bodySide(new Pen(g), o, { mode: "stand", expr, seed, light: -2.4 });
      else bodyFront(new Pen(g), o, { mode: "stand", expr, seed, light: -2.4 });
      this.tex.needsUpdate = true; this.key = key;
    }
    this.mesh.position.set(...p); this.mesh.scale.setScalar(scale);
    this.mesh.rotation.set(0, Math.atan2(cam.position.x - p[0], cam.position.z - p[2]), 0);
    this.blob.position.set(p[0], p[1] + 0.02, p[2]); this.blob.scale.setScalar(scale);
    this.mesh.visible = this.blob.visible = true;
  }
  hide() { this.mesh.visible = this.blob.visible = false; }
}

/** camera-facing effect card (unlit): bursts are cut-outs, smoke is soft */
export class Fx {
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
export class FxPool {
  private list: Fx[] = []; private n = 0;
  constructor(private parent: THREE.Object3D, private soft: boolean) {}
  next() { if (this.n >= this.list.length) this.list.push(new Fx(this.parent, this.soft)); return this.list[this.n++]; }
  reset() { this.n = 0; for (const f of this.list) f.mesh.visible = false; }
}
