# Alphabet of Refusal

Static site (no build step). Open `index.html` in a browser, or serve locally for best results.

## Run locally

From this folder:

```bash
cd "alphabet-of-refusal"
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## How it works

- Home screen shows 26 folders (A–Z) as draggable desktop-style icons.
- Clicking a letter opens that folder.
- Folder positions persist in your browser (drag to move).
- Structure is saved in your browser via `localStorage` (key: `aor.tree.v1`).
