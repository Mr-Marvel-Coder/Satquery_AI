"""Adding a sixth tool is one file plus one line here."""
from __future__ import annotations

from ..tools.change import ChangeTool
from ..tools.fusion import FusionTool
from ..tools.grounding import GroundingTool
from ..tools.indices_tool import BufferIndicesTool, IndicesTool
from ..tools.vqa import VQATool

REGISTRY = {t.name: t for t in (
    VQATool(),
    GroundingTool(),
    IndicesTool(),
    BufferIndicesTool(),
    FusionTool(),
    ChangeTool(),
)}


def get(name: str):
    return REGISTRY.get(name)


def describe() -> list[dict]:
    return [
        {"name": t.name, "version": t.version, "label": t.label,
         "accepts": t.accepts, "kind": t.kind}
        for t in REGISTRY.values()
    ]
