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
music preset with a one-line description (about 3,300 tokens for all 234 presets). It's generated from the code, so it
never drifts. It is the only thing an AI helper needs to see.

### Scenes (9 kits)
| Kit | For | Signature anchors |
|---|---|---|
| harbour | history / war | clock, palace, palace-flag, fleet, deck-gun, town, beach |
| castle | medieval | castle, gate (drawbridge), keep, wall, moat, field, village |
| desert | ancient / adventure | pyramids, statue, oasis, dunes, caravan, camp |
| jungle | adventure / nature | river, temple, waterfall, canopy, clearing |
| savanna | animals | elephant, giraffe, lion, zebras, waterhole, acacia, mountain |
| ocean | sea / nature | island, lighthouse-rock, whale, sailboat, sea, horizon |
| space | science / space | rocket (launch), pad, earth, planet, lander, base, satellite |
| lab | science | coil (spark), beakers (bubble), blackboard, machine, bench |
| city | modern / everyday | street, crossing, shop, skyline, taxi, bus, cars |
Every kit has a standing point for `from-to` shots (lookout, sidewalk, doorway, trail, beach, gate-road, deck...).

### Props library (49 props, usable in any scene)
| Group | Props |
|---|---|
| Animals (10) | elephant, giraffe, lion, zebra, horse, cow, dog, camel, birds (flock), whale |
| Vehicles (10) | car, car-blue, taxi, bus, jeep, cannon, rowboat, sailboat, plane, tank |
| Nature (9) | acacia, palm, pine, oak, bush, rock, cactus, log, flowers |
| Buildings (8) | house, barn, hut, tent, castle-tower, lighthouse, windmill, pyramid |
| Objects (12) | crate, barrel, campfire, flagpole, lamppost, bench, signpost, table, chest, well, traffic-light, telescope |

Place props for every shot of a kit (`"props"` at the story level, with `"kit"`) or for one shot (`"props"` in the shot):
```json
"props": [ { "id": "elephant", "name": "jumbo", "at": "beach", "dx": 8, "dz": -2, "face": "palace", "scale": 1 },
           { "id": "zebra", "group": "herd", "at": "plain", "dx": -4 }, { "id": "zebra", "group": "herd", "at": "plain", "dx": 0 } ]
```
A placed prop becomes an anchor (its `name`, else its id; `group` makes a group anchor). Cameras can frame it, characters
can stand by it, and actions can target it: `run` / `drive` / `fly` move it along its heading, `fire` uses its muzzle
(cannon, tank), and prop actions include `trumpet`, `roar`, `moo`, `bark`, `honk`, `open`.

| Library | Where | Add one by |
|---|---|---|
| Props | `src/props/{animals,vehicles,nature,buildings,objects}.ts` | add a `PropDef` (build from shapes, optional `animate`) |
| Scene kits + anchors | `src/kits/*.ts` | write a `KitDef` (build function + named anchors), register in `src/kits/index.ts` |
| Cameras | `src/core/cameras.ts` | add a two-framing preset in subject terms (azimuth, elevation, distance) |
| Generic actions | `src/core/actions.ts` | add an effect, plus its sound recipe in `tools/sound.py` |
| Kit actions | the kit's `update()` | e.g. `clock-sweep`, `flag-fall` |
| Outfits | `src/core/characters.ts` | colours/hats for the cartoon cast |
| Music | `tools/sound.py` `SCALES` + `music()` | one entry per preset, following shot moods |

Cameras are defined relative to the subject (its size and preferred viewing side), so one preset works on a clock face or
a fleet. Auto-framing raises or swings the camera when a building would block the subject.
