"""
backend/services/insights_service.py — Bug Risk + Suggestions + Docs

All read from RepoContext — no re-scanning.
"""

import logging
import re
from typing import Dict, List

import ollama

from backend.services.repo_context import repo_context

logger = logging.getLogger("InsightsService")
OLLAMA_MODEL = "qwen2.5-coder:3b"

COMPLEXITY_KEYWORDS = ["if ", "for ", "while ", "case ", "&&", "||", "elif ", "catch", "except"]
ERROR_HANDLING_KEYWORDS = ["try", "catch", "except", "finally", "raise", "throw"]


def _call_ollama(prompt: str, max_tokens: int = 256) -> str:
    try:
        response = ollama.chat(
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0.3, "num_predict": max_tokens},
        )
        return response.message.content.strip()
    except Exception as e:
        logger.warning(f"Ollama error: {e}")
        return "Analysis unavailable."


def _score_entity(entity, dep_count: int) -> float:
    code = entity.code or ""
    lines = [l for l in code.splitlines() if l.strip()]
    loc = len(lines)
    complexity = sum(code.count(kw) for kw in COMPLEXITY_KEYWORDS)
    has_error_handling = any(kw in code for kw in ERROR_HANDLING_KEYWORDS)

    score = 0.0
    if loc > 50:    score += 0.3
    elif loc > 30:  score += 0.15
    if complexity > 10:  score += 0.3
    elif complexity > 5: score += 0.15
    if dep_count > 5:    score += 0.2
    elif dep_count > 2:  score += 0.1
    if not has_error_handling: score += 0.2
    return round(min(score, 1.0), 2)


class InsightsService:
    def __init__(self, graph_service):
        self.graph_service = graph_service

    def predict_bug_risk(self) -> Dict:
        """Use RepoContext entities — no re-scan."""
        if not repo_context.scanned:
            return {"high_risk": [], "medium_risk": [], "error": "Run /scan-repo first."}

        scored = []
        for e in repo_context.entities:
            dep_count = len(e.dependencies)
            score = _score_entity(e, dep_count)
            if score >= 0.3:
                scored.append((score, e))

        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[:10]

        high_risk, medium_risk = [], []
        for score, e in top:
            code_sample = e.code[:600]
            prompt = (
                f"This function may be error-prone. Explain why in 1-2 sentences. "
                f"Focus on complexity, missing error handling, or side effects.\n\nCode:\n{code_sample}"
            )
            reason = _call_ollama(prompt, max_tokens=100)
            item = {
                "name": e.name,
                "risk_score": score,
                "reason": reason,
                "file": e.file.split("\\")[-1].split("/")[-1],
            }
            if score >= 0.5:
                high_risk.append(item)
            else:
                medium_risk.append(item)

        return {"high_risk": high_risk, "medium_risk": medium_risk}

    def suggest_improvements(self) -> Dict:
        """Use RepoContext code sample — no re-scan."""
        if not repo_context.scanned:
            return {"suggestions": [], "error": "Run /scan-repo first."}

        code_sample = repo_context.get_code_sample(max_chars=2000)
        prompt = (
            "Analyze this codebase and suggest improvements. "
            "Format your response as a numbered list where each item has:\n"
            "TITLE: short title\nDESC: one sentence description\n\n"
            "Suggest better language features, library replacements, or more idiomatic patterns. "
            "Give 4-6 suggestions.\n\nCode:\n" + code_sample
        )
        raw = _call_ollama(prompt, max_tokens=400)

        suggestions = []
        blocks = re.split(r'\n\d+[\.\)]\s+', raw)
        for block in blocks:
            if not block.strip():
                continue
            title_match = re.search(r'TITLE:\s*(.+)', block)
            desc_match = re.search(r'DESC:\s*(.+)', block)
            if title_match and desc_match:
                suggestions.append({
                    "title": title_match.group(1).strip(),
                    "description": desc_match.group(1).strip(),
                })
            elif block.strip():
                lines = [l.strip() for l in block.strip().splitlines() if l.strip()]
                if lines:
                    suggestions.append({
                        "title": lines[0][:80],
                        "description": " ".join(lines[1:])[:200] if len(lines) > 1 else "",
                    })

        return {"suggestions": suggestions[:6]}

    def generate_docs(self) -> Dict:
        """Generate per-file summaries + project overview from RepoContext."""
        logger.info(f"generate_docs called, scanned={repo_context.scanned}, files={len(repo_context.files)}")
        if not repo_context.scanned:
            return {"documentation": "Run /scan-repo first.", "files": []}

        file_docs = []
        try:
            for fr in repo_context.files[:8]:  # cap at 8 files
                functions = ", ".join(fr.functions[:6]) if fr.functions else "none detected"
                code_sample = fr.content[:600] if fr.content else "No content available"
                prompt = (
                    f"Write a concise 2-3 sentence documentation summary for this file.\n"
                    f"File: {fr.filename}\n"
                    f"Language: {fr.language}\n"
                    f"Functions: {functions}\n\n"
                    f"Code:\n{code_sample}"
                )
                summary = _call_ollama(prompt, max_tokens=150)
                file_docs.append({"filename": fr.filename, "summary": summary})

            # Project-level overview
            all_files = ", ".join(fr.filename for fr in repo_context.files)
            overview_prompt = (
                f"Write a 3-4 sentence project overview for a codebase with these files: {all_files}.\n"
                f"Total entities: {len(repo_context.entities)}. "
                f"Languages: {', '.join(set(fr.language for fr in repo_context.files))}.\n"
                f"Be concise and technical."
            )
            overview = _call_ollama(overview_prompt, max_tokens=200)

            return {
                "overview": overview,
                "files": file_docs,
            }
        except Exception as e:
            logger.error(f"Error in generate_docs: {e}")
            return {"documentation": f"Error generating docs: {str(e)}", "files": []}