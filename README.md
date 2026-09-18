# KindleForge

AI-powered book creation studio for Kindle (and eventually Amazon KDP print).

Goal: A focused, beautiful tool where you build your book page-by-page (or section-by-section), with powerful AI assistance for both **text** and **illustrations** right next to a live digital-book preview.

## Current Status (v0.3 - Portable projects + local gen)

- Single-file web app (`index.html`) — best run via local server (see below).
- Full UI: Page list (left) • Live Kindle-like preview (center) • Per-page Text + Illustration AI boxes (right) with **Grok Request Panel** for seamless chat-assisted or direct local generation.
- Real **EPUB export** — produces a valid .epub with embedded text and images (portable via data URLs or Make Portable).
- **Save Project / Load Project** — download a portable `.kindleforge.json` (book + embedded images) and reopen it later or on another PC. Keyboard: `Ctrl+S` / `Ctrl+O`.
- Browser **localStorage** still auto-saves the last book on the same machine/browser.
- **Local model support (no xAI key required)**: Run the small FastAPI backend (like your beatreel setup). 
  - Text: Calls your local Ollama (llama3.2 etc.) — Generate button now **populates the page directly**.
  - Illustrations: Stub ready for your local model (ComfyUI/Flux/SD/Wan etc.) — same "populate on page" flow once wired.
- "Embed Demo Images" + drag/upload for bringing generated images in.
- "Make Portable" + improved image handling.
- Clear step-by-step instructions under buttons so the flow is obvious.

**This is now functioning for creating real Kindle books.**

## Important: Testing EPUB Export

The EPUB export uses browser tech (fetch for images, JSZip). 

**Best experience:**
- Open `index.html` 
- Click **"Make Portable"** first (this tries to convert demo images to embedded data).
- Then **Export EPUB**.

**If images are missing in the EPUB:**
- This is very common when double-clicking the HTML (file:// protocol blocks fetch).
- Solutions:
  1. For any page with a missing image, use the **Upload** button or drag a copy of the image from the `generated/` folder onto the illustration preview area. This stores it as a portable data URL.
  2. Run a local server for best results:
     - In the `kindleforge` folder, open PowerShell/Terminal and run:
       `python -m http.server 8000`
     - Then open http://localhost:8000/index.html in your browser.
  3. Re-export after making images portable.

Test the resulting .epub with Amazon's free **Kindle Previewer** tool (highly recommended for validation).

## Vision / What You're Seeing

- A clean e-reader-like page in the center.
- For the selected page you have:
  - **Text AI box**: Prompt field + Generate / Regenerate button. Edit the final text.
  - **Illustration AI box**: Prompt + style controls + Generate / Variations / Regenerate. The image appears naturally in the book page preview.
- The preview feels like the final Kindle experience (serif typography, proper margins, page-like container).

## Phased Build Plan (we start simple, add depth)

1. **Prototype (current)**: Beautiful interactive UI mock that feels real. Local persistence. Dummy generation (you describe prompts here in chat → I generate real text/images and you paste or I help integrate).

2. **Interactivity + Polish**: Full editing, drag reorder, chapter support, better preview (page turn feel, zoom, reading mode).

3. **Real EPUB Export**: Proper .epub file you can send straight to Kindle or upload to KDP.

4. **AI Integration**:
   - Text: Connect to Grok / xAI (or other) for one-click generation with context of previous pages.
   - Images: One-click illustration generation with style consistency across the book (character sheets, art direction).

5. **Advanced Features**:
   - Cover designer
   - Full book metadata for Amazon
   - Consistency tools (character bible, tone checker)
   - Multiple illustration slots per page
   - Print layout (for paperback/hardcover)
   - Version history per page
   - Batch generation

6. **Packaging & Distribution**:
   - Easy local run (Pinokio launcher, Tauri desktop app, or `python -m http.server`)
   - Optional backend for heavier generation / storage
   - One-click "Publish prep" checklist for Amazon

## How to Use Right Now (with Local Generation)

**Recommended setup (like beatreel - no external API keys):**

0. **One-click (Windows):** double-click `start_kindleforge.bat` (starts backend + frontend + browser).

1. **Backend for local models**:
   - Or: `backend\start_backend.bat` (uses venv, port 8001)
   - Ollama must be running with a model: `ollama pull llama3.2`
   - Health check: http://127.0.0.1:8001/health (`ollama_ok` should be true)

2. **Frontend**:
   - In the `kindleforge` folder: `python -m http.server 8000`
   - Open http://127.0.0.1:8000/index.html (**not** file://)

3. In the app:
   - **Settings** (cog) — Backend URL `http://127.0.0.1:8001`, Ollama Model `llama3.2` → **Test Backend**
   - Click **GENERATE** on Text → Ollama fills the page (first call can take ~1–2 min).
   - Click **GENERATE** on Illustration → places an image (placeholder by default until Flux/Comfy on 7900 XTX).
   - Edit, **Save Project**, Export EPUB.

**Without backend** (still works great):
- Use the in-app **Grok Request Panel** (appears under buttons).
- Click Generate → copy prompt from panel → paste here in chat → I generate (real content, including images via my tools) → paste back in the panel → Apply.
- This is fully "in the app" with minimal friction, no keys needed.

See backend/README.md for details on wiring your local image models.

## Roadmap — We go one by one (functioning first, then polish)

You said: get it functioning properly first, then tweak to perfection. All steps, I pick the order.

**Current phase goal:** A working tool you can use end-to-end to produce real Kindle books with my help.

**Picked starting point (just completed):**
- Step 1: Robust image handling (upload/drag-drop + data URLs) + **Real EPUB export** (with JSZip, proper structure, image embedding, metadata). 
  Result: You can now create pages, get content/illustrations via chat, bring images in, and export a real .epub that works on Kindle.

**Done:**
- Project file import/export — **Save Project** / **Load Project** (`.kindleforge.json`, portable with embedded images).

**Next logical steps (we'll do one at a time, you approve before moving):**

2. Improve AI generation workflow inside the app (better auto-prompts that include previous pages for consistency, "Send to Grok" helper that logs the request, one-click "Use last response", etc.)
3. Recent-projects list / named sessions in the UI (optional; files already work for multi-book).
4. Smoother image workflow + config-driven image provider ready for 7900 XTX (ComfyUI / Flux / etc.).
5. Better preview fidelity (more accurate Kindle typography, page size simulation, reading mode, zoom).
6. Add basic book metadata editor for Amazon KDP (description, categories, etc.).
7. Move beyond single-file (Vite + proper frontend + optional small backend for local API calls if you want one-click generation with your keys).
8. Packaging (easy launcher, Pinokio, desktop app via Tauri, etc.).
9. Advanced (style consistency tools, character bible, batch regen, print layouts, cover generator...).

Tell me when you're ready for Step 2, or if you want to change the order. Test the EPUB export on the current demo first!

Let's build this step by step exactly how you want it.

## Target hardware & PC move (important)

**Tomorrow:** moving KindleForge to a new PC with an **AMD Radeon RX 7900 XTX** (~24GB VRAM).

Build decisions today should assume that environment, not lock us into the current NVIDIA / Beatreel-on-3070 setup.

| Concern | How we handle it |
|--------|-------------------|
| **AMD, not CUDA** | Image backends via **config** (env + Settings), not hardcoded `C:\pinokio\...` or CUDA-only paths. Prefer ComfyUI / Ollama / abstract “image provider” so ROCm, DirectML, or ZLUDA can plug in on the new box. |
| **24GB VRAM** | Design for **bigger models**: Flux (dev/schnell), SDXL, larger Ollama (7B–32B+), style-consistency models. Keep model **names/IDs and size presets** configurable — don’t bake in 1.3B-only defaults as the only path. |
| **Portable projects** | Prefer **file-based save/load** (JSON books + assets) over browser-only localStorage so work survives the PC move. |
| **No machine-specific hardcodes** | Paths, ports, model IDs, and GPU device go in `.env` / Settings UI. Repo should clone and run with a short setup checklist. |
| **Backend as the heavy layer** | Frontend stays thin; FastAPI owns generation so we can swap Ollama + Comfy/Wan/Flux without rewriting the UI. |

Current machine can still use smaller models / chat fallback; the **architecture** is what has to be 7900-ready.

### Migration checklist (for the new PC)
1. On this PC: open KindleForge → **Save Project** (or `Ctrl+S`). Prefer running via `python -m http.server` first so relative images embed as data URLs.
2. Copy the downloaded `*.kindleforge.json` (and optionally the whole `kindleforge` folder) to the new PC.
3. Install: Python, Ollama (pull preferred text model), ComfyUI or chosen image stack for AMD 24GB.
4. Open frontend → **Load Project** (or `Ctrl+O`) → pick the `.kindleforge.json` → continue the book.
5. Set Settings: backend URL, Ollama model, image provider + model (when wired).

## Tech Notes

- v0.1: Pure HTML + Tailwind CDN + vanilla JS (zero install, instant to try).
- Later: Can evolve into the same stack as beatreel (Vite + TSX frontend + FastAPI) or Tauri for a real desktop app.
- Images live in `/generated` (we'll populate real AI images here).
- Image gen currently has Beatreel/Wan-style defaults — treat as **one provider**, not the forever stack.

## Amazon KDP Ready

The end goal is files + metadata that pass Amazon review easily (EPUB for Kindle, proper interiors for print, good cover, clean metadata).

Let's get the core creative loop feeling great first.
