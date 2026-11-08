// Timeline of "The 38-Minute War" (~14 s). Every cut and reaction is keyed to the voice word timings (words.json,
// copied from voice/words.json), so re-recording the voice re-times the picture. Camera grammar from the bridge short:
// slow continuous push-ins, symmetric ease-in-out moves, big reframes are cuts, impacts are 7-frame flip kicks.
import WORDS from "./words.json";

export const FPS = 30;
export type V3 = [number, number, number];
type Word = { w: string; s: number; e: number };
const W = WORDS as Word[];
/** time (s) of the n-th occurrence of a word (punctuation ignored) */
export const at = (word: string, n = 0, edge: "s" | "e" = "s") => {
  const hits = W.filter((x) => x.w.toLowerCase().replace(/[^a-z-]/g, "") === word);
  if (!hits[n]) throw new Error(`story.ts: word "${word}" #${n} not in words.json`);
  return hits[n][edge];
};
const fr = (t: number) => Math.round(t * FPS);
export const VOICE_END = W[W.length - 1].e;
export const TOTAL = fr(VOICE_END + 1.2);

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const ease = (x: number) => { const u = clamp01(x); return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---------------- story beats (seconds) ----------------
export const T = {
  sweep0: at("lasted"),                 // clock minute hand starts its 38-minute sweep
  sweep1: at("minutes", 0, "e"),        // ... and lands on 9:40
  britain: at("britain"),
  zanzibar: at("zanzibar"),
  fire: at("british") + 0.05,           // deck gun fires on "British"
  ripple: at("won"),                    // the rest of the line fires
  hit: at("quickly") - 0.1,             // palace hit, flag falls
  ever: at("ever"),
};

// ---------------- shots ----------------
export type ShotDef = { id: number; a: number; b: number; light: "day" | "golden" };
const cut1 = fr(at("in", 1)) - 4;               // clock -> harbour (white flash)
const cut2 = fr(T.zanzibar) - 2;              // ships -> palace
const cut3 = fr(at("the", 1)) - 3;            // palace -> deck gun ("The British")
const cut4 = fr(T.hit) - 2;                   // deck -> palace hit ("quickly")
const cut5 = fr(at("that")) + 2;              // -> admiral watches the smoke
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: cut1, light: "day" },          // clock tower close-up, the 38-minute sweep
  { id: 2, a: cut1, b: cut2, light: "day" },       // five warships glide past ("In 1896, Britain")
  { id: 3, a: cut2, b: cut3, light: "day" },       // palace and its red flag ("fought Zanzibar")
  { id: 4, a: cut3, b: cut4, light: "day" },       // deck gun + sailors fire ("The British won so")
  { id: 5, a: cut4, b: cut5, light: "day" },       // palace hit, flagpole snaps ("quickly")
  { id: 6, a: cut5, b: TOTAL, light: "day" },      // admiral in profile, palace smoking ("...shortest war ever!")
];
export const FLASH_AT = cut1;
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];

// ---------------- world layout (metres; sea level y = 0, shore along x, sea toward +z) ----------------
export const GROUND = 1.0;
export const PALACE = { x0: -22, x1: 22, z0: -32, z1: -14, h: 13 };
export const TOWER = { x: -30, z: -22, w: 7, h: 30, clockY: 24, clockR: 2.5 };
export const POLE = { x: 9, z: -22, base: PALACE.h, h: 10, brk: 4.2 };
export const SHIP_Z = 120;
export const SHIPS_X = [-148, -68, 12, 92, 172];
export const FLAG_SHIP = 2;          // index of the ship whose deck we stand on
export const DECK = 5.6;             // deck height
const SX = SHIPS_X[FLAG_SHIP];
export const PALACE_C: V3 = [2, 8, -16];
const CAM4: V3 = [SX + 17.4, DECK + 2.9, SHIP_Z + 3.6];
const CAM6: V3 = [SX + 13.2, DECK + 1.75, SHIP_Z + 2.2];
/** point `dist` metres from `from` toward `to` (horizontal), turned `deg` degrees to the left (+) / right (-) */
export const toward = (from: V3, to: V3, dist: number, deg = 0, y = from[1]): V3 => {
  const dx = to[0] - from[0], dz = to[2] - from[2], l = Math.hypot(dx, dz), a = (deg * Math.PI) / 180;
  const ux = dx / l, uz = dz / l, rx = ux * Math.cos(a) + uz * Math.sin(a), rz = -ux * Math.sin(a) + uz * Math.cos(a);
  return [from[0] + rx * dist, y, from[2] + rz * dist];
};
export const GUN_BASE: V3 = toward(CAM4, PALACE_C, 7.2, 0, DECK);   // bow deck gun mount, aimed at the palace
export const GUN: V3 = toward(GUN_BASE, PALACE_C, 3.7, 0, DECK + 1.75); // its muzzle
export const SAILORS: V3[] = [toward(CAM4, PALACE_C, 6.0, 10.5, DECK), toward(CAM4, PALACE_C, 6.4, -10, DECK)];
export const ADMIRAL: V3 = toward(CAM6, PALACE_C, 6.2, 10, DECK);
export const PALACE_HITS: V3[] = [[-12, 8, -13.6], [6, 10.5, -13.6], [15, 5.2, -13.6], [-4, 12.6, -18]];

/** clock time in minutes after 9:00 at story time t */
export const clockMin = (t: number) => 2 + 38 * ease((t - T.sweep0) / (T.sweep1 - T.sweep0));
/** flag pole fall 0..1 */
export const poleFall = (t: number) => { const u = clamp01((t - T.hit - 0.12) / 0.75); return u * u; };

// ---------------- cameras ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Key = (u: number) => Cam;
const glide = (p0: V3, p1: V3, l0: V3, l1: V3, fov0: number, fov1 = fov0, roll = 0): Key =>
  (u) => ({ pos: lerp3(p0, p1, u), look: lerp3(l0, l1, u), fov: lerp(fov0, fov1, u), roll });

const clock: V3 = [TOWER.x, TOWER.clockY, TOWER.z + TOWER.w / 2];
const CAMS: Record<number, { key: Key; shape?: (u: number) => number }> = {
  1: { key: glide([TOWER.x + 12, 9, TOWER.z + 52], [TOWER.x + 3.5, TOWER.clockY - 2.5, TOWER.z + 17], [TOWER.x - 1, TOWER.clockY + 1, TOWER.z], [clock[0], clock[1], clock[2]], 40, 30, 0.03), shape: (u) => 1 - (1 - u) ** 2 },
  2: { key: glide([-215, 58, 178], [-188, 52, 170], [30, 0, 112], [48, 0, 110], 34, 33), shape: (u) => u },
  3: { key: glide([27, 5.5, 27], [23, 5.8, 21], [3, 11.5, -20], [5, 12.5, -21], 44, 40, -0.02), shape: (u) => u },
  4: { key: glide(CAM4, [CAM4[0] - 0.4, CAM4[1] - 0.15, CAM4[2] - 0.8], toward(CAM4, PALACE_C, 30, 2, DECK + 0.9), toward(CAM4, PALACE_C, 30, 1, DECK + 1.0), 46, 43), shape: (u) => u },
  5: { key: glide([16, 10, 30], [15, 10, 26], [4, 11, -16], [5, 11.5, -16], 46, 44, 0.03), shape: (u) => u },
  6: { key: glide(CAM6, [CAM6[0] - 0.5, CAM6[1] + 0.05, CAM6[2] - 1.0], toward(CAM6, PALACE_C, 30, 3.0, DECK + 2.3), toward([CAM6[0] - 0.5, 0, CAM6[2] - 1.0], PALACE_C, 30, 2.6, DECK + 2.5), 36, 31), shape: (u) => u },
};

// impact kicks: image offset flips sign every frame, decays to 0 in 7 frames
const KICKS: [number, number][] = [[T.fire, 1.3], [T.ripple + 0.12, 0.5], [T.ripple + 0.42, 0.45], [T.hit, 1.2], [T.hit + 0.3, 0.6]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const s = SHOTS[id - 1], c = CAMS[id], u = (f - s.a) / Math.max(1, s.b - s.a);
  const cam = c.key((c.shape ?? smooth)(u));
  const a = kickAt(f / FPS);
  if (!a) return cam;
  const d: V3 = [cam.look[0] - cam.pos[0], cam.look[1] - cam.pos[1], cam.look[2] - cam.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((cam.fov * Math.PI) / 360) * L * a;
  return { ...cam, look: [cam.look[0] - (d[2] / h) * m, cam.look[1] + 0.6 * m, cam.look[2] + (d[0] / h) * m], roll: cam.roll + a * 0.004 };
};

/** lens blur: cInf = blur radius (px at 1080x1920) at infinity, focus = point kept sharp (default: the look target) */
export const dofAt = (id: number): { cInf: number; focus?: V3 } => {
  switch (id) {
    case 1: return { cInf: 10 };                                    // clock sharp, town behind soft
    case 4: return { cInf: 11, focus: [GUN_BASE[0], DECK + 1.4, GUN_BASE[2]] }; // sailors + gun sharp, shore soft
    case 6: return { cInf: 8, focus: [ADMIRAL[0], DECK + 1.6, ADMIRAL[2]] }; // admiral sharp, palace soft
    default: return { cInf: 0 };
  }
};
/** camera-relative sun per shot: az = degrees from the camera's forward axis (+ = screen right), el = elevation */
export const SUN_SHOT: Record<number, { az: number; el: number }> = {
  1: { az: 140, el: 40 }, 2: { az: 120, el: 42 }, 3: { az: 150, el: 45 }, 4: { az: 115, el: 38 }, 5: { az: 150, el: 45 }, 6: { az: 125, el: 36 },
};
