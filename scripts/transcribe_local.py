#!/usr/bin/env python3
"""
Transcribe homily-finder episodes on your own computer, then push the
transcripts back to GitHub.

Why this exists: Podbean (which hosts Bishop Barron's audio) blocks GitHub's
data-center servers, so the nightly cloud job can't download those episodes.
Your home internet isn't blocked, so this script does that work locally.

Run it from inside your homily-finder folder:

    python3 transcribe_local.py                # everything still missing
    python3 transcribe_local.py --source barron    # just Bishop Barron
    python3 transcribe_local.py --max 50           # stop after 50 episodes

Safe to stop anytime with Ctrl-C -- finished transcripts are already saved,
and re-running picks up where you left off.
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
)
TMP_AUDIO = "/tmp/homily_local_ep.mp3"


def sh(*args, check=True):
    """Run a shell command inside the repo."""
    return subprocess.run(args, check=check, capture_output=True, text=True)


def have(cmd):
    return subprocess.run(["which", cmd], capture_output=True).returncode == 0


def load_episodes():
    if not os.path.exists("episodes.json"):
        sys.exit(
            "Couldn't find episodes.json.\n"
            "Run this script from inside your homily-finder folder."
        )
    with open("episodes.json") as f:
        return json.load(f)


def pick_episodes(data, source_filter, limit):
    """Newest first, skipping anything already transcribed."""
    src_ids = [s["id"] for s in data["sources"]]
    todo, seen = [], set()
    for years in data["byId"].values():
        for lst in years.values():
            for e in lst:
                url = e.get("a")
                if not url:
                    continue
                sid = src_ids[e["s"]] if e["s"] < len(src_ids) else "?"
                if source_filter and sid != source_filter:
                    continue
                key = hashlib.md5(url.encode()).hexdigest()[:12]
                if key in seen or os.path.exists(f"transcripts/{key}.txt"):
                    continue
                seen.add(key)
                todo.append((e.get("p", ""), key, url, sid, e.get("t", "")))
    todo.sort(reverse=True)
    return todo[:limit] if limit else todo


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": BROWSER_UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=180) as r, open(dest, "wb") as f:
        f.write(r.read())


def commit_and_push(count):
    """Save progress to GitHub, merging politely with the nightly bot."""
    try:
        sh("git", "add", "transcripts")
        staged = subprocess.run(
            ["git", "diff", "--cached", "--quiet"], capture_output=True
        ).returncode
        if staged == 0:
            return  # nothing new
        sh("git", "commit", "-m", f"Local transcription batch ({count} episodes)")
        sh("git", "pull", "--rebase", "-X", "theirs", "origin", "main")
        sh("git", "push")
        print(f"  ...pushed {count} transcripts to GitHub")
    except subprocess.CalledProcessError as ex:
        err = (ex.stderr or "").strip().splitlines()
        print("  ...couldn't push just now: " + (err[-1] if err else "git error"))
        print("     (transcripts are saved locally; the next push will catch up)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", help="only one show: barron, schmitz, pillar, lbs, preach")
    ap.add_argument("--max", type=int, default=0, help="stop after this many episodes")
    ap.add_argument("--model", default="small.en", help="whisper model (default small.en)")
    ap.add_argument("--push-every", type=int, default=10, help="push to GitHub every N episodes")
    args = ap.parse_args()

    if not os.path.isdir(".git"):
        sys.exit("This isn't a git folder.\nRun the script from inside your homily-finder folder.")

    # Start from the newest data so we don't redo what the cloud already did.
    print("Getting the latest episode list from GitHub...")
    try:
        sh("git", "pull", "--rebase", "-X", "theirs", "origin", "main")
    except subprocess.CalledProcessError:
        print("  (couldn't pull -- continuing with the local copy)")

    data = load_episodes()
    os.makedirs("transcripts", exist_ok=True)
    todo = pick_episodes(data, args.source, args.max)

    if not todo:
        print("\nNothing left to transcribe. Everything's already done!")
        return

    label = args.source if args.source else "all shows"
    print(f"\n{len(todo)} episodes to transcribe ({label}).")
    print(f"Loading the {args.model} speech model -- the first run downloads it once...\n")

    from faster_whisper import WhisperModel  # imported late so --help stays instant

    model = WhisperModel(args.model, compute_type="int8")

    done = failed = 0
    started = time.time()
    try:
        for i, (pub, key, url, sid, title) in enumerate(todo, 1):
            short = (title[:52] + "...") if len(title) > 52 else title
            print(f"[{i}/{len(todo)}] {sid}: {short}")
            try:
                download(url, TMP_AUDIO)
                segments, _ = model.transcribe(TMP_AUDIO, beam_size=1, vad_filter=True)
                text = " ".join(s.text.strip() for s in segments)
                if len(text) < 200:
                    print("      skipped -- transcript came out too short")
                    failed += 1
                    continue
                with open(f"transcripts/{key}.txt", "w") as f:
                    f.write(text)
                done += 1
                mins = (time.time() - started) / 60
                rate = done / mins if mins > 0.1 else 0
                left = (len(todo) - i) / rate / 60 if rate else 0
                note = f"  (~{left:.1f}h left)" if left else ""
                print(f"      done -- {len(text):,} characters{note}")
            except urllib.error.HTTPError as ex:
                print(f"      download blocked ({ex.code}) -- skipping")
                failed += 1
            except Exception as ex:  # noqa: BLE001 -- one bad episode shouldn't stop the run
                print(f"      trouble: {ex}")
                failed += 1

            if done and done % args.push_every == 0:
                commit_and_push(done)
    except KeyboardInterrupt:
        print("\n\nStopped. Saving what's finished...")

    if have("node") and done:
        print("\nRebuilding the search index...")
        try:
            sh("node", "scripts/build.js")
        except subprocess.CalledProcessError:
            print("  (skipped -- the nightly job will rebuild it)")
        try:
            sh("git", "add", "episodes.json", "searchindex.json")
        except subprocess.CalledProcessError:
            pass

    commit_and_push(done)
    elapsed = (time.time() - started) / 60
    print(f"\nFinished: {done} transcribed, {failed} skipped, {elapsed:.0f} minutes.")
    if done:
        print("They're on GitHub now -- the site will use them within a few minutes.")


if __name__ == "__main__":
    main()
