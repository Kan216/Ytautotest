#!/usr/bin/env python3
"""Offline voice-over with Kokoro (open-source neural TTS, Apache-2.0) and exact word timings.
Same outputs as skills/edge-tts-voice: voice.wav (48 kHz mono 24-bit), words.json [{"w","s","e"}], words.srt.
Used for this short because the cloud session could not reach the edge-tts server.

Word timings come from the model itself: the stock kokoro-v1.0.onnx computes per-phoneme frame durations
internally (/encoder/Clip_output_0) but does not output them. --export-timed writes a copy that exposes that tensor
as a `duration` output, which kokoro-onnx's create_timed() turns into phoneme start/end times; phonemes are grouped
into words at the spaces. Each sentence is synthesized on its own; its model times are mapped linearly onto the
measured speech onset/offset (the raw times run ~7-12 % long), and word edges snap to real pauses within 120 ms.
Models (Apache-2.0): github.com/thewh1teagle/kokoro-onnx releases, model-files-v1.0.

Usage:
  python kokoro_voice.py --export-timed --models /home/user/models      # once
  python kokoro_voice.py narration.txt --voice am_michael --models /home/user/models --out .
"""
import argparse, json, os, re, subprocess, sys
import numpy as np, soundfile as sf

ap = argparse.ArgumentParser()
ap.add_argument("text", nargs="?"); ap.add_argument("--voice", default="am_michael"); ap.add_argument("--speed", type=float, default=1.0)
ap.add_argument("--models", default="/home/user/models"); ap.add_argument("--out", default=".")
ap.add_argument("--lead", type=float, default=0.3, help="silence before the first word (s)")
ap.add_argument("--tail", type=float, default=0.8, help="silence after the last word (s)")
ap.add_argument("--export-timed", action="store_true")
a = ap.parse_args()
src, timed = (os.path.join(a.models, n) for n in ("kokoro-v1.0.onnx", "kokoro-v1.0.timed.onnx"))
if a.export_timed:
    import onnx
    m = onnx.load(src)
    m.graph.node.append(onnx.helper.make_node("Identity", ["/encoder/Clip_output_0"], ["duration"]))
    m.graph.output.append(onnx.helper.make_tensor_value_info("duration", onnx.TensorProto.FLOAT, None))
    onnx.save(m, timed); print("wrote", timed); sys.exit()
if not a.text: ap.error("narration text file required")

from kokoro_onnx import Kokoro
K = Kokoro(timed, os.path.join(a.models, "voices-v1.0.bin"))
assert K.has_timings
text = " ".join(open(a.text, encoding="utf-8").read().split())
sents = [m.strip() for m in re.findall(r"[^.!?]+[.!?]+|[^.!?]+$", text) if m.strip()]
ap_gap = 0.35  # silence between sentences (s)

def envelope(x, sr, win=0.01):
    n = max(1, int(win * sr)); return np.sqrt(np.convolve(x.astype(np.float64) ** 2, np.ones(n) / n, "same"))

pieces, words, t0, sr = [np.zeros(int(a.lead * 24000), np.float32)], [], a.lead, 24000
for s in sents:
    x, sr, tim = K.create_timed(s, voice=a.voice, speed=a.speed, lang="en-us", trim=False)
    env = envelope(x, sr); on = env > env.max() * 0.03
    v = np.flatnonzero(on); s_on, s_off = v[0] / sr, (v[-1] + 1) / sr
    # gaps inside the sentence (real pauses), for snapping
    idx = np.flatnonzero(np.diff(on.astype(int)))
    gaps = [(idx[i] / sr, idx[i + 1] / sr) for i in range(len(idx) - 1) if not on[idx[i] + 1] and (idx[i + 1] - idx[i]) / sr > 0.05]
    # phonemes -> words
    groups, cur = [], []
    for t in tim:
        if t.phoneme == " ":
            if cur: groups.append(cur); cur = []
        else: cur.append(t)
    if cur: groups.append(cur)
    alpha = lambda t: any(ch.isalpha() for ch in t.phoneme)
    groups = [g for g in groups if any(alpha(t) for t in g)]
    toks = s.split()
    if len(groups) != len(toks):
        sys.exit(f"{s!r}: phoneme groups {len(groups)} != words {len(toks)}")
    # linear map model time -> audio time: first phoneme -> speech onset, final mark -> speech end
    m0 = groups[0][0].start; m1 = tim[-1].start if not alpha(tim[-1]) else tim[-1].end
    k = (s_off - s_on) / (m1 - m0)
    T = lambda m: s_on + (m - m0) * k
    ws = []
    for w, g in zip(toks, groups):
        st = T(g[0].start); en = T(max(t.end for t in g if alpha(t)))
        ws.append([w, st, en])
    for i in range(len(ws)):  # snap starts to gap ends and ends to gap starts
        for g0, g1 in gaps:
            if abs(ws[i][1] - g1) < 0.12: ws[i][1] = g1
            if abs(ws[i][2] - g0) < 0.12: ws[i][2] = g0
    ws[0][1] = s_on; ws[-1][2] = s_off
    for i in range(len(ws) - 1):  # keep words in order after snapping
        if ws[i][2] > ws[i + 1][1]: ws[i][2] = ws[i + 1][1] = (ws[i][2] + ws[i + 1][1]) / 2 if ws[i][1] < ws[i + 1][1] else ws[i][2]
        ws[i + 1][1] = max(ws[i + 1][1], ws[i][1] + 0.04)
    seg = x[max(0, int(s_on * sr) - int(0.03 * sr)): int(s_off * sr) + int(0.05 * sr)]
    off = t0 - s_on + min(0.03, s_on)
    for w, st, en in ws:
        words.append({"w": w, "s": round(st + off, 3), "e": round(max(en, st + 0.04) + off, 3)})
    pieces += [seg.astype(np.float32), np.zeros(int(ap_gap * sr), np.float32)]
    t0 += len(seg) / sr + ap_gap
pieces[-1] = np.zeros(int(a.tail * sr), np.float32)
y = np.concatenate(pieces)
os.makedirs(a.out, exist_ok=True)
raw = os.path.join(a.out, "voice_raw.wav"); sf.write(raw, y, sr)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s24le",
                os.path.join(a.out, "voice.wav")], check=True)
os.remove(raw)
json.dump(words, open(os.path.join(a.out, "words.json"), "w"), indent=1)
ts = lambda t: (lambda ms: f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}")(int(round(t * 1000)))
with open(os.path.join(a.out, "words.srt"), "w") as f:
    for i, w in enumerate(words, 1): f.write(f"{i}\n{ts(w['s'])} --> {ts(w['e'])}\n{w['w']}\n\n")
d = len(y) / sr
print(f"{d:.2f} s, {len(words)} words, {len(words) / d:.2f} w/s, voice {a.voice} speed {a.speed}")
for w in words: print(f"{w['s']:6.2f} {w['e']:6.2f} {w['w']}")
