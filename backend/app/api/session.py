"""Session history endpoint — exposes stored traces from SQLite."""
from __future__ import annotations

from fastapi import APIRouter

from .. import store

router = APIRouter()


@router.get("/session/{session_id}/history")
def history(session_id: str) -> list[dict]:
    """Return all query traces for a given session, newest last."""
    rows = store.session_traces(session_id)
    result = []
    for r in rows:
        tr = r.get("trace", {})
        result.append({
            "id":         r["id"],
            "query":      r["query"],
            "answer":     r["answer"],
            "confidence": r["confidence"],
            "abstained":  bool(r["abstained"]),
            "created":    r["created"],
            "task":       tr.get("interpreted_task", ""),
            "tools":      [s.get("tool") for s in tr.get("execution_sequence", [])
                           if s.get("tool") not in ("planner", "validator")],
        })
    return result
