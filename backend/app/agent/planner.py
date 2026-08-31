"""Select and sequence. The router.

The LLM proposes a plan as JSON; a keyword fallback catches every case where it
does not. Section 7 of the build spec predicted this fallback "will save the
demo at least once" — so it is not a safety net bolted on afterwards, it is the
primary path whenever the model is slow, absent, or returns prose.
"""
from __future__ import annotations

import json
import logging
import re

from ..models import qwen

log = logging.getLogger("satquery.planner")

TASKS = ("single_vqa", "grounding", "indices", "cross_modal", "bitemporal_change", "abstain")

# Questions imagery cannot answer at all. Catching these BEFORE routing is what
# makes abstention a decision rather than an accident of low confidence — the
# system should refuse a yield forecast even when NDVI happens to look strong.
OUT_OF_SCOPE = (
    "yield", "forecast", "predict", "next year", "next season", "will there be",
    "who owns", "ownership", "land price", "market value", "how much is it worth",
    "population", "gdp", "profit", "revenue", "rainfall next", "temperature next",
    "weather tomorrow", "stock", "invest",
)

CHANGE_WORDS = ("chang", "differ", "between", "compare", "before", "after", "since",
                "grew", "shrunk", "expansion", "deforest", "over time")
GROUND_WORDS = ("where", "locate", "highlight", "find", "point", "show me the",
                "which part", "coordinates", "boundary", "extent")
INDEX_WORDS = {"ndwi": ("water", "lake", "river", "reservoir", "flood", "pond", "wet"),
               "ndvi": ("vegetation", "crop", "forest", "green", "farm", "tree", "healthy"),
               "ndbi": ("built", "urban", "building", "settlement", "city", "concrete")}
FUSION_WORDS = ("cloud", "sar", "radar", "under", "through", "agree", "disagree",
                "both sensor", "backscatter", "obscur")

PROMPT = """You route geospatial queries to tools. Return ONLY JSON, no prose, no code fences.

Inputs: {n} image(s). Modalities: {mods}. Dates: {dates}.
Available tasks: single_vqa | grounding | indices | cross_modal | bitemporal_change
Available tools: vqa | grounding | indices | indices_ring | fusion | change

Query: "{query}"

Return exactly:
{{"task": "...", "tools": ["..."], "params": {{}}}}

Rules:
- Two modalities (S1 and S2) present and the query mentions cloud, radar or sensor agreement -> cross_modal, tools ["fusion"].
- Two dates of the same sensor and the query asks what changed -> bitemporal_change, tools ["change"].
- The query asks WHERE something is -> grounding, tools ["grounding"], params {{"target": "<thing>"}}.
- The query asks about a feature AND its surroundings -> indices, tools ["indices_ring"], params {{"around": "ndwi"|"ndvi"|"ndbi", "measure": "ndwi"|"ndvi"|"ndbi"}}.
- The query asks how much water/vegetation/built-up -> indices, tools ["indices"], params {{"indices": ["ndwi"]}}.
- Otherwise -> single_vqa, tools ["vqa"], params {{"question": "<the query>"}}.
"""


def plan(query: str, scenes: list) -> dict:
    mods = sorted({s.sensor for s in scenes})
    dates = sorted({(s.acquired or "")[:10] for s in scenes if s.acquired})

    # Out-of-scope is decided by rule, never delegated to the model. A VLM asked
    # to forecast a yield will cheerfully try.
    if any(w in query.lower() for w in OUT_OF_SCOPE):
        return _sanitise({"task": "abstain", "tools": [], "params": {"reason": "out_of_scope"},
                          "source": "scope_guard"}, query, scenes, mods, dates)

    if qwen.get_model() is not None:
        try:
            raw, _ = qwen.chat(
                PROMPT.format(n=len(scenes), mods=", ".join(mods) or "unknown",
                              dates=", ".join(dates) or "unknown", query=query),
                max_new_tokens=160,
            )
            parsed = _parse(raw)
            if parsed:
                parsed["source"] = "llm"
                return _sanitise(parsed, query, scenes, mods, dates)
        except Exception as exc:
            log.warning("planner LLM failed, using keywords — %s", exc)

    parsed = keyword_plan(query, scenes, mods, dates)
    parsed["source"] = "keyword_fallback"
    return _sanitise(parsed, query, scenes, mods, dates)


def keyword_plan(query: str, scenes: list, mods: list[str], dates: list[str]) -> dict:
    q = query.lower()

    if any(w in q for w in OUT_OF_SCOPE):
        return {"task": "abstain", "tools": [], "params": {"reason": "out_of_scope"}}

    cross_modal_possible = "S1" in mods and len(mods) > 1
    if cross_modal_possible and (any(w in q for w in FUSION_WORDS) or len(scenes) == 2):
        return {"task": "cross_modal", "tools": ["fusion"], "params": {}}

    if len(scenes) >= 2 and len(dates) > 1 and any(w in q for w in CHANGE_WORDS):
        return {"task": "bitemporal_change", "tools": ["change"], "params": {}}

    hits = [name for name, words in INDEX_WORDS.items() if any(w in q for w in words)]

    # "the water AND the area around it" — the compound case.
    surrounding = any(w in q for w in ("surround", "around", "nearby", "adjacent", "border", "bank"))
    # Chained deliberately: locate the feature, THEN measure its surroundings.
    # Two registry entries, two trace rows — which is what proves "select and
    # sequence" to anyone reading the trace.
    if surrounding and hits:
        around = hits[0]
        measure = hits[1] if len(hits) >= 2 else ("ndvi" if around != "ndvi" else "ndwi")
        return {"task": "indices", "tools": ["indices", "indices_ring"],
                "params": {"indices": [around], "around": around, "measure": measure}}

    if any(w in q for w in GROUND_WORDS):
        return {"task": "grounding", "tools": ["grounding"],
                "params": {"target": _target(query, hits)}}

    if hits:
        return {"task": "indices", "tools": ["indices"], "params": {"indices": hits}}

    return {"task": "single_vqa", "tools": ["vqa"], "params": {"question": query}}


def _target(query: str, hits: list[str]) -> str:
    if hits:
        return {"ndwi": "water body", "ndvi": "vegetation", "ndbi": "built-up area"}[hits[0]]
    m = re.search(r"where (?:is|are|exactly is) (?:the )?([a-z ]{3,40})", query.lower())
    return m.group(1).strip(" ?.") if m else "the main feature"


def _parse(raw: str) -> dict | None:
    raw = re.sub(r"```(?:json)?|```", "", raw).strip()
    for candidate in (raw, *re.findall(r"\{.*\}", raw, re.S)):
        try:
            data = json.loads(candidate)
        except Exception:
            continue
        if isinstance(data, dict) and data.get("task") in TASKS and isinstance(data.get("tools"), list):
            return {"task": data["task"], "tools": [str(t) for t in data["tools"]],
                    "params": data.get("params") or {}}
    return None


def _sanitise(p: dict, query: str, scenes: list, mods: list[str], dates: list[str]) -> dict:
    """A plan the inputs cannot support is worse than no plan. Fix it or drop it."""
    from .registry import REGISTRY

    tools = [t for t in p["tools"] if t in REGISTRY]
    notes = []

    if p["task"] == "abstain":
        return {"task": "abstain", "tools": [], "params": p.get("params", {}),
                "source": p.get("source", "scope_guard"), "notes": ["query maps to no registered tool"],
                "modalities": mods, "dates": dates}

    if "fusion" in tools and not ("S1" in mods and len(mods) > 1):
        tools = [t for t in tools if t != "fusion"]
        notes.append("fusion dropped: no optical/SAR pair")
    if "change" in tools and len(scenes) < 2:
        tools = [t for t in tools if t != "change"]
        notes.append("change dropped: only one scene")

    if not tools:
        tools = ["vqa"]
        p["task"] = "single_vqa"
        p["params"] = {"question": query}

    params = dict(p.get("params") or {})
    params.setdefault("question", query)
    if "grounding" in tools:
        params.setdefault("target", _target(query, []))

    return {"task": p["task"], "tools": tools, "params": params,
            "source": p.get("source", "keyword_fallback"), "notes": notes,
            "modalities": mods, "dates": dates}
