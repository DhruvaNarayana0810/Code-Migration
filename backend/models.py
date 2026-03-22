"""
backend/models.py — Pydantic request/response schemas
"""

from typing import List, Optional
from pydantic import BaseModel


# ── Requests ─────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    path: str


class MigrateRequest(BaseModel):
    path: str
    target_language: str


# ── Responses ────────────────────────────────────────────────────────────────

class AnalyzeResponse(BaseModel):
    status: str
    entities_found: int


class NodeData(BaseModel):
    id: str
    label: str
    type: str


class EdgeData(BaseModel):
    source: str
    target: str
    label: Optional[str] = ""


class GraphNode(BaseModel):
    data: NodeData


class GraphEdge(BaseModel):
    data: EdgeData


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]


class MigratedFile(BaseModel):
    filename: str
    code: str


class MigrateResponse(BaseModel):
    files: List[MigratedFile]
    parity: str               # "PASS" | "FAIL" | "SKIP"
    confidence_score: float
    execution_time_ms: int
    files_migrated: int