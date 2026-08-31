"""Pixels to the real world. The thing almost no team builds.

Every box and every polygon leaves this module in EPSG:4326, because a bounding
box in pixel coordinates is not evidence — it cannot be checked against anything.
"""
from __future__ import annotations

import numpy as np
from pyproj import Transformer
from rasterio import features


def _to_wgs84(crs: str):
    return Transformer.from_crs(crs, "EPSG:4326", always_xy=True)


def bbox_to_geojson(bbox_px, scene, properties: dict | None = None) -> dict:
    """(x0, y0, x1, y1) in pixels -> a lon/lat Polygon Feature."""
    x0, y0, x1, y1 = bbox_px
    corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]
    tf = _to_wgs84(scene.crs)
    ring = []
    for cx, cy in corners:
        wx, wy = scene.transform * (cx, cy)
        lon, lat = tf.transform(wx, wy)
        ring.append([round(lon, 6), round(lat, 6)])
    return {
        "type": "Feature",
        "properties": properties or {},
        "geometry": {"type": "Polygon", "coordinates": [ring]},
    }


def mask_to_geojson(mask: np.ndarray, scene, min_px: int = 40,
                    properties: dict | None = None) -> dict:
    """Boolean mask -> FeatureCollection of lon/lat polygons.

    Small blobs are dropped: at 10 m GSD a 40-pixel polygon is 4000 m2, below
    which we are almost certainly vectorising speckle rather than a feature.
    """
    mask = mask.astype(np.uint8)
    tf = _to_wgs84(scene.crs)
    feats = []

    for geom, value in features.shapes(mask, mask=mask.astype(bool), transform=scene.transform):
        if value != 1:
            continue
        rings = []
        area_px = 0.0
        for ring in geom["coordinates"]:
            pts = [list(tf.transform(x, y)) for x, y in ring]
            pts = [[round(a, 6), round(b, 6)] for a, b in pts]
            rings.append(pts)
            area_px += _shoelace(ring) / (scene.gsd ** 2)
        if abs(area_px) < min_px:
            continue
        feats.append({
            "type": "Feature",
            "properties": {**(properties or {}), "area_m2": round(abs(area_px) * scene.gsd ** 2, 1)},
            "geometry": {"type": "Polygon", "coordinates": rings},
        })

    feats.sort(key=lambda f: -f["properties"]["area_m2"])
    return {"type": "FeatureCollection", "features": feats[:60]}


def _shoelace(ring) -> float:
    xs = np.array([p[0] for p in ring])
    ys = np.array([p[1] for p in ring])
    return 0.5 * float(np.abs(np.dot(xs, np.roll(ys, 1)) - np.dot(ys, np.roll(xs, 1))))


def centroid_lonlat(mask: np.ndarray, scene) -> tuple[float, float] | None:
    ys, xs = np.nonzero(mask)
    if xs.size == 0:
        return None
    wx, wy = scene.transform * (float(xs.mean()), float(ys.mean()))
    lon, lat = _to_wgs84(scene.crs).transform(wx, wy)
    return round(lon, 6), round(lat, 6)


def describe_sector(mask: np.ndarray) -> str:
    """Which part of the frame a mask occupies, in words the VLM can reuse."""
    ys, xs = np.nonzero(mask)
    if xs.size == 0:
        return "no coverage"
    h, w = mask.shape
    cy, cx = ys.mean() / h, xs.mean() / w
    v = "northern" if cy < 0.38 else "southern" if cy > 0.62 else "central"
    hz = "western" if cx < 0.38 else "eastern" if cx > 0.62 else ""
    return f"{v} {hz}".strip() + " sector"
