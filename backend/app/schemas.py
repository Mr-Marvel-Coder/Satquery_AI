"""Contract 3. The wire format the frontend already consumes."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

PairType = Literal["single", "bitemporal", "cross_modal"]


class BandInfo(BaseModel):
    index: int
    name: str


class SceneMeta(BaseModel):
    """Mirrors geo.loader.Scene, minus the pixel array."""
    id: str
    label: str
    sensor: str
    bands: list[str]
    gsd: float
    crs: str
    acquired: str | None = None
    width: int
    height: int
    bounds: list[list[float]]        # [[south, west], [north, east]] for Leaflet
    preview_png: str                 # URL


class Validation(BaseModel):
    ok: bool
    crs_match: bool = True
    co_registered: bool = True
    notes: list[str] = Field(default_factory=list)


class UploadResponse(BaseModel):
    scene_ids: list[str]
    metadata: list[SceneMeta]
    validation: Validation


class QueryRequest(BaseModel):
    scene_ids: list[str]
    text: str


class ToolCall(BaseModel):
    step: int
    tool: str
    version: str
    label: str
    detail: str
    params: dict[str, Any] = Field(default_factory=dict)
    confidence: float
    confidence_basis: str
    runtime_ms: int


class OverlayRef(BaseModel):
    id: str
    label: str
    kind: str                        # legend key: teal | ochre | carmine | moss
    url: str
    bounds: list[list[float]]


class ExecutionTrace(BaseModel):
    query: str
    interpreted_task: str
    input_validation: dict[str, Any]
    execution_sequence: list[ToolCall]      # ORDERED — this is the proof of sequencing
    outputs: dict[str, Any]
    composite_confidence: float
    abstained: bool
    timestamp: datetime
