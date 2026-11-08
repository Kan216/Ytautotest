// Stylised sea: distance colour ramp, turquoise shallows toward a shoreline, scrolling painted crests/glints,
// shore foam, manual fog. Colours are on-screen targets (tone-map inverted with untone() by the caller).
import * as THREE from "three";
import { waterNear, waterFar } from "./paint";
// ---------------- water ----------------
/** shoreZ: z of the waterline, land toward -z (null = open water, no shallows or foam) */
export const waterMat = (shoreZ: number | null = null) => { const SHORE_Z = shoreZ ?? -1e5; return new THREE.ShaderMaterial({
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
}); };
export type WaterPal = { near: string; mid: string; far: string; shallow: string; crest: string; trough: string; glint: string };
export const WATER: WaterPal = { near: "#1fa5bd", mid: "#1680b4", far: "#2d6aa8", shallow: "#36d0c8", crest: "#b9f2ef", trough: "#0f5a8a", glint: "#ffffff" };