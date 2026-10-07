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

The text model is deliberately not pulled or changed by KindleForge. It only
discovers Ollama through `/api/tags` and uses the configured model for live
text generation. Image discovery checks common ComfyUI (8188) and
A1111/Forge (7860) endpoints, then uses the config/env fallback.

```powershell
kindleforge doctor
kindleforge generate --kind illustrated --trim 6x9 --pages 24 --mock --output outputs\illustrated
kindleforge generate --kind colouring --trim 8.5x11 --pages 24 --mock --output outputs\colouring
```

Outputs are `interior.pdf` and `cover.pdf` inside each output directory.
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
