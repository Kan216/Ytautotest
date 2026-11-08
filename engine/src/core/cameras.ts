// Camera presets. Every preset is a move between two framings of a subject anchor, described in the subject's own
// terms (azimuth around it, elevation, distance in "frame fills" of its size), so the same preset works on a clock
// face, a warship line or a lion. Auto-framing: if a kit occluder sits between the lens and the subject, the camera
// rises and swings until the view is clear.
import * as THREE from "three";
import { V3 } from "./geo";
import { Anchor, CamSpec, KitWorld } from "./types";

export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Frame = { az: number; el: number; dist: number; fov: number; lx?: number; ly?: number; roll?: number; truck?: number };
type Preset = { desc: string; a: Frame; b: Frame; ease?: "smooth" | "linear" | "out" };

const F = (az: number, el: number, dist: number, fov = 38, o: Partial<Frame> = {}): Frame => ({ az, el, dist, fov, ...o });
export const CAMERAS: Record<string, Preset> = {
  "push-in": { desc: "slow push in toward the subject (default, calm emphasis)", a: F(0, 10, 1.25, 40), b: F(0, 9, 0.95, 36) },
  "push-in-fast": { desc: "quick push in for a punch line or shock", a: F(0, 8, 1.3, 42), b: F(0, 8, 0.8, 34), ease: "out" },
  "pull-out": { desc: "start close, pull back to reveal the surroundings", a: F(0, 10, 0.85, 34), b: F(0, 16, 1.7, 42) },
  "orbit-left": { desc: "circle around the subject to the left", a: F(18, 12, 1.1), b: F(-18, 12, 1.1) },
  "orbit-right": { desc: "circle around the subject to the right", a: F(-18, 12, 1.1), b: F(18, 12, 1.1) },
  "aerial": { desc: "high establishing view gliding over the subject", a: F(-6, 38, 1.7, 36), b: F(6, 34, 1.55, 34), ease: "linear" },
  "low-angle": { desc: "low camera looking up: makes the subject look big or heroic", a: F(-6, -6, 1.0, 44, { ly: 0.15 }), b: F(6, -4, 0.92, 42, { ly: 0.2 }) },
  "truck-left": { desc: "camera slides sideways to the left past the subject", a: F(0, 10, 1.1, 38, { truck: 0.35 }), b: F(0, 10, 1.1, 38, { truck: -0.35 }), ease: "linear" },
  "truck-right": { desc: "camera slides sideways to the right past the subject", a: F(0, 10, 1.1, 38, { truck: -0.35 }), b: F(0, 10, 1.1, 38, { truck: 0.35 }), ease: "linear" },
  "tilt-up": { desc: "starts low on the subject and tilts up to its top", a: F(0, 6, 1.1, 40, { ly: -0.35 }), b: F(0, 10, 1.1, 40, { ly: 0.3 }) },
  "static": { desc: "locked-off framing, no movement", a: F(0, 10, 1.1), b: F(0, 10, 1.1) },
  "dutch": { desc: "tilted, uneasy framing with a slow push (tension)", a: F(8, 8, 1.15, 40, { roll: 0.12 }), b: F(8, 8, 1.0, 38, { roll: 0.16 }) },
  "from-to": { desc: "point of view from one anchor (use 'from') looking at the subject; characters stand in front", a: F(0, 0, 0, 44), b: F(0, 0, 0, 41) },
};

const rad = THREE.MathUtils.degToRad;
const ease = (u: number, e: Preset["ease"] = "smooth") => {
  const x = Math.max(0, Math.min(1, u));
  return e === "linear" ? x : e === "out" ? 1 - (1 - x) ** 3 : x * x * (3 - 2 * x);
};
const ray = new THREE.Raycaster();

/** framing -> camera, with the spec's overrides (az/el offsets in degrees, dist multiplier, fov) */
const place = (S: Anchor, f: Frame, spec: CamSpec): Cam => {
  const fov = spec.fov ?? f.fov, fill = 0.62;
  const D = (S.size / (2 * Math.tan(rad(fov) / 2) * fill)) * f.dist * (spec.dist ?? 1);
  const az = rad(S.view + f.az + (spec.az ?? 0)), el = rad(f.el + (spec.el ?? 0));
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const side = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
  const c = new THREE.Vector3(...S.p).addScaledVector(dir, D).addScaledVector(side, (f.truck ?? 0) * S.size);
  const look = new THREE.Vector3(...S.p).addScaledVector(side, (f.truck ?? 0) * S.size * 0.6);
  look.y += (f.ly ?? 0) * S.size + (spec.height ?? 0);
  return { pos: [c.x, c.y, c.z], look: [look.x, look.y, look.z], fov, roll: f.roll ?? 0 };
};

/** keep the camera above the floor and out from behind occluders */
const clear = (cam: Cam, S: Anchor, W: KitWorld, f: Frame, spec: CamSpec): Cam => {
  let c = cam;
  for (let k = 0; k < 8; k++) {
    const p = new THREE.Vector3(...c.pos), s = new THREE.Vector3(...S.p);
    p.y = Math.max(p.y, W.floor(p.x, p.z) + 1.2);
    c = { ...c, pos: [p.x, p.y, p.z] };
    const d = s.clone().sub(p), len = d.length();
    ray.set(p, d.normalize()); ray.far = Math.max(0, len - S.size * 0.6);
    const hit = W.occluders.length ? ray.intersectObjects(W.occluders, true)[0] : undefined;
    if (!hit) return c;
    const nf = { ...f, el: f.el + 7 * (k + 1), az: f.az + (k % 2 ? -12 : 12) * Math.ceil((k + 1) / 2) };
    c = place(S, nf, spec);
  }
  return c;
};

/** point `dist` m from `from` toward `to` (horizontal), turned `deg` degrees left (+) or right (-) */
export const toward = (from: V3, to: V3, dist: number, deg = 0, y = from[1]): V3 => {
  const dx = to[0] - from[0], dz = to[2] - from[2], l = Math.hypot(dx, dz) || 1, a = rad(deg);
  const ux = dx / l, uz = dz / l, rx = ux * Math.cos(a) + uz * Math.sin(a), rz = -ux * Math.sin(a) + uz * Math.cos(a);
  return [from[0] + rx * dist, y, from[2] + rz * dist];
};

export class ShotCamera {
  private a: Cam; private b: Cam; private e: Preset["ease"];
  constructor(public spec: CamSpec, public W: KitWorld) {
    const P = CAMERAS[spec.id];
    if (!P) throw new Error(`unknown camera preset "${spec.id}"`);
    const S = W.anchors[spec.subject];
    if (!S) throw new Error(`kit has no anchor "${spec.subject}"`);
    this.e = P.ease;
    if (spec.id === "from-to") {
      const O = W.anchors[spec.from ?? ""];
      if (!O) throw new Error(`from-to camera needs a valid "from" anchor (got "${spec.from}")`);
      const eye = (O.eye ?? 1.75) + (spec.height ?? 0), y0 = (O.ground ?? O.p[1]) + eye;
      const p0: V3 = [O.p[0], y0, O.p[2]], push = Math.min(1.2, S.size * 0.02 + 0.6) * (spec.move ?? 1);
      const p1 = toward(p0, S.p, push, 0, y0 + 0.05);
      const look = (p: V3, deg: number): V3 => toward(p, S.p, 30, deg + (spec.az ?? 0), (O.ground ?? O.p[1]) + 1.0 + (spec.el ?? 0) * 0.3);
      this.a = { pos: p0, look: look(p0, 1.5), fov: spec.fov ?? P.a.fov, roll: 0 };
      this.b = { pos: p1, look: look(p1, 1.0), fov: (spec.fov ?? P.a.fov) - 3, roll: 0 };
    } else {
      const m = spec.move ?? 1, mix = (x: number, y: number) => x + (y - x) * m;
      const fb: Frame = { ...P.b, az: mix(P.a.az, P.b.az), el: mix(P.a.el, P.b.el), dist: mix(P.a.dist, P.b.dist), fov: mix(P.a.fov, P.b.fov), truck: mix(P.a.truck ?? 0, P.b.truck ?? 0) };
      this.a = clear(place(S, P.a, spec), S, W, P.a, spec);
      this.b = clear(place(S, fb, spec), S, W, fb, spec);
    }
  }
  at(u: number): Cam {
    const k = ease(u, this.e), L = (x: number, y: number) => x + (y - x) * k;
    const A = this.a, B = this.b;
    return { pos: [L(A.pos[0], B.pos[0]), L(A.pos[1], B.pos[1]), L(A.pos[2], B.pos[2])], look: [L(A.look[0], B.look[0]), L(A.look[1], B.look[1]), L(A.look[2], B.look[2])], fov: L(A.fov, B.fov), roll: L(A.roll, B.roll) };
  }
  start() { return this.a; }
}

/** impact kicks: image offset flips sign every frame, decays to 0 in 7 frames */
export const kickAt = (f: number, kicks: [number, number][]) => {
  let a = 0;
  for (const [f0, g] of kicks) { const n = f - f0; if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5; }
  return a;
};
export const applyKick = (c: Cam, a: number): Cam => {
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1, m = (3 / 640) * Math.tan(rad(c.fov) / 2) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
