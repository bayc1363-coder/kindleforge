# MINIPC setup

KindleForge runs locally on Boris's Windows MINIPC. It never uploads or
publishes to KDP and does not require credentials.

## Install

Install Python 3.10+, Ollama, and (optionally) the local image service already
installed on the machine. In PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\python -m pip install -e .
$env:OLLAMA_MODEL = "qwen38-uncensored"
$env:LAYA_BACKEND = "torch"
$env:CUDA_VISIBLE_DEVICES = ""
$env:HIP_VISIBLE_DEVICES = ""
```

Copy `kindleforge.toml.example` to `kindleforge.toml` to configure endpoints,
the optional resident model, an exported ComfyUI API workflow, and Sydney
schedule windows. Precedence is environment variables, then TOML, then
auto-detection. The text model is deliberately not pulled or changed:
KindleForge checks `/api/ps` first and refuses to switch models while another
is resident. Image discovery checks ComfyUI (8188) and A1111/Forge (7860).

For ComfyUI, export an API-format workflow JSON and set
`COMFY_WORKFLOW=path\to\workflow.json`; the default workflow expects a
checkpoint named `model.safetensors`, so an exported workflow is recommended.
For A1111/Forge, enable its API and make sure `/sdapi/v1/txt2img` is reachable.
The selected client requests the placed pixel dimensions at 300 DPI. Colouring
prompts add a line-art constraint and generated images are desaturated,
thresholded to 1-bit, and lightly despeckled.

```powershell
kindleforge doctor
kindleforge generate --kind illustrated --trim 6x9 --pages 24 --mock --output outputs\illustrated
kindleforge generate --kind colouring --trim 8.5x11 --pages 24 --mock --output outputs\colouring
```

Live runs (Ollama and an image backend must already be running):

```powershell
kindleforge doctor
kindleforge generate --kind illustrated --trim 6x9 --pages 24 --output outputs\illustrated-live
kindleforge generate --kind colouring --trim 8.5x11 --pages 24 --output outputs\colouring-live
```

Outputs are `interior.pdf`, `cover.pdf`, and `manifest.json` inside each output directory.
`--mock` is deterministic and is used by CI; omit it only after wiring the
local image backend and live text service. Heavy generation is refused during
07:30–09:00 and 15:00–18:30 Australia/Sydney; pass
`--override-schedule` for an intentional exception. Planning, layout and
validation are not blocked.

## Print rules

Supported trims are 6x9, 8.5x11 and 8.5x8.5. Interior pages are trim size
plus 0.125 inch bleed on every edge when bleed is enabled. Without bleed they
are the exact trim size. The full-wrap cover is back + spine + front plus
0.125 inch bleed on each edge. The spine uses KDP's paperback formula:

* white paper: page count × 0.002252 in
* cream paper: page count × 0.0025 in
* colour paper: page count × 0.002347 in

The implementation uses KDP's official paperback trim, bleed, and cover
guidance: <https://kdp.amazon.com/en_US/help/topic/G201834180> and
<https://kdp.amazon.com/en_US/help/topic/G201953020>. Always check the
current KDP cover calculator before submission because Amazon can change
paper stock or product constraints.

`kindleforge` validates PDF page size, artwork resolution (300 DPI minimum),
embedded fonts, and the colouring-book invariant that artwork is pure
black/white line art without fills or greys.
