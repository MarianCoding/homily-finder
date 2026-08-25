# Transcribes podcast episodes listed in episodes.json using Whisper (tiny.en).
# Saves plain-text transcripts to transcripts/<key>.txt where <key> is a short
# hash of the episode's audio URL. Skips episodes already transcribed.
# Run by .github/workflows/transcribe.yml — MAX_EPISODES controls batch size.

import hashlib
import json
import os
import sys
import urllib.request

MAX = int(os.environ.get("MAX_EPISODES", "25"))

with open("episodes.json") as f:
    eps = json.load(f)

todo, seen = [], set()
for years in eps["byId"].values():
    for lst in years.values():
        for e in lst:
            url = e.get("a")
            if not url:
                continue
            key = hashlib.md5(url.encode()).hexdigest()[:12]
            if key in seen or os.path.exists(f"transcripts/{key}.txt"):
                continue
            seen.add(key)
            todo.append((e.get("p", ""), key, url))

todo.sort(reverse=True)  # newest first so current Sundays are searchable soonest
print(f"{len(todo)} episodes still need transcripts; doing up to {MAX} this run")
if not todo:
    sys.exit(0)

from faster_whisper import WhisperModel  # noqa: E402  (import after early exit)

model = WhisperModel("tiny.en", compute_type="int8")
os.makedirs("transcripts", exist_ok=True)

done = 0
for pub, key, url in todo[:MAX]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "homily-finder/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open("/tmp/ep.mp3", "wb") as f:
            f.write(r.read())
        segments, _ = model.transcribe("/tmp/ep.mp3", beam_size=1, vad_filter=True)
        text = " ".join(s.text.strip() for s in segments)
        if len(text) < 200:
            print(f"skip {key} — transcript suspiciously short")
            continue
        with open(f"transcripts/{key}.txt", "w") as f:
            f.write(text)
        done += 1
        print(f"ok   {key}  {pub}  {url[:70]}")
    except Exception as ex:  # noqa: BLE001 — keep the batch going
        print(f"fail {key}  {ex}")

print(f"transcribed {done} episodes")
