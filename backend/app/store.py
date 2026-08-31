"""SQLite plus local disk. Sessions, scenes and traces — enough to regenerate a
report after the fact, and nothing more."""
from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone

from .config import DB_PATH

_LOCK = threading.Lock()
_SCENES: dict[str, object] = {}          # scene_id -> live Scene (arrays stay in RAM)

SCHEMA = """
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY, session_id TEXT, path TEXT, sensor TEXT,
  meta TEXT, created TEXT
);
CREATE TABLE IF NOT EXISTS traces (
  id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, query TEXT,
  trace TEXT, answer TEXT, confidence REAL, abstained INTEGER, created TEXT
);
"""


def _conn():
    c = sqlite3.connect(DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c


def init() -> None:
    with _LOCK, _conn() as c:
        c.executescript(SCHEMA)


def put_scene(scene, session_id: str, meta: dict) -> None:
    _SCENES[scene.id] = scene
    with _LOCK, _conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO scenes VALUES (?,?,?,?,?,?)",
            (scene.id, session_id, scene.path, scene.sensor, json.dumps(meta),
             datetime.now(timezone.utc).isoformat()),
        )


def get_scene(scene_id: str):
    """Live scenes only. A Colab restart clears them, and the API says so
    plainly rather than silently reloading something that may have changed."""
    return _SCENES.get(scene_id)


def save_trace(session_id: str, query: str, trace: dict, answer: str,
               confidence: float, abstained: bool) -> None:
    with _LOCK, _conn() as c:
        c.execute(
            "INSERT INTO traces (session_id, query, trace, answer, confidence, abstained, created)"
            " VALUES (?,?,?,?,?,?,?)",
            (session_id, query, json.dumps(trace), answer, confidence, int(abstained),
             datetime.now(timezone.utc).isoformat()),
        )


def session_traces(session_id: str) -> list[dict]:
    with _LOCK, _conn() as c:
        rows = c.execute(
            "SELECT * FROM traces WHERE session_id=? ORDER BY id", (session_id,)
        ).fetchall()
    return [{**dict(r), "trace": json.loads(r["trace"])} for r in rows]


# Idempotent, and cheap. Doing it at import means the schema exists no matter how
# the app is started — uvicorn, a notebook cell, or a test client that never
# triggers the lifespan hook.
init()
