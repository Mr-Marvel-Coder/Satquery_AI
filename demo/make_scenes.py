"""Synthetic but genuinely georeferenced demo scenes.

Real Sentinel granules are ~1 GB each and cannot be committed. These carry a real
UTM 43N affine, real band descriptions and physically plausible values, so every
code path — band resolution, reprojection, dB handling — is exercised exactly as
it will be on real data.
"""
import numpy as np, rasterio
from rasterio.transform import from_origin
from pathlib import Path

OUT = Path(__file__).resolve().parent / "scenes"
OUT.mkdir(parents=True, exist_ok=True)
H = W = 512
GSD = 10.0
# Koyna basin, Maharashtra. UTM zone 43N.
TRANSFORM = from_origin(410000.0, 1995000.0, GSD, GSD)
CRS = "EPSG:32643"

yy, xx = np.mgrid[0:H, 0:W]

def blob(cy, cx, ry, rx):
    return (((yy - cy) / ry) ** 2 + ((xx - cx) / rx) ** 2) < 1.0

WATER = blob(150, 240, 70, 110) | blob(170, 380, 45, 80)
VEG   = (yy > 300) & ~WATER
BUILT_2022 = blob(430, 90, 40, 45)
BUILT_2024 = BUILT_2022 | blob(90, 420, 55, 60)      # the change: new development

def s2(built, seed):
    rng = np.random.default_rng(seed)
    n = lambda s: rng.normal(0, s, (H, W))
    blue  = np.where(WATER, 0.09, np.where(built, 0.20, 0.07)) + n(0.006)
    green = np.where(WATER, 0.11, np.where(built, 0.21, 0.09)) + n(0.006)
    red   = np.where(WATER, 0.07, np.where(built, 0.23, 0.10)) + n(0.006)
    nir   = np.where(WATER, 0.03, np.where(VEG & ~built, 0.42, np.where(built, 0.24, 0.20))) + n(0.010)
    swir  = np.where(WATER, 0.02, np.where(built, 0.34, 0.18)) + n(0.008)
    return np.clip(np.stack([blue, green, red, nir, swir]), 0, 1).astype("float32")

def write(path, arr, names, dtype="float32", **tags):
    with rasterio.open(path, "w", driver="GTiff", height=H, width=W, count=arr.shape[0],
                       dtype=dtype, crs=CRS, transform=TRANSFORM, compress="deflate") as dst:
        dst.write(arr.astype(dtype))
        for i, nm in enumerate(names, 1):
            dst.set_band_description(i, nm)
        dst.update_tags(**tags)

BANDS = ["B02", "B03", "B04", "B08", "B11"]
write(OUT / "koyna_s2_2022-03-09.tif", s2(BUILT_2022, 1), BANDS, ACQUISITION_DATE="2022-03-09")
write(OUT / "koyna_s2_2024-03-14.tif", s2(BUILT_2024, 2), BANDS, ACQUISITION_DATE="2024-03-14")

# Cloudy optical: cloud hides the water and reads as bright bare-ish surface.
rng = np.random.default_rng(7)
CLOUD = blob(150, 260, 110, 165)
cloudy = s2(BUILT_2024, 3)
cloudy[:, CLOUD] = np.array([0.62, 0.63, 0.64, 0.58, 0.44])[:, None] + rng.normal(0, 0.01, (5, CLOUD.sum()))
write(OUT / "koyna_s2_2024-07-02_cloud.tif", np.clip(cloudy, 0, 1), BANDS,
      ACQUISITION_DATE="2024-07-02")

# SAR in dB. Water is smooth -> very low VV. Cloud is invisible to radar.
rng = np.random.default_rng(11)
vv = np.where(WATER, -19.0, np.where(BUILT_2024, -3.0, -9.5)) + rng.normal(0, 0.9, (H, W))
vh = vv - 6.0 + rng.normal(0, 0.7, (H, W))
write(OUT / "koyna_s1_2024-07-03_vvvh.tif", np.stack([vv, vh]).astype("float32"), ["VV", "VH"],
      ACQUISITION_DATE="2024-07-03")

print("wrote:", *[p.name for p in sorted(OUT.iterdir())], sep="\n  ")
