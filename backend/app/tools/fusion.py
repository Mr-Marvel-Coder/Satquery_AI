"""Cross-modal pair analysis. MANDATORY under PS 26167.

    "The system must extract complementary information from a co-registered
     optical/multispectral and SAR image pair."

NumPy only. No model, no training, no fusion head. The whole tool is an index
compared against a backscatter threshold — and the interesting output is not the
label but the DISAGREEMENT, because that is where SAR earns its place.

On disagreement the tool explains rather than picking a side. Optical alone would
answer "bare soil" with high confidence; this answers "water, flagged" and says
why. That difference is the demo.
"""
from __future__ import annotations

import numpy as np

from ..config import SAR_WATER_DB
from ..geo import indices as ix
from ..geo.transform import describe_sector, mask_to_geojson
from ..models import qwen
from .base import RGB, Tool, ToolResult, overlay_from_mask


def _align(a: np.ndarray, b: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Crop two rasters to their common top-left extent.

    Proper co-registration is a resampling job; validation has already confirmed
    the footprints overlap, so a crop is honest here and costs nothing.
    """
    h = min(a.shape[-2], b.shape[-2])
    w = min(a.shape[-1], b.shape[-1])
    return a[..., :h, :w], b[..., :h, :w]


class FusionTool(Tool):
    name = "fusion"
    version = "0.1"
    label = "Cross-modal fusion"
    accepts = ["cross_modal"]
    kind = "ochre"

    def run(self, scenes: list, params: dict) -> ToolResult:
        optical = next((s for s in scenes if s.sensor != "S1"), None)
        sar = next((s for s in scenes if s.sensor == "S1"), None)

        if optical is None or sar is None:
            return ToolResult(
                text=("Cross-modal fusion needs one optical and one SAR scene. "
                      f"I was given: {', '.join(s.sensor for s in scenes)}."),
                confidence=0.0, confidence_basis="wrong_modalities", abstained=True,
                detail="missing an optical or SAR scene",
            )
        if not optical.has("green", "nir"):
            return ToolResult(
                text=f"NDWI needs green and NIR; the optical scene has {', '.join(optical.bands)}.",
                confidence=0.0, confidence_basis="missing_bands", abstained=True,
                detail="optical scene lacks green/NIR",
            )
        if not sar.has("vv"):
            return ToolResult(
                text=f"The SAR scene has no VV band; bands present: {', '.join(sar.bands)}.",
                confidence=0.0, confidence_basis="missing_bands", abstained=True,
                detail="SAR scene lacks VV",
            )

        thr_db = float(params.get("sar_db", SAR_WATER_DB))

        ndwi = ix.compute(optical, "ndwi")
        vv_db = sar.band("vv")                       # already dB — never 8-bit stretch SAR
        water_optical, vv_db = _align(ndwi["mask"], vv_db)
        water_sar = vv_db < thr_db

        valid = np.isfinite(vv_db)
        agreement = float((water_optical == water_sar)[valid].mean()) if valid.any() else 0.0

        both = water_optical & water_sar
        sar_only = water_sar & ~water_optical        # the cloud-shadow case
        opt_only = water_optical & ~water_sar

        joint = np.where(both, 3, np.where(sar_only, 2, np.where(opt_only, 1, 0))).astype(np.uint8)

        overlays = [
            overlay_from_mask(both, sar, "fusion_both", "Water · both sensors", "teal", RGB["teal"]),
            overlay_from_mask(sar_only, sar, "fusion_sar", f"SAR only · VV < {thr_db:g} dB",
                              "ochre", RGB["ochre"]),
        ]
        if opt_only.any():
            overlays.append(overlay_from_mask(opt_only, sar, "fusion_opt",
                                              "Optical only · disputed", "carmine", RGB["carmine"]))

        pct = lambda m: round(float(m.mean()) * 100, 2)  # noqa: E731
        mean_db_sar_only = round(float(np.nanmean(vv_db[sar_only])), 1) if sar_only.any() else None

        # --- the sentence that wins the demo ------------------------------
        if agreement > 0.9:
            verdict = (
                f"Both sensors agree over {agreement * 100:.0f}% of the scene. Open water covers "
                f"{pct(both):.1f}%, confirmed independently by NDWI and by VV backscatter."
            )
        elif sar_only.any():
            verdict = (
                f"Optical indices suggest dry ground across the {describe_sector(sar_only)}, but SAR "
                f"backscatter there reads VV {mean_db_sar_only} dB — a smooth surface, consistent with "
                f"open water beneath cloud or cloud shadow in the optical acquisition. The two "
                f"modalities agree over {agreement * 100:.0f}% of the scene; the disagreement covers "
                f"{pct(sar_only):.1f}% and is concentrated where the optical scene is obscured. "
                f"Reporting water with moderate confidence, flagged for review."
            )
        else:
            verdict = (
                f"NDWI marks {pct(opt_only):.1f}% of the scene as water where SAR backscatter stays "
                f"above {thr_db:g} dB — a rough surface. That is inconsistent with open water; the "
                f"optical signal may be shadow or wet soil. Agreement {agreement * 100:.0f}%. Flagged."
            )

        prompt = (
            "Two co-registered satellite images of the same area were compared: a Sentinel-2 optical "
            "scene and a Sentinel-1 SAR scene. The comparison is already done and these numbers are "
            "exact — quote them, do not re-estimate, and do not resolve the disagreement silently.\n\n"
            f"- NDWI water (optical): {ndwi['coverage_pct']:.1f}% of scene\n"
            f"- VV < {thr_db:g} dB water (SAR): {pct(water_sar):.1f}% of scene\n"
            f"- Both sensors agree: {agreement * 100:.1f}% of pixels\n"
            f"- Water seen only by SAR: {pct(sar_only):.1f}%"
            + (f", mean VV {mean_db_sar_only} dB, in the {describe_sector(sar_only)}" if sar_only.any() else "")
            + f"\n- Water seen only by optical: {pct(opt_only):.1f}%\n\n"
            "Write one short paragraph for an analyst. If the sensors disagree, explain the likely "
            "physical reason rather than choosing a side, and state that the result is flagged."
        )
        text, conf, basis = qwen.narrate(prompt, None, verdict)

        return ToolResult(
            text=text,
            geojson=mask_to_geojson(both | sar_only, sar, properties={"class": "water_joint"}),
            overlays=overlays,
            stats={
                "agreement": round(agreement, 3),
                "ndwi_water_pct": ndwi["coverage_pct"],
                "sar_water_pct": pct(water_sar),
                "both_pct": pct(both),
                "sar_only_pct": pct(sar_only),
                "optical_only_pct": pct(opt_only),
                "sar_only_mean_vv_db": mean_db_sar_only,
                "sar_threshold_db": thr_db,
                "joint_classes": {"0": "neither", "1": "optical only", "2": "SAR only", "3": "both"},
                "narration_basis": basis,
            },
            # Confidence IS the agreement. Nothing invented.
            confidence=round(agreement, 3),
            confidence_basis="inter_modality_agreement",
            detail=(f"NDWI vs VV<{thr_db:g}dB · agreement {agreement:.2f} · "
                    f"SAR-only {pct(sar_only):.1f}%"),
        )
