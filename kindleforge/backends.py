"""Local model discovery and deterministic CI-safe mock backends."""
from __future__ import annotations
import os, urllib.request, json
from dataclasses import dataclass
from pathlib import Path
from PIL import Image, ImageDraw
from .config import RuntimeConfig, load_config
from .clients import OllamaClient, ComfyClient, A1111Client, prepare_line_art

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

def discover(config: RuntimeConfig | None = None) -> Discovery:
    config = config or load_config()
    ollama_url = config.ollama_url.rstrip("/")
    tags = _get_json(ollama_url + "/api/tags")
    models = [m.get("name", "") for m in (tags or {}).get("models", [])]
    candidates = [
        ("comfyui", config.comfyui_url.rstrip("/") + "/system_stats"),
        ("a1111", config.a1111_url.rstrip("/") + "/sdapi/v1/options"),
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

def generate_text(page: int, title: str, mock: bool = False, beat: str = "",
                  config: RuntimeConfig | None = None) -> str:
    if mock:
        return mock_text(page, title)
    text, _ = OllamaClient(config or load_config()).generate(
        f"Write page {page} of '{title}' in 160-190 words. Page beat: {beat}. "
        "Output only story prose.",
        "You are an acclaimed gentle illustrated-book author.")
    return text

def story_plan(title: str, pages: int, mock: bool, config: RuntimeConfig | None = None):
    if mock:
        return {"title": title, "beats": [f"Page {n}: the story advances its gentle wonder." for n in range(1, pages + 1)]}
    client = OllamaClient(config or load_config())
    text, model = client.generate(
        f"Create a concise page-by-page plan for an illustrated book titled '{title}'. "
        f"Return exactly {pages} lines, one beat per page, no numbering or commentary.",
        "You are a careful children's book editor.")
    beats = [line.strip(" -*") for line in text.splitlines() if line.strip()]
    return {"title": title, "beats": (beats + ["The story continues."] * pages)[:pages], "model": model}

def live_image(prompt: str, output: Path, width: int, height: int, colouring: bool,
               config: RuntimeConfig | None = None):
    config = config or load_config()
    selected = config.image_backend
    if selected in (None, "auto"):
        found = discover(config).image_backend
        selected = found if found != "mock" else "auto"
    final_prompt = prompt + (", clean black ink line art, white background, no shading, no fills"
                             if colouring else "")
    if selected == "comfyui":
        path = ComfyClient(config).generate(final_prompt, width, height, output)
    elif selected in ("a1111", "forge"):
        path = A1111Client(config).generate(final_prompt, width, height, output)
    else:
        raise RuntimeError("No live image backend detected. Set IMAGE_PROVIDER or use --mock.")
    if colouring:
        prepare_line_art(path)
    return path, selected
