from __future__ import annotations
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color, black, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image
from .config import BookSpec
from .backends import mock_image, generate_text
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

def render_interior(spec: BookSpec, out: Path, image_dir: Path, mock=True) -> Path:
    out.parent.mkdir(parents=True, exist_ok=True); image_dir.mkdir(parents=True, exist_ok=True)
    font = _font(); iw, ih = spec.interior_size
    c = canvas.Canvas(str(out), pagesize=(iw * 72, ih * 72))
    for page in range(1, spec.pages + 1):
        layout = choose_layout(page, spec.kind)
        img_px = (int(iw * 300), int(ih * 300))
        image = image_dir / f"page-{page:03}.png"
        if mock and not image.exists():
            mock_image(image, *img_px, line_art=spec.kind == "colouring", label=f"{page}")
        margin = 0.375 * 72 if spec.bleed else 0.5 * 72
        c.setFillColor(black); c.setFont(font, 11)
        if spec.kind == "colouring":
            c.drawImage(ImageReader(str(image)), margin, margin + 0.25*72,
                        iw*72-2*margin, ih*72-2*margin-0.25*72,
                        preserveAspectRatio=True, anchor="c", mask="auto")
        else:
            image_h = ih * 72 * layout["image_ratio"]
            c.drawImage(ImageReader(str(image)), margin, ih*72-margin-image_h,
                        iw*72-2*margin, image_h, preserveAspectRatio=True,
                        anchor="c", mask="auto")
            text = generate_text(page, spec.title, mock=mock)
            y = margin + 0.65 * 72
            for line in _wrap(text, max(35, int((iw * 72 - 2*margin) / 6))):
                c.drawCentredString(iw*36, y, line); y -= 15
        c.showPage()
    c.save()
    return out

def render_cover(spec: BookSpec, out: Path, mock=True) -> Path:
    out.parent.mkdir(parents=True, exist_ok=True)
    w, h = spec.cover_size
    c = canvas.Canvas(str(out), pagesize=(w*72, h*72))
    c.setFillColor(Color(0.94, 0.88, 0.76)); c.rect(0, 0, w*72, h*72, fill=1, stroke=0)
    # Full wrap order is back, spine, front. Bleed is included in the page size.
    c.setFillColor(Color(0.20, 0.12, 0.08)); c.setFont(_font(), 26)
    c.drawCentredString((0.125 + spec.trim_size[0] + spec.spine_width + spec.trim_size[0]/2)*72,
                        h*72*0.72, spec.title)
    c.setFont(_font(), 13); c.drawCentredString(w*72/2, h*72*0.50, f"by {spec.author}")
    c.setFont(_font(), 8); c.drawCentredString((0.125+spec.trim_size[0]+spec.spine_width/2)*72,
                                                h*36, spec.title[:28])
    c.save(); return out
