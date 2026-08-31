"""Deterministic, instant, exact — and never the VLM's job.

The single strongest design rule in this build: if a number can be computed,
compute it. The model is handed the result as text and writes prose about it.
"""
from __future__ import annotations

import numpy as np

from ..config import NDBI_BUILT, NDVI_VEG, NDWI_WATER

EPS = 1e-6


def _norm_diff(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return (a - b) / (a + b + EPS)


def ndvi(scene) -> np.ndarray:
    return _norm_diff(scene.band("nir"), scene.band("red"))


def ndwi(scene) -> np.ndarray:
    return _norm_diff(scene.band("green"), scene.band("nir"))


def ndbi(scene) -> np.ndarray:
    return _norm_diff(scene.band("swir"), scene.band("nir"))


INDEX = {
    "ndvi": {"fn": ndvi, "needs": ("nir", "red"),   "threshold": NDVI_VEG,
             "label": "NDVI", "means": "vegetation", "kind": "moss"},
    "ndwi": {"fn": ndwi, "needs": ("green", "nir"), "threshold": NDWI_WATER,
             "label": "NDWI", "means": "open water", "kind": "teal"},
    "ndbi": {"fn": ndbi, "needs": ("swir", "nir"),  "threshold": NDBI_BUILT,
             "label": "NDBI", "means": "built-up surface", "kind": "ochre"},
}


def available(scene) -> list[str]:
    return [k for k, spec in INDEX.items() if scene.has(*spec["needs"])]


def compute(scene, name: str, threshold: float | None = None) -> dict:
    spec = INDEX[name]
    if not scene.has(*spec["needs"]):
        raise KeyError(
            f"{spec['label']} needs {' and '.join(spec['needs'])}; "
            f"scene {scene.id} has {', '.join(scene.bands)}"
        )
    thr = spec["threshold"] if threshold is None else threshold
    raw = spec["fn"](scene)
    valid = np.isfinite(raw)
    mask = (raw > thr) & valid

    return {
        "name": name,
        "label": spec["label"],
        "means": spec["means"],
        "kind": spec["kind"],
        "threshold": float(thr),
        "raw": raw,
        "mask": mask,
        "coverage_pct": round(float(mask.sum()) / max(valid.sum(), 1) * 100, 2),
        "mean": round(float(np.nanmean(raw[valid])) if valid.any() else 0.0, 4),
        "mean_inside": round(float(np.nanmean(raw[mask])) if mask.any() else 0.0, 4),
    }


def buffer_ring(mask: np.ndarray, gsd: float, metres: float = 500.0) -> np.ndarray:
    """The ring around a mask, for questions like 'is there vegetation AROUND
    the water'. Binary dilation minus the original — no scipy morphology import
    needed at call sites."""
    from scipy.ndimage import binary_dilation

    radius = max(1, int(round(metres / max(gsd, 1e-6))))
    grown = binary_dilation(mask, np.ones((3, 3), bool), iterations=radius)
    return grown & ~mask
