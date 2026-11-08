#!/usr/bin/env python3
"""Contact sheet of PNG stills: python tools/sheet.py out.jpg a.png b.png ..."""
import sys
from PIL import Image
out, fs = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert("RGB").resize((270, 480)) for f in fs]
W = Image.new("RGB", (280 * len(ims), 480), "white")
for i, im in enumerate(ims): W.paste(im, (i * 280, 0))
W.save(out, quality=88)
