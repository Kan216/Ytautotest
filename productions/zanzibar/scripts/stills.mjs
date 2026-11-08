// Render test stills of ZanzibarShort: node scripts/stills.mjs out/stills/x_ 0,60,120 [scale]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import path from "node:path";
const [prefix = "out/stills/s_", list = "0", scale = "0.5"] = process.argv.slice(2);
process.env.TMPDIR = process.env.TMPDIR || "/home/user/rtmp";
const exe = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browser = await openBrowser("chrome", { browserExecutable: exe, chromiumOptions: { gl: "swangle" } });
const inputProps = {};
const composition = await selectComposition({ serveUrl, id: "ZanzibarShort", inputProps, puppeteerInstance: browser, browserExecutable: exe });
for (const f of list.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ serveUrl, composition, frame: f, output: `${prefix}${String(f).padStart(4, "0")}.png`, scale: Number(scale), inputProps, puppeteerInstance: browser, browserExecutable: exe, chromiumOptions: { gl: "swangle" } });
  console.log(`frame ${f}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
await browser.close({ silent: true });
