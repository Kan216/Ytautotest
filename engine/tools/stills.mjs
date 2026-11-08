// Test stills of a timeline: node tools/stills.mjs out/x/timeline.json out/x/stills/s_ 0,60,120 [scale]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const [tlPath, prefix, list, scale = "0.5"] = process.argv.slice(2);
process.env.TMPDIR = process.env.TMPDIR || "/home/user/rtmp";
const exe = process.env.CHROME || "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const gl = process.env.GL || "swangle";
const inputProps = { timeline: JSON.parse(readFileSync(tlPath, "utf8")) };
mkdirSync(path.dirname(prefix), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browser = await openBrowser("chrome", { browserExecutable: exe, chromiumOptions: { gl } });
const composition = await selectComposition({ serveUrl, id: "Short", inputProps, puppeteerInstance: browser, browserExecutable: exe });
for (const f of list.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ serveUrl, composition, frame: f, output: `${prefix}${String(f).padStart(4, "0")}.png`, scale: Number(scale), inputProps, puppeteerInstance: browser, browserExecutable: exe, chromiumOptions: { gl }, timeoutInMilliseconds: 300000 });
  console.log(`frame ${f}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
await browser.close({ silent: true });
