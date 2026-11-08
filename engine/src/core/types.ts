// Shared types. A story (stories/*.json, preset IDs only) is resolved by tools/resolve.py against the voice word
// timings into a Timeline (frames), which is the only input the renderer needs.
import * as THREE from "three";
import { V3 } from "./geo";
import { WaterPal } from "./water";
import { FxPool } from "./cards";

export type Light = "day" | "golden";
export type CamSpec = {
  id: string; subject: string; from?: string;
  az?: number; el?: number; dist?: number; fov?: number; move?: number; height?: number; follow?: boolean;
};
export type CharSpec = {
  outfit: string; place: string; dist?: number; angle?: number; view?: "side" | "front"; mirror?: boolean; scale?: number;
  expr: [number, string][];   // [frame, expression] pairs, first applies from the shot start
};
export type Shot = {
  id: number; a: number; b: number; kit: string; seed?: number; light?: Light;
  camera: CamSpec; chars: CharSpec[]; dof?: number; focus?: "subject" | "chars";
};
export type Action = { id: string; at: string; f: number; f1?: number; p?: Record<string, number | string | boolean> };
export type Timeline = {
  title: string; fps: number; width: number; height: number; frames: number;
  shots: Shot[]; actions: Action[]; flashes: number[];
};

/** a named place in a kit that cameras frame, actions happen at and characters stand around.
 *  view = compass angle (deg) from the subject toward the side a camera should normally be on (0 = +z, 90 = +x);
 *  size = how big the subject is (m); ground = floor height for characters standing nearby. */
export type Anchor = { p: V3; size: number; view: number; ground?: number; points?: V3[]; eye?: number;
  /** moving subject: offset from p at time t (cameras follow it unless camera.follow is false) */
  track?: (t: number, actions: Action[], fps: number) => V3 };

export type Ctx = {
  t: number; f: number; fps: number; cam: THREE.PerspectiveCamera;
  actions: Action[]; fx: FxPool; soft: FxPool; shot: Shot;
};
export interface KitWorld {
  root: THREE.Group;
  anchors: Record<string, Anchor>;
  water?: { shoreZ: number | null; pal?: WaterPal };
  /** optional sky look: 5 on-screen colours by elevation (deg), fog colour, a star field (space) */
  sky?: { c: string[]; e: number[]; fog?: string; fogNear?: number; fogFar?: number; stars?: boolean; clouds?: boolean };
  /** big static meshes cameras must not sit behind (auto-framing raycasts against these) */
  occluders: THREE.Object3D[];
  /** lowest safe camera height at (x, z) */
  floor(x: number, z: number): number;
  /** kit-specific animation for the global frame (props, ambient effects, kit-only actions) */
  update(ctx: Ctx): void;
}
export type KitDef = {
  id: string; desc: string;
  anchors: Record<string, string>;          // anchor id -> one-line description (goes into the catalogue)
  actions?: Record<string, string>;         // kit-only actions -> description
  ambience: string;                         // sound preset id for tools/sound.py
  build(seed: number): KitWorld;
};
