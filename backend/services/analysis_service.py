"""
backend/services/analysis_service.py — Migration analysis and entity info
"""

import logging
import re
import sys
import threading
import time
from pathlib import Path
from typing import Dict, List

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

import ollama

logger = logging.getLogger("AnalysisService")

OLLAMA_MODEL = "qwen2.5-coder:3b"

COMPLEXITY_KEYWORDS = ["if", "for", "while", "case", "&&", "||", "elif", "catch", "except"]


def _compute_metrics(code: str) -> Dict:
    lines = [l for l in code.splitlines() if l.strip()]
    loc = len(lines)
    functions = len(re.findall(r'\b(def |function |func |fn )\s*\w+', code))
    complexity = sum(code.count(kw) for kw in COMPLEXITY_KEYWORDS)
    return {"loc": loc, "functions": functions, "complexity": complexity}


def _extract_quick_summary(entity_name: str, code: str, entity_type: str) -> str:
    """Extract summary from code without LLM (fallback method)."""
    lines = len([l for l in code.splitlines() if l.strip()])
    
    # Try to find docstrings
    docstring_match = re.search(r'"""(.*?)"""|\'\'\'(.*?)\'\'\'', code, re.DOTALL)
    if docstring_match:
        doc_text = docstring_match.group(1) or docstring_match.group(2)
        summary = doc_text.strip().split('\n')[0].strip()
        if summary and len(summary) > 5:
            return summary[:150]
    
    # Try to find meaningful comments or function/class definitions
    lines_list = code.split('\n')
    summary_parts = []
    for line in lines_list[:15]:
        line_stripped = line.strip()
        if line_stripped.startswith('#') and not line_stripped.startswith('#!'):
            comment = line_stripped[1:].strip()
            if comment and len(comment) > 10:
                summary_parts.append(comment)
        elif line_stripped.startswith(('def ', 'class ', 'async def')):
            summary_parts.append(line_stripped[:100])
    
    if summary_parts:
        return ' | '.join(summary_parts[:2])[:150]
    
    return f"{entity_name} ({entity_type}): {lines} LOC"


def _call_ollama_with_timeout(prompt: str, timeout: int = 15) -> str:
    """Call Ollama with timeout and return None if timeout."""
    result = [None]
    exception = [None]
    
    def ollama_thread():
        try:
            response = ollama.chat(
                model=OLLAMA_MODEL,
                messages=[{"role": "user", "content": prompt}],
                options={"temperature": 0.3, "num_predict": 256},
                stream=False
            )
            result[0] = response.message.content.strip()
        except Exception as e:
            exception[0] = e
    
    thread = threading.Thread(target=ollama_thread, daemon=True)
    thread.start()
    thread.join(timeout=timeout)
    
    if result[0] is not None:
        return result[0]
    elif exception[0]:
        logger.warning(f"Ollama call failed: {exception[0]}")
        return None
    else:
        logger.warning(f"Ollama call timed out after {timeout}s")
        return None


class AnalysisService:
    def __init__(self, graph_service):
        self.graph_service = graph_service
        self._entity_info_cache = {}  # Cache for entity info to avoid repeated Ollama calls

    def analyze_migration(self, source_dir: str, migrated_files: List[Dict], target_language: str) -> Dict:
        """
        Compare source files vs migrated files using code metrics + LLM analysis.
        migrated_files: list of {filename, code} dicts from migration_service
        """
        # Collect source code
        source_path = Path(source_dir)
        source_texts = []
        for sf in source_path.rglob("*"):
            if sf.is_file() and sf.suffix in [".py", ".js", ".ts", ".java", ".go", ".rs", ".cs"]:
                try:
                    source_texts.append(sf.read_text(encoding="utf-8", errors="replace"))
                except Exception:
                    pass

        source_code = "\n".join(source_texts)
        target_code = "\n".join(f["code"] for f in migrated_files)

        # Compute metrics
        before = _compute_metrics(source_code)
        after = _compute_metrics(target_code)

        # Dependency count from Neo4j
        before["dependencies"] = self.graph_service.get_dependency_count()
        after["dependencies"] = before["dependencies"]  # same graph, structural comparison

        # LLM analysis — use a sample of code to stay within context
        sample_source = source_code[:1500]
        sample_target = target_code[:1500]

        prompt = (
            f"Compare the following two versions of code migrated from source to {target_language}.\n"
            f"Provide:\n- Key improvements\n- Tradeoffs\n- Readability differences\n- Maintainability impact\n\n"
            f"OLD CODE:\n{sample_source}\n\nNEW CODE:\n{sample_target}\n\n"
            f"Be concise — 4-6 bullet points total."
        )
        analysis = _call_ollama_with_timeout(prompt, timeout=30) or "Migration analysis unavailable."

        return {
            "metrics": {"before": before, "after": after},
            "analysis": analysis,
        }

    def get_entity_info(self, entity_name: str) -> Dict:
        """Fetch entity from Neo4j and generate LLM summary with caching and timeout."""
        # Check cache first
        if entity_name in self._entity_info_cache:
            cached = self._entity_info_cache[entity_name]
            # If cache is recent (< 1 hour), return it immediately
            if time.time() - cached.get("cached_at", 0) < 3600:
                logger.info(f"Returning cached info for {entity_name}")
                return {k: v for k, v in cached.items() if k != "cached_at"}
        
        entity = self.graph_service.get_entity_by_name(entity_name)
        if not entity:
            result = {
                "name": entity_name,
                "summary": "Entity not found in graph.",
                "dependencies": [],
                "impact": "Unknown",
                "risk": "Low",
            }
            self._entity_info_cache[entity_name] = {**result, "cached_at": time.time()}
            return result

        deps = self.graph_service.get_entity_dependencies(entity_name)
        dep_names = [d["name"] for d in deps if d["name"] != entity_name]
        code = entity.get('body') or ''
        dep_count = len(dep_names)

        # Try to get summary from Ollama first (with 15s timeout)
        prompt = (
            f"Explain this code in 1-2 sentences, focusing on its purpose:\n\n"
            f"```\n{code[:500]}\n```\n\n"
            f"Be concise and clear. Do NOT include code snippets in your answer."
        )
        
        logger.info(f"Generating Ollama summary for {entity_name} (timeout: 15s)")
        ollama_summary = _call_ollama_with_timeout(prompt, timeout=15)
        
        if ollama_summary:
            summary = ollama_summary
            logger.info(f"Got Ollama summary for {entity_name}: {summary[:60]}...")
        else:
            # Fallback to code extraction if Ollama fails/times out
            logger.warning(f"Ollama failed for {entity_name}, using fallback summary")
            summary = _extract_quick_summary(entity_name, code, entity.get('type', 'unknown'))
        
        # Determine risk from dep count
        risk = "High" if dep_count >= 4 else "Medium" if dep_count >= 2 else "Low"

        result = {
            "name": entity_name,
            "summary": summary,
            "dependencies": dep_names[:10],  # Limit to 10
            "impact": f"Changes affect {dep_count} dependent entit{'ies' if dep_count != 1 else 'y'}.",
            "risk": risk,
        }
        
        # Cache the result
        self._entity_info_cache[entity_name] = {**result, "cached_at": time.time()}
        return result