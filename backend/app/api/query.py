from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from .. import store
from ..agent.executor import execute
from ..geo.validator import validate
from ..schemas import QueryRequest

router = APIRouter()


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps({'event': event, 'data': data})}\n\n"


@router.post("/query")
async def query(req: QueryRequest):
    scenes = [store.get_scene(i) for i in req.scene_ids]
    missing = [i for i, s in zip(req.scene_ids, scenes) if s is None]
    if missing:
        raise HTTPException(
            410,
            f"Scene(s) {', '.join(missing)} are no longer in memory — the server restarted. "
            "Re-upload and try again.",
        )
    if not scenes:
        raise HTTPException(400, "No scenes supplied.")

    pair_type = ("single" if len(scenes) == 1
                 else "cross_modal" if len({s.sensor for s in scenes}) > 1
                 else "bitemporal")
    validation = validate(scenes, pair_type)
    session_id = f"sq-{uuid.uuid4().hex[:8]}"

    def stream():
        final = None
        try:
            for ev in execute(req.text, scenes, validation, session_id):
                if ev["event"] == "final":
                    final = ev["data"]
                yield _sse(ev["event"], ev["data"])
        except Exception as exc:                     # never leave the client hanging
            yield _sse("final", {
                "text": f"The analysis failed: {type(exc).__name__} — {exc}",
                "geojson": None, "overlays": [], "confidence": 0.0,
                "basis": "server_error", "abstained": True, "session_id": session_id,
            })
            return

        if final:
            store.save_trace(session_id, req.text, final.get("trace", {}),
                             final["text"], final["confidence"], final["abstained"])

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )
