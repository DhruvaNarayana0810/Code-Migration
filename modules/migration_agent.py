"""
modules/migration_agent.py — Module 3: LLM-Driven Migration Agent

Optimized version:
- Change 1: Entities batched per file into ONE LLM call (3-4x fewer calls)
- Change 2: Content-hash translation cache (repeat runs ~instant)
- Change 3: Graph-RAG depth reduced to 1, max 2 deps, 300 char cap
"""

import hashlib
import json
import logging
import time
from pathlib import Path
from typing import List, Dict, Optional

import ollama

logger = logging.getLogger("MigrationAgent")

OLLAMA_MODEL = "qwen2.5-coder:3b"

# Change 2: Cache file location
CACHE_FILE = Path("workdir/translation_cache.json")

SYSTEM_PROMPT = """You are a code translator. Output ONLY raw code, nothing else.

STRICT RULES:
1. Output ONLY valid code in the target language. No comments explaining what you did.
2. No markdown fences (no ``` or ```typescript).
3. No explanations, no prose, no prefixes like "Here is the translation:".
4. Preserve all logic and behavior exactly.
5. Use idiomatic target language patterns and standard libraries.
6. If no equivalent library exists, reimplement the logic using native primitives.
7. Preserve all original code comments and docstrings but translate them to the target language style.
8. Always use ES module syntax for TypeScript (export function, export class). Never use module.exports.
9. The first character of your response must be valid code.
"""


# ── Change 2: Cache helpers ───────────────────────────────────────────────────

def _load_cache() -> Dict:
    try:
        if CACHE_FILE.exists():
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}


def _save_cache(cache: Dict):
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        CACHE_FILE.write_text(json.dumps(cache, indent=2), encoding="utf-8")
    except Exception as e:
        logger.warning(f"Could not save cache: {e}")


def _cache_key(file_path: str, entities_body: str, target_lang: str) -> str:
    raw = f"{file_path}:{target_lang}:{entities_body}"
    return hashlib.md5(raw.encode()).hexdigest()


# ── Change 1: Batched prompt builder ─────────────────────────────────────────

def build_batched_prompt(
    entities: List[Dict],
    context_entities: List[Dict],
    target_lang: str,
    source_lang: str,
) -> str:
    # Change 3: Depth-1 context, max 2 deps, 300 char cap
    context_block = ""
    if context_entities:
        context_block = "\n\n=== DEPENDENCY CONTEXT ===\n"
        for dep in context_entities[:2]:
            context_block += f"\n-- {dep['name']} ({dep.get('language','')}) --\n"
            context_block += (dep.get("body") or "")[:300]
            context_block += "\n"

    # Combine all entities into one source block
    combined = ""
    for e in entities[:6]:  # cap at 6 entities per file
        combined += f"\n# --- {e.get('name','?')} ({e.get('type','?')}) ---\n"
        combined += (e.get("body") or "")[:1200]
        combined += "\n"

    return (
        f"Translate the following {source_lang} code to {target_lang}.\n"
        f"This is a complete file containing {len(entities)} entities. "
        f"Translate ALL of them into one cohesive {target_lang} file.\n"
        + context_block
        + f"\n\n=== SOURCE FILE ({source_lang}) ===\n"
        + combined
        + f"\n\n=== COMPLETE TRANSLATED FILE ({target_lang}) ==="
    )


class MigrationAgent:
    def __init__(self, config, archaeologist):
        self.config = config
        self.archaeologist = archaeologist
        self._cache = _load_cache()
        self._cache_hits = 0
        self._cache_misses = 0

        try:
            models = [m.model for m in ollama.list().models]
            if not any(OLLAMA_MODEL in m for m in models):
                logger.warning(f"Model '{OLLAMA_MODEL}' not found. Run: ollama pull {OLLAMA_MODEL}")
            else:
                logger.info(f"Ollama model ready: {OLLAMA_MODEL}")
        except Exception as e:
            raise RuntimeError(f"Ollama not running. Start with: ollama serve\nError: {e}")

    def migrate_all(self) -> List[Dict]:
        all_entities = self.archaeologist.get_all_entities()
        if not all_entities:
            logger.warning("No entities found in graph. Nothing to migrate.")
            return []

        # Group entities by file
        files: Dict[str, List[Dict]] = {}
        for e in all_entities:
            files.setdefault(e["file"], []).append(e)

        migrated = []
        for file_path, entities in files.items():
            try:
                result = self._migrate_file(file_path, entities)
                if result:
                    migrated.append(result)
            except Exception as ex:
                logger.error(f"Failed to migrate {file_path}: {ex}")

        # Persist updated cache
        _save_cache(self._cache)
        logger.info(f"Cache: {self._cache_hits} hits, {self._cache_misses} misses")
        return migrated

    def _migrate_file(self, file_path: str, entities: List[Dict]) -> Optional[Dict]:
        source_lang = entities[0].get("language", "unknown") if entities else "unknown"
        logger.info(f"  Migrating: {file_path} ({source_lang} -> {self.config.target_lang})")

        # Change 2: Check cache using combined entity bodies as key
        combined_bodies = "".join((e.get("body") or "")[:500] for e in entities)
        key = _cache_key(file_path, combined_bodies, self.config.target_lang)

        if key in self._cache:
            logger.info(f"    [CACHE HIT] {Path(file_path).name}")
            self._cache_hits += 1
            full_translation = self._cache[key]
        else:
            self._cache_misses += 1

            # Change 3: Depth-1 context, cap at 2, 300 chars each
            # Collect context from first entity (representative for the file)
            context = []
            if entities:
                raw_ctx = self.archaeologist.get_context_for_entity(
                    entities[0]["id"], depth=1
                )
                context = [
                    c for c in raw_ctx
                    if c["id"] != entities[0]["id"]
                ][:2]

            # Change 1: Single batched prompt for all entities in file
            prompt = build_batched_prompt(
                entities=entities,
                context_entities=context,
                target_lang=self.config.target_lang,
                source_lang=source_lang,
            )

            full_translation = self._call_ollama(prompt)
            if not full_translation:
                return None

            # Store in cache
            self._cache[key] = full_translation

        # Write output file
        src_path = Path(file_path)
        try:
            rel = src_path.relative_to(self.config.work_dir)
        except ValueError:
            rel = Path(src_path.name)

        out_path = (
            self.config.output_dir
            / rel.parent
            / (rel.stem + self.config.target_extension)
        )
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(full_translation, encoding="utf-8")
        logger.info(f"    -> Written: {out_path}")

        return {
            "source_file": file_path,
            "target_file": str(out_path),
            "source_lang": source_lang,
            "target_lang": self.config.target_lang,
            "entity_count": len(entities),
        }

    def _call_ollama(self, prompt: str, retries: int = 3) -> Optional[str]:
        for attempt in range(retries):
            try:
                print("  Translating: ", end="", flush=True)
                full_text = ""
                for chunk in ollama.chat(
                    model=OLLAMA_MODEL,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    options={"temperature": 0.2, "num_predict": 2048},
                    stream=True,
                ):
                    token = chunk.message.content
                    print(token, end="", flush=True)
                    full_text += token
                print()

                # Strip markdown fences
                if full_text.strip().startswith("```"):
                    lines = full_text.strip().split("\n")
                    lines = lines[1:] if lines[0].startswith("```") else lines
                    lines = lines[:-1] if lines and lines[-1].strip() == "```" else lines
                    full_text = "\n".join(lines)

                return full_text.strip()

            except Exception as e:
                wait = 2 ** attempt
                logger.warning(f"Ollama error (attempt {attempt+1}/{retries}): {e}. Retrying in {wait}s...")
                time.sleep(wait)

        logger.error("Ollama call failed after all retries.")
        return None