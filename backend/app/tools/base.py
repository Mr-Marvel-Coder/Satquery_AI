"""Contract 1. Every specialist implements this and nothing more.

The point of the ABC is stated in section 13 of the build spec: because every
specialist sits behind a fixed contract, swapping a NumPy heuristic for a trained
model later requires no controller changes.
"""
from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolResult:
    text: str = ""
    geojson: dict | None = None
    overlays: list[dict] = field(default_factory=list)   # OverlayRef-shaped
    stats: dict = field(default_factory=dict)
    confidence: float = 0.0
    confidence_basis: str = ""
    abstained: bool = False
    detail: str = ""                                     # one line for the trace
    runtime_ms: int = 0


class Tool(ABC):
    name: str = "tool"
    version: str = "0.1"
    label: str = "Tool"
    accepts: list[str] = ["single"]      # single | bitemporal | cross_modal
    kind: str = "teal"                   # legend key

    @abstractmethod
    def run(self, scenes: list, params: dict) -> ToolResult: ...

    def __call__(self, scenes: list, params: dict) -> ToolResult:
        t0 = time.perf_counter()
        try:
            result = self.run(scenes, params)
        except Exception as exc:                      # a failing tool must not kill the run
            result = ToolResult(
                text=f"{self.label} could not run: {exc}",
                confidence=0.0,
                confidence_basis="tool_error",
                abstained=True,
                detail=str(exc)[:160],
            )
        result.runtime_ms = int((time.perf_counter() - t0) * 1000)
        return result


def overlay_from_mask(mask, scene, name: str, label: str, kind: str, rgb: tuple[int, int, int]) -> dict:
    """Write a mask as a transparent PNG that Leaflet can drape on the scene."""
    import numpy as np
    from PIL import Image

    from ..config import PREVIEW_MAX_PX, STATIC_DIR

    h, w = mask.shape
    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = rgb
    rgba[..., 3] = np.where(mask, 190, 0).astype(np.uint8)

    img = Image.fromarray(rgba, "RGBA")
    if max(img.size) > PREVIEW_MAX_PX:
        img.thumbnail((PREVIEW_MAX_PX, PREVIEW_MAX_PX), Image.NEAREST)

    fname = f"{scene.id}_{name}.png"
    img.save(STATIC_DIR / fname, optimize=True)
    return {"id": name, "label": label, "kind": kind,
            "url": f"/static/{fname}", "bounds": scene.bounds}


# Legend keys, shared with the frontend palette.
RGB = {
    "teal":    (11, 114, 133),
    "ochre":   (169, 97, 10),
    "carmine": (176, 38, 76),
    "moss":    (47, 122, 62),
}
