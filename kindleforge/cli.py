from __future__ import annotations
import argparse, json, os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from .config import BookSpec, TRIM_SIZES
from .backends import discover
from .render import render_interior, render_cover
from .validate import validate_pdf

def _guard(override):
    if override: return
    now = datetime.now(ZoneInfo("Australia/Sydney")).time()
    blocked = (now >= datetime.strptime("07:30", "%H:%M").time() and now < datetime.strptime("09:00", "%H:%M").time()) or \
              (now >= datetime.strptime("15:00", "%H:%M").time() and now < datetime.strptime("18:30", "%H:%M").time())
    if blocked:
        raise SystemExit("Heavy generation is paused during the Sydney schedule guard. Re-run with --override-schedule.")

def doctor():
    d = discover()
    print(json.dumps({"ollama": {"url": d.ollama_url, "ok": d.ollama_ok, "models": d.ollama_models},
                      "image_backend": d.image_backend, "laya_importable": d.laya,
                      "laya_backend": os.getenv("LAYA_BACKEND", "torch"),
                      "gpu_visibility": {"CUDA_VISIBLE_DEVICES": os.getenv("CUDA_VISIBLE_DEVICES", ""),
                                         "HIP_VISIBLE_DEVICES": os.getenv("HIP_VISIBLE_DEVICES", "")}}, indent=2))

def generate(args):
    _guard(args.override_schedule)
    spec = BookSpec(kind=args.kind, trim=args.trim, pages=args.pages, bleed=args.bleed,
                    paper=args.paper, title=args.title, author=args.author)
    out = Path(args.output); assets = out / "assets"
    interior = render_interior(spec, out / "interior.pdf", assets, mock=args.mock)
    cover = render_cover(spec, out / "cover.pdf", mock=args.mock)
    checks = validate_pdf(interior, spec.interior_size, spec.bleed, args.kind == "colouring")
    if checks: raise SystemExit("Generated files failed validation:\n- " + "\n- ".join(checks))
    print(json.dumps({"interior": str(interior), "cover": str(cover), "validated": True}, indent=2))

def main():
    p = argparse.ArgumentParser(prog="kindleforge")
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("doctor")
    g = sub.add_parser("generate")
    g.add_argument("--kind", choices=("illustrated", "colouring"), default="illustrated")
    g.add_argument("--trim", choices=tuple(TRIM_SIZES), default="6x9")
    g.add_argument("--pages", type=int, default=24)
    g.add_argument("--paper", choices=("white", "cream", "color"), default="white")
    g.add_argument("--title", default="KindleForge Sample")
    g.add_argument("--author", default="KindleForge")
    g.add_argument("--output", default="outputs/sample")
    g.add_argument("--no-bleed", dest="bleed", action="store_false")
    g.add_argument("--mock", action="store_true", help="use deterministic local fixtures")
    g.add_argument("--override-schedule", action="store_true")
    args = p.parse_args()
    if args.command == "doctor": doctor()
    else: generate(args)

if __name__ == "__main__":
    main()
