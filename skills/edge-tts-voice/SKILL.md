---
name: edge-tts-voice
description: Generate free voice-over narration for a video with Microsoft Edge neural voices (edge-tts, no API key, no account). Outputs voice.wav (48 kHz) plus word-level timings words.json and words.srt, ready for Remotion/ffmpeg video production and for the cartoon-3d-short pipeline (step 3 "Voice"). Use when the user wants text to speech, a narrator, a voice-over, TTS, "edge tts", a free AI voice, or needs voice.wav/words.json for a short.
---

# Free voice-over with edge-tts

`edge-tts` uses the same neural voices as Microsoft Edge's "Read aloud". It is free, needs no key, and returns **word timings**, so no separate speech-to-text pass is needed.

## Setup (once)
```bash
pip install edge-tts      # Python 3.8+
ffmpeg -version           # needed to write voice.wav
```
It needs internet access to `speech.platform.bing.com`.

## Make the voice
1. **Write the narration** as plain text in `voice/narration.txt`. Only spoken words: no headings, stage directions or emoji.
   - Write numbers the way they should be said ("eighteen thirty-one", "seventy-four") so the read and the word timings match the script.
   - Punctuation drives the pauses: a comma is a short pause, a full stop a longer one. Use "..." for a dramatic beat.
2. **Pick a voice.** List them with `python scripts/tts.py --list en-`. Good narrators:
   | Voice | Feel |
   |---|---|
   | `en-US-GuyNeural` | warm male narrator (default) |
   | `en-US-ChristopherNeural` | deeper, serious male |
   | `en-US-AndrewMultilingualNeural` | natural, conversational male |
   | `en-US-AriaNeural` / `en-US-JennyNeural` | clear female |
   | `en-US-EmmaMultilingualNeural` | natural, conversational female |
   | `en-GB-RyanNeural` / `en-GB-SoniaNeural` | British storyteller |
   | `en-AU-WilliamNeural` | Australian male |
3. **Generate** (from the project folder, e.g. `~/bridge-short/`):
   ```bash
   python ~/.claude/skills/edge-tts-voice/scripts/tts.py \
     --text-file voice/narration.txt --voice en-US-GuyNeural --rate -5% --out voice
   ```
   Outputs in `voice/`:
   - `voice.wav`: 48 kHz mono 24-bit (what `templates/audio/mix.py` loads)
   - `words.json`: `[{"w": "Seventy-four", "s": 0.112, "e": 0.687}, ...]` with seconds from the start
   - `words.srt`: one cue per word, for checking timings in a player
   - `voice.mp3`: the raw download
4. **Check pace.** The script prints duration and words/s. A short wants ~3.7 words/s and 55-70 s.
   - Too slow or long: `--rate +5%`. Too fast: `--rate -8%`. Lower the voice with `--pitch -2Hz`.
   - Keep one rate and pitch for the whole read so the tone stays steady. Don't stitch clips with different settings.
5. **Listen**, then fix the text and run again. Re-runs are free.
   - Mispronounced name: spell it phonetically in the text ("Broughton" → "Brawton"). Remember the timed word changes to match.
6. **Hand-check the word timings** in `words.json` against the audio for the punch words, then lock them. Shots, camera kicks, SFX and music ducking are all timed to `words.json`.
   - Any later re-generation changes every timing, so re-run the shot plan and the sound after it.

## Use in the video
- **cartoon-3d-short pipeline:** this skill does step 3 (Voice). Point `story.ts` and `templates/audio/mix.py` at `voice/words.json` and `voice/voice.wav` as usual.
- **Remotion directly:** copy `voice.wav` to `public/` and add `<Audio src={staticFile("voice.wav")} />`. Convert word seconds to frames with `Math.round(s * fps)`.
- **ffmpeg only:** `ffmpeg -i video.mp4 -i voice/voice.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest out.mp4`

## Rules and limits
- Respect the user rules from the main skill: English only, one steady tone, no captions burned in. `words.srt` is for checking timings only.
- The service is unofficial and free. If a request fails, wait and retry. On an error about the clock or `403`, update with `pip install -U edge-tts`.
- **No access to Microsoft's server** (for example a locked-down cloud sandbox): `productions/zanzibar/voice/kokoro_voice.py` is an offline fallback. It uses the open-source Kokoro voice, downloaded from GitHub, and writes the same `voice.wav`, `words.json` and `words.srt` with word timings from the model itself.
- Microsoft's voices are fine for personal and creative use, but check Microsoft's terms before commercial or monetised use. Never imitate a real person's voice.
