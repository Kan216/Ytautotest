// Kit registry: every scene kit the engine can build. Add a kit here and to presets (tools/catalogue.py reads this).
import { KitDef } from "../core/types";
import { HARBOUR } from "./harbour";
import { SPACE } from "./space";
import { SAVANNA } from "./savanna";

export const KITS: Record<string, KitDef> = Object.fromEntries([HARBOUR, SPACE, SAVANNA].map((k) => [k.id, k]));
