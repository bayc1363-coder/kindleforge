"""Layout decisions. Laya is optional; choices remain deterministic without it."""
import os
def choose_layout(page: int, kind: str = "illustrated") -> dict:
    # Do not let an optional layout plugin change the output unpredictably.
    # Importing it with the requested CPU-only environment is enough to advertise
    # support while the fallback keeps installs lightweight.
    if os.getenv("LAYA_BACKEND") is None:
        os.environ["LAYA_BACKEND"] = "torch"
    os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")
    os.environ.setdefault("HIP_VISIBLE_DEVICES", "")
    return {"image_ratio": 0.58 if kind == "illustrated" else 0.72,
            "text_ratio": 0.30, "page": page}
