#!/usr/bin/env python3
"""KindleForge bridge: text prompt -> Wan local image (PNG). Adapt from beatreel wan_i2v.py.

Run with your Wan's venv Python (same as beatreel).

Usage example:
  python wan_t2i.py --prompt "..." --output "path/to/image.png" --model "..." --wan-root "C:\pinokio\..."
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Wan2GP text-to-image bridge for KindleForge")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default=os.environ.get("WAN_MODEL_TYPE", "fun_inp_1.3B"))
    parser.add_argument("--resolution", default="832x480")
    parser.add_argument("--steps", type=int, default=20)
    parser.add_argument("--wan-root", default=os.environ.get("WAN_APP_ROOT", ""))
    args = parser.parse_args()

    os.environ.setdefault("GIT_PYTHON_REFRESH", "quiet")

    wan_root = Path(args.wan_root or r"C:\pinokio\api\wan.git\app").resolve()
    if not wan_root.exists():
        print(json.dumps({"success": False, "errors": [f"Wan app root not found: {wan_root}"]}))
        return 1

    sys.path.insert(0, str(wan_root))

    # Adapt this import and run_task for T2I in your Wan version.
    # In beatreel it's for I2V with "image_start". For T2I you may need different keys
    # e.g. no image_start, or specific "text_to_image" mode, or different model_type.
    # Check your Wan app's shared/api.py or examples for T2I settings.
    try:
        from shared.api import WanGPSession
    except ImportError:
        print(json.dumps({"success": False, "errors": ["Could not import WanGPSession from shared.api in wan_root"]}))
        return 1

    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Example settings for T2I - YOU MAY NEED TO ADJUST based on your Wan installation.
    # This is a guess based on I2V pattern; test and tweak.
    settings = {
        "model_type": args.model,
        "prompt": args.prompt,
        "resolution": args.resolution,
        "num_inference_steps": args.steps,
        "client_id": "kindleforge",
        # "text_to_image": True,  # or whatever key your Wan uses for pure T2I
        # "image_start": None,   # ensure no image input
    }

    session = WanGPSession(root=wan_root, console_output=False)
    try:
        result = session.run_task(settings)
    finally:
        session.close()

    payload: dict = {
        "success": bool(result.success),
        "errors": [str(err) for err in (result.errors or [])],
        "generated_files": list(result.generated_files or []),
    }

    if result.success and result.generated_files:
        src = Path(result.generated_files[0])
        # Assume it outputs PNG or convert if needed
        if src.suffix.lower() != ".png":
            # If it outputs jpg or other, convert with PIL or ffmpeg
            try:
                from PIL import Image
                img = Image.open(src)
                img.save(output_path, "PNG")
            except Exception as e:
                payload["errors"].append(f"Could not convert to PNG: {e}")
                print(json.dumps(payload))
                return 1
        else:
            shutil.copy2(src, output_path)
        payload["path"] = str(output_path)
        payload["success"] = True

    print(json.dumps(payload))
    return 0 if payload.get("success") and payload.get("path") else 1


if __name__ == "__main__":
    raise SystemExit(main())