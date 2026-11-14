# Regrid

**English** | [日本語](README.ja.md)

Regrid rebuilds a sprite sheet as an **evenly spaced grid**. It is made for sheets whose rows and columns are aligned but whose spacing is irregular, where Godot's Auto Slice (which looks for rectangles separated by transparent pixels) does not work well.

**Demo: https://searchlie.github.io/regrid/** (use the button at the top right to switch the UI to Japanese)

- No install. It is a static page, so it runs from GitHub Pages or straight from `index.html`
- Your image is processed in the browser and never uploaded
- The detected grid lines can be adjusted by dragging

## How to use

1. Open the page and choose an image (drag & drop and paste also work).
2. Row and column boundary lines are drawn automatically. Drag only the lines that are off.
   - Cells outlined in red may be cut by a line.
3. Press **Save aligned sheet (PNG)** to export a sheet where every frame sits in a cell of the same size (default).
   - Use the Hframes / Vframes values shown on the page in Godot.
   - You can choose the frame anchor (bottom center / center / top left) and the cell padding.
4. Optionally, save each frame as a separate PNG (ZIP) or export the coordinates as JSON.

## How detection works (projection profiles)

1. Build a foreground mask from transparency (or from the difference to the background color for opaque images).
2. Count foreground pixels per row and per column to get two profiles.
3. A stretch where the profile is at or below a fraction of its maximum (2% by default) is a gap. The rest are bands (rows / columns).
4. Draw a boundary line in the middle of each gap.
5. A band much larger than the median (rows or columns that touch) is split at the valley of the profile.

Because a gap is defined by a *fraction* rather than by zero, rows can still be separated when only a few tiles touch their neighbors.

## Files

| Path | Description |
| --- | --- |
| `index.html`, `src/style.css` | The page |
| `src/detect.js` | Detection logic (pure functions, works in the browser and in Node) |
| `src/app.js` | UI and export |
| `src/i18n.js` | UI strings (English / Japanese, English by default) |
| `src/zip.js` | Minimal dependency-free ZIP writer |
| `tests/detect.test.js` | Detection tests on synthetic images (`node tests/detect.test.js`) |

## Publishing (GitHub Pages)

Settings → Pages → Build and deployment → Source: **Deploy from a branch** → Branch: `main` / `/ (root)`

## Limitations

- Rows and columns must each be aligned (diagonal or rotated layouts are not supported).
- Very large images (thousands of pixels per side) may be slow because of browser memory limits.
