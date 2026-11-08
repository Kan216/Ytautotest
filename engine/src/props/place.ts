// Places library props into a kit world. Each placed prop becomes an anchor (named `name`, else its id), so cameras
// can frame it and actions can target it; members of a `group` also form a group anchor (e.g. a herd).
// Movement: a "run" / "drive" / "fly" action at the prop (or its group) moves it along its heading from that frame.
import * as THREE from "three";
import { V3 } from "../core/geo";
import { puff } from "../core/actions";
import { Action, Anchor, Ctx, KitWorld } from "../core/types";
import { PROPS, PropInst } from "./index";

export type PropPlace = {
  id: string; name?: string; group?: string;
  at: string;                 // anchor to stand next to
  dx?: number; dz?: number;   // offset from the anchor (m, world x / z)
  dy?: number;                // raise (e.g. on a deck); boats default to the water line
  face?: string;              // anchor to face toward ...
  yaw?: number;               // ... or a heading in degrees (0 = +x, 90 = -z)
  scale?: number; speed?: number; seed?: number;
};
const MOVES = new Set(["run", "drive", "fly"]);
const compass = (x: number, z: number) => (Math.atan2(x, z) * 180) / Math.PI;

export const placeProps = (W: KitWorld, list: PropPlace[]) => {
  const placed: { name: string; group?: string; inst: PropInst; def: (typeof PROPS)[string]; home: V3; yaw: number; s: number; speed: number }[] = [];
  const groups: Record<string, string[]> = {};
  for (const pl of list) {
    const def = PROPS[pl.id];
    if (!def) throw new Error(`unknown prop "${pl.id}"`);
    const A = W.anchors[pl.at];
    if (!A) throw new Error(`prop "${pl.id}": no anchor "${pl.at}" in this kit`);
    const x = A.p[0] + (pl.dx ?? 0), z = A.p[2] + (pl.dz ?? 0), boat = def.id.endsWith("boat");
    const y = (boat ? 0 : A.ground ?? W.floor(x, z)) + (pl.dy ?? 0);
    let yaw = ((pl.yaw ?? 0) * Math.PI) / 180;
    const F = pl.face ? W.anchors[pl.face] : undefined;
    if (F) yaw = Math.atan2(-(F.p[2] - z), F.p[0] - x);
    const s = pl.scale ?? 1, inst = def.build(pl.seed ?? placed.length + 1);
    inst.obj.position.set(x, y, z); inst.obj.rotation.y = yaw; inst.obj.scale.setScalar(s);
    W.root.add(inst.obj);
    if (def.solid) W.occluders.push(inst.obj);
    let name = pl.name ?? def.id, k = 2;
    while (W.anchors[name]) name = `${pl.name ?? def.id}-${k++}`;
    const head: V3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const speed = pl.speed ?? def.speed ?? 5;
    const muzzle = def.muzzle ? new THREE.Vector3(...def.muzzle).multiplyScalar(s).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(new THREE.Vector3(x, y, z)) : undefined;
    const rec = { name, group: pl.group, inst, def, home: [x, y, z] as V3, yaw, s, speed };
    placed.push(rec);
    W.anchors[name] = {
      p: [x, y + def.h * s * 0.5, z], size: Math.max(def.h, (def.len ?? def.h) * 0.8) * s * 1.25,
      view: compass(head[0], head[2]) + 55, ground: y,
      points: muzzle ? [[muzzle.x, muzzle.y, muzzle.z]] : undefined,
      track: (t, a, fps) => offset(rec, t, a, fps),
    };
    if (pl.group) (groups[pl.group] ??= []).push(name);
  }
  // group anchors: centre of the members, follows the middle member
  for (const [g, names] of Object.entries(groups)) {
    const ps = names.map((n) => W.anchors[n].p), c: V3 = [0, 0, 0];
    ps.forEach((p) => { c[0] += p[0] / ps.length; c[1] += p[1] / ps.length; c[2] += p[2] / ps.length; });
    const span = Math.max(...ps.map((p) => Math.hypot(p[0] - c[0], p[2] - c[2]))) * 2 + 4;
    const mid = W.anchors[names[Math.floor(names.length / 2)]];
    W.anchors[g] = { p: c, size: span, view: mid.view, ground: mid.ground, points: ps.map((p) => [p[0], p[1], p[2]] as V3), track: mid.track };
  }

  function mine(rec: { name: string; group?: string }, a: Action) { return a.at === rec.name || (rec.group !== undefined && a.at === rec.group); }
  function dist(rec: (typeof placed)[number], t: number, actions: Action[], fps: number) {
    const a = actions.find((x) => MOVES.has(x.id) && mine(rec, x));
    if (!a) return 0;
    const sp = typeof a.p?.speed === "number" ? (a.p.speed as number) : rec.speed, u = t - a.f / fps;
    return u > 0 ? sp * (u - 0.4 * (1 - Math.exp(-u / 0.4))) : 0;
  }
  function offset(rec: (typeof placed)[number], t: number, actions: Action[], fps: number): V3 {
    const d = dist(rec, t, actions, fps), fly = rec.def.move === "fly";
    return [Math.cos(rec.yaw) * d, fly ? d * 0.18 : 0, -Math.sin(rec.yaw) * d];
  }
  return {
    update(ctx: Ctx) {
      for (const rec of placed) {
        const off = offset(rec, ctx.t, ctx.actions, ctx.fps), d = dist(rec, ctx.t, ctx.actions, ctx.fps);
        rec.inst.obj.position.set(rec.home[0] + off[0], rec.home[1] + off[1], rec.home[2] + off[2]);
        const since: Record<string, number | undefined> = {};
        for (const a of ctx.actions) if (mine(rec, a)) since[a.id] = ctx.t - a.f / ctx.fps;
        rec.def.animate?.(rec.inst, { t: ctx.t, d, moving: d > 0.01, since });
        if (d > 0.01 && rec.def.move !== "fly" && !rec.def.id.endsWith("boat")) {   // dust kicked up behind
          const b = (rec.def.len ?? 2) * rec.s * 0.6, p = rec.inst.obj.position;
          puff(ctx, ctx.t - ((ctx.t * 3) % 1) / 3, [p.x - Math.cos(rec.yaw) * b, p.y + 0.4, p.z + Math.sin(rec.yaw) * b], 1.2 + b, [-Math.cos(rec.yaw), 0.2, Math.sin(rec.yaw)], Math.floor(ctx.t * 3), false, 1.2);
        }
      }
    },
  };
};
