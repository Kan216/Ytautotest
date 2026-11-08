// Kit registry: every scene kit the engine can build. Add a kit here and to presets (tools/catalogue.py reads this).
import { KitDef } from "../core/types";
import { HARBOUR } from "./harbour";

export const KITS: Record<string, KitDef> = { [HARBOUR.id]: HARBOUR };
