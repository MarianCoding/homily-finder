# Homily Finder

Pick a liturgical date and see every homily / commentary episode for that day across past years.

- `index.html` — the page
- `liturgy.js` — US Roman Catholic calendar math (shared by page and script)
- `sources.json` — the podcasts to index. Add a show with either its RSS `feed` URL or its Apple Podcasts `appleId`. `kind` is `sunday` (match by liturgical day) or `daily` (match by publish date).
- `scripts/build.js` — fetches every feed and writes `episodes.json`
- `.github/workflows/update.yml` — runs the script every night and commits the result

To refresh by hand: GitHub → Actions → "Refresh episodes" → Run workflow.
