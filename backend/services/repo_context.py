"""
backend/services/repo_context.py — Singleton in-memory knowledge store

Scanned once per session. All features read from here — no re-scanning.
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

logger = logging.getLogger("RepoContext")


@dataclass
class FileRecord:
    filename: str
    path: str
    language: str
    content: str
    functions: List[str] = field(default_factory=list)
    imports: List[str] = field(default_factory=list)


@dataclass
class EntityRecord:
    id: str
    name: str
    type: str           # function, class, file, etc.
    code: str
    language: str
    file: str
    dependencies: List[str] = field(default_factory=list)


class RepoContext:
    """
    Singleton in-memory knowledge store.
    Populated once by /scan-repo, read by all other endpoints.
    """

    def __init__(self):
        self.repo_path: Optional[str] = None
        self.files: List[FileRecord] = []
        self.entities: List[EntityRecord] = []
        self._entity_index: Dict[str, EntityRecord] = {}  # name -> entity
        self.scanned: bool = False

    def clear(self):
        self.repo_path = None
        self.files = []
        self.entities = []
        self._entity_index = {}
        self.scanned = False

    def populate(self, repo_path: str, raw_entities: List[Dict], source_files):
        """
        Called once by scan_service after Excavator + Archaeologist run.
        raw_entities: list of dicts from archaeologist.get_all_entities()
        source_files: list of SourceFile objects from excavator
        """
        self.clear()
        self.repo_path = repo_path

        # Build file records from source files
        seen_files = set()
        for sf in source_files:
            path_str = str(sf.path)
            if path_str in seen_files:
                continue
            seen_files.add(path_str)
            try:
                content = sf.read()
            except Exception:
                content = ""
            self.files.append(FileRecord(
                filename=sf.path.name,
                path=path_str,
                language=sf.language,
                content=content,
                imports=[],
                functions=[],
            ))

        # Build entity records
        for e in raw_entities:
            record = EntityRecord(
                id=e.get("id", ""),
                name=e.get("name", ""),
                type=e.get("type", "unknown"),
                code=e.get("body") or "",
                language=e.get("language", ""),
                file=e.get("file", ""),
                dependencies=[],
            )
            self.entities.append(record)
            self._entity_index[record.name] = record

        # Enrich file records with function names from entities
        file_to_functions: Dict[str, List[str]] = {}
        file_to_imports: Dict[str, List[str]] = {}
        for e in raw_entities:
            f = e.get("file", "")
            if e.get("type") in ("function_definition", "function", "method_declaration"):
                file_to_functions.setdefault(f, []).append(e.get("name", ""))
            imports = e.get("imports") or []
            file_to_imports.setdefault(f, []).extend(imports)

        for fr in self.files:
            fr.functions = list(set(file_to_functions.get(fr.path, [])))
            fr.imports = list(set(file_to_imports.get(fr.path, [])))

        self.scanned = True
        logger.info(f"RepoContext populated: {len(self.files)} files, {len(self.entities)} entities")

    def get_entity(self, name: str) -> Optional[EntityRecord]:
        return self._entity_index.get(name)

    def search(self, query: str, top_k: int = 5) -> List[EntityRecord]:
        """
        Keyword search across entity names and code bodies.
        Returns top_k most relevant entities.
        """
        query_lower = query.lower()
        keywords = query_lower.split()

        scored = []
        for e in self.entities:
            score = 0
            name_lower = e.name.lower()
            code_lower = e.code.lower()

            for kw in keywords:
                if kw in name_lower:
                    score += 3      # name match weighs more
                if kw in code_lower:
                    score += 1
            if score > 0:
                scored.append((score, e))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [e for _, e in scored[:top_k]]

    def get_code_sample(self, max_chars: int = 2000) -> str:
        """Return a representative code sample across files for LLM prompts."""
        sample = ""
        per_file = max_chars // max(len(self.files), 1)
        for fr in self.files:
            sample += f"\n# --- {fr.filename} ---\n"
            sample += fr.content[:per_file]
        return sample[:max_chars]

    def summary(self) -> Dict:
        return {
            "repo_path": self.repo_path,
            "files": len(self.files),
            "entities": len(self.entities),
            "scanned": self.scanned,
        }


# Global singleton — imported everywhere
repo_context = RepoContext()