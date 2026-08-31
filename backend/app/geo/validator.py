"""Input upload and compatibility checking — a MUST clause in the PS.

Validation is not a formality here: it is what lets the system abstain honestly.
A cross-modal answer computed from two scenes that do not overlap is worse than
no answer, so the checks below gate execution rather than just annotating it.
"""
from __future__ import annotations

from ..schemas import PairType, Validation


def _overlap_fraction(a, b) -> float:
    (s1, w1), (n1, e1) = a.bounds
    (s2, w2), (n2, e2) = b.bounds
    iw = max(0.0, min(e1, e2) - max(w1, w2))
    ih = max(0.0, min(n1, n2) - max(s1, s2))
    inter = iw * ih
    smallest = min((e1 - w1) * (n1 - s1), (e2 - w2) * (n2 - s2))
    return inter / smallest if smallest > 0 else 0.0


def validate(scenes: list, pair_type: PairType) -> Validation:
    notes: list[str] = []
    ok = True
    crs_match = True
    co_registered = True

    if not scenes:
        return Validation(ok=False, notes=["No readable GeoTIFF was uploaded."])

    expected = {"single": 1, "bitemporal": 2, "cross_modal": 2}[pair_type]
    if len(scenes) != expected:
        ok = False
        notes.append(
            f"{pair_type.replace('_', '-')} needs {expected} scene(s); {len(scenes)} uploaded."
        )

    notes.append(f"{len(scenes)} GeoTIFF{'s' if len(scenes) != 1 else ''} read")
    notes.append(f"{scenes[0].crs} · {scenes[0].gsd:g} m GSD")

    if len(scenes) > 1:
        a, b = scenes[0], scenes[1]

        if a.crs != b.crs:
            crs_match = False
            ok = False
            notes.append(f"CRS mismatch: {a.crs} vs {b.crs}. Reproject before pairing.")

        frac = _overlap_fraction(a, b)
        co_registered = frac > 0.80
        notes.append(f"footprints overlap {frac * 100:.1f}%")
        if not co_registered:
            ok = False
            notes.append("Scenes are not co-registered. Results would not be comparable.")

        if a.shape != b.shape:
            notes.append(f"raster sizes differ ({a.shape} vs {b.shape}) — comparing on the overlap")

        if pair_type == "cross_modal":
            sensors = {a.sensor, b.sensor}
            if sensors != {"S1", "S2"}:
                ok = False
                notes.append(
                    f"Cross-modal needs one optical and one SAR scene; got {a.sensor} + {b.sensor}."
                )
        if pair_type == "bitemporal":
            if a.sensor != b.sensor:
                notes.append(f"mixed sensors ({a.sensor}/{b.sensor}) — differencing is less reliable")
            if a.acquired and b.acquired and a.acquired[:10] == b.acquired[:10]:
                notes.append("both scenes carry the same acquisition date")
    else:
        notes.append("single-scene mode")

    return Validation(ok=ok, crs_match=crs_match, co_registered=co_registered, notes=notes)
