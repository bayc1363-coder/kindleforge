# KindleForge

A local book studio for Kindle and KDP. Picture books (ages 2–5) keep the illustration locked and put the words in an editable layer on top. Classic text-and-picture layouts are still there.

No build step, no API key, and no upload to Amazon. Open it with a local server so fonts, pictures, and export can read local files:

```bash
python -m http.server 8000
```

Then open http://127.0.0.1:8000/

## Picture books

A picture page is one full-bleed illustration. A **spread** is one wide picture (for example 1376×768) across a left page and a right page. Text boxes sit anywhere on top. Moving or restyling the words does not change the picture file.

1. **Spread** or **Picture** in the page strip adds a page. **Import → Folder of images** makes one page per file, in filename order. A wide picture becomes a spread.
2. Drop one image on the canvas to set that page’s background. The stored file is never cropped. **Cover** fills the page; **Contain** shows the whole picture. Scale and the two sliders only change how it sits.
3. **Add text**, then drag the box (use the Drag pill or the padding). Corner and edge handles resize it. Arrow keys nudge; Shift is a bigger step, Alt is a hair. Snap pulls a box to the trim, the safe area, the centre, and other boxes. Hold Alt while dragging to ignore snap.
4. Type in the box or in **Words** on the right. They stay in sync. `**Whoosh!**` is bold, `*soft*` is italic. You can also select a word and press **B** or **I**.
5. **Text style** is per box: any point size, Nunito, Baloo 2, or Andika (bundled, so they work offline), colour, bold, italic, alignment, line spacing, letter spacing.
   - **Outline**, **Soft shadow**, and **Panel behind text** each have their own on/off switch, plus width, colour, opacity, corner radius, and padding. A cream rounded panel is the usual read-aloud look.
6. **Save this style** stores a named preset in the project. **Apply** puts it on the selected box. **Apply to every text box** copies the look across the book and leaves positions and words alone.
7. **Trim** defaults to the KDP square, 8.5 × 8.5 in, with 0.125 in bleed and a 0.5 in safe area. The dashed line is the trim. The green line is the safe area. Other trims, including a custom size, stay in the menu. **Fit** and the zoom slider frame the canvas. The page strip collapses with the arrow at its top.
8. The sun/moon button switches light and dark. Undo is Ctrl+Z, redo is Ctrl+Shift+Z or Ctrl+Y.

**Import → Paste manuscript** splits a draft into pages. Headings like `### Pages 10–11 — Joy` followed by a `**Text:**` block work, and so does a line that is only `---`. **Fill existing pages** writes each chunk into the first text box, in order. **Add pages for the rest** creates picture pages when there are more chunks than pages.

The sample project is `demo/wide-awake-kip-sample.kindleforge.json` (Wide-Awake Kip, three spreads). **More → Load picture-book demo**, or open `index.html#picture-demo`. The pictures live in `demo/spreads/`.

## Export

| Export | What you get |
| --- | --- |
| Print PDF | One page per physical page, at trim + bleed. A spread becomes two pages and repeats a bleed-wide strip at the gutter. The original image is embedded. Text is vector, in the same fonts as the screen. |
| Pages as PNG / JPG | A zip of those print pages at 200 DPI, for a phone or a markup pass. |
| Tall review JPG | The same pages stacked in one image. |
| EPUB | A book that is only picture pages and spreads is a fixed-layout EPUB. Mixed books keep the older reflowable EPUB for classic pages. |
| HTML | A simple preview next to this folder. |

Nothing here uploads to KDP. Open the PDF in a viewer and check the trim box before you send it anywhere.

## Project file

**Save** downloads a `.kindleforge.json`. **Load** opens one, including older KindleForge files. Ctrl+S and Ctrl+O do the same. The file has a `guide` object that describes the fields. In short:

- `book.trim` is the trim, bleed, and safe inset in inches.
- A picture or spread page stores the background in `images[0].src`. `bgFit`, `bgScale`, `bgX`, and `bgY` are view-only.
- `texts[]` boxes use `x`, `y`, `w`, `h` as percentages of the full-bleed canvas. On a spread that canvas is both pages, including the outer bleeds, and the gutter is the exact centre.
- `sizePt` is the type size in points. `strokeOn`, `shadowOn`, and `panelOn` are the three switches.
- `stylePresets` are the named looks saved in that project.

The browser also keeps the last book in localStorage. A book with several large pictures can be too big for that; the project file is the copy to keep.

## What is bundled

- `vendor/pdf-lib.min.js` and `vendor/fontkit.umd.min.js` for the print PDF
- `vendor/jszip.min.js` for EPUB and the image zip
- `vendor/fonts/` — Nunito, Baloo 2, and Andika, SIL Open Font License (see `vendor/fonts/OFL-*.txt`)

Baloo 2 is shipped as regular and bold only. Italic on that family is simulated on screen and stays upright in the PDF. The soft shadow is a small stack of offset copies, on screen and in the PDF, so the print matches the preview.

## Classic pages and the local backend

Text only, image + text, side by side, panels, and Custom (drag up to three pictures and three text boxes) still load and still export to EPUB. **More → Load classic fox demo** restores the original sample.

**Settings** can point Generate at the optional FastAPI backend (`backend/`, port 8001) and a local Ollama model. Picture-book layout does not need it. There is no xAI key in the app.

## Layout of the repo

- `index.html` — the app shell
- `css/app.css` — the interface
- `js/app.js` — editing, import, and export
- `demo/` — the Kip sample and its spreads
- `backend/` — optional local text and image generation
