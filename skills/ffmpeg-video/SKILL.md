---
name: ffmpeg-video
description: Tested ffmpeg recipes for short-form video production. Mux a Remotion render with its sound mix, export for YouTube Shorts/TikTok/Reels (2K vertical H.264), normalise loudness, trim, join, crossfade, turn landscape into vertical, duck music under a voice, fades, thumbnails, contact sheets, GIF previews, speed changes and audio conversion. Includes check.py to QA a final file (size, fps, pixel format, silent audio, loudness, true peak, faststart). Use when the user mentions ffmpeg, muxing, encoding, exporting, compressing, converting, cutting, joining, resizing or checking a video or audio file, or for steps 10-11 (render/deliver) of the cartoon-3d-short pipeline.
---

# ffmpeg for video production

Every recipe below was run on ffmpeg 6.1. Replace file names, keep the flags.
Check every final file with `python ~/.claude/skills/ffmpeg-video/scripts/check.py final.mp4` before delivering.

## Rules
- Delivery format: H.264 High, `-pix_fmt yuv420p`, constant 30 fps, AAC 48 kHz, `-movflags +faststart`, even width and height.
- Re-encode only once at the end. Cut and join with `-c copy` when nothing changes, and keep intermediates lossless or high-quality (`-crf 16` or WAV).
- Loudness: YouTube plays at -14 LUFS. `templates/audio/mix.py` masters to -15 LUFS, which is fine, so don't re-normalise its mix. Use loudnorm only on audio that hasn't been mastered. Keep the true peak at -1 dBTP or lower.
- Main skill rules still apply: no captions burned in, standard mix music +3 dB, SFX -6 dB, voice unchanged.
- On Windows PowerShell, replace the trailing `\` line breaks with a backtick `` ` ``. In cmd, put the command on one line.

## 1. Check a file
```bash
python scripts/check.py final.mp4 --size 1440x2560 --fps 30          # exit 1 + PROBLEMS list if anything is off
ffprobe -v error -show_entries stream=index,codec_type,codec_name,width,height,r_frame_rate,pix_fmt -of compact final.mp4
```

## 2. Mux a Remotion render with the mix
Remotion writes a silent audio track, so map only the video from the render and only the audio from the mix:
```bash
ffmpeg -i out/<name>/video.mp4 -i audio/mix.wav -map 0:v:0 -map 1:a:0 \
  -c:v copy -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart final.mp4
```

## 3. Export for upload (Shorts / TikTok / Reels)
Re-encode, for example when the render is 1080x1920 or isn't yuv420p. The 2K vertical render from the main skill already fits, so mux it (recipe 2) instead.
```bash
ffmpeg -i final.mp4 -vf "scale=1440:2560:flags=lanczos,format=yuv420p" -r 30 \
  -c:v libx264 -preset slow -crf 18 -profile:v high -c:a copy -movflags +faststart upload.mp4
```
Small file to share in chat or for review (720p, about 5-10x smaller):
```bash
ffmpeg -i upload.mp4 -vf "scale=720:-2" -c:v libx264 -crf 26 -c:a aac -b:a 128k -movflags +faststart share.mp4
```

## 4. Loudness
Measure it with `check.py`, or with `ffmpeg -i in.mp4 -af ebur128=peak=true -f null -` and read the `Summary:`.
Two-pass normalise to -14 LUFS (bash):
```bash
M=$(ffmpeg -hide_banner -nostats -i in.mp4 -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g(){ echo "$M" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -i in.mp4 -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" \
  -c:a aac -b:a 320k -movflags +faststart out.mp4
```
Without bash, run pass 1, copy the five numbers from its JSON into pass 2 by hand.

## 5. Trim, join, crossfade
```bash
# frame-accurate cut 1.5 s → 4 s (re-encodes)
ffmpeg -ss 1.5 -to 4 -i in.mp4 -c:v libx264 -crf 16 -pix_fmt yuv420p -c:a aac -b:a 320k cut.mp4
# fast cut, no re-encode (snaps to keyframes, so it can start a little early)
ffmpeg -ss 1.5 -to 4 -i in.mp4 -c copy cut_fast.mp4

# join clips with identical codec/size/fps, no re-encode
printf "file 'a.mp4'\nfile 'b.mp4'\n" > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy joined.mp4

# 0.5 s crossfade; offset = length of a.mp4 - 0.5
ffmpeg -i a.mp4 -i b.mp4 -filter_complex \
  "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=5.5,format=yuv420p[v];[0:a][1:a]acrossfade=d=0.5[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -crf 16 -c:a aac -b:a 320k xfade.mp4
```
Other `transition=` values include `fadewhite`, `fadeblack`, `wipeleft`, `slideup`, `circleopen` and `dissolve`.

## 6. Landscape → vertical 1080x1920
```bash
# blurred fill behind the full frame
ffmpeg -i land.mp4 -filter_complex \
  "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=40:5,eq=brightness=-0.08[bg];[0:v]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]" \
  -map "[v]" -map 0:a? -c:v libx264 -crf 18 -c:a copy vertical.mp4
# centre crop
ffmpeg -i land.mp4 -vf "crop=ih*9/16:ih,scale=1080:1920,format=yuv420p" -c:v libx264 -crf 18 -c:a copy vertical.mp4
```

## 7. Audio
```bash
# quick voice + music mix, music -6 dB and ducked under the voice (mix.py is the full version for shorts)
ffmpeg -i voice.wav -i music.wav -filter_complex \
  "[1:a]volume=-6dB[m];[0:a]asplit=2[v][key];[m][key]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400[duck];[v][duck]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.89[a]" \
  -map "[a]" -ar 48000 -c:a pcm_s24le mix.wav
# loop music to 15 s and fade out the last 2 s
ffmpeg -stream_loop -1 -i music.wav -t 15 -af "afade=t=out:st=13:d=2" music_15s.wav
# pull audio out of a video / convert
ffmpeg -i in.mp4 -vn -ac 2 -ar 48000 -c:a pcm_s24le audio.wav
ffmpeg -i audio.wav -c:a libmp3lame -q:a 2 audio.mp3
# find gaps longer than 0.4 s in a voice track
ffmpeg -i voice.wav -af silencedetect=noise=-40dB:d=0.4 -f null -
```

## 8. Fades and speed
```bash
# 0.5 s fade in/out on a 6 s clip (st = start time of the fade)
ffmpeg -i in.mp4 -vf "fade=t=in:st=0:d=0.5,fade=t=out:st=5.5:d=0.5,format=yuv420p" \
  -af "afade=t=in:st=0:d=0.3,afade=t=out:st=5.5:d=0.5" -c:v libx264 -crf 16 -c:a aac -b:a 320k out.mp4
# 1.25x faster, pitch kept (atempo takes 0.5-2.0; chain two for more)
ffmpeg -i in.mp4 -filter_complex "[0:v]setpts=PTS/1.25[v];[0:a]atempo=1.25[a]" -map "[v]" -map "[a]" \
  -c:v libx264 -crf 16 -pix_fmt yuv420p -c:a aac fast.mp4
```

## 9. Stills, sheets, previews
```bash
ffmpeg -ss 2.5 -i in.mp4 -frames:v 1 -q:v 2 thumb.jpg                              # one frame at 2.5 s
ffmpeg -i in.mp4 -vf "fps=2,scale=270:-2" -q:v 3 frames/f_%04d.jpg                  # 2 frames per second
ffmpeg -i in.mp4 -vf "fps=2,scale=180:-2,tile=6x2:padding=4:color=white" -frames:v 1 sheet.jpg   # contact sheet
ffmpeg -t 3 -i in.mp4 -filter_complex \
  "fps=12,scale=360:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" preview.gif
ffmpeg -framerate 30 -i frames/f_%04d.png -c:v libx264 -crf 16 -pix_fmt yuv420p \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" seq.mp4                                    # image sequence → video
```

## Fixes for common errors
| Error / symptom | Fix |
|---|---|
| `width not divisible by 2` | scale with `-2` (`scale=720:-2`) or `scale=trunc(iw/2)*2:trunc(ih/2)*2` |
| Plays black or has wrong colours on a phone or in QuickTime | add `-pix_fmt yuv420p` (or `format=yuv420p` at the end of `-vf`) |
| Final video is silent | Remotion's empty track was kept: use `-map 0:v:0 -map 1:a:0` |
| Audio and video lengths differ | add `-shortest`, or pad the audio with `apad` and add `-shortest` |
| Cut starts on a frozen or wrong frame | `-c copy` snaps to keyframes: re-encode the cut |
| `Non-monotonic DTS` when joining | the clips differ in codec, size or fps: re-encode them to match first |
| `Option not found` / `No such filter` | old ffmpeg build: install a current static build |
