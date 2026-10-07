from pathlib import Path
from kindleforge.config import BookSpec
from kindleforge.render import render_interior, render_cover
from kindleforge.validate import validate_pdf

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
