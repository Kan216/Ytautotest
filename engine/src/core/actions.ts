// Generic action presets that work in any kit (they only need an anchor's position or points). Kit-only actions
// (clock sweep, flag fall, rocket launch, ...) are handled by the kit's own update(). Each action id also has a
// sound recipe of the same name in tools/sound.py.
import * as THREE from "three";
import { V3 } from "./geo";
import { burstTex, smokeTex } from "./textures";
import { Action, Ctx, KitWorld } from "./types";

export const ACTIONS: Record<string, string> = {
  "fire": "gun/cannon shot at the anchor's points: muzzle flash, smoke puff, camera kick (p: stagger s, size m)",
  "explode": "explosion at the anchor's points, then smoke columns that keep rising (p: stagger s, size m)",
  "smoke": "a column of dark smoke rising from the anchor from this moment on",
  "dust": "a puff of dust at the anchor (landing, running, impact on ground)",
  "kick": "camera shake on this word (p: strength 0.3-1.5)",
  "flash": "white flash on the cut (use as a shot 'transition' instead)",
};
/** actions that shake the camera by default, and how hard */
export const KICK: Record<string, number> = { fire: 1.2, explode: 1.1, kick: 1.0 };

let tex: { gold: THREE.Texture[]; fire: THREE.Texture[]; light: THREE.Texture[]; dark: THREE.Texture[] } | null = null;
const T = () => (tex ??= {
  gold: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => burstTex(k, "#fff2a6")), fire: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => burstTex(k, "#ffb347")),
  light: [0, 1, 2, 3].map((i) => smokeTex(i, false)), dark: [0, 1, 2, 3].map((i) => smokeTex(i, true)),
});
const num = (a: Action, k: string, d: number) => (typeof a.p?.[k] === "number" ? (a.p![k] as number) : d);

export const puff = (ctx: Ctx, t0: number, p: V3, size: number, dir: V3, k: number, dark = false, life = 3.2) => {
  const u = (ctx.t - t0) / life;
  if (u < 0 || u > 1) return;
  const e = 1 - (1 - u) ** 2, s = size * (0.45 + 1.4 * e);
  ctx.soft.next().show(ctx.cam, (dark ? T().dark : T().light)[k % 4], [p[0] + dir[0] * e * 4 + u * 3, p[1] + dir[1] * e * 4 + u * 2.5, p[2] + dir[2] * e * 4], s, s, 0.95 * (1 - u) ** 1.3);
};
export const burst = (ctx: Ctx, t0: number, p: V3, size: number, fire = false) => {
  const n = Math.floor((ctx.t - t0) * ctx.fps);
  if (n < 0 || n > 7) return;
  ctx.fx.next().show(ctx.cam, (fire ? T().fire : T().gold)[n], p, size, size, 1, new THREE.Color(fire ? 2.4 : 3.2, fire ? 1.7 : 3.0, fire ? 1.0 : 2.2), n * 0.05);
};
export const column = (ctx: Ctx, t0: number, p: V3, i: number, scale = 1, rise = 20) => {
  if (ctx.t <= t0) return;
  for (let j = 0; j < 6; j++) {
    const u = ((ctx.t - t0) * 0.16 + j / 6) % 1, age = ctx.t - t0, s = (3 + u * 12) * scale * Math.min(1, age * 1.4);
    ctx.soft.next().show(ctx.cam, T().dark[(i + j) % 4], [p[0] + u * 9 * scale, p[1] + 1 + u * rise * scale, p[2] - u * 2 * scale], s, s, 0.8 * (1 - u) ** 1.2 * Math.min(1, age * 2));
  }
};

/** run every generic action of the timeline for the current frame (state persists: smoke keeps rising later) */
export const runActions = (ctx: Ctx, W: KitWorld) => {
  for (const a of ctx.actions) {
    const A = W.anchors[a.at];
    if (!A) continue; // the anchor lives in another kit: nothing to show in this shot
    const t0 = a.f / ctx.fps, pts = A.points ?? [A.p], st = num(a, "stagger", 0.12);
    switch (a.id) {
      case "fire": pts.forEach((p, k) => {
        const tk = t0 + k * st, sz = num(a, "size", Math.max(2.5, A.size * 0.05));
        burst(ctx, tk, p, sz); puff(ctx, tk, p, sz * 1.2, [0, 0.2, 0], k); puff(ctx, tk + 0.05, p, sz * 1.4, [0.3, 0.3, 0], k + 1);
      }); break;
      case "explode": pts.forEach((p, k) => {
        const tk = t0 + k * st, sz = num(a, "size", Math.max(4, A.size * 0.35));
        burst(ctx, tk, p, sz, true); puff(ctx, tk + 0.05, p, sz * 0.9, [0, 0.4, 0.3], k, true);
        if (a.p?.smoke !== false) column(ctx, tk, p, k, sz / 10);
      }); break;
      case "smoke": pts.forEach((p, k) => column(ctx, t0 + k * 0.2, p, k, num(a, "scale", 1))); break;
      case "dust": pts.forEach((p, k) => { puff(ctx, t0 + k * st, p, num(a, "size", 2.5), [-0.5, 0.1, 0], k, false, 1.6); puff(ctx, t0 + k * st, p, num(a, "size", 2.5), [0.5, 0.1, 0], k + 1, false, 1.6); }); break;
    }
  }
};
