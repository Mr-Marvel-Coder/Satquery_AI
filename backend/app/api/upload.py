from __future__ import annotations

import json
import logging
import shutil
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .. import store
from ..config import UPLOAD_DIR
from ..geo.loader import load_scene
from ..geo.validator import validate
from ..schemas import SceneMeta, UploadResponse, Validation

router = APIRouter()
log = logging.getLogger("satquery.upload")

# What each demo set is supposed to contain. Used only to warn — a mismatch is
# a preload problem, and silently truncating would hide it.
EXPECTED = {"single": 1, "bitemporal": 2, "cross_modal": 2}


def _demo_scenes(pair_type: str):
    """Resolve the preloaded demo set for `pair_type`.

    Two things make the naive `SELECT ... WHERE session_id=?` wrong:

    1. `scenes` is keyed on `scene.id`, and `load_scene()` mints a fresh id per
       call, so `INSERT OR REPLACE` never replaces anything. The SQLite file
       outlives the process, so every restart — and under `--reload` that means
       every file save — stacks another copy of the same demo set under the
       same session_id.
    2. `store.get_scene()` reads `_SCENES`, which lives in RAM and is empty
       after a restart. Rows from earlier runs therefore resolve to None at
       query time, so handing their ids to the frontend produces scene_ids that
       every tool will fail on.

    Both are fixed by the same filter: keep the newest row per source path, and
    only rows whose Scene is still resident in this process.
    """
    with store._conn() as c:
        rows = c.execute(
            "SELECT id, path, meta, created FROM scenes WHERE session_id=?"
            " ORDER BY created ASC",
            (f"demo-{pair_type}",),
        ).fetchall()

    if not rows:
        raise HTTPException(
            404,
            "Demo scenes not loaded on this server. Ensure SATQUERY_DEMO_SCENES "
            "is set and valid, then restart the backend.",
        )

    # Ordered oldest first, so a later row for the same file overwrites an
    # earlier one and the newest generation wins.
    newest: dict[str, dict] = {}
    for r in rows:
        if store.get_scene(r["id"]) is None:
            continue
        newest[r["path"]] = r

    if not newest:
        raise HTTPException(
            409,
            "Demo scenes are registered in the database but no longer in memory. "
            "The backend restarted without re-running the preload — restart it "
            "again with SATQUERY_DEMO_SCENES set.",
        )

    stale = len(rows) - len(newest)
    if stale:
        log.warning(
            "demo-%s: %d of %d scene rows are stale (earlier runs). "
            "Call store.clear_session('demo-%s') before preloading, or delete "
            "the SQLite file, to stop the table growing.",
            pair_type, stale, len(rows), pair_type,
        )

    scenes = list(newest.values())
    expected = EXPECTED.get(pair_type)
    if expected is not None and len(scenes) != expected:
        log.warning(
            "demo-%s resolved %d scenes, expected %d — check the preload.",
            pair_type, len(scenes), expected,
        )

    return scenes


@router.post("/upload", response_model=UploadResponse)
async def upload(files: list[UploadFile] | None = None,
                 pair_type: str = Form("single"),
                 session_id: str = Form("")):
    if pair_type not in ("single", "bitemporal", "cross_modal"):
        raise HTTPException(400, f"unknown pair_type '{pair_type}'")

    session_id = session_id or f"sq-{uuid.uuid4().hex[:8]}"

    # Fast path: demo load triggered by an empty files list.
    if not files:
        rows = _demo_scenes(pair_type)

        meta_list = [SceneMeta(**json.loads(r["meta"])) for r in rows]
        scene_ids = [r["id"] for r in rows]

        # Preloaded scenes were validated on the way in; re-running validate()
        # here would just repeat the same work against the same files.
        validation = Validation(
            ok=True,
            crs_match=True,
            co_registered=pair_type != "single",
            notes=[
                f"{len(scene_ids)} GeoTIFF{'s' if len(scene_ids) != 1 else ''} loaded from demo",
                f"{meta_list[0].crs} · {meta_list[0].gsd:g} m GSD" if meta_list else "",
                "single-scene mode" if pair_type == "single" else f"{pair_type.replace('_', '-')} pair",
            ],
        )
        return UploadResponse(scene_ids=scene_ids, metadata=meta_list, validation=validation)

    scenes, failures = [], []

    for f in files:
        suffix = "".join(c for c in (f.filename or "scene.tif") if c.isalnum() or c in "._-")
        dest = UPLOAD_DIR / f"{uuid.uuid4().hex[:8]}_{suffix}"
        with dest.open("wb") as out:
            shutil.copyfileobj(f.file, out)
        try:
            scenes.append(load_scene(dest))
        except Exception as exc:
            failures.append(f"{f.filename}: {type(exc).__name__} — {exc}")

    validation = validate(scenes, pair_type)
    if failures:
        validation.ok = False
        validation.notes.extend(failures)

    meta = []
    for s in scenes:
        m = SceneMeta(
            id=s.id, label=s.label, sensor=s.sensor, bands=s.bands, gsd=s.gsd, crs=s.crs,
            acquired=s.acquired, width=s.shape[1], height=s.shape[0],
            bounds=s.bounds, preview_png=s.preview_png,
        )
        store.put_scene(s, session_id, m.model_dump())
        meta.append(m)

    return UploadResponse(scene_ids=[s.id for s in scenes], metadata=meta, validation=validation)
