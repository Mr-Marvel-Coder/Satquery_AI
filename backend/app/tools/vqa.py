"""Single-image visual question answering.

The only tool where the model is genuinely the answer rather than the narrator.
Sensor context is prepended to every prompt — without it Qwen reads a SAR scene
as a black-and-white photograph and calls dark water "shadow".
"""
from __future__ import annotations

from ..geo import indices as ix
from ..models import qwen
from .base import Tool, ToolResult


class VQATool(Tool):
    name = "vqa"
    version = "0.1"
    label = "Visual QA"
    accepts = ["single", "bitemporal", "cross_modal"]
    kind = "teal"

    def run(self, scenes: list, params: dict) -> ToolResult:
        scene = scenes[0]
        question = params.get("question") or "Describe the land cover in this image."

        # Give the model whatever is cheaply computable, so it never has to guess
        # a number it could be handed.
        measured = []
        for name in ix.available(scene):
            r = ix.compute(scene, name)
            measured.append(f"- {r['label']}: {r['coverage_pct']:.1f}% of scene above "
                            f"{r['threshold']:.2f} ({r['means']}), scene mean {r['mean']:.3f}")

        if qwen.get_model() is None:
            body = ("The vision model is not loaded on this server, so I can only report what the "
                    "deterministic tools measured:\n" + ("\n".join(measured) if measured
                    else f"no spectral indices are computable from bands {', '.join(scene.bands)}."))
            return ToolResult(
                text=body,
                stats={"model_loaded": False},
                confidence=0.4,
                confidence_basis="indices_only_no_vlm",
                detail="VLM unavailable · reported measured indices only",
            )

        prompt = (
            f"{qwen.sensor_context(scene)}\n\n"
            + (f"Measurements already computed from the raw bands — treat these as exact:\n"
               f"{chr(10).join(measured)}\n\n" if measured else "")
            + f"Question: {question}\n\n"
            "Answer in two to four sentences for a geospatial analyst. Describe only what is "
            "visible or measured. Do not estimate any percentage that is not listed above, and say "
            "so plainly if the image does not support an answer."
        )

        text, conf = qwen.chat(prompt, [_disk(scene.preview_png)])
        return ToolResult(
            text=text,
            stats={"question": question, "sensor": scene.sensor,
                   "indices_supplied": len(measured)},
            confidence=conf,
            confidence_basis="answer_token_logprob",
            detail=f"Qwen · {scene.sensor} context · {len(measured)} indices supplied",
        )


def _disk(url: str) -> str:
    from ..config import STATIC_DIR
    return str(STATIC_DIR / url.rsplit("/", 1)[-1])
