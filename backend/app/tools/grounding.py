"""Text-guided grounding, output in lat/lon.

Qwen returns boxes in its own normalised pixel space. Converting them through the
scene affine into EPSG:4326 is the differentiator — a box in pixel coordinates
cannot be checked against anything, a box in lon/lat can be dropped into QGIS.

When the VLM is unavailable, grounding falls back to the index masks, which
locate water and vegetation deterministically and are frequently more accurate
than the model anyway.
"""
from __future__ import annotations

import json
import re

import numpy as np
from PIL import Image

from ..geo import indices as ix
from ..geo.transform import bbox_to_geojson, centroid_lonlat, describe_sector, mask_to_geojson
from ..models import qwen
from .base import RGB, Tool, ToolResult, overlay_from_mask

# Words that map onto something we can locate without a model at all.
DETERMINISTIC = {
    "ndwi": ("water", "lake", "reservoir", "river", "pond", "waterbody", "water body"),
    "ndvi": ("vegetation", "forest", "crop", "field", "farmland", "green", "trees"),
    "ndbi": ("building", "built", "urban", "settlement", "city", "town", "construction"),
}


def _index_for(target: str) -> str | None:
    t = target.lower()
    for name, words in DETERMINISTIC.items():
        if any(w in t for w in words):
            return name
    return None


class GroundingTool(Tool):
    name = "grounding"
    version = "0.1"
    label = "Grounding"
    accepts = ["single", "bitemporal", "cross_modal"]
    kind = "teal"

    def run(self, scenes: list, params: dict) -> ToolResult:
        scene = next((s for s in scenes if s.sensor != "S1"), scenes[0])
        target = params.get("target") or params.get("question") or "the main feature"

        index = _index_for(target)
        if index and scene.has(*ix.INDEX[index]["needs"]):
            return self._from_index(scene, index, target)
        if qwen.get_model() is None:
            return ToolResult(
                text=(f"I can't locate '{target}' on this server. The vision model isn't loaded, and "
                      f"'{target}' doesn't map onto a spectral index I can compute from bands "
                      f"{', '.join(scene.bands)}."),
                confidence=0.0, confidence_basis="no_grounding_path", abstained=True,
                detail=f"no deterministic index for '{target}', VLM unavailable",
            )
        return self._from_vlm(scene, target)

    # --- deterministic path -----------------------------------------------
    def _from_index(self, scene, index: str, target: str) -> ToolResult:
        r = ix.compute(scene, index)
        if not r["mask"].any():
            return ToolResult(
                text=f"No {r['means']} was detected in this scene at the {r['threshold']:.2f} "
                     f"{r['label']} threshold.",
                confidence=0.35, confidence_basis="empty_mask", abstained=True,
                detail=f"{r['label']} mask empty",
            )

        ys, xs = np.nonzero(r["mask"])
        bbox = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
        feature = bbox_to_geojson(bbox, scene, {"label": target, "source": r["label"]})
        lons = [p[0] for p in feature["geometry"]["coordinates"][0]]
        lats = [p[1] for p in feature["geometry"]["coordinates"][0]]
        km_x = (max(lons) - min(lons)) * 111.32 * np.cos(np.radians(np.mean(lats)))
        km_y = (max(lats) - min(lats)) * 110.57
        centre = centroid_lonlat(r["mask"], scene)

        polygons = mask_to_geojson(r["mask"], scene, properties={"label": target})
        collection = {"type": "FeatureCollection", "features": [feature] + polygons["features"]}

        text = (
            f"{target.capitalize()} spans {min(lons):.4f}–{max(lons):.4f} E and "
            f"{min(lats):.4f}–{max(lats):.4f} N, roughly {km_x:.1f} km by {km_y:.1f} km, in the "
            f"{describe_sector(r['mask'])}. It covers {r['coverage_pct']:.1f}% of the scene. Bounds "
            f"are EPSG:4326, reprojected from {scene.crs} through the scene affine — download the "
            f"GeoJSON to load it straight into QGIS."
        )
        return ToolResult(
            text=text,
            geojson=collection,
            overlays=[overlay_from_mask(r["mask"], scene, index,
                                        f"{r['label']} > {r['threshold']:.2f}", r["kind"], RGB[r["kind"]])],
            stats={"bbox_px": bbox, "centroid_lonlat": centre, "extent_km": [round(km_x, 2), round(km_y, 2)],
                   "source": r["label"], "coverage_pct": r["coverage_pct"], "crs_in": scene.crs,
                   "crs_out": "EPSG:4326"},
            confidence=0.92,
            confidence_basis="deterministic_index_extent",
            detail=f"{r['label']} extent → EPSG:4326 · {min(lons):.4f}–{max(lons):.4f} E",
        )

    # --- model path --------------------------------------------------------
    def _from_vlm(self, scene, target: str) -> ToolResult:
        disk = _disk(scene.preview_png)
        with Image.open(disk) as im:
            pw, ph = im.size
        H, W = scene.shape

        prompt = (
            f"{qwen.sensor_context(scene)}\n\n"
            f"Locate: {target}.\n"
            "Reply with ONLY a JSON array of bounding boxes, no other text, in the form "
            '[{"bbox_2d": [x1, y1, x2, y2], "label": "..."}] using pixel coordinates of this image. '
            "Return an empty array [] if it is not present."
        )
        raw, conf = qwen.chat(prompt, [disk], max_new_tokens=192)

        boxes = _parse_boxes(raw)
        if not boxes:
            return ToolResult(
                text=f"I could not locate '{target}' in this scene with enough confidence to place a box.",
                stats={"raw": raw[:300]},
                confidence=min(conf, 0.3), confidence_basis="box_token_logprob",
                abstained=True, detail=f"no box returned for '{target}'",
            )

        # Model boxes are in preview pixels; the affine expects source pixels.
        sx, sy = W / pw, H / ph
        feats = []
        for b in boxes[:8]:
            x1, y1, x2, y2 = b["bbox_2d"]
            src = (x1 * sx, y1 * sy, x2 * sx, y2 * sy)
            feats.append(bbox_to_geojson(src, scene, {"label": b.get("label", target), "source": "qwen"}))

        ring = feats[0]["geometry"]["coordinates"][0]
        lons = [p[0] for p in ring]
        lats = [p[1] for p in ring]

        return ToolResult(
            text=(f"{target.capitalize()} is at {min(lons):.4f}–{max(lons):.4f} E, "
                  f"{min(lats):.4f}–{max(lats):.4f} N"
                  + (f", plus {len(feats) - 1} further detection(s)." if len(feats) > 1 else ".")
                  + f" Boxes are EPSG:4326, reprojected from {scene.crs} through the scene affine."),
            geojson={"type": "FeatureCollection", "features": feats},
            stats={"boxes": len(feats), "preview_px": [pw, ph], "source_px": [W, H],
                   "crs_in": scene.crs, "crs_out": "EPSG:4326"},
            confidence=conf,
            confidence_basis="box_token_logprob",
            detail=f"Qwen box → EPSG:4326 · {min(lons):.4f}–{max(lons):.4f} E",
        )


def _parse_boxes(raw: str) -> list[dict]:
    """Qwen wraps JSON in prose and fences often enough that this must be tolerant."""
    raw = re.sub(r"```(?:json)?|```", "", raw).strip()
    for candidate in (raw, *re.findall(r"\[.*?\]\s*$", raw, re.S), *re.findall(r"\[.*\]", raw, re.S)):
        try:
            data = json.loads(candidate)
        except Exception:
            continue
        if isinstance(data, dict):
            data = [data]
        out = []
        for item in data:
            if not isinstance(item, dict):
                continue
            box = item.get("bbox_2d") or item.get("bbox") or item.get("box")
            if isinstance(box, list) and len(box) == 4:
                out.append({"bbox_2d": [float(v) for v in box], "label": item.get("label", "")})
        if out:
            return out
    return []


def _disk(url: str) -> str:
    from ..config import STATIC_DIR
    return str(STATIC_DIR / url.rsplit("/", 1)[-1])
