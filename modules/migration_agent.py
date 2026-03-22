"""
modules/migration_agent.py — Module 3: LLM-Driven Migration Agent

Uses Ollama (local) for zero-cost, no-quota code translation.
Default model: qwen2.5-coder:3b (lightweight, good at code)
"""

import logging
import time
from pathlib import Path
from typing import List, Dict, Optional

import ollama

logger = logging.getLogger("MigrationAgent")

# Lightweight local model — change to 'codellama' or 'qwen2.5-coder:7b' if you have more RAM
OLLAMA_MODEL = "qwen2.5-coder:3b"

SYSTEM_PROMPT = """You are an expert code migration engine.
Your task is to translate source code from one programming language to another.

STRICT RULES:
1. Output ONLY valid code in the target language. No comments explaining what you did.
2. No markdown fences (no ``` or ```typescript).
3. No explanations, no prose, no prefixes like "Here is the translation:".
4. Preserve ALL logic, algorithms, and behavior exactly.
5. Use idiomatic patterns and best practices of the TARGET language.
6. If a library has a direct equivalent in the target language, use it.
7. If no equivalent exists, implement the behavior from scratch using target language primitives and add a comment explaining the substitution.
8. Output ONLY the translated code — no explanations, no markdown fences.
9. Preserve function/class/variable names where possible.
10. If context files are provided, use them to resolve types and dependencies correctly.
11. The first character of your response must be valid code.
12. Always use ES module syntax: 'export function', 'export class', 'export const'. Never use 'module.exports'.
"""


def build_migration_prompt(
    entity: Dict,
    context_entities: List[Dict],
    target_lang: str,
    source_lang: str,
) -> str:
    context_block = ""
    if context_entities:
        context_block = "\n\n=== DEPENDENCY CONTEXT ===\n"
        for dep in context_entities[:5]:  # fewer deps for smaller context window
            context_block += f"\n-- {dep['name']} ({dep['language']}) --\n"
            context_block += (dep.get("body") or "")[:500]
            context_block += "\n"

    return (
        f"Translate the following {source_lang} code to {target_lang}.\n"
        f"Entity type: {entity.get('type', 'unknown')}\n"
        f"Entity name: {entity.get('name', 'unknown')}\n"
        + context_block
        + f"\n\n=== SOURCE CODE ({source_lang}) ===\n"
        + (entity.get("body") or "")[:3000]  # cap for small models
        + f"\n\n=== TRANSLATED CODE ({target_lang}) ==="
    )


class MigrationAgent:
    def __init__(self, config, archaeologist):
        self.config = config
        self.archaeologist = archaeologist

        # Verify Ollama is running and model is available
        try:
            models = [m.model for m in ollama.list().models]
            if not any(OLLAMA_MODEL in m for m in models):
                logger.warning(f"Model '{OLLAMA_MODEL}' not found. Run: ollama pull {OLLAMA_MODEL}")
                logger.info(f"Available models: {models}")
            else:
                logger.info(f"Ollama model ready: {OLLAMA_MODEL}")
        except Exception as e:
            raise RuntimeError(
                f"Ollama not running. Start it with: ollama serve\nError: {e}"
            )

    def migrate_all(self) -> List[Dict]:
        all_entities = self.archaeologist.get_all_entities()
        if not all_entities:
            logger.warning("No entities found in graph. Nothing to migrate.")
            return []

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

        return migrated

    def _migrate_file(self, file_path: str, entities: List[Dict]) -> Optional[Dict]:
        source_lang = entities[0].get("language", "unknown") if entities else "unknown"
        logger.info(f"  Migrating: {file_path} ({source_lang} -> {self.config.target_lang})")

        translated_sections = []

        for entity in entities:
            context = self.archaeologist.get_context_for_entity(entity["id"], depth=2)
            context = [c for c in context if c["id"] != entity["id"]]

            prompt = build_migration_prompt(
                entity=entity,
                context_entities=context,
                target_lang=self.config.target_lang,
                source_lang=source_lang,
            )

            translated = self._call_ollama(prompt)
            if translated:
                translated_sections.append(
                    f"// === {entity['name']} (translated from {source_lang}) ===\n{translated}"
                )

        if not translated_sections:
            return None

        full_translation = "\n\n".join(translated_sections)

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
                response = ollama.chat(
                    model=OLLAMA_MODEL,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    options={
                        "temperature": 0.2,
                        "num_predict": 4096,
                    }
                )
                text = response.message.content.strip()

                # Strip markdown fences if model adds them
                if text.startswith("```"):
                    lines = text.split("\n")
                    lines = lines[1:] if lines[0].startswith("```") else lines
                    lines = lines[:-1] if lines and lines[-1].strip() == "```" else lines
                    text = "\n".join(lines)

                return text

            except Exception as e:
                wait = 2 ** attempt
                logger.warning(f"Ollama error (attempt {attempt+1}/{retries}): {e}. Retrying in {wait}s...")
                time.sleep(wait)

        logger.error("Ollama call failed after all retries.")
        return None