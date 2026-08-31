"""Runs the plan and emits the trace as it goes.

The trace is not a log written afterwards — each step is yielded the moment it
finishes, which is what lets the frontend fill stage by stage. That ordering is
the auditable evidence the PS asks for.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Iterator

from ..config import ABSTAIN_BELOW
from ..schemas import ToolCall
from . import planner
from .registry import get as get_tool


def _step(n: int, tool: str, version: str, label: str, detail: str,
          ms: int, conf: float, basis: str, params: dict | None = None) -> ToolCall:
    return ToolCall(step=n, tool=tool, version=version, label=label, detail=detail,
                    params=params or {}, confidence=round(conf, 3),
                    confidence_basis=basis, runtime_ms=ms)


def execute(query: str, scenes: list, validation, session_id: str) -> Iterator[dict]:
    """Yields SSE-shaped dicts: interpreted, trace_step (xN), final."""
    sequence: list[ToolCall] = []
    step_no = 0

    # --- 1. route ---------------------------------------------------------
    t0 = time.perf_counter()
    p = planner.plan(query, scenes)
    ms = int((time.perf_counter() - t0) * 1000)

    task_label = f"{p['task']} → {' → '.join(p['tools'])}"
    yield {"event": "interpreted", "data": {"interpreted_task": task_label}}

    step_no += 1
    detail = f"{len(p['tools'])} tool(s) · {p['source'].replace('_', ' ')}"
    if p["notes"]:
        detail += " · " + "; ".join(p["notes"])
    route_conf = 0.88 if p["source"] == "llm" else 0.75
    sequence.append(_step(step_no, "planner", "0.1", "Route", detail, ms, route_conf,
                          "plan_parse", {"task": p["task"], "tools": p["tools"]}))
    yield {"event": "trace_step", "data": sequence[-1].model_dump()}

    # --- 2. validate ------------------------------------------------------
    step_no += 1
    sequence.append(_step(step_no, "validator", "0.1", "Validate",
                          " · ".join(validation.notes[:3]), 0,
                          1.0 if validation.ok else 0.0,
                          "metadata_complete" if validation.ok else "validation_failed"))
    yield {"event": "trace_step", "data": sequence[-1].model_dump()}

    # --- 2a. refuse out-of-scope questions outright ------------------------
    if p["task"] == "abstain":
        trace = _trace(query, task_label, validation, sequence, {}, 0.0, True)
        yield {"event": "final", "data": {
            "text": ("I can't answer that from satellite imagery. It needs ground truth, market data "
                     "or a forecast this scene set doesn't contain, and no registered tool produces "
                     "it.\n\nWhat I can give you from these bands: current vegetation vigour (NDVI), "
                     "open water extent (NDWI), built-up surface (NDBI), the location of any of those "
                     "in latitude and longitude, change against a second date, or a cross-check "
                     "against SAR."),
            "geojson": None, "overlays": [], "confidence": 0.0,
            "basis": "no_tool_match", "abstained": True,
            "session_id": session_id, "trace": trace,
        }}
        return

    if not validation.ok:
        trace = _trace(query, task_label, validation, sequence, {}, 0.0, True)
        yield {"event": "final", "data": {
            "text": ("I can't run this analysis on these inputs. "
                     + " ".join(validation.notes[-2:])
                     + " Fix the inputs and ask again — answering anyway would give you a number "
                       "with nothing behind it."),
            "geojson": None, "overlays": [], "confidence": 0.0,
            "basis": "validation_failed", "abstained": True,
            "session_id": session_id, "trace": trace,
        }}
        return

    # --- 3. run the tools, in order --------------------------------------
    texts, overlays, stats = [], [], {}
    geojson = None
    confidences = []
    abstained_any = False

    for tool_name in p["tools"]:
        tool = get_tool(tool_name)
        if tool is None:
            continue

        result = tool(scenes, p["params"])
        step_no += 1
        sequence.append(_step(step_no, tool.name, tool.version, tool.label,
                              result.detail or result.text[:120], result.runtime_ms,
                              result.confidence, result.confidence_basis, p["params"]))
        yield {"event": "trace_step", "data": sequence[-1].model_dump()}

        if result.text:
            texts.append(result.text)
        # Chained tools legitimately re-emit the same mask; the map only needs it once.
        for o in result.overlays:
            if o["id"] not in {x["id"] for x in overlays}:
                overlays.append(o)
        stats[tool.name] = result.stats
        if result.geojson and geojson is None:
            geojson = result.geojson
        confidences.append(result.confidence)
        abstained_any = abstained_any or result.abstained

    # --- 4. compose -------------------------------------------------------
    # The weakest link governs. A chain is only as trustworthy as its worst step,
    # so we take the minimum rather than an average that would hide it.
    composite = round(min(confidences), 3) if confidences else 0.0
    abstained = abstained_any or composite < ABSTAIN_BELOW

    text = "\n\n".join(texts) if texts else "No tool produced an answer."
    if abstained and not abstained_any:
        text += (f"\n\nComposite confidence is {composite:.2f}, below the {ABSTAIN_BELOW:.2f} "
                 "threshold for reporting a result. Treat this as insufficient evidence rather "
                 "than an answer.")

    basis = " ; ".join(dict.fromkeys(c.confidence_basis for c in sequence[2:])) or "no_tool_run"
    outputs = {"overlays": [o["id"] for o in overlays], "stats": stats,
               "geojson_features": len(geojson.get("features", [])) if geojson else 0}
    trace = _trace(query, task_label, validation, sequence, outputs, composite, abstained)

    yield {"event": "final", "data": {
        "text": text,
        "geojson": geojson,
        "overlays": overlays,
        "confidence": composite,
        "basis": basis,
        "abstained": abstained,
        "session_id": session_id,
        "trace": trace,
    }}


def _trace(query, task, validation, sequence, outputs, confidence, abstained) -> dict:
    return {
        "query": query,
        "interpreted_task": task,
        "input_validation": validation.model_dump(),
        "execution_sequence": [c.model_dump() for c in sequence],
        "outputs": outputs,
        "composite_confidence": confidence,
        "abstained": abstained,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
