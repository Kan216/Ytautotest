// Character outfit presets for the flat cartoon cast (toon.ts). The engine draws them as lit cards; stories pick
// an outfit id, a place and an expression timeline.
import { Outfit, Expr, INK, SKINS } from "./toon";

const o = (x: Outfit): Outfit => x;
export const OUTFITS: Record<string, { desc: string; o: Outfit }> = {
  "sailor": { desc: "navy sailor, white cap", o: o({ jacket: "#26385f", pants: "#f2efe6", boots: INK, hat: "cap", cap: "#f4f1ea", buttons: "#e8e4da", skin: SKINS[0] }) },
  "sailor-2": { desc: "navy sailor with moustache", o: o({ jacket: "#26385f", pants: "#f2efe6", boots: INK, hat: "cap", cap: "#f4f1ea", buttons: "#e8e4da", skin: SKINS[1], moustache: "#4a3426" }) },
  "admiral": { desc: "naval officer, dark coat, gold buttons, sword", o: o({ jacket: "#1c2640", pants: "#1c2640", boots: INK, hat: "cap", cap: "#1c2640", buttons: "#e8c45a", moustache: "#ece6da", sword: true, build: "stout", skin: SKINS[0] }) },
  "soldier": { desc: "green-coated rifleman with shako", o: o({ jacket: "#357650", pants: "#3d4440", boots: INK, hat: "shako", belt: "#f1efe6", buttons: "#d9dde0", rifle: true, skin: SKINS[2] }) },
  "redcoat": { desc: "red-coated soldier with shako and rifle", o: o({ jacket: "#b8352f", pants: "#2d3142", boots: INK, hat: "shako", belt: "#f1efe6", buttons: "#e8c45a", rifle: true, skin: SKINS[0] }) },
  "officer": { desc: "army officer, tall shako, sash, sword", o: o({ jacket: "#357650", pants: "#3d4440", boots: INK, hat: "shako_tall", buttons: "#e8c45a", sash: "#c0353a", sword: true, moustache: "#4a3020", build: "stout", skin: SKINS[0] }) },
  "king": { desc: "ruler in purple with gold buttons", o: o({ jacket: "#5b2d8a", pants: "#2d2240", boots: "#5a3b2a", hat: "tophat", buttons: "#f0c850", sash: "#f0c850", build: "stout", moustache: "#5a3b2a", skin: SKINS[3] }) },
  "scientist": { desc: "white lab coat", o: o({ jacket: "#f4f4f0", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#6b5a4a", buttons: "#b8bcc4", skin: SKINS[1] }) },
  "astronaut": { desc: "white space suit with cap", o: o({ jacket: "#eef0f4", pants: "#eef0f4", boots: "#9aa0aa", hat: "cap", cap: "#d24a3a", buttons: "#3a6fd0", build: "stout", skin: SKINS[0] }) },
  "engineer": { desc: "orange overalls, cap", o: o({ jacket: "#e8822e", pants: "#e8822e", boots: INK, hat: "cap", cap: "#2f5f8a", buttons: "#f1efe6", skin: SKINS[2] }) },
  "ranger": { desc: "safari ranger in khaki", o: o({ jacket: "#b9a06a", pants: "#7a6a48", boots: "#5a3b2a", hat: "cap", cap: "#8a7650", buttons: "#5a4a30", skin: SKINS[3] }) },
  "explorer": { desc: "old-time explorer, top hat", o: o({ jacket: "#8a5a3a", pants: "#d8c8a0", boots: "#4a3426", hat: "tophat", buttons: "#e8c45a", moustache: "#5a3b2a", skin: SKINS[0] }) },
  "office": { desc: "office worker in a blue suit", o: o({ jacket: "#3f6fb5", pants: "#3b3f52", boots: INK, hat: "hair", hair: "#3a2a20", buttons: "#d9dde0", skin: SKINS[1] }) },
  "police": { desc: "police officer, navy uniform, cap", o: o({ jacket: "#1f2f5a", pants: "#1f2f5a", boots: INK, hat: "cap", cap: "#1f2f5a", buttons: "#e8c45a", skin: SKINS[2] }) },
  "chef": { desc: "cook in white", o: o({ jacket: "#f7f5ef", pants: "#3b3f52", boots: INK, hat: "cap", cap: "#f7f5ef", buttons: "#b8bcc4", build: "stout", skin: SKINS[0] }) },
  "kid": { desc: "kid in an orange top and red cap", o: o({ jacket: "#f08a2c", pants: "#3b5b9a", boots: "#f4f1ea", hat: "cap", cap: "#e2453c", build: "kid", skin: SKINS[1] }) },
  "woman": { desc: "woman in a dress and bonnet", o: o({ jacket: "#7b5ac9", pants: "#3b3f52", boots: "#5a3b2a", hat: "bonnet", dress: "#c25a7a", skin: SKINS[0] }) },
  "townsman": { desc: "man in a coat and top hat", o: o({ jacket: "#8c3b4a", pants: "#3b3f52", boots: "#4a3426", hat: "tophat", skin: SKINS[3] }) },
  "farmer": { desc: "farmer in green with a cap", o: o({ jacket: "#5d7a3a", pants: "#6a5040", boots: "#4a3426", hat: "cap", cap: "#b5653f", skin: SKINS[2] }) },
};
export const EXPRS: Expr[] = ["neutral", "stern", "grin", "laugh", "whistle", "nervous", "shock", "relief", "relief_open", "dazed", "pained", "smile", "smile_closed"];
