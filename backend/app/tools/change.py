"""Multi-image change analysis. MANDATORY under PS 26167.

    "Change description or change-based visual question answering from a
     bi-temporal image pair shall be mandatory."

Differencing and a threshold. No Siamese network, no training. The model is never
asked to SEE the change — it is handed the measured facts and writes prose about
them, which is both faster and more honest than asking a general VLM to spot a
4% difference between two 10 m rasters.
"""
from __future__ import annotations

import numpy as np
from scipy.ndimage import binary_opening

from ..config import CHANGE_SIGMA, MIN_POLYGON_PX
from ..geo.transform import describe_sector, mask_to_geojson
from ..models import qwen
from .base import RGB, Tool, ToolResult, overlay_from_mask


class ChangeTool(Tool):
    name = "change"
    version = "0.1"
    label = "Bi-temporal change"
    accepts = ["bitemporal"]
    kind = "carmine"

    def run(self, scenes: list, params: dict) -> ToolResult:
        if len(scenes) < 2:
            return ToolResult(
                text="Change analysis needs two scenes of the same area at different dates.",
                confidence=0.0, confidence_basis="insufficient_inputs", abstained=True,
                detail="fewer than two scenes",
            )

        a, b = sorted(scenes[:2], key=lambda s: s.acquired or "")
        sigma = float(params.get("sigma", CHANGE_SIGMA))

        # Common bands only, so a 4-band scene and a 5-band scene still compare.
        shared = [x for x in a.bands if x in b.bands] or None
        if shared:
            av = np.nanmean(np.stack([a.band(x) for x in shared]), axis=0)
            bv = np.nanmean(np.stack([b.band(x) for x in shared]), axis=0)
        else:
            av, bv = np.nanmean(a.array, 0), np.nanmean(b.array, 0)

        h = min(av.shape[0], bv.shape[0])
        w = min(av.shape[1], bv.shape[1])
        av, bv = av[:h, :w], bv[:h, :w]

        diff = np.abs(av - bv)
        valid = np.isfinite(diff)
        if not valid.any():
            return ToolResult(
                text="The two scenes share no valid overlapping pixels.",
                confidence=0.0, confidence_basis="no_overlap", abstained=True,
                detail="empty overlap",
            )

        thr = float(np.nanmean(diff[valid]) + sigma * np.nanstd(diff[valid]))
        mask = (diff > thr) & valid
        mask = binary_opening(mask, np.ones((3, 3), bool))      # kills speckle

        pct = round(float(mask.sum()) / max(valid.sum(), 1) * 100, 2)
        geojson = mask_to_geojson(mask, a, min_px=MIN_POLYGON_PX, properties={"class": "changed"})
        n_poly = len(geojson["features"])
        sector = describe_sector(mask)

        da = (a.acquired or "date A")[:7]
        db = (b.acquired or "date B")[:7]

        # A confident mask is one whose changed pixels sit well clear of the
        # threshold; a marginal one is mostly noise scraping over the line.
        margin = float(np.nanmean(diff[mask])) / thr if mask.any() else 0.0
        conf = float(np.clip(0.45 + 0.35 * min(margin - 1.0, 1.0) + (0.15 if n_poly else 0.0), 0.1, 0.95))

        if pct < 0.4:
            fallback = (
                f"Almost nothing changed between {da} and {db} — {pct:.2f}% of the overlapping area "
                f"exceeds the {sigma:g}-sigma difference threshold, which is within what speckle and "
                f"illumination differences alone would produce. I would not call this real change."
            )
            conf = min(conf, 0.4)
        else:
            fallback = (
                f"Change affects {pct:.1f}% of the overlapping area between {da} and {db}, resolved "
                f"into {n_poly} distinct polygon{'s' if n_poly != 1 else ''} concentrated in the "
                f"{sector}. The mask comes from band-mean differencing at mean + {sigma:g} sigma, "
                f"followed by a 3x3 opening to remove speckle."
            )

        prompt = (
            f"{qwen.sensor_context(a)}\n\n"
            f"Two images of the same area were compared. Date A is {da}, date B is {db}. The change "
            "detection is already done and these numbers are exact — do not re-estimate them, and do "
            "not claim to see anything the figures do not support.\n\n"
            f"- Changed area: {pct:.2f}% of the overlapping scene\n"
            f"- Distinct change polygons: {n_poly}\n"
            f"- Concentrated in the: {sector}\n"
            f"- Method: band-mean differencing, threshold at mean + {sigma:g} standard deviations\n\n"
            "Write one short paragraph describing what most likely changed and why, noting whether "
            "seasonal variation could explain it given the two dates."
        )
        text, cbasis, = None, None
        text, ncf, cbasis = qwen.narrate(prompt, [_disk(a.preview_png), _disk(b.preview_png)], fallback)

        return ToolResult(
            text=text,
            geojson=geojson,
            overlays=[overlay_from_mask(mask, a, "change", "Change mask", "carmine", RGB["carmine"])],
            stats={
                "changed_pct": pct,
                "polygons": n_poly,
                "threshold": round(thr, 5),
                "sigma": sigma,
                "sector": sector,
                "date_a": a.acquired, "date_b": b.acquired,
                "bands_compared": shared or a.bands,
                "narration_basis": cbasis,
            },
            confidence=round(conf * (ncf if cbasis != "deterministic_template" else 1.0), 3),
            confidence_basis="deterministic_mask + " + cbasis,
            detail=f"{da} → {db} · {pct:.1f}% changed · {n_poly} polygons · {sector}",
        )


def _disk(url: str) -> str:
    from ..config import STATIC_DIR
    return str(STATIC_DIR / url.rsplit("/", 1)[-1])
