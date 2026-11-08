# The 38-Minute War (Zanzibar short)

A 14 s vertical (1080x1920, 30 fps) cartoon short in the "2D characters in a colourful 3D world" style of the
`cartoon-3d-short` skill: three.js inside Remotion, voice-over, synthesized sound effects and an original music cue.

> Did you know the shortest war in history lasted just 38 minutes? In 1896, Britain fought Zanzibar.
> The British won so quickly that history still remembers it as the shortest war ever!

Facts: Anglo-Zanzibar War, 27 August 1896. The bombardment started at about 9:02 and ended at about 9:40. Sources
give 38-45 minutes; 38 is the figure most often cited.

## Shots (all timed to `voice/words.json`)
| # | Words | Picture |
|---|---|---|
| 1 | "Did you know ... thirty-eight minutes?" | Palace clock tower: push in, the hands race from 9:02 to 9:40, bell |
| 2 | "In eighteen ninety-six, Britain" | White flash. Five Victorian warships in line, heading for the shore |
| 3 | "fought Zanzibar." | The palace and its plain red flag |
| 4 | "The British won so" | Bow deck gun fires, two sailors, the whole line fires behind |
| 5 | "quickly" | Shells hit the palace, the flagpole snaps and the flag falls |
| 6 | "that history still remembers ... shortest war ever!" | The admiral in profile watches the smoke and smiles on "ever!" |

No captions or on-screen text, English only.

## Pipeline
1. **Voice:** `voice/kokoro_voice.py`. The edge-tts skill (`skills/edge-tts-voice`) is the default, but the cloud
   session that made this short could not reach Microsoft's speech server. This short therefore uses the
   open-source Kokoro voice `am_michael` at speed 1.1, with exact word timings read from the model's own phoneme
   durations. To use edge-tts instead, run `skills/edge-tts-voice/scripts/tts.py` with the same `narration.txt` into
   `voice/`, copy `words.json` to `src/zanzibar/`, and re-run steps 3-5. The shots and sound re-time themselves.
2. **Picture:** `src/zanzibar/`.
   - `story.ts` holds the beats, cuts, cameras, kicks and depth of field, all computed from the word timings.
   - `world.ts` builds the harbour, palace, clock tower, flag, town, palms, ships, cards and effects.
   - `Zanzibar.tsx` is the composition and post chain.
   - `ink`, `lensblur`, `grade`, `shade`, `lights`, `paint`, `toon` and `cardshade` are copied unchanged from
     `templates/bridge`.
3. **Sound:** `python audio/sound.py` writes `audio/mix.wav` and `audio/cues.md`. Every effect and the music are
   synthesized with the repo's DSP kit (`templates/audio`), so nothing is downloaded and there are no licences.
   - Mix: voice reference -16 LUFS, music bed -9 LU ducked 3 dB under words, SFX -3 LU and stepping back under words.
   - Master: -15 LUFS, true peak -1.9 dBTP.
4. **Render** (no GPU in the cloud, so it uses SwiftShader through `--gl=swangle`, about 5 s per frame):
   ```bash
   npm install
   npx remotion render src/index.ts ZanzibarShort out/video.mp4 --codec=h264 --crf=16 --gl=swangle
   ```
   On a PC with a GPU, drop `--gl=swangle` (or use `--gl=angle`). For test stills: `node scripts/stills.mjs out/stills/x_ 60,200 0.5`.
5. **Mux and check** (see `skills/ffmpeg-video`):
   ```bash
   ffmpeg -i out/video.mp4 -i audio/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart final.mp4
   python ../../skills/ffmpeg-video/scripts/check.py final.mp4 --size 1080x1920 --fps 30 --target -15
   ```

## Notes
- `@react-three/postprocessing`'s `<EffectComposer>` drew nothing under Remotion's manual frame loop with R3F 9.
  `Zanzibar.tsx` therefore drives `postprocessing`'s `EffectComposer` itself from a priority-1 `useFrame`. The passes
  are the same as the bridge short: RenderPass, ink, lens blur pre/main, bloom, then tone map + grade.
- With an explicit `gl` prop, keep `preserveDrawingBuffer: true`.
- On these SwiftShader builds, `--gl=swiftshader` and `--gl=angle` cannot create a WebGL context. `--gl=swangle` works.
