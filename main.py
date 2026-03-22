"""
Code Archaeologist: Universal Edition v2.0
Main orchestration pipeline for language-agnostic codebase migration.
"""

import argparse
import logging
import sys
from pathlib import Path

from modules.excavator import Excavator
from modules.archaeologist import Archaeologist
from modules.migration_agent import MigrationAgent
from modules.universal_judge import UniversalJudge
from config import Config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("CodeArchaeologist")


def parse_args():
    parser = argparse.ArgumentParser(description="Code Archaeologist: Universal Edition v2.0")
    parser.add_argument("--repo", required=True, help="Git repo URL or local path to migrate")
    parser.add_argument("--target-lang", required=True, help="Target language (e.g. python, typescript, go, rust)")
    parser.add_argument("--output-dir", default="./output", help="Output directory for migrated code")
    parser.add_argument("--source-lang", default=None, help="Override source language detection")
    parser.add_argument("--chunk-size", type=int, default=10, help="Files per processing chunk (RAM control)")
    parser.add_argument("--skip-judge", action="store_true", help="Skip differential testing")
    parser.add_argument("--neo4j-uri", default="bolt://localhost:7687")
    parser.add_argument("--neo4j-user", default="neo4j")
    parser.add_argument("--neo4j-password", default="password")
    parser.add_argument("--gemini-api-key", default=None, help="Gemini API key (or set GEMINI_API_KEY env var)")
    return parser.parse_args()


def main():
    args = parse_args()
    config = Config(args)

    logger.info("=== Code Archaeologist: Universal Edition v2.0 ===")
    logger.info(f"Repository: {args.repo}")
    logger.info(f"Target Language: {args.target_lang}")

    # Module 1: Excavator — clone & discover files
    logger.info("\n[Module 1] Excavator: Cloning and scanning repository...")
    excavator = Excavator(config)
    source_files = excavator.excavate()
    logger.info(f"  Found {len(source_files)} source files.")

    # Module 2: Archaeologist — parse ASTs, build Neo4j graph
    logger.info("\n[Module 2] Archaeologist: Parsing ASTs and building dependency graph...")
    archaeologist = Archaeologist(config)
    archaeologist.analyze(source_files)
    logger.info("  Dependency graph built in Neo4j.")

    # Module 3: Migration Agent — LLM-driven translation
    logger.info("\n[Module 3] Migration Agent: Translating source to target language...")
    agent = MigrationAgent(config, archaeologist)
    migrated_files = agent.migrate_all()
    logger.info(f"  Migrated {len(migrated_files)} files.")

    # Module 4: Universal Judge — differential testing
    if not args.skip_judge:
        logger.info("\n[Module 4] Universal Judge: Running differential tests...")
        judge = UniversalJudge(config)
        results = judge.evaluate(migrated_files)
        passed = sum(1 for r in results if r["passed"])
        logger.info(f"  Parity check: {passed}/{len(results)} tests passed.")
        for r in results:
            status = "✓" if r["passed"] else "✗"
            logger.info(f"    [{status}] {r['file']}: {r.get('message', '')}")

    logger.info("\n=== Migration Complete ===")
    logger.info(f"Output directory: {config.output_dir}")


if __name__ == "__main__":
    main()