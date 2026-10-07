from __future__ import annotations
from pathlib import Path
from pypdf import PdfReader
from PIL import Image
from io import BytesIO

def validate_pdf(path: Path, expected_size: tuple[float, float], bleed: bool,
                 colouring: bool = False, require_artwork: bool = True,
                 artwork_width_inches: float | None = None,
                 artwork_height_inches: float | None = None) -> list[str]:
    errors = []
    reader = PdfReader(str(path))
    if not reader.pages:
        return ["PDF has no pages"]
    expected = tuple(round(v * 72, 2) for v in expected_size)
    for number, page in enumerate(reader.pages, 1):
        actual = (round(float(page.mediabox.width), 2), round(float(page.mediabox.height), 2))
        if actual != expected:
            errors.append(f"page {number}: size {actual}pt, expected {expected}pt")
        images = list(getattr(page, "images", []))
        if not images and require_artwork:
            errors.append(f"page {number}: no raster artwork found")
            continue
        for image in images:
            try:
                im = Image.open(BytesIO(image.data))
                displayed_w = artwork_width_inches or expected_size[0]
                displayed_h = artwork_height_inches or expected_size[1]
                min_dpi = min(im.width / displayed_w, im.height / (displayed_h or 1))
                if min_dpi < 300:
                    errors.append(f"page {number}: image resolution below 300 DPI")
                if colouring:
                    colors = im.convert("RGB").getcolors(maxcolors=3)
                    if colors is None or any(not (r == g == b and r in (0, 255))
                                              for _, (r, g, b) in colors):
                        errors.append(f"page {number}: colouring artwork contains colour or greys")
            except Exception as exc:
                errors.append(f"page {number}: unreadable artwork ({exc})")
    fonts = []
    for page in reader.pages:
        for font in (page.get("/Resources", {}).get("/Font", {}) or {}).values():
            obj = font.get_object()
            descriptor = obj.get("/FontDescriptor")
            if descriptor and (descriptor.get_object().get("/FontFile") or
                               descriptor.get_object().get("/FontFile2") or
                               descriptor.get_object().get("/FontFile3")):
                fonts.append(obj)
    if not fonts:
        errors.append("no embedded fonts found")
    return errors

def assert_valid(*args, **kwargs):
    errors = validate_pdf(*args, **kwargs)
    if errors:
        raise ValueError("Validation failed:\n- " + "\n- ".join(errors))
