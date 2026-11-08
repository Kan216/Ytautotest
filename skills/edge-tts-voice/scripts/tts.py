#!/usr/bin/env python3
"""Free narration with Microsoft Edge neural voices (edge-tts, no API key).

Writes, into --out (default ./voice):
  voice.mp3    raw edge-tts output
  voice.wav    48 kHz mono 24-bit PCM (what templates/audio/mix.py reads)
  words.json   [{"w": word, "s": start_sec, "e": end_sec}, ...] (what mix.py / story.ts are timed to)
  words.srt    one cue per word, handy for checking timings in a player

Usage:
  python tts.py --text-file SCRIPT.txt --voice en-US-GuyNeural --rate -5% --out voice
  python tts.py --text "Seventy-four soldiers knocked down an iron bridge." --out voice
  python tts.py --list en-          # list voices whose name starts with en-
"""
import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys

try:
    import edge_tts
except ImportError:
    sys.exit("edge-tts is not installed: pip install edge-tts")

TICKS = 10_000_000  # edge-tts offsets/durations are in 100 ns units


async def list_voices(prefix):
    for v in sorted(await edge_tts.list_voices(), key=lambda v: v["ShortName"]):
        if v["ShortName"].lower().startswith(prefix.lower()):
            print(f'{v["ShortName"]:<40} {v["Gender"]:<7} {", ".join(v.get("VoiceTag", {}).get("VoicePersonalities", []))}')


async def synth(text, voice, rate, pitch, volume, mp3_path):
    com = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, volume=volume, boundary="WordBoundary")
    words = []
    with open(mp3_path, "wb") as f:
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                s = chunk["offset"] / TICKS
                words.append({"w": chunk["text"], "s": round(s, 3), "e": round(s + chunk["duration"] / TICKS, 3)})
    return words


def srt_time(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group()
    src.add_argument("--text", help="text to speak")
    src.add_argument("--text-file", help="UTF-8 file with the narration (plain text, no stage directions)")
    src.add_argument("--list", metavar="PREFIX", help="list voices, e.g. en- or en-GB")
    ap.add_argument("--voice", default="en-US-GuyNeural")
    ap.add_argument("--rate", default="+0%", help="e.g. -10%% or +5%%")
    ap.add_argument("--pitch", default="+0Hz", help="e.g. -2Hz")
    ap.add_argument("--volume", default="+0%")
    ap.add_argument("--out", default="voice", help="output folder")
    ap.add_argument("--sr", type=int, default=48000, help="WAV sample rate (mix.py expects 48000)")
    a = ap.parse_args()

    if a.list is not None:
        asyncio.run(list_voices(a.list))
        return
    if not a.text and not a.text_file:
        ap.error("give --text, --text-file or --list")
    text = a.text if a.text else open(a.text_file, encoding="utf-8").read()
    text = " ".join(text.split())  # one paragraph keeps one steady read
    if not text:
        sys.exit("empty text")
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg is required to write voice.wav")

    os.makedirs(a.out, exist_ok=True)
    mp3 = os.path.join(a.out, "voice.mp3")
    wav = os.path.join(a.out, "voice.wav")
    words = asyncio.run(synth(text, a.voice, a.rate, a.pitch, a.volume, mp3))
    if not words:
        sys.exit("no word timings came back; check the voice name and your network")

    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mp3, "-ac", "1", "-ar", str(a.sr),
                    "-c:a", "pcm_s24le", wav], check=True)

    with open(os.path.join(a.out, "words.json"), "w", encoding="utf-8") as f:
        json.dump(words, f, indent=1, ensure_ascii=False)
    with open(os.path.join(a.out, "words.srt"), "w", encoding="utf-8") as f:
        for i, w in enumerate(words, 1):
            f.write(f"{i}\n{srt_time(w['s'])} --> {srt_time(w['e'])}\n{w['w']}\n\n")

    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav],
                               capture_output=True, text=True).stdout or 0)
    n = len(text.split())
    print(f"{wav}: {dur:.2f} s, {len(words)} timed words ({n} in text), {n / max(dur, 1e-6):.2f} words/s")
    print(f"voice={a.voice} rate={a.rate} pitch={a.pitch}")


if __name__ == "__main__":
    main()
