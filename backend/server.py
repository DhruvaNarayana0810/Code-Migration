"""
backend/server.py — FastAPI routes
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.models import (
    AnalyzeRequest, AnalyzeResponse,
    GraphResponse,
    MigrateRequest, MigrateResponse,
    AnalyzeMigrationRequest,
)
from backend.services.graph_service import GraphService
from backend.services.migration_service import MigrationService
from backend.services.analysis_service import AnalysisService
from backend.services.insights_service import InsightsService
from backend.services.scan_service import ScanService
from backend.services.chat_service import ChatService
from backend.services.repo_context import repo_context

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("Server")

NEO4J_URI      = os.getenv("NEO4J_URI",      "bolt://127.0.0.1:7687")
NEO4J_USER     = os.getenv("NEO4J_USER",     "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "omnamahshivaya")

graph_service:     GraphService     = None
migration_service: MigrationService = None
analysis_service:  AnalysisService  = None
insights_service:  InsightsService  = None
scan_service:      ScanService      = None
chat_service:      ChatService      = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global graph_service, migration_service, analysis_service
    global insights_service, scan_service, chat_service

    graph_service     = GraphService(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
    migration_service = MigrationService(graph_service)
    analysis_service  = AnalysisService(graph_service)
    insights_service  = InsightsService(graph_service)
    scan_service      = ScanService(graph_service)
    chat_service      = ChatService()
    logger.info("Services initialized.")
    yield
    graph_service.close()
    logger.info("Services shut down.")


app = FastAPI(title="Code Archaeologist API", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request models ────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    path: str

class ChatRequest(BaseModel):
    query: str


# ── Existing routes ───────────────────────────────────────────────────────────

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    try:
        result = migration_service.analyze(request.path)
        return AnalyzeResponse(**result)
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/graph", response_model=GraphResponse)
async def get_graph():
    try:
        data = graph_service.get_graph_data()
        return GraphResponse(**data)
    except Exception as e:
        logger.error(f"Graph fetch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/migrate", response_model=MigrateResponse)
async def migrate(request: MigrateRequest):
    try:
        result = migration_service.migrate(request.path, request.target_language)
        return MigrateResponse(**result)
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze-migration")
async def analyze_migration(request: AnalyzeMigrationRequest):
    try:
        from pathlib import Path
        output_dir = Path("./api_output")
        migrated_files = []
        if output_dir.exists():
            for f in output_dir.rglob("*"):
                if f.is_file():
                    try:
                        migrated_files.append({"filename": f.name, "code": f.read_text(encoding="utf-8")})
                    except Exception:
                        pass
        source_dir = str(Path("./workdir/repo"))
        result = analysis_service.analyze_migration(source_dir, migrated_files, request.target_language)
        return result
    except Exception as e:
        logger.error(f"Migration analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/entity-info")
async def entity_info(entity_name: str = Query(...)):
    try:
        result = analysis_service.get_entity_info(entity_name)
        return result
    except Exception as e:
        logger.error(f"Entity info failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── New unified routes — all read from RepoContext ────────────────────────────

@app.post("/scan-repo")
async def scan_repo(request: ScanRequest):
    """Scan repo once. Populates Neo4j graph AND in-memory RepoContext."""
    try:
        result = scan_service.scan(request.path)
        return result
    except Exception as e:
        logger.error(f"Scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
async def chat(request: ChatRequest):
    """Answer questions about the scanned codebase."""
    try:
        answer = chat_service.answer(request.query)
        return {"answer": answer}
    except Exception as e:
        logger.error(f"Chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/bug-risk")
async def bug_risk():
    """Return bug risk analysis from RepoContext — no re-scan."""
    try:
        return insights_service.predict_bug_risk()
    except Exception as e:
        logger.error(f"Bug risk failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/suggestions")
async def suggestions():
    """Return improvement suggestions from RepoContext — no re-scan."""
    try:
        return insights_service.suggest_improvements()
    except Exception as e:
        logger.error(f"Suggestions failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/generate-docs")
async def generate_docs():
    """Generate documentation from RepoContext — no re-scan."""
    try:
        return insights_service.generate_docs()
    except Exception as e:
        logger.error(f"Docs failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/repo-context")
async def get_repo_context():
    """Return current RepoContext status."""
    return repo_context.summary()


@app.post("/bug-risk-legacy")
async def bug_risk_legacy(request: AnalyzeRequest):
    """Legacy endpoint — kept for backward compat with Home.jsx panels."""
    return insights_service.predict_bug_risk()


@app.post("/suggest-improvements")
async def suggest_improvements_legacy(request: AnalyzeRequest):
    """Legacy endpoint — kept for backward compat with Home.jsx panels."""
    return insights_service.suggest_improvements()


@app.get("/health")
async def health():
    return {"status": "ok", "repo_scanned": repo_context.scanned}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.server:app", host="0.0.0.0", port=8000, reload=True)