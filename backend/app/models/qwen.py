"""The vision backbone, loaded lazily and never load-bearing.

Two things matter here.

1. **Sensor-aware prompting.** Qwen is not remote-sensing adapted and cannot be
   fine-tuned inside 48 hours, so the gap is closed at inference using metadata
   the loader already has. Ten lines, highest value per line in the build.

2. **The service runs without it.** If torch is absent or the GPU OOMs, VQA and
   grounding degrade to a deterministic narrator and say so in the trace. The
   two mandatory clauses — fusion and change — are pure NumPy and are unaffected
   either way. A missing model must never be a missing demo.
"""
from __future__ import annotations

import logging
import math
import threading

from ..config import LOAD_IN_4BIT, MAX_NEW_TOKENS, MODEL_BACKEND, MODEL_ID

log = logging.getLogger("satquery.qwen")

_LOCK = threading.Lock()
_STATE: dict = {"tried": False, "model": None, "processor": None, "error": None}

SENSOR_CONTEXT = {
    "S1": ("This is a Sentinel-1 SAR image at {gsd:g} m resolution. Bright areas mean high radar "
           "backscatter (buildings, rough terrain, vegetation). Dark areas mean smooth surfaces "
           "(calm water, roads, bare soil). This is radar, not a photograph — do not describe "
           "colour, and do not interpret dark areas as shadow."),
    "S2": ("This is a Sentinel-2 optical satellite image at {gsd:g} m resolution, viewed from "
           "directly above. Bands present: {bands}."),
    "unknown": "This is a satellite image at {gsd:g} m resolution, viewed from directly above.",
}


def sensor_context(scene) -> str:
    tmpl = SENSOR_CONTEXT.get(scene.sensor, SENSOR_CONTEXT["unknown"])
    return tmpl.format(gsd=scene.gsd, bands=", ".join(scene.bands))


def status() -> dict:
    return {
        "backend": MODEL_BACKEND,
        "model_id": MODEL_ID,
        "loaded": _STATE["model"] is not None,
        "error": _STATE["error"],
    }


def is_available() -> bool:
    return get_model() is not None


def get_model():
    """Load once, on first use. Returns None when running without the VLM."""
    if MODEL_BACKEND == "stub":
        return None
    if _STATE["tried"]:
        return _STATE["model"]

    with _LOCK:
        if _STATE["tried"]:
            return _STATE["model"]
        _STATE["tried"] = True
        try:
            import torch
            from transformers import AutoProcessor

            try:
                from transformers import Qwen2_5_VLForConditionalGeneration as VLM
            except ImportError:                      # older transformers
                from transformers import Qwen2VLForConditionalGeneration as VLM

            kwargs = {"torch_dtype": torch.float16, "device_map": "auto"}
            if LOAD_IN_4BIT:
                from transformers import BitsAndBytesConfig
                kwargs["quantization_config"] = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_compute_dtype=torch.float16,
                    bnb_4bit_quant_type="nf4",
                    bnb_4bit_use_double_quant=True,
                )

            log.info("loading %s (4bit=%s)", MODEL_ID, LOAD_IN_4BIT)
            _STATE["model"] = VLM.from_pretrained(MODEL_ID, **kwargs).eval()
            _STATE["processor"] = AutoProcessor.from_pretrained(MODEL_ID)
            log.info("model ready")
        except Exception as exc:
            _STATE["error"] = f"{type(exc).__name__}: {exc}"
            _STATE["model"] = None
            if MODEL_BACKEND == "qwen":
                raise
            log.warning("VLM unavailable, falling back to deterministic narration — %s", exc)

    return _STATE["model"]


def chat(prompt: str, image_paths: list[str] | None = None,
         max_new_tokens: int | None = None) -> tuple[str, float]:
    """One turn. Returns (text, mean answer-token probability).

    The confidence is the geometric mean of the sampled tokens' probabilities —
    a real signal about how sure the decoder was, not a number we invented.
    """
    model = get_model()
    if model is None:
        raise RuntimeError("VLM not loaded")

    import torch
    from PIL import Image

    proc = _STATE["processor"]
    content = []
    images = []
    for p in (image_paths or []):
        img = Image.open(p).convert("RGB")
        images.append(img)
        content.append({"type": "image"})
    content.append({"type": "text", "text": prompt})

    text = proc.apply_chat_template(
        [{"role": "user", "content": content}], tokenize=False, add_generation_prompt=True
    )
    inputs = proc(text=[text], images=images or None, return_tensors="pt").to(model.device)

    with torch.inference_mode():
        out = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens or MAX_NEW_TOKENS,
            do_sample=False,
            output_scores=True,
            return_dict_in_generate=True,
        )

    seq = out.sequences[0][inputs["input_ids"].shape[1]:]
    answer = proc.decode(seq, skip_special_tokens=True).strip()

    logps = []
    for step, score in enumerate(out.scores):
        if step >= seq.shape[0]:
            break
        logps.append(float(torch.log_softmax(score[0].float(), -1)[seq[step]]))
    conf = math.exp(sum(logps) / len(logps)) if logps else 0.0

    return answer, round(min(max(conf, 0.0), 1.0), 3)


def narrate(prompt: str, image_paths: list[str] | None, fallback: str) -> tuple[str, float, str]:
    """Prose for a result whose numbers are already known.

    The VLM writes it when present. When it is not, the caller's deterministic
    sentence is returned and the basis says so — the trace never claims model
    confidence for text a template produced.
    """
    if get_model() is None:
        return fallback, 0.99, "deterministic_template"
    try:
        text, conf = chat(prompt, image_paths)
        return text, conf, "answer_token_logprob"
    except Exception as exc:
        log.warning("narration failed, using template — %s", exc)
        return fallback, 0.99, "deterministic_template"
