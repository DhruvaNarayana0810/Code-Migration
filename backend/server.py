"""
backend/server.py — FastAPI route definitions

Only defines routes and dependency injection.
All logic lives in services/.
"""

import logging
import os
import asyncio
import json
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from backend.models import (
    AnalyzeRequest, AnalyzeResponse,
    GraphResponse,
    MigrateRequest, MigrateResponse,
)
from backend.services.graph_service import GraphService
from backend.services.migration_service import MigrationService

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("Server")

# ── Neo4j config from env (falls back to hardcoded defaults) ─────────────────
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://127.0.0.1:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "omnamahshivaya")

# ── Shared service instances ──────────────────────────────────────────────────
graph_service: GraphService = None
migration_service: MigrationService = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and teardown services on startup/shutdown."""
    global graph_service, migration_service
    graph_service = GraphService(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
    migration_service = MigrationService(graph_service)
    logger.info("Services initialized.")
    yield
    graph_service.close()
    logger.info("Services shut down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Code Archaeologist API",
    description="Dependency graph analysis and code migration API",
    version="2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    """Analyze a repository and populate the Neo4j dependency graph."""
    try:
        result = migration_service.analyze(request.path)
        return AnalyzeResponse(**result)
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


from neo4j.exceptions import ServiceUnavailable


@app.get("/graph", response_model=GraphResponse)
async def get_graph():
    """Return Cytoscape.js-compatible dependency graph data.

    If the Neo4j database is down or unreachable we log the error and
    return an empty graph rather than propagating a 500 to every client.
    This makes the frontend more tolerant when the database isn't started
    (e.g. during local development).
    """
    try:
        data = graph_service.get_graph_data()
        return GraphResponse(**data)
    except ServiceUnavailable as e:
        # typical when bolt:// host:port is not listening
        logger.error(f"Neo4j unavailable: {e}")
        return GraphResponse(nodes=[], edges=[])
    except Exception as e:
        logger.error(f"Graph fetch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/migrate", response_model=MigrateResponse)
async def migrate(request: MigrateRequest):
    """Run full migration pipeline and return results."""
    try:
        result = migration_service.migrate(request.path, request.target_language)
        return MigrateResponse(**result)
    except Exception as e:
        error_str = str(e)
        if "connection" in error_str.lower() or "resolve" in error_str.lower():
            # Likely Neo4j connection issue
            logger.error(f"Neo4j connection failed for migration: {e}")
            raise HTTPException(status_code=503, detail="Database unavailable. Please check Neo4j connection settings.")
        else:
            logger.error(f"Migration failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/migrate")
async def migrate_ws(websocket: WebSocket):
    """Run migration with progress updates via WebSocket."""
    await websocket.accept()
    
    # Create a queue for progress messages
    progress_queue = asyncio.Queue()
    
    async def send_progress_updates():
        """Background task to send progress updates via WebSocket."""
        try:
            while True:
                message = await progress_queue.get()
                await websocket.send_text(json.dumps(message))
                progress_queue.task_done()
        except Exception:
            # WebSocket closed or error
            pass
    
    # Start the progress sender task
    progress_task = asyncio.create_task(send_progress_updates())
    
    try:
        data = await websocket.receive_json()
        path = data["path"]
        target_language = data["target_language"]

        def progress_cb(step, percent):
            # Put progress message in queue (this is thread-safe)
            progress_queue.put_nowait({"type": "progress", "step": step, "percent": percent})

        result = await asyncio.to_thread(migration_service.migrate, path, target_language, progress_cb)
        await websocket.send_text(json.dumps({"type": "done", "result": result}))
    except Exception as e:
        await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
    finally:
        # Clean up the progress task
        progress_task.cancel()
        try:
            await progress_task
        except asyncio.CancelledError:
            pass


@app.get("/health")
async def health():
    """Simple health check."""
    return {"status": "ok"}


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.server:app", host="0.0.0.0", port=8001, reload=True)