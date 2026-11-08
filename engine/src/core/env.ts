// Shared environment for every kit: graded sky dome, camera-relative sun with fitted shadows, two-tone light
// uniforms, painted clouds, fog, optional sea. Kits only build their own ground and props.
import * as THREE from "three";
import { cloudHD } from "./paint";
import { LIGHTS, LOOK } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { waterMat, WATER, WaterPal } from "./water";
import { Light } from "./types";

export class Env {
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private fog = new THREE.Fog("#b8d0ec", 260, 1500);
  private clouds: THREE.Mesh[] = [];
  private water?: THREE.Mesh; private wmat?: THREE.ShaderMaterial; private pal: WaterPal;

  constructor(root: THREE.Object3D, water?: { shoreZ: number | null; pal?: WaterPal }) {
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
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK); root.add(this.sky);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.0);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    root.add(this.hemi, this.sun, this.sun.target);
    const cmaps = [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.2, d = 700 + (i % 3) * 80, w = 150 + (i % 4) * 40;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cmaps[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      m.position.set(Math.cos(a) * d, 110 + (i % 4) * 40, Math.sin(a) * d); m.scale.set(w, w / 2, 1); m.layers.set(NOINK);
      this.clouds.push(m); root.add(m);
    }
    this.pal = water?.pal ?? WATER;
    if (water) {
      this.wmat = waterMat(water.shoreZ);
      this.water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), this.wmat);
      root.add(this.water);
    }
  }

  /** camera-relative sun: az deg from the camera's forward axis (+ = screen right), el deg */
  sunDir(cam: { pos: number[]; look: number[] }, az = 130, el = 40) {
    const fw = new THREE.Vector3(cam.look[0] - cam.pos[0], 0, cam.look[2] - cam.pos[2]).normalize();
    const rt = fw.clone().cross(new THREE.Vector3(0, 1, 0)).normalize(), a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
    return fw.multiplyScalar(Math.cos(a)).addScaledVector(rt, Math.sin(a)).normalize().multiplyScalar(Math.cos(e)).add(new THREE.Vector3(0, Math.sin(e), 0)).normalize();
  }

  update(light: Light, t: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene, focus: THREE.Vector3, sun: THREE.Vector3) {
    const L = LIGHTS[light], K = LOOK[light], dist = cam.position.distanceTo(focus);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 0.9 + 10, 14, 90);
    this.sun.position.copy(focus).addScaledVector(sun, 300); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 50; sc.far = 600; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((d) => THREE.MathUtils.degToRad(d)); su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color);
    scene.fog = this.fog; scene.background = null;
    for (const m of this.clouds) m.lookAt(cam.position.x, m.position.y, cam.position.z);
    if (this.wmat) {
      const wu = this.wmat.uniforms, P = this.pal;
      untone(P.near, wu.cNear.value); untone(P.mid, wu.cMid.value); untone(P.far, wu.cFar.value); untone(P.shallow, wu.cShallow.value);
      untone(P.crest, wu.cCrest.value); untone(P.trough, wu.cTrough.value); untone(P.glint, wu.cGlint.value); untone(L.fog, wu.cFog.value);
      wu.time.value = t; wu.camPos.value.copy(cam.position); wu.fogNear.value = 300; wu.fogFar.value = 1400;
    }
  }
}
