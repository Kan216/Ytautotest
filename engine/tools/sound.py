#!/usr/bin/env python3
"""Sound for any resolved timeline: kit ambience, one recipe per action id, transition whooshes, a music preset that
follows each shot's mood, then the mix under the voice. Everything is synthesized with the repo's DSP kit
(templates/audio), so there is nothing to download and no licences.

Usage: python tools/sound.py out/x/timeline.json voice/words.json voice/voice.wav out/x/audio
Writes mix.wav (48 kHz stereo, -15 LUFS, true peak <= -1 dBTP), stem_*.wav, cues.md.
"""
import json, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "templates", "audio"))
from dsp import (SR, TAU, ns, dbg, rng, lp, hp, bp, colored, fades, modal, pan, place, widen, make_ir, convolve_st,
                 integrated, true_peak, norm_to, read_wav, write_wav, smooth_noise)
from instruments import m2f, brass, snare, cymbal, timpani, pad, pluck, vibes, glock, brush
from sfx_gen import whoosh, water_bed, breeze, flag_flutter, wood_crack, rattle, bird_chirps, crickets


def wide(x, r, ms=11.0, amount=0.5):
    x = np.asarray(x, float); return x if x.ndim == 2 else widen(x, r, ms, amount)
def pk(x):
    x = np.asarray(x, float); return x / (np.abs(x).max() + 1e-12)
def mono(x):
    x = np.asarray(x, float); return x.mean(0) if x.ndim == 2 else x


# ================================================================ SFX generators
def boom(r, dist=0.0, size=1.0):
    n = ns(2.6); t = np.arange(n) / SR
    thump = np.sin(TAU * np.cumsum(34 + 46 * np.exp(-t / 0.09)) / SR) * np.exp(-t / (0.32 * size))
    blast = lp(colored(n, r, 1.0), 1400 - 900 * dist) * np.exp(-t / (0.16 * size)) * 1.4
    crack = hp(colored(n, r, 0.0), 1800) * np.exp(-t / 0.01) * (1 - 0.85 * dist)
    rumble = lp(colored(n, r, 1.6), 160) * np.exp(-t / (0.9 * size)) * 0.9
    y = 1.2 * thump + blast + 0.7 * crack + rumble
    y = np.tanh(1.6 * y / np.abs(y).max()) if dist < 0.5 else y / np.abs(y).max()
    return fades(y, 0.0005, 0.3)
def explosion(r):
    y = boom(r, 0.25, 1.4); deb = mono(rattle(1.6, r, density=45, heavy=True))
    deb = deb[: len(y)] if len(deb) >= len(y) else np.pad(deb, (0, len(y) - len(deb)))
    return y + 0.35 * deb / (np.abs(deb).max() + 1e-9)
def tick(r, tock=False):
    k = 0.72 if tock else 1.0
    return fades(modal(0.06, [(2600 * k, 1.0, 0.005), (4100 * k, 0.55, 0.0035), (6100 * k, 0.3, 0.002), (900 * k, 0.4, 0.012)], r), 0.0002, 0.01)
def bell(r, f=392.0):
    return fades(modal(3.2, [(f * 0.5, 0.5, 1.6), (f, 1.0, 1.3), (f * 1.19, 0.35, 0.8), (f * 1.5, 0.3, 0.7), (f * 2.0, 0.45, 0.6), (f * 2.74, 0.2, 0.35), (f * 5.4, 0.08, 0.15)], r), 0.002, 0.3)
def gull(r):
    n = ns(0.75); y = np.zeros(n)
    for t0, f0, f1, l in ((0.0, 2100, 1400, 0.26), (0.32, 1900, 1250, 0.34)):
        i0 = ns(t0); m = ns(l); tl = np.arange(m) / SR
        fm = f0 + (f1 - f0) * (tl / l) ** 0.7 + 60 * np.sin(TAU * 23 * tl)
        x = (np.sign(np.sin(TAU * np.cumsum(fm) / SR)) * 0.5 + np.sin(TAU * np.cumsum(fm) / SR)) * np.sin(np.pi * np.clip(tl / l, 0, 1)) ** 0.6
        y[i0:i0 + m] += bp(x, 900, 3800, 2)[: n - i0]
    return fades(pk(y), 0.005, 0.05)
def whistle_in(r, dur=0.42):
    n = ns(dur); t = np.arange(n) / SR
    return fades(np.sin(TAU * np.cumsum(1500 - 850 * (t / dur) ** 1.3) / SR) * (t / dur) ** 1.5 + 0.15 * bp(colored(n, r, 0.5), 800, 3000) * (t / dur), 0.01, 0.01)
def thud(r):
    n = ns(0.5); t = np.arange(n) / SR
    return fades(np.sin(TAU * np.cumsum(70 * np.exp(-t / 0.08) + 45) / SR) * np.exp(-t / 0.09) + 0.4 * lp(colored(n, r, 1.0), 600) * np.exp(-t / 0.05), 0.001, 0.05)
def crackle(dur, r, rate=26):
    n = ns(dur); y = np.zeros(n)
    for _ in range(int(dur * rate)):
        i = r.integers(0, max(1, n - 2000)); a = r.uniform(0.2, 1.0) ** 2
        y[i:i + 400] += a * hp(colored(400, r, 0.2), 900)[: len(y[i:i + 400])] * np.exp(-np.arange(len(y[i:i + 400])) / 60)
    return lp(y, 5000) + 0.25 * lp(colored(n, r, 1.2), 300) * (0.6 + 0.4 * smooth_noise(n, r, 1.5))
def roar(dur, r):
    """rocket engine: low rumble + crackle, swelling in"""
    n = ns(dur); t = np.arange(n) / SR
    y = lp(colored(n, r, 1.4), 220) * 1.4 + 0.5 * bp(colored(n, r, 0.6), 300, 2500) + 0.3 * mono(crackle(dur, r, 60))[:n]
    return fades(y * np.minimum(1, t / 0.8), 0.01, 0.6)
def hum(dur, r):
    n = ns(dur); t = np.arange(n) / SR
    return 0.6 * np.sin(TAU * 55 * t) * (0.7 + 0.3 * np.sin(TAU * 0.2 * t)) + 0.3 * np.sin(TAU * 110.4 * t) + 0.25 * lp(colored(n, r, 1.0), 400)
def traffic(dur, r):
    n = ns(dur)
    return lp(colored(n, r, 1.3), 500) * (0.7 + 0.3 * smooth_noise(n, r, 0.3)) + 0.15 * bp(colored(n, r, 0.4), 800, 3000) * smooth_noise(n, r, 0.8)
def horn(r):
    n = ns(0.45); t = np.arange(n) / SR
    return fades(lp(np.sign(np.sin(TAU * 410 * t)) + np.sign(np.sin(TAU * 517 * t)), 2500), 0.02, 0.08)
def trumpet_call(r):
    """elephant-like trumpet: nasal rising-falling squeal"""
    n = ns(0.9); t = np.arange(n) / SR; f = 520 + 380 * np.sin(np.pi * t / 0.9) ** 0.5
    x = np.sign(np.sin(TAU * np.cumsum(f) / SR)) * np.sin(np.pi * t / 0.9) ** 0.4
    return fades(bp(x, 400, 3500, 2) + 0.2 * bp(colored(n, r, 0.4), 600, 4000) * np.sin(np.pi * t / 0.9), 0.01, 0.1)
def roar_animal(r):
    n = ns(1.3); t = np.arange(n) / SR; f = 95 + 40 * np.sin(np.pi * t / 1.3)
    x = np.sign(np.sin(TAU * np.cumsum(f) / SR)) * np.sin(np.pi * t / 1.3) ** 0.6
    return fades(lp(x, 1200) + 0.6 * lp(colored(n, r, 0.8), 900) * np.sin(np.pi * t / 1.3), 0.02, 0.15)


# ================================================================ ambience per kit
def ambience(kit, dur, r):
    if kit == "harbour":
        y = 0.7 * np.asarray(water_bed(dur, r, close=0.5, slosh_rate=0.5)) + 0.5 * np.asarray(breeze(dur, r, level=0.8))
        for k in range(int(dur / 3)): place(y, pan(gull(r), r.uniform(-0.6, 0.6)), r.uniform(0.3, dur - 0.8), 0.08)
        return y
    if kit == "space": return wide(0.5 * hum(dur, r), r)
    if kit == "savanna":
        return 0.6 * np.asarray(breeze(dur, r, level=1.0)) + 0.3 * wide(mono(bird_chirps(dur, r, density=0.4)), r) + 0.15 * wide(mono(crickets(dur, r)), r)
    if kit == "city": return wide(0.6 * traffic(dur, r), r)
    if kit == "castle" or kit == "countryside":
        return 0.6 * np.asarray(breeze(dur, r, level=0.9)) + 0.35 * wide(mono(bird_chirps(dur, r, density=0.5)), r)
    if kit == "jungle":
        return 0.4 * wide(mono(bird_chirps(dur, r, density=1.2)), r) + 0.25 * wide(mono(crickets(dur, r, voices=5)), r) + 0.4 * np.asarray(water_bed(dur, r, close=0.3))
    if kit == "desert": return 0.9 * np.asarray(breeze(dur, r, level=1.3, gust=0.35, bright=600))
    if kit == "ocean":
        y = 0.8 * np.asarray(water_bed(dur, r, close=0.7, slosh_rate=0.4)) + 0.4 * np.asarray(breeze(dur, r, level=0.9))
        for k in range(int(dur / 3)): place(y, pan(gull(r), r.uniform(-0.6, 0.6)), r.uniform(0.3, max(0.4, dur - 0.8)), 0.08)
        return y
    if kit == "lab":
        n = ns(dur); t = np.arange(n) / SR; y = 0.4 * np.sin(TAU * 60 * t) + 0.2 * np.sin(TAU * 120 * t) + 0.15 * lp(colored(n, r, 1.0), 300)
        for k in range(int(dur * 1.5)):
            i = int(r.uniform(0, max(1, n - ns(0.12)))); f0 = r.choice([880, 1320, 1760]); m = ns(0.08)
            y[i:i + m] += 0.25 * np.sin(TAU * f0 * np.arange(m) / SR) * np.hanning(m)
        return wide(y, r)
    return np.asarray(breeze(dur, r, level=0.6))


# ================================================================ music presets
B = 0.5  # 120 bpm
SCALES = {"march": (50, [0, 3, 7, 10], [7, 9]), "space": (45, [0, 3, 7, 10, 14], [5, 7]), "nature": (55, [0, 2, 4, 7, 9], [5, 7]), "modern": (48, [0, 4, 7, 11], [5, 7])}
def music(tl, words, r, N, cues):
    preset = tl.get("music", "march"); root, chord, cad = SCALES.get(preset, SCALES["march"])
    fps = tl["fps"]; mus = np.zeros((2, N))
    def note(x, t, g, p=0.0): place(mus, pan(mono(x), p), t, g)
    def lead(m, l, vel=0.7):
        if preset == "march": return brass(m2f(m), l, vel, r, "stab")
        if preset == "space": return glock(m2f(m + 12), vel * 0.8, r, 1.4)
        if preset == "nature": return vibes(m2f(m), vel, r, 1.2)
        return pluck(m2f(m), vel, r, 0.6, 0.6)
    def bass(m, l, vel=0.7):
        return brass(m2f(m), l, vel, r, "tuba") if preset == "march" else pluck(m2f(m), vel, r, l + 0.3, 0.25)
    def perc(t, v):
        if preset in ("march", "modern"): note(snare(v, r), t, 0.33, 0.25)
        elif preset == "nature": note(brush(v, r), t, 0.6, 0.2)
        else: note(pluck(m2f(root + 24), v * 0.6, r, 0.15, 0.9), t, 0.25, 0.3)
    end_t = words[-1]["e"]
    for s in tl["shots"]:
        a, b, mood = s["a"] / fps, s["b"] / fps, s["mood"]
        cues.append((a, f"music {preset}: {mood}", "music"))
        if mood in ("hook", "calm", "build", "impact"):
            place(mus, pad([m2f(root - 12), m2f(root - 12 + chord[2]), m2f(root + chord[1]), m2f(root + chord[2])], b - a + 0.3, 0.45 if mood != "impact" else 0.3, r, att=0.6, rel=0.5), a, 0.45)
        if mood == "hook":
            for k in range(int((b - a - 0.3) / (B / 2))):
                note(pluck(m2f(root + chord[k % len(chord)]), 0.5, r, 0.6, 0.35), a + 0.3 + k * B / 2, 0.22, -0.2)
        if mood == "build":
            for k in range(int((b - a) / (B / 2))): perc(a + 0.2 + k * B / 2, [0.7, 0.3, 0.45, 0.3][k % 4])
            for k, iv in enumerate(chord[:3]):
                note(lead(root + 12 + iv, 0.2 if k < 2 else 0.6), a + 0.15 + 0.22 * k, 0.3, -0.15)
            for k, iv in enumerate((0, 3, 5, 7)): note(bass(root - 12 + iv, 0.2), a + 1.0 + 0.18 * k, 0.35)
        if mood == "impact":
            for act in tl["actions"]:
                if act["id"] in ("fire", "explode", "launch", "charge", "crash") and a <= act["f"] / fps < b:
                    note(timpani(m2f(root - 12 - (5 if act["id"] == "explode" else 0)), 1.0, r), act["f"] / fps, 0.9)
        if mood == "finale":
            t = a + 0.1
            for k in range(8):
                tb = t + k * 2 * B
                if tb > end_t - 0.5: break
                ch = [root + 5 + cad[k % 2] - 5 + x for x in (0, 4, 7)]
                for m in ch: note(lead(m, 2 * B * 0.9, 0.45) if preset != "march" else brass(m2f(m), 2 * B * 0.9, 0.55, r, "soft"), tb, 0.13)
                note(bass(ch[0] - 24, B * 0.8), tb, 0.3); perc(tb, 0.5); perc(tb + B, 0.3)
            maj = [root, root + 4, root + 7, root + 12, root + 16, root + 19]
            for m in maj: note(lead(m, 1.4, 0.8) if preset != "march" else brass(m2f(m), 1.4, 0.85, r, "horn" if m < root + 10 else "stab", rel=0.6), end_t - 0.04, 0.17, (m - root - 8) / 30)
            note(bass(root - 12, 1.4, 0.8), end_t - 0.04, 0.45)
            note(timpani(m2f(root - 12), 1.0, r, 2.6), end_t - 0.04, 1.0); place(mus, wide(cymbal(0.85, r, 3.0), r), end_t - 0.04, 0.45)
    for fl in tl["flashes"]:
        note(timpani(m2f(root - 12), 0.9, r), fl / fps, 0.9); place(mus, wide(cymbal(0.5, r, 2.0), r), fl / fps, 0.25)
    return mus + 0.25 * convolve_st(mus, make_ir(1.6, 7, hf=1.4))


# ================================================================ main
def main():
    tl_p, words_p, voice_p, out = sys.argv[1:5]
    tl, words = json.load(open(tl_p)), json.load(open(words_p))
    fps = tl["fps"]; DUR = tl["frames"] / fps; N = ns(DUR); r = rng(1896)
    sfx = np.zeros((2, N)); amb = np.zeros((2, N)); cues = []
    cue = lambda t, w, l="sfx": cues.append((t, w, l))
    # ambience per shot (crossfaded 0.1 s)
    for s in tl["shots"]:
        a, b = s["a"] / fps, s["b"] / fps
        x = np.asarray(ambience(s["kit"], b - a + 0.2, r)); x = fades(x, 0.1, 0.1)
        place(amb, x, max(0, a - 0.1), 1.0); cue(a, f"ambience: {s['kit']}", "amb")
    for fl in tl["flashes"]:
        place(sfx, pk(wide(whoosh(0.7, r, peak=0.45, f_lo=300, f_hi=3200), r)), fl / fps - 0.45, 0.3); cue(fl / fps - 0.45, "whoosh into the flash")
    shot_start = {s["id"]: s["a"] / fps for s in tl["shots"]}
    for act in tl["actions"]:
        t0, aid, at, p = act["f"] / fps, act["id"], act["at"], act.get("p", {})
        t1 = act.get("f1", act["f"] + 30) / fps; st = float(p.get("stagger", 0.12))
        many = any(k in at for k in ("guns", "fleet", "line", "army", "battery"))
        if aid == "fire" and not many:
            place(sfx, pk(wide(boom(r, 0.0, 1.1), r, 9, 0.6)), t0, 0.9); cue(t0, f"fire (close) at {at}")
        elif aid == "fire":
            for k in range(int(p.get("count", 15))):
                place(sfx, pan(pk(boom(r, 0.6, 1.0)), r.uniform(-0.6, 0.6)), t0 + k * max(st, 0.04) + r.uniform(0, 0.05), 0.12)
            cue(t0, f"fire ripple (distant) at {at}")
        elif aid == "explode":
            place(sfx, pan(pk(whistle_in(r)), 0.2), t0 - 0.42, 0.18)
            for k in range(int(p.get("count", 4))):
                place(sfx, pan(pk(explosion(r)), r.uniform(-0.4, 0.5)), t0 + k * st, [0.55, 0.36, 0.32, 0.28, 0.25, 0.22][min(k, 5)])
            place(amb, wide(crackle(max(0.5, DUR - t0), r), r), t0 + 0.3, 0.16); cue(t0, f"explosions + fire crackle at {at}")
        elif aid == "smoke":
            place(amb, wide(crackle(max(0.5, DUR - t0), r), r), t0, 0.12); cue(t0, f"fire crackle at {at}", "amb")
        elif aid == "dust":
            place(sfx, pan(pk(thud(r)), 0.0), t0, 0.35); place(sfx, pk(wide(whoosh(0.4, r, peak=0.1, f_lo=200, f_hi=900), r)), t0, 0.12); cue(t0, f"dust thump at {at}")
        elif aid == "kick":
            place(sfx, pan(pk(thud(r)), 0.0), t0, 0.4); cue(t0, "impact thump")
        elif aid == "clock-sweep":
            a0 = shot_start.get(act.get("shot"), 0) + 0.25; tk, i = a0, 0
            while tk < t0: place(sfx, pan(pk(tick(r, i % 2 == 1)), -0.1), tk, 0.22); tk += 1.0; i += 1
            tk = t0
            while tk < t1:
                place(sfx, pan(pk(tick(r, i % 2 == 1)), 0.0), tk, 0.1); i += 1
                u = (tk - t0) / max(0.01, t1 - t0); tk += 1 / (4 + 26 * np.sin(np.pi * min(1, u)) ** 0.7)
            place(sfx, pk(wide(bell(r), r, 13, 0.7)), t1 - 0.02, 0.45); cue(a0, "clock ticks, ratchet sweep, bell")
        elif aid == "flag-fall":
            place(sfx, pk(wide(flag_flutter(0.5, r), r)), t0 - 0.3, 0.15)
            place(sfx, pan(pk(mono(wood_crack(r))), 0.3), t0 + 0.13, 0.35); place(sfx, pk(wide(whoosh(0.6, r, peak=0.4, f_lo=250, f_hi=1200), r)), t0 + 0.25, 0.15)
            place(sfx, pan(pk(thud(r)), 0.3), t0 + 0.95, 0.3); cue(t0, "flagpole snaps, falls, lands")
        elif aid == "launch":
            place(sfx, pk(wide(roar(max(1.0, t1 - t0 + 2.0), r), r)), t0, 0.55); cue(t0, "rocket roar")
        elif aid in ("trumpet", "elephant-call"):
            place(sfx, pan(pk(trumpet_call(r)), 0.2), t0, 0.4); cue(t0, "elephant trumpet")
        elif aid in ("roar", "lion-roar"):
            place(sfx, pan(pk(roar_animal(r)), 0.0), t0, 0.5); cue(t0, "lion roar")
        elif aid in ("charge", "stampede", "run"):
            for k in range(int(max(1, (t1 - t0) * 8))): place(sfx, pan(pk(thud(r)), r.uniform(-0.5, 0.5)), t0 + k / 8 + r.uniform(0, 0.03), 0.18)
            cue(t0, "running thuds")
        elif aid == "drive":
            place(sfx, pk(wide(lp(colored(ns(max(1.0, t1 - t0 + 1.5)), r, 1.2), 300) * (0.7 + 0.3 * np.sin(TAU * 18 * np.arange(ns(max(1.0, t1 - t0 + 1.5))) / SR)), r)), t0, 0.25); cue(t0, f"engine at {at}")
        elif aid == "fly":
            place(sfx, pk(wide(whoosh(2.5, r, peak=1.2, f_lo=200, f_hi=1400, tail=0.8), r)), t0, 0.2); cue(t0, f"fly-by at {at}")
        elif aid == "drawbridge":
            for k in range(14): place(sfx, pan(pk(tick(r, k % 2 == 1)), 0.1), t0 + k * 0.17, 0.25)
            place(sfx, pan(pk(thud(r)), 0.0), t0 + 2.5, 0.5); cue(t0, "drawbridge chain rattle + landing thud")
        elif aid == "spark":
            for k in range(6):
                n = ns(0.15); place(sfx, pan(pk(hp(colored(n, r, 0.0), 2000) * np.exp(-np.arange(n) / ns(0.03))), r.uniform(-0.3, 0.3)), t0 + k * 0.18, 0.35)
            cue(t0, "electric zaps")
        elif aid == "bubble":
            for k in range(20):
                f0 = r.uniform(400, 1200); n = ns(0.06); place(sfx, pan(np.sin(TAU * np.cumsum(np.linspace(f0, f0 * 1.8, n)) / SR) * np.hanning(n), r.uniform(-0.4, 0.4)), t0 + k * 0.08, 0.15)
            cue(t0, "bubbling")
        elif aid == "spout":
            place(sfx, pk(wide(whoosh(1.4, r, peak=0.2, f_lo=500, f_hi=4000, air=0.5), r)), t0, 0.35); cue(t0, "whale spout")
        elif aid == "dive":
            place(sfx, pk(wide(water_bed(2.0, r, close=1.2, slosh_rate=2.0), r)), t0 + 0.5, 0.4); cue(t0, "splash dive")
        elif aid in ("moo", "bark"):
            n = ns(0.9 if aid == "moo" else 0.25); tt_ = np.arange(n) / SR; f = (130 if aid == "moo" else 420) * (1 + 0.15 * np.sin(np.pi * tt_ / tt_[-1]))
            x = np.sign(np.sin(TAU * np.cumsum(f) / SR)) * np.sin(np.pi * tt_ / tt_[-1]) ** 0.5
            for k in range(1 if aid == "moo" else 2): place(sfx, pan(pk(lp(x, 1500 if aid == "moo" else 3000)), 0.1), t0 + k * 0.35, 0.3)
            cue(t0, aid)
        elif aid == "open":
            place(sfx, pan(pk(mono(wood_crack(r))), 0.0), t0, 0.2); place(sfx, pk(wide(bell(r, 1046), r)), t0 + 0.2, 0.2); cue(t0, "chest creak + sparkle")
        elif aid in ("honk", "traffic-jam"):
            for k in range(3): place(sfx, pan(pk(horn(r)), r.uniform(-0.6, 0.6)), t0 + k * 0.35, 0.18)
            cue(t0, "car horns")
        else:
            cue(t0, f"(no sound recipe for '{aid}')")
    sfx = sfx + 0.18 * convolve_st(sfx, make_ir(2.2, 9, hf=1.2))
    amb = lp(amb, 9000)
    mus = music(tl, words, r, N, cues)
    # ---- mix: voice on top, music bed ducked under words, SFX step back under words ----
    v, vsr = read_wav(voice_p); assert vsr == SR, vsr
    x = v.mean(0); vm = np.zeros(N); vm[: min(N, len(x))] = x[:N]
    voice = np.stack([vm, vm])
    spk = np.zeros(N)
    for w in words: spk[ns(w["s"] - 0.08): ns(w["e"] + 0.15)] = 1
    k = ns(0.12); spk = np.convolve(spk, np.ones(k) / k, "same")
    voice = norm_to(voice, -16.0, "integrated")
    music_ = norm_to(mus, -25.0, "integrated") * dbg(-3.0 * spk)
    fx = (norm_to(sfx, -19.0, "integrated") + norm_to(amb, -36.0, "integrated")) * dbg(-7.0 * spk)
    mix = voice + music_ + fx
    g = dbg(-15.0 - integrated(mix)); mix *= g
    lim = 10 ** (-1.9 / 20)
    mix = np.where(np.abs(mix) > lim * 0.8, np.sign(mix) * (lim * 0.8 + (lim * 0.2) * np.tanh((np.abs(mix) - lim * 0.8) / (lim * 0.2))), mix)
    mix = fades(mix, 0.0, 0.6)
    os.makedirs(out, exist_ok=True)
    write_wav(os.path.join(out, "mix.wav"), mix)
    for n_, s_ in (("voice", voice * g), ("music", music_ * g), ("sfx", fx * g)): write_wav(os.path.join(out, f"stem_{n_}.wav"), s_)
    I, TP = integrated(mix), true_peak(mix)
    with open(os.path.join(out, "cues.md"), "w") as f:
        f.write(f"# Sound cues: {tl['title']}\n\nAll synthesized by tools/sound.py (templates/audio DSP kit), no downloads.\n\n")
        f.write(f"Mix {I:.1f} LUFS, true peak {TP:.1f} dBTP, {DUR:.2f} s. Voice -16 LUFS ref; music -9 LU (ducked 3 dB under words); SFX -3 LU (-7 dB under words); ambience -20 LU.\n\n")
        f.write("| time (s) | cue | layer |\n|---|---|---|\n")
        for t_, w_, l_ in sorted(cues): f.write(f"| {t_:.2f} | {w_} | {l_} |\n")
    print(f"{out}/mix.wav: {DUR:.2f} s, {I:.1f} LUFS, TP {TP:.1f} dBTP, {len(cues)} cues")


if __name__ == "__main__":
    main()
