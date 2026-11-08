# Short engine (preset-driven)

Makes vertical cartoon shorts (three.js inside Remotion) from a **story file made only of preset IDs**. No AI is
needed to make a video. A person, the rules helper, or one small AI call fills in the story, and scripts do the rest.

```
stories/zanzibar.json ──► voice (edge-tts / Kokoro) ──► resolve.py ──► sound.py ──► Remotion render ──► mux + check
     (preset IDs)            voice.wav + words.json      timeline.json    mix.wav       video.mp4         final.mp4
```

## Make a video
```bash
cd engine && npm install
python tools/make_short.py stories/zanzibar.json                   # -> out/zanzibar/final.mp4
python tools/make_short.py stories/zanzibar.json --stills 60,200    # quick look check, a few frames only
```
Needs Node 18+, Python 3 with numpy and scipy, ffmpeg, and `pip install edge-tts`.
For the offline voice, also `pip install kokoro-onnx onnx soundfile` plus the Kokoro model files.
On a PC with a GPU, use `--gl angle`. It is far faster than the CPU default in the cloud.

## Story format
```json
{ "title": "The 38-Minute War", "voice": { "engine": "edge", "name": "en-US-GuyNeural" }, "music": "march", "kit": "harbour",
  "shots": [
    { "text": "Did you know the shortest war in history lasted just thirty-eight minutes?",
      "camera": { "id": "push-in", "subject": "clock", "dist": 1.6 }, "dof": 10,
      "actions": [ { "id": "clock-sweep", "at": "clock", "on": "lasted", "until": "minutes", "p": { "from": 2, "to": 40 } } ] },
    { "text": "In eighteen ninety-six, Britain", "transition": "flash", "camera": { "id": "aerial", "subject": "fleet" } },
    { "text": "The British won so", "camera": { "id": "from-to", "from": "deck", "subject": "palace" }, "focus": "chars", "dof": 11,
      "chars": [ { "outfit": "sailor", "place": "left", "expr": "stern", "react": [ { "on": "British", "expr": "grin" } ] } ],
      "actions": [ { "id": "fire", "at": "deck-gun", "on": "British" } ] } ] }
```
- Each shot's `text` is the words spoken during it. Together the shots must equal the narration.
- Timing comes from the voice: `on` / `until` name a word in that shot (`"word#2"` picks the 2nd one), and `offset` is in seconds.
- Optional fields: `light` (day/golden), `mood` (hook/build/impact/finale/calm, which drives the music; it's automatic if left out), `dof` (background blur), `focus`.
- `resolve.py` checks every ID and lists the valid choices when something is wrong.

## Presets
`node tools/catalogue.mjs` writes **`presets/catalogue.json`**: every kit, anchor, camera, action, outfit, expression and
music preset with a one-line description (about 1,100 tokens). It's generated from the code, so it never drifts. It is the only
thing an AI helper needs to see.

| Library | Where | Add one by |
|---|---|---|
| Scene kits + anchors | `src/kits/*.ts` | write a `KitDef` (build function + named anchors), register in `src/kits/index.ts` |
| Cameras | `src/core/cameras.ts` | add a two-framing preset in subject terms (azimuth, elevation, distance) |
| Generic actions | `src/core/actions.ts` | add an effect, plus its sound recipe in `tools/sound.py` |
| Kit actions | the kit's `update()` | e.g. `clock-sweep`, `flag-fall` |
| Outfits | `src/core/characters.ts` | colours/hats for the cartoon cast |
| Music | `tools/sound.py` `SCALES` + `music()` | one entry per preset, following shot moods |

Cameras are defined relative to the subject (its size and preferred viewing side), so one preset works on a clock face or
a fleet. Auto-framing raises or swings the camera when a building would block the subject.
