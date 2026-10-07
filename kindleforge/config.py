from dataclasses import dataclass, field
from pathlib import Path
import os
import json
import tomllib

TRIM_SIZES = {
    "6x9": (6.0, 9.0),
    "8.5x11": (8.5, 11.0),
    "8.5x8.5": (8.5, 8.5),
}
PAPER_SPINE_IN = {
    "white": 0.002252,
    "cream": 0.0025,
    "color": 0.002347,
}

DEFAULT_CONFIG = Path("kindleforge.toml")

@dataclass
class RuntimeConfig:
    ollama_url: str = "http://127.0.0.1:11434"
    ollama_model: str | None = None
    comfyui_url: str = "http://127.0.0.1:8188"
    a1111_url: str = "http://127.0.0.1:7860"
    image_backend: str | None = None
    workflow_path: str | None = None
    schedule_windows: list[tuple[str, str]] = field(
        default_factory=lambda: [("07:30", "09:00"), ("15:00", "18:30")])

def load_config(path: Path | None = None) -> RuntimeConfig:
    path = path or Path(os.getenv("KINDLEFORGE_CONFIG", DEFAULT_CONFIG))
    raw = {}
    if path.exists():
        with path.open("rb") as fh:
            raw = tomllib.load(fh)
    image = raw.get("image", {})
    schedule = raw.get("schedule", {}).get("windows")
    cfg = RuntimeConfig(
        ollama_url=raw.get("ollama", {}).get("url", RuntimeConfig.ollama_url),
        ollama_model=raw.get("ollama", {}).get("model"),
        comfyui_url=image.get("comfyui_url", RuntimeConfig.comfyui_url),
        a1111_url=image.get("a1111_url", RuntimeConfig.a1111_url),
        image_backend=image.get("backend"),
        workflow_path=image.get("workflow_path"),
        schedule_windows=[tuple(x) for x in schedule] if schedule else RuntimeConfig().schedule_windows,
    )
    # Environment is intentionally the highest-precedence layer.
    for attr, env in (("ollama_url", "OLLAMA_URL"), ("ollama_model", "OLLAMA_MODEL"),
                      ("comfyui_url", "COMFYUI_URL"), ("a1111_url", "A1111_URL"),
                      ("image_backend", "IMAGE_PROVIDER"), ("workflow_path", "COMFY_WORKFLOW")):
        if os.getenv(env):
            setattr(cfg, attr, os.environ[env])
    if os.getenv("KINDLEFORGE_SCHEDULE_WINDOWS"):
        cfg.schedule_windows = [tuple(x) for x in json.loads(os.environ["KINDLEFORGE_SCHEDULE_WINDOWS"])]
    return cfg

@dataclass(frozen=True)
class BookSpec:
    kind: str = "illustrated"
    trim: str = "6x9"
    pages: int = 24
    bleed: bool = True
    paper: str = "white"
    title: str = "KindleForge Sample"
    author: str = "KindleForge"

    @property
    def trim_size(self):
        if self.trim not in TRIM_SIZES:
            raise ValueError(f"Unsupported trim {self.trim}; choose {', '.join(TRIM_SIZES)}")
        return TRIM_SIZES[self.trim]

    @property
    def spine_width(self):
        if self.pages < 24:
            raise ValueError("KDP paperback books require at least 24 pages")
        if self.paper not in PAPER_SPINE_IN:
            raise ValueError(f"Unsupported paper {self.paper}")
        return self.pages * PAPER_SPINE_IN[self.paper]

    @property
    def interior_size(self):
        w, h = self.trim_size
        return (w + (0.125 if self.bleed else 0), h + (0.25 if self.bleed else 0))

    @property
    def gutter(self):
        bands = ((150, 0.375), (300, 0.5), (500, 0.625), (700, 0.75), (828, 0.875))
        for maximum, margin in bands:
            if self.pages <= maximum:
                return margin
        return 0.875

    def margins(self, page: int) -> dict[str, float]:
        outside = 0.375 if self.bleed else 0.25
        # Page 1 is recto: its inside edge is the left edge.
        left, right = (self.gutter, outside) if page % 2 else (outside, self.gutter)
        vertical = 0.375 if self.bleed else 0.25
        return {"left": left, "right": right, "top": vertical, "bottom": vertical}

    @property
    def cover_size(self):
        w, h = self.trim_size
        return (2 * w + self.spine_width + 0.25, h + 0.25)
