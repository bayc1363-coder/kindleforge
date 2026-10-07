"""Local model discovery and deterministic CI-safe mock backends."""
from __future__ import annotations
import os, urllib.request, json
from dataclasses import dataclass
from pathlib import Path
from PIL import Image, ImageDraw

@dataclass
class Discovery:
    ollama_url: str
    ollama_ok: bool
    ollama_models: list[str]
    image_backend: str
    laya: bool

def _get_json(url):
    try:
        with urllib.request.urlopen(url, timeout=1.5) as r:
            return json.loads(r.read())
    except Exception:
        return None

def discover() -> Discovery:
    ollama_url = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
    tags = _get_json(ollama_url + "/api/tags")
    models = [m.get("name", "") for m in (tags or {}).get("models", [])]
    candidates = [
        ("comfyui", os.getenv("COMFYUI_URL", "http://127.0.0.1:8188") + "/system_stats"),
        ("a1111", os.getenv("A1111_URL", "http://127.0.0.1:7860") + "/sdapi/v1/options"),
    ]
    image = next((name for name, url in candidates if _get_json(url) is not None), "mock")
    try:
        import laya  # type: ignore
        laya_ok = True
    except Exception:
        laya_ok = False
    return Discovery(ollama_url, tags is not None, models, image, laya_ok)

def mock_text(page: int, title: str) -> str:
    return (f"{title} — page {page}. "
            "A small brave idea stepped into the morning light. "
            "It listened, noticed something wonderful, and carried that "
            "wonder gently onward to the next page.")

def mock_image(path: Path, width: int, height: int, line_art: bool = False, label: str = ""):
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = "1" if line_art else "RGB"
    bg = 1 if line_art else (245, 235, 215)
    image = Image.new(mode, (width, height), bg)
    d = ImageDraw.Draw(image)
    ink = 0 if line_art else (75, 55, 40)
    d.rectangle((30, 30, width - 30, height - 30), outline=ink, width=8)
    d.ellipse((width // 4, height // 5, width * 3 // 4, height * 3 // 5),
              outline=ink, width=8)
    d.arc((width // 3, height // 2, width * 2 // 3, height * 4 // 5),
          0, 180, fill=ink, width=8)
    if label:
        d.text((width // 2, height - 110), label, fill=ink, anchor="mm")
    image.save(path, dpi=(300, 300))

def generate_text(page: int, title: str, mock: bool = False) -> str:
    if mock:
        return mock_text(page, title)
    # Generation is intentionally delegated to the configured local Ollama service.
    raise RuntimeError("Live text generation is provided by the backend; use --mock for offline generation.")
