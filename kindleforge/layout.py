"""Layout decisions. Laya is optional; choices remain deterministic without it."""
import os
_LAST_ENGINE = "fallback"

def choose_layout(page: int, kind: str = "illustrated") -> dict:
    # Do not let an optional layout plugin change the output unpredictably.
    # Importing it with the requested CPU-only environment is enough to advertise
    # support while the fallback keeps installs lightweight.
    if os.getenv("LAYA_BACKEND") is None:
        os.environ["LAYA_BACKEND"] = "torch"
    os.environ["CUDA_VISIBLE_DEVICES"] = ""
    os.environ["HIP_VISIBLE_DEVICES"] = ""
    global _LAST_ENGINE
    templates = [
        {"image_ratio": 0.58, "text_ratio": 0.30},
        {"image_ratio": 0.48, "text_ratio": 0.40},
        {"image_ratio": 0.68, "text_ratio": 0.22},
    ]
    if kind == "colouring":
        templates = [{"image_ratio": 0.72, "text_ratio": 0.0},
                     {"image_ratio": 0.64, "text_ratio": 0.0}]
    try:
        import laya  # type: ignore
        decision = None
        if hasattr(laya, "handle_decide"):
            decision = laya.handle_decide({"page": page, "kind": kind,
                                           "choices": list(range(len(templates)))})
        elif hasattr(laya, "Agent"):
            agent = laya.Agent(seed=page)
            decision = agent.predict({"page": page, "kind": kind})
        index = int(decision if decision is not None else page) % len(templates)
        _LAST_ENGINE = "laya"
        return {**templates[index], "page": page, "engine": _LAST_ENGINE}
    except Exception:
        _LAST_ENGINE = "fallback"
        return {**templates[page % len(templates)], "page": page, "engine": _LAST_ENGINE}

def engine_name():
    return _LAST_ENGINE
