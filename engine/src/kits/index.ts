// Kit registry: every scene kit the engine can build. Add a kit here and to presets (tools/catalogue.py reads this).
import { KitDef } from "../core/types";
import { HARBOUR } from "./harbour";
import { SPACE } from "./space";
import { SAVANNA } from "./savanna";
import { CITY } from "./city";
import { CASTLE } from "./castle";
import { JUNGLE } from "./jungle";
import { DESERT } from "./desert";
import { OCEAN } from "./ocean";
import { LAB } from "./lab";

export const KITS: Record<string, KitDef> = Object.fromEntries([HARBOUR, SPACE, SAVANNA, CITY, CASTLE, JUNGLE, DESERT, OCEAN, LAB].map((k) => [k.id, k]));
