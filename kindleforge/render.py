from __future__ import annotations
from pathlib import Path
import math
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color, black, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image
from .config import BookSpec
from .backends import mock_image, generate_text, live_image
from .backends import story_plan
from .clients import OllamaClient
from .config import RuntimeConfig, load_config
from .layout import choose_layout

def _font():
    candidates = [
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"),
        Path("C:/Windows/Fonts/georgia.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
    ]
    for p in candidates:
        if p.exists():
            pdfmetrics.registerFont(TTFont("KindleForgeFont", str(p)))
            return "KindleForgeFont"
    return "Helvetica"

def _wrap(text, max_chars):
    words, lines, line = text.split(), [], ""
    for word in words:
        if len(line) + len(word) + 1 > max_chars:
            lines.append(line); line = word
        else:
            line = (line + " " + word).strip()
    if line: lines.append(line)
    return lines

def render_interior(spec: BookSpec, out: Path, image_dir: Path, mock=True,
                    config: RuntimeConfig | None = None, plan=None, manifest=None) -> Path:
    out.parent.mkdir(parents=True, exist_ok=True); image_dir.mkdir(parents=True, exist_ok=True)
    font = _font(); iw, ih = spec.interior_size
    c = canvas.Canvas(str(out), pagesize=(iw * 72, ih * 72))
    for page in range(1, spec.pages + 1):
        layout = choose_layout(page, spec.kind)
        image = image_dir / f"page-{page:03}.png"
        if mock and not image.exists():
            mock_image(image, math.ceil(iw * 300), math.ceil(ih * 300),
                       line_art=spec.kind == "colouring", label=f"{page}")
        margins = spec.margins(page)
        left, right = margins["left"] * 72, margins["right"] * 72
        top, bottom = margins["top"] * 72, margins["bottom"] * 72
        placed_w = iw * 72 - left - right
        c.setFillColor(black); c.setFont(font, 11)
        if spec.kind == "colouring":
            if not mock and not image.exists():
                image, provider = live_image(f"{spec.title}, page {page}", image,
                                              math.ceil(placed_w * 300), math.ceil((ih*72-top-bottom) * 300),
                                              True, config)
                if manifest is not None: manifest["image_backend"] = provider
            c.drawImage(ImageReader(str(image)), left, bottom,
                        placed_w, ih*72-top-bottom,
                        preserveAspectRatio=True, anchor="c", mask="auto")
            # Keep a real embedded font resource even on image-only pages.
            c.setFont(font, 1); c.setFillColor(white); c.drawString(1, 1, " ")
        else:
            image_h = (ih * 72 - top - bottom) * layout["image_ratio"]
            if not mock and not image.exists():
                image, provider = live_image(f"{spec.title}, page {page}", image,
                                              math.ceil(placed_w * 300), math.ceil(image_h * 300),
                                              False, config)
                if manifest is not None: manifest["image_backend"] = provider
            c.drawImage(ImageReader(str(image)), left, ih*72-top-image_h,
                        placed_w, image_h, preserveAspectRatio=True,
                        anchor="c", mask="auto")
            if mock:
                text = generate_text(page, spec.title, mock=True)
            else:
                client = OllamaClient(config or load_config())
                beat = (plan or {}).get("beats", [""] * spec.pages)[page - 1]
                text, model = client.generate(
                    f"Write page {page} of '{spec.title}' in 160-190 words. Page beat: {beat}. "
                    "Maintain continuity and output only story prose.",
                    "You are an acclaimed gentle illustrated-book author.")
                if manifest is not None: manifest["text_model"] = model
            y = bottom + 0.25 * 72
            for line in _wrap(text, max(35, int(placed_w / 6))):
                c.drawCentredString(iw*36, y, line); y -= 15
        c.showPage()
    c.save()
    return out

def render_cover(spec: BookSpec, out: Path, mock=True, config: RuntimeConfig | None = None,
                 image_dir: Path | None = None, manifest=None) -> Path:
    out.parent.mkdir(parents=True, exist_ok=True)
    w, h = spec.cover_size
    c = canvas.Canvas(str(out), pagesize=(w*72, h*72))
    c.setFillColor(Color(0.94, 0.88, 0.76)); c.rect(0, 0, w*72, h*72, fill=1, stroke=0)
    if not mock and image_dir:
        image_dir.mkdir(parents=True, exist_ok=True)
        art = image_dir / "cover.png"
        if not art.exists():
            art, provider = live_image(f"{spec.title} book cover art", art,
                                       int(spec.trim_size[0] * 300), int(spec.trim_size[1] * 300),
                                       spec.kind == "colouring", config)
            if manifest is not None: manifest["cover_image_backend"] = provider
        front_x = (0.125 + spec.trim_size[0] + spec.spine_width) * 72
        c.drawImage(ImageReader(str(art)), front_x, 0.125*72, spec.trim_size[0]*72,
                    spec.trim_size[1]*72, preserveAspectRatio=True, anchor="c", mask="auto")
    # Full wrap order is back, spine, front. Bleed is included in the page size.
    c.setFillColor(Color(0.20, 0.12, 0.08)); c.setFont(_font(), 26)
    c.drawCentredString((0.125 + spec.trim_size[0] + spec.spine_width + spec.trim_size[0]/2)*72,
                        h*72*0.72, spec.title)
    c.setFont(_font(), 13); c.drawCentredString(w*72/2, h*72*0.50, f"by {spec.author}")
    if spec.pages >= 79:
        c.setFont(_font(), 8); c.drawCentredString((0.125+spec.trim_size[0]+spec.spine_width/2)*72,
                                                    h*36, spec.title[:28])
    c.save(); return out
