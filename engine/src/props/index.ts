// Props library: standalone animals, vehicles, nature, buildings and objects that can be placed in ANY scene kit.
// A placed prop becomes an anchor (cameras frame it, actions target it). Props are built facing +x, base at y = 0.
import * as THREE from "three";
import { V3 } from "../core/geo";

export type PropState = {
  t: number;                 // seconds
  d: number;                 // distance moved along its heading (run / drive / fly)
  moving: boolean;
  since: Record<string, number | undefined>;   // seconds since each of this prop's actions started (undefined = not yet)
};
export type PropInst = {
  obj: THREE.Group;
  parts: Record<string, THREE.Object3D | THREE.Object3D[] | undefined>;
  stride?: number;           // metres per gait cycle (legs) or wheel radius (vehicles)
};
export type PropDef = {
  id: string; desc: string; cat: "animal" | "vehicle" | "nature" | "building" | "object";
  h: number;                 // height (m), used for framing
  len?: number;              // length along its heading (m)
  move?: "run" | "drive" | "fly";
  speed?: number;            // default m/s for its move action
  acts?: Record<string, string>;   // prop-specific actions -> description
  muzzle?: V3;               // local point where "fire" effects appear
  solid?: boolean;           // big enough to block cameras (buildings)
  build(seed: number): PropInst;
  animate?(p: PropInst, s: PropState): void;
};

import { ANIMALS } from "./animals";
import { VEHICLES } from "./vehicles";
import { NATURE } from "./nature";
import { BUILDINGS } from "./buildings";
import { OBJECTS } from "./objects";
export const PROPS: Record<string, PropDef> = Object.fromEntries([...ANIMALS, ...VEHICLES, ...NATURE, ...BUILDINGS, ...OBJECTS].map((p) => [p.id, p]));
