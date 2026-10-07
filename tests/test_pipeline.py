from pathlib import Path
from kindleforge.config import BookSpec
from kindleforge.render import render_interior, render_cover
from kindleforge.validate import validate_pdf
from kindleforge.config import RuntimeConfig
from kindleforge.clients import OllamaClient, A1111Client, ComfyClient
import base64
from PIL import Image
from io import BytesIO
import json

def test_illustrated_mock_pipeline(tmp_path):
    spec = BookSpec(pages=24, trim="6x9", bleed=True)
    interior = render_interior(spec, tmp_path / "interior.pdf", tmp_path / "assets")
    render_cover(spec, tmp_path / "cover.pdf")
    assert validate_pdf(interior, spec.interior_size, True) == []

def test_colouring_is_black_and_white(tmp_path):
    spec = BookSpec(kind="colouring", pages=24, trim="8.5x11", bleed=False)
    interior = render_interior(spec, tmp_path / "interior.pdf", tmp_path / "assets")
    assert validate_pdf(interior, spec.interior_size, False, True) == []

def test_cover_formula():
    assert round(BookSpec(pages=100, paper="white").spine_width, 6) == 0.2252
    assert BookSpec(trim="8.5x8.5").cover_size[0] > 17

def test_cover_pdf_is_validated(tmp_path):
    spec = BookSpec(pages=78)
    cover = render_cover(spec, tmp_path / "cover.pdf")
    assert validate_pdf(cover, spec.cover_size, True, require_artwork=False) == []

def test_kdp_bleed_and_mirrored_gutter():
    spec = BookSpec(pages=151, trim="6x9", bleed=True)
    assert spec.interior_size == (6.125, 9.25)
    assert spec.gutter == 0.5
    assert spec.margins(1)["left"] == 0.5
    assert spec.margins(2)["right"] == 0.5
    assert BookSpec(pages=24, bleed=False).margins(1)["right"] == 0.25

def test_ollama_client_selects_resident_model():
    def handler(request):
        if request.url.path == "/api/ps":
            return httpx.Response(200, json={"models": [{"name": "qwen38-uncensored:latest"}]})
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": "qwen38-uncensored:latest"}]})
        return httpx.Response(200, json={"response": "A coherent page."})
    import httpx
    client = OllamaClient(RuntimeConfig(ollama_url="http://ollama"), transport=httpx.MockTransport(handler))
    text, model = client.generate("write a page")
    assert text == "A coherent page." and model.startswith("qwen38")

def test_a1111_client_decodes_image(tmp_path):
    image = Image.new("RGB", (12, 12), "white"); buf = BytesIO(); image.save(buf, "PNG")
    encoded = base64.b64encode(buf.getvalue()).decode()
    import httpx
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"images": [encoded]}))
    path = A1111Client(RuntimeConfig(a1111_url="http://a1111"), transport).generate(
        "a", 12, 12, tmp_path / "a.png")
    assert Image.open(path).size == (12, 12)

def test_comfy_client_polls_history(tmp_path):
    def handler(request):
        if request.url.path == "/prompt":
            return httpx.Response(200, json={"prompt_id": "p1"})
        if request.url.path == "/history/p1":
            return httpx.Response(200, json={"p1": {"outputs": {"9": {"images": [
                {"filename": "a.png", "subfolder": "", "type": "output"}]}}}})
        return httpx.Response(200, content=b"png")
    import httpx
    transport = httpx.MockTransport(handler)
    out = ComfyClient(RuntimeConfig(comfyui_url="http://comfy"), transport).generate(
        "a", 10, 10, tmp_path / "c.png")
    assert out.read_bytes() == b"png"
