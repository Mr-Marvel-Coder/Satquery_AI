from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import store
from .agent.registry import describe
from .api import auth as auth_api
from .api import query as query_api
from .api import report as report_api
from .api import session as session_api
from .api import upload as upload_api
from .config import DEMO_SCENES_DIR, MODEL_BACKEND, STATIC_DIR
from .models import qwen

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("satquery")


def _preload_demo_scenes() -> None:
    """Auto-load demo GeoTIFFs from SATQUERY_DEMO_SCENES into memory.

    This means the frontend's scene library works immediately without the user
    having to manually upload files. The demo session ID is deterministic so
    the report endpoint can find the traces later.
    """
    demo_dir = Path(DEMO_SCENES_DIR) if DEMO_SCENES_DIR else None
    if not demo_dir or not demo_dir.is_dir():
        log.info("No SATQUERY_DEMO_SCENES configured — skipping auto-preload")
        return

    from .geo.loader import load_scene
    from .schemas import SceneMeta

    # Stable IDs that match the frontend's SCENE_SETS expectations
    PAIR_MAP = {
        "single":      ["koyna_s2_2024-03-14.tif"],
        "bitemporal":  ["koyna_s2_2022-03-09.tif", "koyna_s2_2024-03-14.tif"],
        "cross_modal": ["koyna_s2_2024-07-02_cloud.tif", "koyna_s1_2024-07-03_vvvh.tif"],
    }

    loaded = 0
    for pair_type, filenames in PAIR_MAP.items():
        session_id = f"demo-{pair_type}"
        for fname in filenames:
            fpath = demo_dir / fname
            if not fpath.exists():
                log.warning("Demo scene not found: %s", fpath)
                continue
            try:
                scene = load_scene(fpath)
                meta = SceneMeta(
                    id=scene.id, label=scene.label, sensor=scene.sensor,
                    bands=scene.bands, gsd=scene.gsd, crs=scene.crs,
                    acquired=scene.acquired, width=scene.shape[1],
                    height=scene.shape[0], bounds=scene.bounds,
                    preview_png=scene.preview_png,
                )
                store.put_scene(scene, session_id, meta.model_dump())
                loaded += 1
                log.info("Preloaded demo scene: %s (%s)", scene.label, pair_type)
            except Exception as exc:
                log.error("Failed to preload %s: %s", fname, exc)

    if loaded:
        log.info("Demo scenes preloaded: %d scene(s)", loaded)


@asynccontextmanager
async def lifespan(_: FastAPI):
    store.init()
    _preload_demo_scenes()
    log.info("ready · backend=%s", MODEL_BACKEND)
    yield


app = FastAPI(title="SatQuery", version="0.1.0", lifespan=lifespan,
              description="Agentic geospatial analysis · PS 26167 · Team QUANTARA")

# ngrok fronts this and the origin rotates every restart, so wildcard it.
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=False,
    allow_methods=["*"], allow_headers=["*"], expose_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.include_router(auth_api.router)
app.include_router(upload_api.router)
app.include_router(query_api.router)
app.include_router(report_api.router)
app.include_router(session_api.router)


@app.get("/health")
def health() -> dict:
    s = qwen.status()
    return {
        "status": "ok",
        # The frontend gates on this. It is true when the service can answer,
        # which includes stub mode — the two mandatory tools need no model.
        "model_loaded": s["loaded"] or MODEL_BACKEND == "stub",
        "vlm": s,
        "tools": describe(),
    }


@app.post("/warmup")
def warmup() -> dict:
    """Load the model on demand, so the first real query is not the slow one."""
    qwen.get_model()
    return qwen.status()
