#!/usr/bin/env python3
"""Resolve a story (preset IDs + script lines) against the voice word timings into a frame timeline.

story.json  (what a person, the rules helper or an AI fills in; see stories/zanzibar.json):
  { "title", "script" (optional, else joined shot texts), "voice": {...}, "music": "march", "light": "day",
    "shots": [ { "text": "words spoken during this shot", "kit": "harbour", "transition": "flash",
                 "camera": {"id": "push-in", "subject": "clock", "from": "...", "az": 0, "el": 0, "dist": 1, "fov": 38},
                 "chars": [{"outfit": "sailor", "place": "left", "expr": "stern", "react": [{"on": "British", "expr": "grin"}]}],
                 "actions": [{"id": "fire", "at": "deck-gun", "on": "British", "offset": 0.05, "until": "minutes", "p": {}}],
                 "dof": 10, "focus": "chars", "mood": "build" } ] }
A word reference ("on"/"until") is the first match inside that shot's text; "word#2" picks the 2nd match.
Every id is checked against presets/catalogue.json; errors list the valid choices.

Usage: python tools/resolve.py story.json words.json out/timeline.json
"""
import json, re, sys, os

FPS, W_, H_, LEAD, TAIL = 30, 1080, 1920, 3, 1.2
HERE = os.path.dirname(os.path.abspath(__file__))
norm = lambda w: re.sub(r"[^a-z0-9'-]", "", w.lower())


class StoryError(Exception):
    pass


def resolve(story, words, cat):
    errs = []
    def check(cond, msg):
        if not cond: errs.append(msg)
    toks = [norm(w["w"]) for w in words]
    shots_in = story["shots"]
    # ---- match shot texts to words, in order ----
    pos, spans = 0, []
    for i, s in enumerate(shots_in):
        st = [norm(x) for x in s["text"].split() if norm(x)]
        if toks[pos:pos + len(st)] != st:
            got = " ".join(w["w"] for w in words[pos:pos + len(st)])
            raise StoryError(f"shot {i + 1}: text does not match the voice at word {pos + 1}.\n  story: {s['text']}\n  voice: {got}")
        spans.append((pos, pos + len(st)))
        pos += len(st)
    if pos != len(toks):
        raise StoryError(f"the shots cover {pos} of {len(toks)} spoken words; missing: {' '.join(w['w'] for w in words[pos:])}")
    fr = lambda t: int(round(t * FPS))
    starts = [0] + [max(1, fr(words[a]["s"]) - LEAD) for a, _ in spans[1:]]
    end = fr(words[-1]["e"] + TAIL)
    def word_at(i, ref, edge="s"):
        a, b = spans[i]
        name, _, n = ref.partition("#")
        n = int(n or 1)
        hits = [k for k in range(a, b) if toks[k] == norm(name)]
        if len(hits) < n:
            raise StoryError(f"shot {i + 1}: word '{ref}' is not in this shot's text")
        return words[hits[n - 1]][edge]
    kits, cams, outfits, exprs = cat["kits"], cat["cameras"], cat["outfits"], set(cat["expressions"])
    generic = set(cat["actions"])
    out_shots, actions, flashes = [], [], []
    default_kit = story.get("kit")
    for i, s in enumerate(shots_in):
        a, b = starts[i], (starts[i + 1] if i + 1 < len(starts) else end)
        kit = s.get("kit", default_kit)
        check(kit in kits, f"shot {i + 1}: unknown kit '{kit}' (choose from {sorted(kits)})")
        K = kits.get(kit, {"anchors": {}, "actions": {}})
        cam = dict(s.get("camera", {"id": "push-in"}))
        check(cam.get("id") in cams, f"shot {i + 1}: unknown camera '{cam.get('id')}' (choose from {sorted(cams)})")
        check(cam.get("subject") in K["anchors"], f"shot {i + 1}: kit '{kit}' has no anchor '{cam.get('subject')}' (choose from {sorted(K['anchors'])})")
        if cam.get("id") == "from-to":
            check(cam.get("from") in K["anchors"], f"shot {i + 1}: from-to needs 'from' = an anchor of '{kit}'")
        if s.get("transition") == "flash" and i > 0:
            flashes.append(a)
        chars = []
        for c in s.get("chars", []):
            check(c.get("outfit") in outfits, f"shot {i + 1}: unknown outfit '{c.get('outfit')}' (choose from {sorted(outfits)})")
            check(c.get("place") in ("left", "right", "center") or c.get("place") in K["anchors"], f"shot {i + 1}: char place must be left/right/center or an anchor")
            ex = [[a, c.get("expr", "neutral")]]
            for r in c.get("react", []):
                ex.append([fr(word_at(i, r["on"]) + r.get("offset", 0)), r["expr"]])
            for _, e in ex: check(e in exprs, f"shot {i + 1}: unknown expression '{e}' (choose from {sorted(exprs)})")
            cc = {k: v for k, v in c.items() if k not in ("expr", "react")}
            cc["expr"] = ex
            chars.append(cc)
        for act in s.get("actions", []):
            aid = act["id"]
            check(aid in generic or aid in K["actions"], f"shot {i + 1}: action '{aid}' is not generic and not a '{kit}' action (generic: {sorted(generic)}; {kit}: {sorted(K['actions'])})")
            check(act.get("at") in K["anchors"], f"shot {i + 1}: action '{aid}' at unknown anchor '{act.get('at')}'")
            t0 = word_at(i, act["on"]) if "on" in act else words[spans[i][0]]["s"]
            A = {"id": aid, "at": act["at"], "f": fr(t0 + act.get("offset", 0)), "p": act.get("p", {})}
            if "until" in act: A["f1"] = fr(word_at(i, act["until"], "e"))
            A["shot"] = i + 1
            actions.append(A)
        sh = {"id": i + 1, "a": a, "b": b, "kit": kit, "camera": cam, "chars": chars, "light": s.get("light", story.get("light", "day")),
              "mood": s.get("mood") or ("hook" if i == 0 else "finale" if i == len(shots_in) - 1 else "impact" if any(x["id"] in ("fire", "explode") for x in s.get("actions", [])) else "build")}
        for k in ("dof", "focus", "seed"):
            if k in s: sh[k] = s[k]
        out_shots.append(sh)
    if errs:
        raise StoryError("story has problems:\n  - " + "\n  - ".join(errs))
    return {"title": story.get("title", "short"), "fps": FPS, "width": W_, "height": H_, "frames": end,
            "music": story.get("music", "march"), "shots": out_shots, "actions": sorted(actions, key=lambda x: x["f"]), "flashes": flashes}


def main():
    story_p, words_p, out_p = sys.argv[1:4]
    story, words = json.load(open(story_p)), json.load(open(words_p))
    cat = json.load(open(os.path.join(HERE, "..", "presets", "catalogue.json")))
    try:
        tl = resolve(story, words, cat)
    except StoryError as e:
        sys.exit(str(e))
    os.makedirs(os.path.dirname(out_p) or ".", exist_ok=True)
    json.dump(tl, open(out_p, "w"), indent=1)
    print(f"{out_p}: {len(tl['shots'])} shots, {tl['frames']} frames ({tl['frames'] / FPS:.1f} s), {len(tl['actions'])} actions")


if __name__ == "__main__":
    main()
