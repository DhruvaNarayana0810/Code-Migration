"""
modules/archaeologist.py — Module 2: AST Parsing & Dependency Graph

Uses Tree-Sitter (0.25+) to parse source files into ASTs, extracts entities
(functions, classes, imports), and stores them in Neo4j with DEPENDS_ON relationships.
This solves the Context Window problem by enabling Graph-RAG.
"""

import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

from neo4j import GraphDatabase
import tree_sitter_languages  # provides pre-built grammars

from modules.excavator import SourceFile

logger = logging.getLogger("Archaeologist")


# ── Tree-Sitter query patterns per grammar ──────────────────────────────────

ENTITY_QUERIES: Dict[str, str] = {
    "python": """
        (function_definition name: (identifier) @name) @entity
        (class_definition name: (identifier) @name) @entity
        (import_statement) @import
        (import_from_statement) @import
    """,
    "javascript": """
        (function_declaration name: (identifier) @name) @entity
        (class_declaration name: (identifier) @name) @entity
        (import_statement) @import
        (export_statement) @entity
    """,
    "typescript": """
        (function_declaration name: (identifier) @name) @entity
        (class_declaration name: (identifier) @name) @entity
        (interface_declaration name: (type_identifier) @name) @entity
        (import_statement) @import
    """,
    "tsx": """
        (function_declaration name: (identifier) @name) @entity
        (class_declaration name: (identifier) @name) @entity
        (import_statement) @import
    """,
    "java": """
        (class_declaration name: (identifier) @name) @entity
        (method_declaration name: (identifier) @name) @entity
        (import_declaration) @import
    """,
    "c": """
        (function_definition declarator: (function_declarator declarator: (identifier) @name)) @entity
        (declaration) @entity
        (preproc_include) @import
    """,
    "cpp": """
        (function_definition declarator: (function_declarator declarator: (identifier) @name)) @entity
        (class_specifier name: (type_identifier) @name) @entity
        (preproc_include) @import
    """,
    "go": """
        (function_declaration name: (identifier) @name) @entity
        (type_declaration) @entity
        (import_declaration) @import
    """,
    "rust": """
        (function_item name: (identifier) @name) @entity
        (struct_item name: (type_identifier) @name) @entity
        (use_declaration) @import
    """,
    "c_sharp": """
        (class_declaration name: (identifier) @name) @entity
        (method_declaration name: (identifier) @name) @entity
        (using_directive) @import
    """,
}

FALLBACK_QUERY = "(identifier) @name"


class Archaeologist:
    def __init__(self, config):
        self.config = config
        self.driver = GraphDatabase.driver(
            "bolt://127.0.0.1:7687",
            auth=("neo4j", "omnamahshivaya"),
            max_connection_pool_size=5,
            connection_timeout=30,
        )
        self._init_schema()
        self._parsers: Dict[str, Any] = {}

    # ── Schema Setup ─────────────────────────────────────────────────────────

    def _init_schema(self):
        with self.driver.session() as session:
            session.run("CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE")
            session.run("CREATE INDEX entity_file IF NOT EXISTS FOR (e:Entity) ON (e.file)")
        logger.info("Neo4j schema ready.")

    # ── Parser Management ────────────────────────────────────────────────────

    def _get_parser(self, grammar: str):
        """Lazily initialize tree-sitter parser for a grammar."""
        if grammar not in self._parsers:
            try:
                language = tree_sitter_languages.get_language(grammar)
                parser = tree_sitter_languages.get_parser(grammar)
                self._parsers[grammar] = (language, parser)
                logger.debug(f"Loaded Tree-Sitter grammar: {grammar}")
            except Exception as e:
                logger.warning(f"Could not load grammar '{grammar}': {e}")
                self._parsers[grammar] = None
        return self._parsers[grammar]

    # ── Analysis ─────────────────────────────────────────────────────────────

    def analyze(self, files: List[SourceFile]):
        """Parse all source files and build the graph."""
        chunk_size = self.config.chunk_size

        for i in range(0, len(files), chunk_size):
            chunk = files[i:i + chunk_size]
            logger.info(f"  Analyzing chunk {i//chunk_size + 1}: files {i}–{i+len(chunk)-1}")
            for sf in chunk:
                try:
                    self._analyze_file(sf)
                except Exception as e:
                    logger.warning(f"  Failed to analyze {sf.path}: {e}")
                finally:
                    sf.evict()  # free RAM

        self._build_dependency_edges()

    def _analyze_file(self, sf: SourceFile):
        """Parse one file, extract entities, write to Neo4j."""
        content = sf.read()
        if not content.strip():
            return

        parser_result = self._get_parser(sf.grammar)
        entities = []

        if parser_result:
            language_obj, parser = parser_result
            tree = parser.parse(bytes(content, "utf-8"))
            entities = self._extract_entities(tree, content, sf, language_obj)
        else:
            imports_raw = self._extract_imports_fallback(content, sf.language)
            entities = [{
                "id": str(sf.path),
                "name": sf.path.stem,
                "type": "file",
                "body": content[:2000],
                "language": sf.language,
                "file": str(sf.path),
                "imports": imports_raw,
            }]

        with self.driver.session() as session:
            for entity in entities:
                session.run("""
                    MERGE (e:Entity {id: $id})
                    SET e.name = $name,
                        e.type = $type,
                        e.body = $body,
                        e.language = $language,
                        e.file = $file,
                        e.imports = $imports
                """, **entity)

    def _extract_entities(self, tree, content: str, sf: SourceFile, language_obj) -> List[Dict]:
        """Use Tree-Sitter queries to extract named entities from AST."""
        from tree_sitter import QueryCursor  # Tree-Sitter 0.25+ API

        grammar = sf.grammar
        query_src = ENTITY_QUERIES.get(grammar, FALLBACK_QUERY)
        entities = []
        imports_raw = []

        try:
            query = language_obj.query(query_src)
            cursor = QueryCursor(query)
            cursor.matches(tree.root_node)
            captures = query.captures(tree.root_node)
        except Exception as e:
            logger.debug(f"Query failed for {sf.path}: {e}")
            return []

        for node, capture_name in captures:
            node_text = content[node.start_byte:node.end_byte]

            if capture_name == "import":
                imports_raw.append(node_text.strip())
                continue

            if capture_name in ("entity", "name"):
                name = node_text[:200].strip().split("\n")[0]
                entity_id = f"{sf.path}::{name}"
                entities.append({
                    "id": entity_id,
                    "name": name,
                    "type": node.type,
                    "body": node_text[:4000],
                    "language": sf.language,
                    "file": str(sf.path),
                    "imports": imports_raw,
                })

        if not entities:
            entities.append({
                "id": str(sf.path),
                "name": sf.path.stem,
                "type": "file",
                "body": content[:4000],
                "language": sf.language,
                "file": str(sf.path),
                "imports": imports_raw,
            })

        return entities

    def _extract_imports_fallback(self, content: str, language: str) -> List[str]:
        """Fallback import extraction using regex when Tree-Sitter fails."""
        import re
        imports = []
        if language == "python":
            import_patterns = [
                r'^\s*import\s+(.+)$',
                r'^\s*from\s+(.+)\s+import\s+(.+)$'
            ]
            for line in content.split('\n'):
                for pattern in import_patterns:
                    match = re.match(pattern, line.strip())
                    if match:
                        imports.append(line.strip())
                        break
        return imports

    def _build_dependency_edges(self):
        """
        Context Collector: Link Entity nodes via DEPENDS_ON edges based on
        import statements referencing known entity names.
        """
        logger.info("  Building DEPENDS_ON edges (Context Collector)...")
        with self.driver.session() as session:
            session.run("""
                MATCH (a:Entity), (b:Entity)
                WHERE a <> b
                  AND any(imp IN a.imports WHERE imp CONTAINS b.name)
                MERGE (a)-[:DEPENDS_ON]->(b)
            """)
            session.run("""
                MATCH (a:Entity), (b:Entity)
                WHERE a.file <> b.file
                  AND any(imp IN a.imports WHERE imp CONTAINS b.file OR imp CONTAINS b.name)
                MERGE (a)-[:DEPENDS_ON]->(b)
            """)
        logger.info("  Dependency edges built.")

    # ── Graph-RAG Retrieval ───────────────────────────────────────────────────

    def get_context_for_entity(self, entity_id: str, depth: int = 2) -> List[Dict]:
        with self.driver.session() as session:
            result = session.run("""
                MATCH path = (e:Entity {id: $id})-[:DEPENDS_ON*0..%d]->(dep:Entity)
                RETURN DISTINCT dep.id AS id, dep.name AS name, dep.type AS type,
                               dep.body AS body, dep.language AS language, dep.file AS file
            """ % depth, id=entity_id)
            return [dict(r) for r in result]

    def get_all_entities(self) -> List[Dict]:
        with self.driver.session() as session:
            result = session.run("""
                MATCH (e:Entity)
                RETURN e.id AS id, e.name AS name, e.type AS type,
                       e.body AS body, e.language AS language, e.file AS file,
                       e.imports AS imports
                ORDER BY e.file, e.name
            """)
            return [dict(r) for r in result]

    def get_file_entities(self, file_path: str) -> List[Dict]:
        with self.driver.session() as session:
            result = session.run("""
                MATCH (e:Entity {file: $file})
                RETURN e.id AS id, e.name AS name, e.type AS type,
                       e.body AS body, e.language AS language, e.imports AS imports
                ORDER BY e.name
            """, file=file_path)
            return [dict(r) for r in result]

    def close(self):
        self.driver.close()