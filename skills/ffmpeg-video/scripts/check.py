#!/usr/bin/env python3
"""Quick delivery check for a video (or audio) file with ffprobe + ffmpeg.

Prints resolution, fps, codec, pixel format, duration, every stream, and the audio loudness
(integrated LUFS, loudness range, true peak). Flags common problems:
  - no audio / silent audio track (Remotion renders one)
  - more than one audio stream
  - not yuv420p (some players/phones show black or wrong colours)
  - odd width/height, variable frame rate, missing faststart
  - loudness far from the target (default -14 LUFS for YouTube; mix.py masters to -15)

Usage:
  python check.py final.mp4 [--target -14] [--size 1440x2560] [--fps 30]
Exit code 1 if any problem was flagged.
"""
import argparse
import json
import re
import subprocess
import sys


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(path):
    r = run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path])
    if r.returncode:
        sys.exit(r.stderr.strip() or f"ffprobe failed on {path}")
    return json.loads(r.stdout)


def loudness(path, idx):
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-map", f"0:{idx}",
             "-af", "ebur128=peak=true", "-f", "null", "-"])
    tail = r.stderr[r.stderr.rfind("Summary:"):]
    get = lambda key: (lambda m: float(m.group(1)) if m else None)(re.search(key + r":\s+(-?[\d.]+|-inf)", tail))
    return get(r"I"), get(r"LRA"), get(r"Peak")


def faststart(path):
    with open(path, "rb") as f:
        head = f.read(1 << 16)
    m, d = head.find(b"moov"), head.find(b"mdat")
    return m != -1 and (d == -1 or m < d)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--target", type=float, default=-14.0, help="integrated loudness target, LUFS")
    ap.add_argument("--size", help="expected WxH, e.g. 1440x2560")
    ap.add_argument("--fps", type=float, help="expected frame rate, e.g. 30")
    a = ap.parse_args()

    info = probe(a.file)
    fmt = info["format"]
    problems = []
    print(f"{a.file}: {float(fmt.get('duration', 0)):.3f} s, {int(fmt.get('size', 0)) / 1e6:.1f} MB, "
          f"{int(fmt.get('bit_rate', 0)) / 1e6:.1f} Mb/s, container {fmt.get('format_name')}")

    vs = [s for s in info["streams"] if s["codec_type"] == "video" and not s.get("disposition", {}).get("attached_pic")]
    aus = [s for s in info["streams"] if s["codec_type"] == "audio"]

    for s in vs:
        w, h = s["width"], s["height"]
        num, den = map(int, s.get("avg_frame_rate", "0/1").split("/"))
        rn, rd = map(int, s.get("r_frame_rate", "0/1").split("/"))
        fps = num / den if den else 0
        rfps = rn / rd if rd else 0
        print(f"  video #{s['index']}: {s['codec_name']} {s.get('profile', '')} {w}x{h} {s.get('pix_fmt')} "
              f"{fps:.3f} fps, {s.get('nb_frames', '?')} frames")
        if s.get("pix_fmt") not in ("yuv420p", "yuvj420p"):
            problems.append(f"pixel format {s.get('pix_fmt')}: add -pix_fmt yuv420p for phones/YouTube")
        if w % 2 or h % 2:
            problems.append(f"odd size {w}x{h}: H.264 needs even width and height")
        if fps and rfps and abs(fps - rfps) > 0.01:
            problems.append(f"variable frame rate ({fps:.3f} avg vs {rfps:.3f}): add -r {round(rfps)} or -fps_mode cfr")
        if a.size and f"{w}x{h}" != a.size:
            problems.append(f"size {w}x{h}, expected {a.size}")
        if a.fps and abs(fps - a.fps) > 0.01:
            problems.append(f"{fps:.3f} fps, expected {a.fps:g}")

    if not aus:
        problems.append("no audio stream")
    if len(aus) > 1:
        problems.append(f"{len(aus)} audio streams: players use the first; mux with -map 0:v:0 -map 1:a:0")
    for s in aus:
        i, lra, tp = loudness(a.file, s["index"])
        print(f"  audio #{s['index']}: {s['codec_name']} {s.get('sample_rate')} Hz {s.get('channels')} ch "
              f"{int(s.get('bit_rate', 0) or 0) // 1000} kb/s | {i} LUFS, LRA {lra} LU, true peak {tp} dBTP")
        if i is None or i < -60:
            problems.append(f"audio #{s['index']} is silent (Remotion's empty track?): mux the real mix in")
        else:
            if abs(i - a.target) > 2:
                problems.append(f"loudness {i} LUFS, target {a.target:g}: see the loudnorm recipe")
            if tp is not None and tp > -1.0:
                problems.append(f"true peak {tp} dBTP > -1: risk of clipping after YouTube's encode")

    if vs and fmt.get("format_name", "").startswith("mov") and not faststart(a.file):
        problems.append("moov atom at the end: add -movflags +faststart for web upload/streaming")

    if problems:
        print("PROBLEMS:")
        for p in problems:
            print("  - " + p)
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main()
