from __future__ import annotations
import argparse, json, os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from .config import BookSpec, TRIM_SIZES, load_config
from .backends import discover, story_plan
from .render import render_interior, render_cover
from .validate import validate_pdf
from .layout import engine_name

def _guard(override, windows):
    if override: return
    now = datetime.now(ZoneInfo("Australia/Sydney")).time()
    blocked = any(datetime.strptime(start, "%H:%M").time() <= now <
                 datetime.strptime(end, "%H:%M").time() for start, end in windows)
    if blocked:
        raise SystemExit("Heavy generation is paused during the Sydney schedule guard. Re-run with --override-schedule.")

def doctor():
    config = load_config(); d = discover(config)
    print(json.dumps({"ollama": {"url": d.ollama_url, "ok": d.ollama_ok, "models": d.ollama_models,
                                 "configured_model": config.ollama_model},
                      "image_backend": d.image_backend if config.image_backend in (None, "auto")
                      else config.image_backend,
                      "image_endpoints": {"comfyui": config.comfyui_url, "a1111": config.a1111_url},
                      "workflow_path": config.workflow_path,
                      "laya_importable": d.laya,
                      "laya_backend": os.getenv("LAYA_BACKEND", "torch"),
                      "gpu_visibility": {"CUDA_VISIBLE_DEVICES": os.getenv("CUDA_VISIBLE_DEVICES", ""),
                                         "HIP_VISIBLE_DEVICES": os.getenv("HIP_VISIBLE_DEVICES", "")},
                      "schedule_windows": config.schedule_windows}, indent=2))

def generate(args):
    config = load_config()
    _guard(args.override_schedule, config.schedule_windows)
    spec = BookSpec(kind=args.kind, trim=args.trim, pages=args.pages, bleed=args.bleed,
                    paper=args.paper, title=args.title, author=args.author)
    out = Path(args.output); assets = out / "assets"; out.mkdir(parents=True, exist_ok=True)
    plan = story_plan(spec.title, spec.pages, args.mock, config)
    manifest = {"title": spec.title, "kind": spec.kind, "trim": spec.trim,
                "pages": spec.pages, "bleed": spec.bleed, "paper": spec.paper,
                "spine_width": spec.spine_width, "layout_engine": "pending",
                "text_model": "mock" if args.mock else plan.get("model"),
                "image_backend": "mock" if args.mock else config.image_backend}
    interior = render_interior(spec, out / "interior.pdf", assets, mock=args.mock,
                               config=config, plan=plan, manifest=manifest)
    cover = render_cover(spec, out / "cover.pdf", mock=args.mock, config=config,
                         image_dir=assets, manifest=manifest)
    interior_errors = validate_pdf(interior, spec.interior_size, spec.bleed, args.kind == "colouring")
    cover_errors = validate_pdf(cover, spec.cover_size, True, False, require_artwork=False,
                                artwork_width_inches=spec.trim_size[0],
                                artwork_height_inches=spec.trim_size[1])
    errors = interior_errors + cover_errors
    manifest["layout_engine"] = engine_name()
    manifest["validation"] = {"interior": not interior_errors, "cover": not cover_errors,
                              "errors": errors}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    if errors: raise SystemExit("Generated files failed validation:\n- " + "\n- ".join(errors))
    print(json.dumps({"interior": str(interior), "cover": str(cover),
                      "manifest": str(out / "manifest.json"), "validated": True}, indent=2))

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
