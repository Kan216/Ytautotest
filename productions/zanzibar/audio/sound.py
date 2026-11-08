#!/usr/bin/env python3
"""Sound for "The 38-Minute War": synthesized SFX + an original short brass/drum cue + the voice, mixed and mastered.
Every event is timed to voice/words.json with the same beat formulas as src/zanzibar/story.ts, so picture and sound
stay locked. All sounds are generated here with the repo's own DSP kit (templates/audio: dsp, instruments, sfx_gen);
nothing is downloaded, so there are no third-party licences.

Writes audio/mix.wav (48 kHz stereo 24-bit, mastered to -15 LUFS, true peak <= -1 dBTP), stem_*.wav and cues.md.
Usage: python audio/sound.py   (from productions/zanzibar)
"""
import json, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "..", "..", "templates", "audio"))
from dsp import (SR, TAU, ns, tt, dbg, rng, lp, hp, bp, colored, fades, modal, pan, st, place, widen, make_ir,
                 convolve_st, integrated, momentary_max, true_peak, norm_to, read_wav, write_wav, smooth_noise)
from instruments import m2f, brass, snare, cymbal, timpani, pad, pluck
from sfx_gen import whoosh, water_bed, breeze, flag_flutter, wood_crack, rattle

FPS = 30
W = json.load(open(os.path.join(ROOT, "voice", "words.json")))
def at(word, n=0, edge="s"):
    hits = [w for w in W if "".join(c for c in w["w"].lower() if c.isalpha() or c == "-") == word]
    return hits[n][edge]
fr = lambda t: round(t * FPS)
T = dict(ever_end=at("ever", 0, "e"), sweep0=at("lasted"), sweep1=at("minutes", 0, "e"), britain=at("britain"), zanzibar=at("zanzibar"),
         fire=at("british") + 0.05, ripple=at("won"), hit=at("quickly") - 0.1, ever=at("ever"))
CUT = [fr(at("in", 1)) - 4, fr(T["zanzibar"]) - 2, fr(at("the", 1)) - 3, fr(T["hit"]) - 2, fr(at("that")) + 2]
CUT = [c / FPS for c in CUT]
DUR = fr(W[-1]["e"] + 1.2) / FPS
N = ns(DUR)
cues = []
def wide(x, r, ms=11.0, amount=0.5):
    x = np.asarray(x, float)
    return x if x.ndim == 2 else widen(x, r, ms, amount)
def pk(x):
    x = np.asarray(x, float)
    return x / (np.abs(x).max() + 1e-12)
def mono(x):
    x = np.asarray(x, float)
    return x.mean(0) if x.ndim == 2 else x
def cue(t, what, layer): cues.append((t, what, layer))

# ================================================================ SFX generators
def boom(r, dist=0.0, size=1.0):
    """cannon: pitch-dropping body thump + powder blast noise + crack, distance = darker, less crack"""
    d = 2.6; n = ns(d); t = np.arange(n) / SR
    f = 34 + 46 * np.exp(-t / 0.09)
    thump = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / (0.32 * size))
    blast = lp(colored(n, r, 1.0), 1400 - 900 * dist) * np.exp(-t / (0.16 * size)) * 1.4
    crack = hp(colored(n, r, 0.0), 1800) * np.exp(-t / 0.01) * (1 - 0.85 * dist)
    rumble = lp(colored(n, r, 1.6), 160) * np.exp(-t / (0.9 * size)) * 0.9
    y = 1.2 * thump + blast + 0.7 * crack + rumble
    y = np.tanh(1.6 * y / np.abs(y).max()) if dist < 0.5 else y / np.abs(y).max()
    return fades(y, 0.0005, 0.3)
def explosion(r):
    y = boom(r, 0.25, 1.4)
    deb = mono(rattle(1.6, r, density=45, heavy=True))
    deb = deb[: len(y)] if len(deb) >= len(y) else np.pad(deb, (0, len(y) - len(deb)))
    return y + 0.35 * deb / (np.abs(deb).max() + 1e-9)
def tick(r, tock=False, v=1.0):
    k = 0.72 if tock else 1.0
    y = modal(0.06, [(2600 * k, 1.0, 0.005), (4100 * k, 0.55, 0.0035), (6100 * k, 0.3, 0.002), (900 * k, 0.4, 0.012)], r)
    return fades(y * v, 0.0002, 0.01)
def bell(r, f=392.0):
    y = modal(3.2, [(f * 0.5, 0.5, 1.6), (f, 1.0, 1.3), (f * 1.19, 0.35, 0.8), (f * 1.5, 0.3, 0.7), (f * 2.0, 0.45, 0.6), (f * 2.74, 0.2, 0.35), (f * 5.4, 0.08, 0.15)], r)
    return fades(y, 0.002, 0.3)
def gull(r):
    """herring-gull style cry: two falling squeals with a nasal formant"""
    d = 0.75; n = ns(d); t = np.arange(n) / SR; y = np.zeros(n)
    for t0, f0, f1, l in ((0.0, 2100, 1400, 0.26), (0.32, 1900, 1250, 0.34)):
        i0 = ns(t0); m = ns(l); tl = np.arange(m) / SR
        fm = f0 + (f1 - f0) * (tl / l) ** 0.7 + 60 * np.sin(TAU * 23 * tl)
        x = np.sign(np.sin(TAU * np.cumsum(fm) / SR)) * 0.5 + np.sin(TAU * np.cumsum(fm) / SR)
        x *= np.sin(np.pi * np.clip(tl / l, 0, 1)) ** 0.6
        y[i0:i0 + m] += bp(x, 900, 3800, 2)[: n - i0]
    return fades(y / (np.abs(y).max() + 1e-9), 0.005, 0.05)
def whistle_in(r, dur=0.42):
    n = ns(dur); t = np.arange(n) / SR
    f = 1500 - 850 * (t / dur) ** 1.3
    y = np.sin(TAU * np.cumsum(f) / SR) * (t / dur) ** 1.5 + 0.15 * bp(colored(n, r, 0.5), 800, 3000) * (t / dur)
    return fades(y, 0.01, 0.01)
def thud(r):
    n = ns(0.5); t = np.arange(n) / SR
    return fades(np.sin(TAU * np.cumsum(70 * np.exp(-t / 0.08) + 45) / SR) * np.exp(-t / 0.09) + 0.4 * lp(colored(n, r, 1.0), 600) * np.exp(-t / 0.05), 0.001, 0.05)
def crackle(dur, r, rate=26):
    n = ns(dur); y = np.zeros(n); k = int(dur * rate)
    for _ in range(k):
        i = r.integers(0, n - 2000); a = r.uniform(0.2, 1.0) ** 2
        y[i:i + 400] += a * hp(colored(400, r, 0.2), 900) * np.exp(-np.arange(400) / 60)
    return lp(y, 5000) + 0.25 * lp(colored(n, r, 1.2), 300) * (0.6 + 0.4 * smooth_noise(n, r, 1.5))

# ================================================================ SFX timeline
r = rng(1896)
sfx = np.zeros((2, N)); amb = np.zeros((2, N))
# clock: tick-tock every second until the sweep, a ratchet of ticks while the hands race, then the bell at 9:40
tk = 0.25; i = 0
while tk < T["sweep0"]:
    place(sfx, pan(pk(tick(r, i % 2 == 1)), -0.1), tk, 0.22); tk += 1.0; i += 1
cue(0.25, "clock tick-tock, 1 per second", "sfx")
tk = T["sweep0"]; rate = 4.0
while tk < T["sweep1"]:
    place(sfx, pan(pk(tick(r, i % 2 == 1)), 0.0), tk, 0.1); i += 1
    u = (tk - T["sweep0"]) / (T["sweep1"] - T["sweep0"]); rate = 4 + 26 * np.sin(np.pi * min(1, u)) ** 0.7; tk += 1 / rate
cue(T["sweep0"], "clock ratchet (hands sweep 9:02 -> 9:40)", "sfx")
place(sfx, pk(wide(bell(r), r, 13, 0.7)), T["sweep1"] - 0.02, 0.45); cue(T["sweep1"], "clock bell (9:40)", "sfx")
place(sfx, pk(wide(whoosh(0.7, r, peak=0.45, f_lo=300, f_hi=3200), r)), CUT[0] - 0.45, 0.3); cue(CUT[0] - 0.45, "whoosh into the white flash", "sfx")
# harbour ambience from the flash on: water, breeze, gulls; quieter under the battle
a0 = CUT[0]; seg = DUR - a0
wb = water_bed(seg, r, close=0.5, slosh_rate=0.5); bz = breeze(seg, r, level=0.8)
place(amb, wb, a0, 0.7); place(amb, bz, a0, 0.5)
place(amb, wide(breeze(CUT[0], r, level=1.0), r), 0.0, 0.45)  # high up at the clock: wind only
for tg, p in ((a0 + 0.4, -0.6), (a0 + 1.6, 0.5), (CUT[1] + 0.3, -0.3), (CUT[4] + 0.6, 0.6), (CUT[4] + 2.4, -0.5)):
    place(sfx, pan(pk(gull(r)), p), tg, 0.07); cue(tg, "gull cry", "sfx")
cue(a0, "harbour bed: water lapping + breeze", "amb")
fl = flag_flutter(CUT[2] - CUT[1], r); place(sfx, pk(wide(fl, r)), CUT[1], 0.2); cue(CUT[1], "flag flutter (palace flag)", "sfx")
fl2 = flag_flutter(0.5, r); place(sfx, pk(wide(fl2, r)), CUT[3], 0.15)
# battle
place(sfx, pk(wide(boom(r, 0.0, 1.1), r, 9, 0.6)), T["fire"], 0.9); cue(T["fire"], "deck gun fires (close)", "sfx")
for si in range(5):
    for k in range(5):
        t0 = T["ripple"] + 0.08 * k + 0.15 * abs(si - 2) + (-0.1 if si == 2 else 0.2)
        d = 0.55 + 0.1 * abs(si - 2)
        place(sfx, pan(pk(boom(r, d, 1.0)), (si - 2) * 0.35), t0, 0.13 * (1 - 0.12 * abs(si - 2)))
cue(T["ripple"], "broadside ripple: 25 distant guns along the line", "sfx")
place(sfx, pan(pk(whistle_in(r)), 0.2), T["hit"] - 0.42, 0.18); cue(T["hit"] - 0.42, "incoming shell whistle", "sfx")
for k, dt in enumerate((0, 0.12, 0.3, 0.45)):
    place(sfx, pan(pk(explosion(r)), [-0.3, 0.2, 0.5, -0.1][k]), T["hit"] + dt, [0.55, 0.36, 0.32, 0.28][k])
cue(T["hit"], "palace hits: 4 explosions + debris", "sfx")
place(sfx, pan(pk(mono(wood_crack(r))), 0.3), T["hit"] + 0.13, 0.35); cue(T["hit"] + 0.13, "flagpole snaps", "sfx")
place(sfx, pk(wide(whoosh(0.6, r, peak=0.4, f_lo=250, f_hi=1200), r)), T["hit"] + 0.25, 0.15)
place(sfx, pan(pk(thud(r)), 0.3), T["hit"] + 0.95, 0.3); cue(T["hit"] + 0.95, "flagpole lands", "sfx")
place(amb, wide(crackle(DUR - CUT[4], r), r), CUT[4], 0.16); cue(CUT[4], "distant fire crackle under the smoke", "amb")
amb = lp(amb, 9000)

# ================================================================ music (original cue, D minor -> D major, 120 bpm)
mus = np.zeros((2, N)); B = 0.5
def note(fn, t, gain, p=0.0): place(mus, pan(mono(fn), p), t, gain)
# A: clock - quiet plucked ostinato + low pad
pl = [50, 57, 53, 57]
t0 = 0.3
for k in range(int((CUT[0] - t0) / (B / 2))):
    note(pluck(m2f(pl[k % 4]), 0.5, r, 0.6, 0.35), t0 + k * B / 2, 0.22 + 0.06 * (k % 4 == 0), -0.2)
place(mus, pad([m2f(38), m2f(45), m2f(50), m2f(53)], CUT[0] + 0.3, 0.5, r, att=1.2, rel=0.6), 0.0, 0.5)
# accent on the flash
note(timpani(m2f(38), 0.9, r), CUT[0], 0.9); place(mus, wide(cymbal(0.5, r, 2.0), r), CUT[0], 0.25)
# B: harbour - snare march, fanfare on "Britain", answer on "Zanzibar"
for k in range(int((CUT[2] - CUT[0]) / (B / 2))):
    t = CUT[0] + 0.25 + k * B / 2
    v = [0.7, 0.3, 0.45, 0.3][k % 4]
    note(snare(v, r), t, 0.35, 0.25)
for k, (m, l) in enumerate(((62, 0.2), (66, 0.2), (69, 0.6))):
    note(brass(m2f(m), l, 0.75, r, "stab"), T["britain"] - 0.03 + 0.22 * k, 0.32, -0.15)
    note(brass(m2f(m - 12), l, 0.7, r, "horn"), T["britain"] - 0.03 + 0.22 * k, 0.22, 0.15)
for k, m in enumerate((38, 41, 43, 45)):
    note(brass(m2f(m), 0.2, 0.7, r, "tuba"), T["zanzibar"] + 0.18 * k, 0.4)
place(mus, pad([m2f(50), m2f(57), m2f(62), m2f(65)], CUT[2] - CUT[0] + 0.4, 0.4, r, att=0.5, rel=0.5), CUT[0], 0.35)
# C: guns - stop time: timpani on the shots, low drone
note(timpani(m2f(38), 1.0, r), T["fire"], 1.0); note(timpani(m2f(33), 0.9, r), T["hit"], 1.0)
place(mus, pad([m2f(38), m2f(45)], CUT[4] - CUT[2] + 0.3, 0.35, r, att=0.3, rel=0.4), CUT[2], 0.4)
# D: the verdict - D major cadence, big chord on "ever!"
t = CUT[4] + 0.1
for k, ch in enumerate(([55, 59, 62], [57, 61, 64], [55, 59, 62], [57, 61, 64])):  # G A G A
    tb = t + k * 2 * B
    if tb > T["ever_end"] - 0.5: break
    for m in ch: note(brass(m2f(m), 2 * B * 0.9, 0.55, r, "soft"), tb, 0.13)
    note(brass(m2f(ch[0] - 24), B * 0.8, 0.6, r, "tuba"), tb, 0.32); note(brass(m2f(ch[0] - 17), B * 0.8, 0.5, r, "tuba"), tb + B, 0.25)
    note(snare(0.5, r), tb, 0.25, 0.25); note(snare(0.3, r), tb + B, 0.2, 0.25)
for m in (50, 54, 57, 62, 66, 69):
    note(brass(m2f(m), 1.4, 0.85, r, "horn" if m < 60 else "stab", rel=0.6), T["ever_end"] - 0.04, 0.17, (m - 60) / 30)
note(brass(m2f(38), 1.4, 0.8, r, "tuba", rel=0.6), T["ever_end"] - 0.04, 0.45)
note(timpani(m2f(38), 1.0, r, 2.6), T["ever_end"] - 0.04, 1.0); place(mus, wide(cymbal(0.85, r, 3.0), r), T["ever_end"] - 0.04, 0.45)
cue(0.3, "music A: plucked D-minor ostinato + pad", "music"); cue(CUT[0], "music B: snare march, fanfare on 'Britain', tuba answer", "music")
cue(CUT[2], "music C: stop time, timpani on the gun and the hit", "music"); cue(CUT[4], "music D: G-A cadence -> D major chord on 'ever!'", "music")
hall = make_ir(1.6, 7, hf=1.4)
mus = mus + 0.25 * convolve_st(mus, hall)
sfx = sfx + 0.18 * convolve_st(sfx, make_ir(2.2, 9, hf=1.2))  # open-air slap across the harbour

# ================================================================ mix
v, vsr = read_wav(os.path.join(ROOT, "voice", "voice.wav")); assert vsr == SR
vm = np.zeros(N); x = v.mean(0); vm[: min(N, len(x))] = x[:N]
voice = st(vm)
spk = np.zeros(N)  # duck the music while words are spoken
for w in W: spk[ns(w["s"] - 0.08): ns(w["e"] + 0.15)] = 1
k = ns(0.12); spk = np.convolve(spk, np.ones(k) / k, "same")
duck = dbg(-3.0 * spk)
voice = norm_to(voice, -16.0, "integrated")
music = norm_to(mus, -16.0 - 12.0 + 3.0, "integrated") * duck   # standard: music +3 dB over a -12 LU bed
sduck = dbg(-7.0 * spk)  # SFX also step back under words; the cannon transients stay above
fx = (norm_to(sfx, -16.0 - 6.0 + 3.0, "integrated") + norm_to(amb, -16.0 - 20.0, "integrated")) * sduck  # standard: SFX -6 dB
mix = voice + music + fx
g = dbg(-15.0 - integrated(mix)); mix *= g; stems = {"voice": voice * g, "music": music * g, "sfx": fx * g}
tp = true_peak(mix)
if tp > -1.0:  # soft limit the peaks (only the cannon transients), then re-measure
    lim = 10 ** (-1.9 / 20)
    mix = np.where(np.abs(mix) > lim * 0.8, np.sign(mix) * (lim * 0.8 + (lim * 0.2) * np.tanh((np.abs(mix) - lim * 0.8) / (lim * 0.2))), mix)
mix = fades(mix, 0.0, 0.6)
write_wav(os.path.join(HERE, "mix.wav"), mix)
for n_, s_ in stems.items(): write_wav(os.path.join(HERE, f"stem_{n_}.wav"), s_)
I, TP = integrated(mix), true_peak(mix)
with open(os.path.join(HERE, "cues.md"), "w") as f:
    f.write("# Sound cues: The 38-Minute War\n\nAll sounds synthesized in `audio/sound.py` with the repo's own DSP kit "
            "(`templates/audio`). Nothing downloaded, no third-party licences.\n\n")
    f.write(f"Mix: {I:.1f} LUFS integrated, true peak {TP:.1f} dBTP, {DUR:.2f} s, 48 kHz stereo.\n")
    f.write("Levels: voice -16 LUFS reference; music bed -9 LU (standard +3 dB), ducked 3 dB under words; SFX -3 LU (standard -6 dB); ambience -20 LU.\n\n")
    f.write("| time (s) | cue | layer |\n|---|---|---|\n")
    for t_, w_, l_ in sorted(cues): f.write(f"| {t_:.2f} | {w_} | {l_} |\n")
print(f"mix.wav: {DUR:.2f} s, {I:.1f} LUFS, TP {TP:.1f} dBTP; cuts {[round(c, 2) for c in CUT]}")
