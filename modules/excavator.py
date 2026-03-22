"""
modules/excavator.py — Module 1: Repository Cloning & File Discovery

Clones a Git repository (or uses a local path) and walks the directory tree
to identify source files. Uses chunked/lazy iteration to keep RAM low on 8GB hardware.
"""

import logging
import os
import shutil
from pathlib import Path
from typing import Generator, List

import git  # gitpython

logger = logging.getLogger("Excavator")

# Directories to always skip
SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv", "env",
    "dist", "build", "target", ".idea", ".vscode", "vendor", "third_party",
}


class SourceFile:
    """Represents a discovered source file."""

    def __init__(self, path: Path, language: str, grammar: str):
        self.path = path
        self.language = language
        self.grammar = grammar
        self._content: str | None = None

    def read(self) -> str:
        """Lazy-load file content."""
        if self._content is None:
            self._content = self.path.read_text(encoding="utf-8", errors="replace")
        return self._content

    def evict(self):
        """Free content from memory."""
        self._content = None

    def __repr__(self):
        return f"SourceFile({self.path}, lang={self.language})"


class Excavator:
    def __init__(self, config):
        self.config = config
        self.repo_dir: Path | None = None

    def excavate(self) -> List[SourceFile]:
        """Clone (if needed) and discover all source files."""
        self.repo_dir = self._resolve_repo()
        files = list(self._walk_files(self.repo_dir))
        logger.info(f"Discovered {len(files)} source files in {self.repo_dir}")
        return files

    def _resolve_repo(self) -> Path:
        """Clone remote repo or validate local path."""
        repo = self.config.repo

        if repo.startswith("http://") or repo.startswith("https://") or repo.startswith("git@"):
            dest = self.config.work_dir / "repo"
            if dest.exists():
                logger.info(f"Repo already cloned at {dest}, reusing.")
            else:
                logger.info(f"Cloning {repo} → {dest}")
                git.Repo.clone_from(repo, dest, depth=1)  # shallow clone saves RAM
            return dest
        else:
            p = Path(repo)
            if not p.exists():
                raise FileNotFoundError(f"Local path does not exist: {p}")
            return p

    def _walk_files(self, root: Path) -> Generator[SourceFile, None, None]:
        """Walk directory tree, yielding SourceFile objects for known extensions."""
        ext_map = self.config.extension_map

        for dirpath, dirnames, filenames in os.walk(root):
            # Prune skip dirs in-place
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]

            for fname in filenames:
                fpath = Path(dirpath) / fname
                if fname == "__init__.py" and fpath.stat().st_size < 500:
                    continue
                ext = fpath.suffix.lower()

                if ext in ext_map:
                    grammar, language = ext_map[ext]
                    # If user specified source_lang, filter to only that language
                    if self.config.source_lang_override and language != self.config.source_lang_override:
                        continue
                    yield SourceFile(path=fpath, language=language, grammar=grammar)

    def iter_chunks(self, files: List[SourceFile]) -> Generator[List[SourceFile], None, None]:
        """Yield files in chunks to limit RAM usage."""
        size = self.config.chunk_size
        for i in range(0, len(files), size):
            chunk = files[i:i + size]
            yield chunk
            # Evict content after each chunk
            for f in chunk:
                f.evict()