"""HTTP clients for the local-only Ollama, ComfyUI, and A1111 services."""
from __future__ import annotations
import json, time
from pathlib import Path
import httpx
from PIL import Image, ImageFilter, ImageOps
from .config import RuntimeConfig

class LocalHTTP:
    def __init__(self, transport=None, timeout=180.0):
        self.client = httpx.Client(timeout=httpx.Timeout(timeout), transport=transport)

    def request(self, method, url, **kwargs):
        last = None
        for attempt in range(3):
            try:
                response = self.client.request(method, url, **kwargs)
                response.raise_for_status()
                return response
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                last = exc
                if attempt < 2: time.sleep(0.5 * (2 ** attempt))
        raise RuntimeError(f"Local service unavailable after retries: {last}")

class OllamaClient(LocalHTTP):
    def __init__(self, config: RuntimeConfig, transport=None):
        super().__init__(transport)
        self.config = config
        self.model = None

    def choose_model(self):
        ps = self.request("GET", self.config.ollama_url.rstrip("/") + "/api/ps").json()
        loaded = [m.get("name", "") for m in ps.get("models", [])]
        tags = self.request("GET", self.config.ollama_url.rstrip("/") + "/api/tags").json()
        available = [m.get("name", "") for m in tags.get("models", [])]
        requested = self.config.ollama_model
        candidate = requested or (loaded[0] if loaded else (available[0] if available else None))
        if not candidate:
            raise RuntimeError("Ollama has no available model; KindleForge never pulls models.")
        if loaded and not any(candidate == x or candidate.split(":")[0] == x.split(":")[0] for x in loaded):
            raise RuntimeError(f"Refusing model '{candidate}': Ollama currently has '{loaded[0]}' resident. "
                               "Set OLLAMA_MODEL to the resident model; KindleForge will not load another.")
        if not loaded:
            raise RuntimeError(f"Refusing model '{candidate}': Ollama has no model loaded in /api/ps.")
        self.model = loaded[0]
        return self.model

    def generate(self, prompt: str, system: str = ""):
        model = self.choose_model()
        data = self.request("POST", self.config.ollama_url.rstrip("/") + "/api/generate",
                            json={"model": model, "prompt": prompt, "system": system,
                                  "stream": False, "options": {"temperature": 0.7, "num_predict": 500}}).json()
        result = (data.get("response") or "").strip()
        if not result:
            raise RuntimeError("Ollama returned empty text.")
        return result, model

class ComfyClient(LocalHTTP):
    def __init__(self, config: RuntimeConfig, transport=None):
        super().__init__(transport); self.config = config

    def generate(self, prompt: str, width: int, height: int, output: Path):
        workflow = _comfy_workflow(self.config.workflow_path, prompt, width, height)
        base = self.config.comfyui_url.rstrip("/")
        pid = self.request("POST", base + "/prompt", json={"prompt": workflow}).json()["prompt_id"]
        for _ in range(180):
            history = self.request("GET", f"{base}/history/{pid}").json()
            if pid in history and history[pid].get("outputs"):
                for node in history[pid]["outputs"].values():
                    for item in node.get("images", []):
                        content = self.request("GET", base + "/view", params=item).content
                        output.write_bytes(content); return output
            time.sleep(1)
        raise RuntimeError("ComfyUI timed out waiting for image history.")

class A1111Client(LocalHTTP):
    def __init__(self, config: RuntimeConfig, transport=None):
        super().__init__(transport); self.config = config

    def generate(self, prompt: str, width: int, height: int, output: Path):
        data = self.request("POST", self.config.a1111_url.rstrip("/") + "/sdapi/v1/txt2img",
                            json={"prompt": prompt, "width": width, "height": height,
                                  "steps": 20, "batch_size": 1}).json()
        import base64
        raw = base64.b64decode(data["images"][0].split(",", 1)[-1])
        output.write_bytes(raw); return output

def _comfy_workflow(path, prompt, width, height):
    if path and Path(path).exists():
        workflow = json.loads(Path(path).read_text())
        # Common API-export node fields; preserve all user workflow settings.
        for node in workflow.values():
            inputs = node.get("inputs", {})
            if "text" in inputs: inputs["text"] = prompt
            if "width" in inputs: inputs["width"] = width
            if "height" in inputs: inputs["height"] = height
        return workflow
    return {
        "3": {"class_type": "KSampler", "inputs": {"seed": 42, "steps": 20, "cfg": 7,
          "sampler_name": "euler", "scheduler": "normal", "denoise": 1,
          "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "model.safetensors"}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": "blurry, low quality", "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "kindleforge", "images": ["8", 0]}},
    }

def prepare_line_art(path: Path):
    image = Image.open(path).convert("L")
    image = image.filter(ImageFilter.MedianFilter(size=3))
    image = ImageOps.autocontrast(image)
    image = image.point(lambda pixel: 255 if pixel > 185 else 0, mode="1")
    image.save(path, dpi=(300, 300))
    return path
