#!/usr/bin/env python3
"""One command from story to finished video, no AI involved:
   voice (edge-tts or Kokoro) -> resolve presets against word timings -> sound -> render -> mux -> check.

Usage:
  python tools/make_short.py stories/zanzibar.json                 # full run -> out/<name>/final.mp4
  python tools/make_short.py stories/zanzibar.json --stills 60,200 # only test stills (fast look check)
  python tools/make_short.py stories/x.json --voice-dir path/       # use an existing voice.wav + words.json
Options: --gl swangle|angle|egl (default: swangle on Linux without GPU, angle elsewhere), --concurrency N.
Steps whose inputs did not change are skipped (voice is cached by text + voice settings).
"""
import argparse, hashlib, json, os, platform, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.dirname(HERE); REPO = os.path.dirname(ENGINE)
PY = sys.executable

def run(cmd, **kw):
    if isinstance(cmd, list) and cmd and shutil.which(cmd[0]):   # Windows: npx -> npx.cmd, node -> node.exe
        cmd = [shutil.which(cmd[0])] + cmd[1:]
    print("  $", " ".join(cmd) if isinstance(cmd, list) else cmd, flush=True)
    r = subprocess.run(cmd, cwd=kw.pop("cwd", ENGINE), **kw)
    if r.returncode: sys.exit(f"step failed ({r.returncode}): {cmd[0] if isinstance(cmd, list) else cmd}")

def narration(story):
    return story.get("script") or " ".join(s["text"] for s in story["shots"])

def voice(story, vdir):
    v = story.get("voice", {"engine": "edge", "name": "en-US-GuyNeural"}); text = narration(story)
    key = hashlib.sha1(json.dumps([text, v], sort_keys=True).encode()).hexdigest()[:12]
    stamp = os.path.join(vdir, ".voice-key")
    if os.path.exists(stamp) and open(stamp).read() == key and os.path.exists(os.path.join(vdir, "words.json")):
        print("voice: cached"); return
    os.makedirs(vdir, exist_ok=True)
    open(os.path.join(vdir, "narration.txt"), "w").write(text + "\n")
    if v.get("engine", "edge") == "edge":
        cmd = [PY, os.path.join(REPO, "skills/edge-tts-voice/scripts/tts.py"), "--text-file", os.path.join(vdir, "narration.txt"),
               "--voice", v.get("name", "en-US-GuyNeural"), "--out", vdir]
        if "rate" in v: cmd += ["--rate", v["rate"]]
        if "pitch" in v: cmd += ["--pitch", v["pitch"]]
    else:
        models = v.get("models", os.environ.get("KOKORO_MODELS", os.path.expanduser("~/models")))
        if not os.path.exists(os.path.join(models, "kokoro-v1.0.timed.onnx")):
            run([PY, os.path.join(HERE, "kokoro_voice.py"), "--export-timed", "--models", models])
        cmd = [PY, os.path.join(HERE, "kokoro_voice.py"), os.path.join(vdir, "narration.txt"), "--voice", v.get("name", "am_michael"),
               "--speed", str(v.get("speed", 1.0)), "--models", models, "--out", vdir]
    run(cmd); open(stamp, "w").write(key)

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("story"); ap.add_argument("--out"); ap.add_argument("--voice-dir"); ap.add_argument("--stills")
    ap.add_argument("--gl", default="swangle" if platform.system() == "Linux" else "angle"); ap.add_argument("--concurrency", default="2")
    ap.add_argument("--chrome", default=os.environ.get("CHROME", "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell"))
    a = ap.parse_args()
    story = json.load(open(a.story)); name = os.path.splitext(os.path.basename(a.story))[0]
    out = os.path.abspath(a.out or os.path.join(ENGINE, "out", name)); os.makedirs(out, exist_ok=True)
    vdir = os.path.abspath(a.voice_dir or os.path.join(out, "voice"))
    print(f"== {story.get('title', name)} -> {out}")
    if not a.voice_dir: voice(story, vdir)
    words = os.path.join(vdir, "words.json")
    run(["node", "tools/catalogue.mjs"])
    tl = os.path.join(out, "timeline.json")
    run([PY, os.path.join(HERE, "resolve.py"), os.path.abspath(a.story), words, tl])
    chrome = ["--browser-executable", a.chrome] if os.path.exists(a.chrome) else []
    env = dict(os.environ, GL=a.gl, TMPDIR=os.environ.get("TMPDIR", os.path.join(os.path.expanduser("~"), "rtmp")))
    os.makedirs(env["TMPDIR"], exist_ok=True)
    if a.stills:
        if chrome: env["CHROME"] = a.chrome
        else: env.pop("CHROME", None)
        run(["node", "tools/stills.mjs", tl, os.path.join(out, "stills", "s_"), a.stills, "0.5"], env=env)
        fr = [os.path.join(out, "stills", f"s_{int(x):04d}.png") for x in a.stills.split(",")]
        run([PY, os.path.join(HERE, "sheet.py"), os.path.join(out, "stills.jpg")] + fr)
        print(f"stills: {out}/stills.jpg"); return
    run([PY, os.path.join(HERE, "sound.py"), tl, words, os.path.join(vdir, "voice.wav"), os.path.join(out, "audio")])
    props = os.path.join(out, "props.json"); json.dump({"timeline": json.load(open(tl))}, open(props, "w"))
    video = os.path.join(out, "video.mp4")
    run(["npx", "remotion", "render", "src/index.ts", "Short", video, f"--props={props}", "--codec=h264", "--crf=16",
         f"--concurrency={a.concurrency}", "--timeout=300000", f"--gl={a.gl}"] + chrome, env=env)
    final = os.path.join(out, "final.mp4")
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-i", os.path.join(out, "audio", "mix.wav"), "-map", "0:v:0", "-map", "1:a:0",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-shortest", "-movflags", "+faststart", final])
    run([PY, os.path.join(REPO, "skills/ffmpeg-video/scripts/check.py"), final, "--size", "1080x1920", "--fps", "30", "--target", "-15"])
    print(f"done: {final}")

if __name__ == "__main__":
    main()
