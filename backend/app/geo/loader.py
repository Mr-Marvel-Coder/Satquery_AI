"""Contract 2. One place that turns a file on disk into a Scene.

Two rules that everything downstream depends on:

  1. Bands are resolved by NAME, never by index position. A Sentinel-2 subset
     with four bands and one with twelve must both answer to "nir".
  2. SAR stays in dB. Stretching it to 8-bit destroys the only thing that makes
     the fusion tool work, so the 8-bit copy lives in `preview_png` and never
     in `array`.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.warp import transform_bounds

from ..config import PREVIEW_MAX_PX, STATIC_DIR

# Canonical band names -> the many things a provider might call them.
BAND_ALIASES = {
    "coastal": {"b01", "b1", "coastal", "aerosol"},
    "blue":    {"b02", "b2", "blue"},
    "green":   {"b03", "b3", "green"},
    "red":     {"b04", "b4", "red"},
    "rededge1":{"b05", "b5", "rededge1"},
    "rededge2":{"b06", "b6", "rededge2"},
    "rededge3":{"b07", "b7", "rededge3"},
    "nir":     {"b08", "b8", "b8a", "nir", "nir08"},
    "swir":    {"b11", "b11a", "swir", "swir16"},
    "swir2":   {"b12", "swir22"},
    "vv":      {"vv", "vv_db", "sigma0_vv"},
    "vh":      {"vh", "vh_db", "sigma0_vh"},
}

# Positional guesses, used only when the file carries no band descriptions.
FALLBACK = {
    2: ["vv", "vh"],
    3: ["red", "green", "blue"],
    4: ["blue", "green", "red", "nir"],
    5: ["blue", "green", "red", "nir", "swir"],
    6: ["blue", "green", "red", "nir", "swir", "swir2"],
}


def _canonical(raw: str | None, position: int, count: int) -> str:
    if raw:
        key = re.sub(r"[^a-z0-9]", "", raw.lower())
        for canon, aliases in BAND_ALIASES.items():
            if key in aliases:
                return canon
    guess = FALLBACK.get(count)
    if guess and position < len(guess):
        return guess[position]
    return f"band{position + 1}"


def _infer_sensor(bands: list[str], path: Path, tags: dict) -> str:
    joined = " ".join(str(v) for v in tags.values()).upper() + " " + path.name.upper()
    if {"vv", "vh"} & set(bands) or "S1" in joined or "GRD" in joined:
        return "S1"
    if {"nir", "red"} <= set(bands) or "S2" in joined or "MSI" in joined:
        return "S2"
    return "unknown"


def _acquired(tags: dict, path: Path) -> str | None:
    for key in ("ACQUISITION_DATE", "TIFFTAG_DATETIME", "DATETIME", "datetime", "date"):
        if key in tags:
            raw = str(tags[key])
            for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d", "%Y%m%d"):
                try:
                    return datetime.strptime(raw[:len(datetime.now().strftime(fmt))], fmt).isoformat() + "Z"
                except ValueError:
                    continue
    # Sentinel filenames carry the date; it is the only hint many exports have.
    m = re.search(r"(20\d{2})[-_]?(\d{2})[-_]?(\d{2})", path.name)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}T00:00:00Z"
    return None


def _stretch(band: np.ndarray, lo: float = 2.0, hi: float = 98.0) -> np.ndarray:
    """Percentile stretch to 8-bit. Preview only — never fed back into a tool."""
    finite = band[np.isfinite(band)]
    if finite.size == 0:
        return np.zeros(band.shape, np.uint8)
    a, b = np.percentile(finite, [lo, hi])
    if b - a < 1e-9:
        return np.zeros(band.shape, np.uint8)
    return (np.clip((band - a) / (b - a), 0, 1) * 255).astype(np.uint8)


@dataclass
class Scene:
    id: str
    array: np.ndarray                  # (C, H, W) float32; SAR in dB
    crs: str
    transform: object                  # affine.Affine
    gsd: float
    sensor: str                        # "S1" | "S2" | "unknown"
    bands: list[str]                   # canonical names, positional
    acquired: datetime | None
    path: str
    preview_png: str                   # URL under /static
    bounds: list[list[float]] = field(default_factory=list)   # [[S,W],[N,E]]
    label: str = ""

    # -- band access by name, the only sanctioned way -----------------------
    def has(self, *names: str) -> bool:
        return all(n in self.bands for n in names)

    def band(self, name: str) -> np.ndarray:
        try:
            return self.array[self.bands.index(name)]
        except ValueError as exc:
            raise KeyError(
                f"scene {self.id} has no '{name}' band; present: {', '.join(self.bands)}"
            ) from exc

    @property
    def shape(self) -> tuple[int, int]:
        return self.array.shape[1], self.array.shape[2]


def load_scene(path: str | Path, scene_id: str | None = None) -> Scene:
    path = Path(path)
    sid = scene_id or f"sc_{uuid.uuid4().hex[:10]}"

    with rasterio.open(path) as src:
        arr = src.read().astype(np.float32)
        if src.nodata is not None:
            arr[arr == src.nodata] = np.nan

        descs = src.descriptions or (None,) * src.count
        bands = [_canonical(descs[i], i, src.count) for i in range(src.count)]
        tags = src.tags()
        sensor = _infer_sensor(bands, path, tags)
        crs = str(src.crs) if src.crs else "EPSG:4326"
        gsd = float(abs(src.transform.a))
        west, south, east, north = transform_bounds(src.crs, "EPSG:4326", *src.bounds) \
            if src.crs else src.bounds
        transform = src.transform
        acquired = _acquired(tags, path)

    # Reflectance is often stored as scaled integers; indices need 0–1.
    if sensor == "S2" and np.nanmax(arr) > 2.0:
        arr = arr / 10000.0

    preview = _write_preview(sid, arr, bands, sensor)

    date_label = (acquired or "")[:10]
    label = f"{'Sentinel-1' if sensor == 'S1' else 'Sentinel-2' if sensor == 'S2' else path.stem}" \
            + (f" · {date_label}" if date_label else "")

    return Scene(
        id=sid, array=arr, crs=crs, transform=transform, gsd=gsd, sensor=sensor,
        bands=bands, acquired=acquired, path=str(path), preview_png=preview,
        bounds=[[south, west], [north, east]], label=label,
    )


def _write_preview(sid: str, arr: np.ndarray, bands: list[str], sensor: str) -> str:
    """8-bit RGB for Leaflet and for the VLM. Generated once, at upload."""
    if sensor == "S1" or not {"red", "green", "blue"} <= set(bands):
        # SAR and anything unusual render as grayscale from the first band.
        g = _stretch(arr[0])
        rgb = np.dstack([g, g, g])
    else:
        rgb = np.dstack([_stretch(arr[bands.index(c)]) for c in ("red", "green", "blue")])

    img = Image.fromarray(rgb, "RGB")
    if max(img.size) > PREVIEW_MAX_PX:
        img.thumbnail((PREVIEW_MAX_PX, PREVIEW_MAX_PX), Image.LANCZOS)

    out = STATIC_DIR / f"{sid}_preview.png"
    img.save(out, optimize=True)
    return f"/static/{out.name}"
