"""NDVI / NDWI / NDBI as a first-class tool.

The governing rule of this build: never let the VLM calculate something that can
be computed deterministically. This tool produces the numbers; the model is only
ever handed them as text.
"""
from __future__ import annotations

import numpy as np

from ..geo import indices as ix
from ..geo.transform import describe_sector, mask_to_geojson
from ..models import qwen
from .base import RGB, Tool, ToolResult, overlay_from_mask


class IndicesTool(Tool):
    name = "indices"
    version = "0.1"
    label = "Indices"
    accepts = ["single", "bitemporal", "cross_modal"]
    kind = "moss"

    def run(self, scenes: list, params: dict) -> ToolResult:
        scene = next((s for s in scenes if s.sensor != "S1"), scenes[0])
        wanted = params.get("indices") or ix.available(scene) or ["ndvi"]
        wanted = [w for w in wanted if w in ix.INDEX]

        usable = [w for w in wanted if scene.has(*ix.INDEX[w]["needs"])]
        if not usable:
            need = {n for w in wanted for n in ix.INDEX[w]["needs"]}
            return ToolResult(
                text=(f"I can't compute {', '.join(w.upper() for w in wanted)} from this scene. "
                      f"That needs the {', '.join(sorted(need))} bands; this file has "
                      f"{', '.join(scene.bands)}."),
                confidence=0.0, confidence_basis="missing_bands", abstained=True,
                detail=f"missing bands for {', '.join(wanted)}",
            )

        results, overlays, lines = [], [], []
        for name in usable:
            r = ix.compute(scene, name, params.get("threshold"))
            results.append(r)
            overlays.append(overlay_from_mask(
                r["mask"], scene, name, f"{r['label']} > {r['threshold']:.2f}",
                r["kind"], RGB[r["kind"]],
            ))
            lines.append(
                f"{r['label']} > {r['threshold']:.2f} covers {r['coverage_pct']:.1f}% of the scene "
                f"({r['means']}), concentrated in the {describe_sector(r['mask'])}; "
                f"scene mean {r['mean']:.3f}, mean inside the mask {r['mean_inside']:.3f}"
            )

        primary = results[0]
        geojson = mask_to_geojson(primary["mask"], scene,
                                  properties={"index": primary["name"]})

        facts = "\n".join(f"- {l}" for l in lines)
        fallback = (
            ". ".join(l[0].upper() + l[1:] for l in lines) + "."
            + " These figures are computed in NumPy from the raw band values, not estimated."
        )
        prompt = (
            f"{qwen.sensor_context(scene)}\n\n"
            "Spectral indices have already been computed from the raw bands. The figures below "
            "are exact — do not re-estimate them, and do not invent any others.\n\n"
            f"{facts}\n\n"
            "Write one short paragraph for an analyst describing what this says about the land "
            "cover. Quote the percentages given."
        )
        text, conf, basis = qwen.narrate(prompt, [_disk(scene.preview_png)], fallback)

        return ToolResult(
            text=text,
            geojson=geojson,
            overlays=overlays,
            stats={r["name"]: {k: v for k, v in r.items() if k not in ("raw", "mask")}
                   for r in results},
            confidence=round(min(0.98, 0.90 * (conf if basis != "deterministic_template" else 1.0)), 3),
            confidence_basis=f"deterministic_indices + {basis}",
            detail=" · ".join(
                f"{r['label']} {r['coverage_pct']:.1f}% @ {r['threshold']:.2f}" for r in results),
        )


class BufferIndicesTool(Tool):
    """The second half of the compound query: an index measured only in a ring
    around another index's mask. 'Water body, and is there vegetation AROUND it.'
    """
    name = "indices_ring"
    version = "0.1"
    label = "Ring statistics"
    accepts = ["single", "bitemporal", "cross_modal"]
    kind = "moss"

    def run(self, scenes: list, params: dict) -> ToolResult:
        scene = next((s for s in scenes if s.sensor != "S1"), scenes[0])
        around = params.get("around", "ndwi")
        measure = params.get("measure", "ndvi")
        metres = float(params.get("metres", 500))

        for n in (around, measure):
            if not scene.has(*ix.INDEX[n]["needs"]):
                return ToolResult(
                    text=f"{ix.INDEX[n]['label']} is not computable from bands {', '.join(scene.bands)}.",
                    confidence=0.0, confidence_basis="missing_bands", abstained=True,
                    detail=f"missing bands for {n}",
                )

        base = ix.compute(scene, around)
        ring = ix.buffer_ring(base["mask"], scene.gsd, metres)
        target = ix.compute(scene, measure)

        if not ring.any():
            return ToolResult(
                text=f"No {ix.INDEX[around]['means']} was detected, so there is no surrounding ring to measure.",
                confidence=0.3, confidence_basis="empty_mask", abstained=True,
                detail=f"{base['label']} mask empty",
            )

        vals = target["raw"][ring & np.isfinite(target["raw"])]
        mean_ring = round(float(vals.mean()), 4) if vals.size else 0.0
        frac = round(float((target["mask"] & ring).sum()) / max(ring.sum(), 1) * 100, 1)

        overlays = [
            overlay_from_mask(base["mask"], scene, around,
                              f"{base['label']} > {base['threshold']:.2f}", base["kind"], RGB[base["kind"]]),
            overlay_from_mask(target["mask"] & ring, scene, f"{measure}_ring",
                              f"{target['label']} in {metres:g} m ring", target["kind"], RGB[target["kind"]]),
        ]

        fallback = (
            f"{base['label']} identifies {ix.INDEX[around]['means']} across {base['coverage_pct']:.1f}% "
            f"of the scene, in the {describe_sector(base['mask'])}. Within a {metres:g} m ring around it, "
            f"mean {target['label']} is {mean_ring:.2f} and {frac:.0f}% of the ring exceeds the "
            f"{target['threshold']:.2f} threshold for {ix.INDEX[measure]['means']}."
        )
        prompt = (
            f"{qwen.sensor_context(scene)}\n\n"
            "Two indices have already been computed. The figures are exact — quote them, do not "
            "re-estimate.\n\n"
            f"- {base['label']}: {base['coverage_pct']:.1f}% of scene, {describe_sector(base['mask'])}\n"
            f"- Mean {target['label']} in a {metres:g} m ring around it: {mean_ring:.3f}\n"
            f"- Share of that ring above the {target['threshold']:.2f} threshold: {frac:.0f}%\n\n"
            "Write one short paragraph answering whether the area surrounding the first feature is "
            f"{ix.INDEX[measure]['means']}."
        )
        text, conf, basis = qwen.narrate(prompt, [_disk(scene.preview_png)], fallback)

        return ToolResult(
            text=text,
            geojson=mask_to_geojson(base["mask"], scene, properties={"index": around}),
            overlays=overlays,
            stats={"ring_metres": metres, f"mean_{measure}_in_ring": mean_ring,
                   "ring_above_threshold_pct": frac,
                   f"{around}_coverage_pct": base["coverage_pct"]},
            confidence=round(min(0.96, 0.88 * (conf if basis != "deterministic_template" else 1.0)), 3),
            confidence_basis=f"deterministic_indices + {basis}",
            detail=f"ring {metres:g} m · mean {target['label']} {mean_ring:.2f} · {frac:.0f}% above threshold",
        )


def _disk(url: str) -> str:
    from ..config import STATIC_DIR
    return str(STATIC_DIR / url.rsplit("/", 1)[-1])
