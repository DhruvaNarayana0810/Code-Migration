"""
backend/services/scan_service.py — One-time repo scan that populates RepoContext

All other services read from RepoContext. Nothing re-scans.
"""

import logging
import os
import sys
from pathlib import Path
from types import SimpleNamespace

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

os.environ["GEMINI_API_KEY"] = "unused"

from config import Config
from modules.excavator import Excavator
from modules.archaeologist import Archaeologist
from backend.services.repo_context import repo_context
from backend.services.graph_service import GraphService

logger = logging.getLogger("ScanService")


def _build_config(path: str) -> Config:
    args = SimpleNamespace(
        repo=path,
        target_lang="python",
        output_dir="./api_output",
        source_lang=None,
        chunk_size=10,
        skip_judge=False,
        neo4j_uri=os.getenv("NEO4J_URI", "bolt://127.0.0.1:7687"),
        neo4j_user=os.getenv("NEO4J_USER", "neo4j"),
        neo4j_password=os.getenv("NEO4J_PASSWORD", "omnamahshivaya"),
        gemini_api_key="unused",
    )
    return Config(args)


class ScanService:
    def __init__(self, graph_service: GraphService):
        self.graph_service = graph_service

    def scan(self, path: str) -> dict:
        """
        Scan repo once — populate Neo4j graph AND RepoContext in-memory store.
        All subsequent feature calls read from RepoContext, no re-scan needed.
        """
        config = _build_config(path)

        # Clear and rebuild graph
        self.graph_service.clear_graph()

        excavator = Excavator(config)
        source_files = excavator.excavate()

        archaeologist = Archaeologist(config)
        try:
            archaeologist.analyze(source_files)
            raw_entities = archaeologist.get_all_entities()
        finally:
            archaeologist.close()

        # Populate in-memory store — re-read files since evict() may have cleared them
        excavator2 = Excavator(config)
        fresh_files = excavator2.excavate()
        for sf in fresh_files:
            sf.read()  # ensure content loaded before populating

        repo_context.populate(
            repo_path=str(Path(config.work_dir) / "repo"),
            raw_entities=raw_entities,
            source_files=fresh_files,
        )

        entity_count = self.graph_service.get_entity_count()
        logger.info(f"Scan complete: {len(source_files)} files, {entity_count} entities")

        return {
            "status": "scanned",
            "files": len(source_files),
            "entities": entity_count,
        }