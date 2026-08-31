"""Every knob in one place.

The OOM fallback in section 11 of the build spec is a one-string change here:
MODEL_ID = 2.5-VL-7B -> 2-VL-7B -> 2-VL-2B.
"""
from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the backend root (two levels up from app/config.py)
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

# --- model ----------------------------------------------------------------
MODEL_ID = os.getenv("SATQUERY_MODEL", "Qwen/Qwen2.5-VL-7B-Instruct")
LOAD_IN_4BIT = os.getenv("SATQUERY_4BIT", "1") == "1"
MAX_NEW_TOKENS = int(os.getenv("SATQUERY_MAX_TOKENS", "384"))

# auto  — load the VLM if torch/transformers are importable, else fall back
# qwen  — insist on the VLM, fail loudly if it cannot load
# stub  — never load it; deterministic prose from the NumPy statistics instead
MODEL_BACKEND = os.getenv("SATQUERY_BACKEND", "auto")

# --- paths ----------------------------------------------------------------
DATA_DIR = Path(os.getenv("SATQUERY_DATA", "/tmp/satquery")).resolve()
UPLOAD_DIR = DATA_DIR / "uploads"
STATIC_DIR = DATA_DIR / "static"          # previews and overlays, served over HTTP
DB_PATH = DATA_DIR / "satquery.sqlite"
for _p in (UPLOAD_DIR, STATIC_DIR):
    _p.mkdir(parents=True, exist_ok=True)

# --- thresholds. Named here so the demo can be tuned without touching logic.
NDWI_WATER = 0.20
NDVI_VEG = 0.35
NDBI_BUILT = 0.00
SAR_WATER_DB = -15.0          # smooth surface: low VV backscatter
CHANGE_SIGMA = 1.5            # mask at mean + k*std of the difference image
ABSTAIN_BELOW = 0.35          # composite confidence floor
MIN_POLYGON_PX = 40           # drop speckle when vectorising

PREVIEW_MAX_PX = 1024         # 8-bit previews for Leaflet and the VLM

# --- authentication (simple HMAC token, no extra deps) --------------------
# Override in .env — never commit plain passwords.
SATQUERY_USER     = os.getenv("SATQUERY_USER",     "admin@quantara.in")
SATQUERY_PASSWORD = os.getenv("SATQUERY_PASSWORD", "satquery2024")
SATQUERY_SECRET   = os.getenv("SATQUERY_SECRET",   "change-me-in-production-env")
TOKEN_TTL_HOURS   = int(os.getenv("SATQUERY_TOKEN_TTL", "24"))

# --- demo scenes directory (auto-preload on startup) ----------------------
# Set to the absolute path of demo/scenes/ to load them without manual upload.
DEMO_SCENES_DIR = os.getenv("SATQUERY_DEMO_SCENES", "")
