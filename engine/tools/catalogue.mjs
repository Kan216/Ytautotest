// Writes presets/catalogue.json from the engine's own registries (kits, anchors, cameras, actions, outfits,
// expressions), so the catalogue can never drift from the code. This file is all an AI helper ever needs to see.
// Usage: node tools/catalogue.mjs
import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "node:fs";
const entry = `
import { KITS } from "./src/kits";
import { CAMERAS } from "./src/core/cameras";
import { ACTIONS } from "./src/core/actions";
import { OUTFITS, EXPRS } from "./src/core/characters";
const kits = Object.fromEntries(Object.values(KITS).map((k) => [k.id, { desc: k.desc, ambience: k.ambience, anchors: k.anchors, actions: k.actions ?? {} }]));
export default {
  kits, cameras: Object.fromEntries(Object.entries(CAMERAS).map(([k, v]) => [k, v.desc])), actions: ACTIONS,
  outfits: Object.fromEntries(Object.entries(OUTFITS).map(([k, v]) => [k, v.desc])), expressions: EXPRS,
  transitions: { cut: "plain cut (default)", flash: "white flash on the cut" },
  moods: { hook: "opening question, sparse music", build: "rising, rhythmic", impact: "stop-time, hits on actions", finale: "resolving chord at the end", calm: "soft pad only" },
  music: { march: "brass + snare, minor to major (history, war)", space: "synth pads and pulses (science, space)", nature: "plucked strings and marimba-like tones (animals, nature)", modern: "upbeat plucks and claps (everyday, city)" },
  lights: { day: "midday sun", golden: "low warm sunset light" },
};`;
const out = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", write: false, loader: { ".json": "json" }, logLevel: "error" });
const mod = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
mkdirSync("presets", { recursive: true });
writeFileSync("presets/catalogue.json", JSON.stringify(mod.default, null, 1));
const c = mod.default;
console.log(`presets/catalogue.json: ${Object.keys(c.kits).length} kits, ${Object.values(c.kits).reduce((n, k) => n + Object.keys(k.anchors).length, 0)} anchors, ${Object.keys(c.cameras).length} cameras, ${Object.keys(c.actions).length + Object.values(c.kits).reduce((n, k) => n + Object.keys(k.actions).length, 0)} actions, ${Object.keys(c.outfits).length} outfits`);
