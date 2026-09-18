# KindleForge Backend (Local Models, No External API Key Needed)

This small FastAPI backend lets the frontend call **local models** for text and illustrations, just like your beatreel setup with Wan.

I checked the beatreel files (backend/app/services/video/wan_local.py, scripts/wan_i2v.py, grok_wan.py, etc.) and adapted the patterns here.

## Quick Start (working Generate buttons)

**Prereqs:** Ollama running with a model (e.g. `ollama pull llama3.2`).

1. Easiest: double-click `kindleforge\start_kindleforge.bat`  
   Or separately:
   - Backend: `backend\start_backend.bat` → http://127.0.0.1:8001  
   - Frontend: from `kindleforge` folder → `python -m http.server 8000` → http://127.0.0.1:8000/index.html
2. In the app **Settings** (cog):
   - Backend URL: `http://127.0.0.1:8001`
   - Ollama Model: `llama3.2`
   - Click **Test Backend** — should show Backend OK + Ollama OK
3. **Text GENERATE** → Ollama fills the page (may take 30–120s on first call).
4. **Illustration GENERATE** → works immediately with `IMAGE_PROVIDER=auto` (offline **placeholder** card so the button is never a dead end). For real art set `IMAGE_PROVIDER=wan` (experimental) or wire Comfy/Flux on the 7900 XTX PC.

Env knobs (portable for new PC):
| Env | Default | Meaning |
|-----|---------|---------|
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama base URL |
| `OLLAMA_MODEL` | `llama3.2` | Default text model |
| `IMAGE_PROVIDER` | `auto` | `auto`/`placeholder`/`wan`/`none` |
| `WAN_APP_ROOT` / `WAN_PYTHON_PATH` | Pinokio paths | Only if using Wan |

## For Illustrations (Local Image Models)

**Short answer to your question:** No — the llama3.2 3B (or any "llama3.3 3b") model will **not** generate images.

Llama models (from Meta) are **text-only** LLMs. 
- The 1B/3B variants are tiny fast text models (good for your preschool rhyme stories).
- Llama 3.2 also has "vision" models (11B and 90B) that can *understand* images you feed them, but they cannot *create* new images.
- There is no official Llama 3.3 3B at all (Llama 3.3 is a 70B text model).

### How to generate images locally (exactly like your beatreel Wan setup)

Use real image diffusion models instead:
- **Flux.1** (schnell is fast and high quality, dev is better but slower)
- SDXL, SD 3, or your existing Wan image model

**Recommended stack (what most people do with beatreel-style local setups):**
1. Install **ComfyUI** (the most flexible way to run local image/video models).
2. Download the model files (Flux GGUF or safetensors versions from Hugging Face or Civitai).
3. Run ComfyUI (it gives you a web UI + an API on port 8188 by default).
4. In `backend/main.py`, replace the `generate_image` stub with a small function that:
   - Sends your prompt (plus any style/character consistency info) to ComfyUI's `/prompt` API using a workflow JSON.
   - Polls the `/history/{prompt_id}` endpoint until the image is ready.
   - Returns either:
     - `{"image_base64": "iVBORw0KGgoAAAANSUhEUg..."}`  (base64 data the frontend can use directly in <img src>)
     - or saves the file to `../generated/someid.png` and returns `{"image_path": "generated/someid.png"}`

The frontend (in generateIllustration) will then automatically set `page.image = that value`, update the preview, and save it.

Once you do this, the Generate button on the Illustration side will call your local model and **directly populate the image on the page** (or into the review box if we add that next small step).

I left detailed comments + a clear TODO right in `backend/main.py` under the generate_image function. You can literally copy-paste your existing beatreel Wan/ComfyUI calling code into it.

### Quick test right now (while you set up images)

Text is already working with Ollama.
- Run the backend (`uvicorn main:app --port 8001`)
- Make sure Ollama is serving llama3.2 (or whatever 3B-class model you want)
- In the app Settings, set Backend URL + model
- Click Generate on any text — it should now call your local model and put the story straight onto the page.

For images, until you wire the local model, the button will still fall back to the "copy prompt → ask me in chat → I generate with my tools → you use the Embed Demo Images button" flow. That's the graceful fallback we built.

Let me know when you have ComfyUI + Flux/Wan running and want me to give you the exact Python snippet to drop into generate_image (or help with a specific workflow JSON). We can also add the "generate → review box first → user clicks Apply" UI next if you want that safety net before it hits the page.

We're on a good small-steps path. What's the very next tiny thing you want to tackle after we get images local? (review modal, save/load projects via backend, better character consistency across pages, etc.)

## Why This Way?
- No xAI/OpenAI API key required for the user.
- Full control with your downloaded models (privacy, cost, offline).
- Matches beatreel pattern: local heavy lifting in backend, nice frontend.
- The frontend (index.html) now calls these endpoints and populates the story/illustration directly.

## Next Small Steps (if you want)
- Add real ComfyUI integration for images in main.py.
- Add project save/load endpoints in backend (JSON files in a projects/ dir).
- Frontend can have "Save Project" that POSTs the full book to backend.
- History of generations per page.

Run the backend alongside the app (via http.server or serve the HTML from FastAPI static).

Let me know if you want me to expand the image generation code or add save/load next!