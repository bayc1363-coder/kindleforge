"""
KindleForge local backend — text (Ollama) + image (pluggable providers).

Providers (IMAGE_PROVIDER env):
  auto         — try wan if installed, else placeholder (offline-safe)
  ollama       — not used for images; text only
  wan          — Pinokio Wan T2I bridge (optional)
  placeholder  — PIL storybook-style card (always works, for offline / UI testing)
  none         — return 503 with setup hint

Config via env (portable for 7900 XTX move):
  OLLAMA_URL, OLLAMA_MODEL
  IMAGE_PROVIDER, WAN_APP_ROOT, WAN_PYTHON_PATH, WAN_MODEL_TYPE
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import shutil
import textwrap
from datetime import datetime
from io import BytesIO
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageDraw, ImageFont
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Paths / defaults (override with env — no hard machine lock-in)
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
GENERATED_DIR = PROJECT_ROOT / "generated"
GENERATED_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_WAN_ROOT = Path(os.environ.get("WAN_APP_ROOT", r"C:\pinokio\api\wan.git\app"))
DEFAULT_WAN_PYTHON = Path(
    os.environ.get("WAN_PYTHON_PATH", str(DEFAULT_WAN_ROOT / "env" / "Scripts" / "python.exe"))
)
DEFAULT_GIT = Path(os.environ.get("WAN_GIT_PATH", r"C:\pinokio\bin\miniconda\Library\bin\git.exe"))

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
DEFAULT_OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")
IMAGE_PROVIDER = os.environ.get("IMAGE_PROVIDER", "auto").lower().strip()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="KindleForge Backend", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/generated", StaticFiles(directory=str(GENERATED_DIR)), name="generated")


class TextRequest(BaseModel):
    prompt: str
    context: str = ""
    model: str = DEFAULT_OLLAMA_MODEL


class ImageRequest(BaseModel):
    prompt: str
    style: str = ""
    provider: str | None = None  # override IMAGE_PROVIDER for this request


class GenerationResponse(BaseModel):
    text: str | None = None
    image_base64: str | None = None
    image_path: str | None = None
    message: str | None = None
    provider: str | None = None


# ---------------------------------------------------------------------------
# Ollama helpers
# ---------------------------------------------------------------------------

async def ollama_reachable() -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            if r.status_code != 200:
                return {"ok": False, "error": f"status {r.status_code}"}
            models = [m.get("name", "") for m in r.json().get("models", [])]
            return {"ok": True, "models": models}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def model_available(name: str, models: list[str]) -> bool:
    if not name:
        return False
    if name in models:
        return True
    # ollama often lists "llama3.2:latest" when user asks for "llama3.2"
    base = name.split(":")[0]
    return any(m == name or m.startswith(base + ":") or m == base for m in models)


# ---------------------------------------------------------------------------
# Text generation
# ---------------------------------------------------------------------------

@app.post("/generate-text", response_model=GenerationResponse)
async def generate_text(req: TextRequest):
    """Call local Ollama and return page text."""
    model = (req.model or DEFAULT_OLLAMA_MODEL).strip() or DEFAULT_OLLAMA_MODEL

    system_bits = [
        "You are a talented author of warm, whimsical illustrated children's books.",
        "Write gentle, slightly magical prose suitable for young readers.",
        "Output ONLY the story page text — no titles, no markdown, no commentary.",
    ]
    user_parts = []
    if req.context.strip():
        user_parts.append(req.context.strip())
    user_parts.append(req.prompt.strip())
    user_parts.append(
        "Write a complete page of about 160–190 words. "
        "Maintain continuity with any previous pages above. "
        "Output only the page text."
    )
    full_prompt = "\n\n".join(user_parts)

    payload = {
        "model": model,
        "prompt": full_prompt,
        "system": " ".join(system_bits),
        "stream": False,
        "options": {
            "temperature": 0.75,
            "num_predict": 400,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
            if response.status_code != 200:
                detail = response.text[:500]
                raise HTTPException(
                    status_code=502,
                    detail=(
                        f"Ollama returned {response.status_code} for model '{model}'. "
                        f"Is the model pulled? Try: ollama pull {model}. Body: {detail}"
                    ),
                )
            data = response.json()
            generated = (data.get("response") or "").strip()
            if not generated:
                raise HTTPException(
                    status_code=502,
                    detail="Ollama returned empty text. Check the model is loaded.",
                )
            return GenerationResponse(text=generated, provider="ollama", message="ok")
    except HTTPException:
        raise
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Cannot reach Ollama at {OLLAMA_URL}. "
                "Start the Ollama app or run: ollama serve"
            ),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ollama error: {e}. Model='{model}'. Is Ollama running?",
        )


# ---------------------------------------------------------------------------
# Image generation providers
# ---------------------------------------------------------------------------

def resolve_wan_python() -> Path:
    if DEFAULT_WAN_PYTHON.exists():
        return DEFAULT_WAN_PYTHON
    found = shutil.which("python") or shutil.which("python3")
    if found:
        return Path(found)
    raise RuntimeError(
        f"Wan Python not found (expected {DEFAULT_WAN_PYTHON}). "
        "Set WAN_PYTHON_PATH or install Wan via Pinokio."
    )


def resolve_wan_root() -> Path:
    if DEFAULT_WAN_ROOT.exists():
        return DEFAULT_WAN_ROOT.resolve()
    raise RuntimeError(
        f"Wan app root not found (expected {DEFAULT_WAN_ROOT}). "
        "Set WAN_APP_ROOT or install Wan via Pinokio."
    )


def wan_t2i_script_path() -> Path:
    script = ROOT / "scripts" / "wan_t2i.py"
    if script.exists():
        return script
    raise RuntimeError(f"Missing bridge script: {script}")


async def generate_image_wan(prompt: str) -> dict:
    python = resolve_wan_python()
    wan_root = resolve_wan_root()
    script = wan_t2i_script_path()

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = GENERATED_DIR / f"wan_t2i_{stamp}.png"
    model = os.environ.get("WAN_MODEL_TYPE", "fun_inp_1.3B")

    cmd = [
        str(python),
        str(script),
        "--prompt",
        prompt,
        "--output",
        str(output_path.resolve()),
        "--model",
        model,
        "--resolution",
        os.environ.get("WAN_RESOLUTION", "832x480"),
        "--steps",
        os.environ.get("WAN_STEPS", "20"),
        "--wan-root",
        str(wan_root),
    ]

    env = os.environ.copy()
    env["GIT_PYTHON_REFRESH"] = "quiet"
    env["WAN_APP_ROOT"] = str(wan_root)
    env["WAN_MODEL_TYPE"] = model
    if DEFAULT_GIT.exists():
        env["GIT_PYTHON_GIT_EXECUTABLE"] = str(DEFAULT_GIT)

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
        cwd=str(wan_root),
    )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)
    out = (stdout or b"").decode("utf-8", errors="replace").strip()
    err = (stderr or b"").decode("utf-8", errors="replace").strip()

    if proc.returncode != 0:
        raise RuntimeError(out or err[-1500:] or f"exit {proc.returncode}")

    try:
        payload = json.loads(out.splitlines()[-1] if out else "{}")
        if payload.get("success") and payload.get("path"):
            p = Path(payload["path"])
            if p.exists():
                # Copy into generated if needed
                dest = GENERATED_DIR / p.name
                if p.resolve() != dest.resolve():
                    shutil.copy2(p, dest)
                return {"image_path": f"generated/{dest.name}", "provider": "wan"}
    except json.JSONDecodeError:
        pass

    if output_path.exists():
        return {"image_path": f"generated/{output_path.name}", "provider": "wan"}

    raise RuntimeError(f"Wan produced no image. stdout={out[-400:]} stderr={err[-400:]}")


def generate_image_placeholder(prompt: str) -> dict:
    """Offline-safe illustrated card so GENERATE always does something visible."""
    w, h = 832, 480
    # Warm paper + ink palette matching the app
    bg = (248, 241, 227)
    ink = (44, 37, 34)
    accent = (63, 46, 35)
    muted = (138, 117, 102)

    img = Image.new("RGB", (w, h), bg)
    draw = ImageDraw.Draw(img)

    # Frame
    margin = 28
    draw.rectangle([margin, margin, w - margin, h - margin], outline=accent, width=3)
    draw.rectangle(
        [margin + 8, margin + 8, w - margin - 8, h - margin - 8],
        outline=(212, 196, 168),
        width=1,
    )

    try:
        font_title = ImageFont.truetype("arial.ttf", 28)
        font_body = ImageFont.truetype("arial.ttf", 18)
        font_small = ImageFont.truetype("arial.ttf", 14)
    except Exception:
        font_title = ImageFont.load_default()
        font_body = font_title
        font_small = font_title

    draw.text((w // 2, 70), "KindleForge", fill=accent, font=font_title, anchor="mt")
    draw.text(
        (w // 2, 110),
        "Illustration placeholder",
        fill=muted,
        font=font_small,
        anchor="mt",
    )

    wrapped = textwrap.fill(prompt.strip() or "(no prompt)", width=48)
    y = 160
    for line in wrapped.split("\n")[:8]:
        draw.text((w // 2, y), line, fill=ink, font=font_body, anchor="mt")
        y += 28

    draw.text(
        (w // 2, h - 70),
        "Set IMAGE_PROVIDER=wan or wire Comfy/Flux on the new PC",
        fill=muted,
        font=font_small,
        anchor="mt",
    )

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = GENERATED_DIR / f"placeholder_{stamp}.png"
    img.save(out_path, "PNG")

    buf = BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    return {
        "image_path": f"generated/{out_path.name}",
        "image_base64": b64,
        "provider": "placeholder",
        "message": "Placeholder image (local image model not configured).",
    }


async def run_image_provider(provider: str, prompt: str) -> dict:
    provider = (provider or "auto").lower().strip()

    if provider == "none":
        raise HTTPException(
            status_code=503,
            detail="IMAGE_PROVIDER=none. Set IMAGE_PROVIDER=placeholder|wan|auto.",
        )

    if provider == "placeholder":
        return generate_image_placeholder(prompt)

    if provider == "wan":
        return await generate_image_wan(prompt)

    if provider == "auto":
        # Reliable default: placeholder always works offline.
        # Real diffusion (Wan/Comfy/Flux) must be selected explicitly via
        # IMAGE_PROVIDER=wan (or future providers) — Wan T2I is optional/experimental
        # and can hang several minutes if misconfigured. On the 7900 XTX PC, set
        # IMAGE_PROVIDER to your Comfy/Flux stack once wired.
        return generate_image_placeholder(prompt)

    raise HTTPException(
        status_code=400,
        detail=f"Unknown IMAGE_PROVIDER '{provider}'. Use auto|wan|placeholder|none.",
    )


@app.post("/generate-image", response_model=GenerationResponse)
async def generate_image(req: ImageRequest):
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    full = prompt
    if req.style.strip():
        full = f"{prompt}. Style: {req.style.strip()}"

    provider = (req.provider or IMAGE_PROVIDER).lower().strip()
    print(f"[backend] Image gen provider={provider}: {full[:100]}...")

    try:
        result = await run_image_provider(provider, full)
        return GenerationResponse(
            image_base64=result.get("image_base64"),
            image_path=result.get("image_path"),
            message=result.get("message") or "ok",
            provider=result.get("provider") or provider,
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[backend] Image gen error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Image generation failed ({provider}): {e}",
        )


# ---------------------------------------------------------------------------
# Health / config
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    ollama = await ollama_reachable()
    wan_ok = DEFAULT_WAN_ROOT.exists()
    return {
        "status": "ok",
        "message": "KindleForge backend running",
        "version": "0.3.0",
        "ollama_url": OLLAMA_URL,
        "ollama_ok": ollama.get("ok", False),
        "ollama_models": ollama.get("models", []) if ollama.get("ok") else [],
        "ollama_error": ollama.get("error"),
        "default_text_model": DEFAULT_OLLAMA_MODEL,
        "image_provider": IMAGE_PROVIDER,
        "wan_root_present": wan_ok,
        "generated_dir": str(GENERATED_DIR),
    }


@app.get("/")
async def root():
    return {
        "app": "KindleForge Backend",
        "docs": "/docs",
        "health": "/health",
        "endpoints": ["/generate-text", "/generate-image"],
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
