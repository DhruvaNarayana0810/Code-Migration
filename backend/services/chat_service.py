"""
backend/services/chat_service.py — Codebase chatbot using RepoContext

Reads from in-memory store — no re-scanning.
"""

import logging
from typing import List

import ollama

from backend.services.repo_context import repo_context

logger = logging.getLogger("ChatService")
OLLAMA_MODEL = "qwen2.5-coder:3b"


def _call_ollama(prompt: str, max_tokens: int = 512) -> str:
    try:
        response = ollama.chat(
            model=OLLAMA_MODEL,
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0.3, "num_predict": max_tokens},
        )
        return response.message.content.strip()
    except Exception as e:
        logger.warning(f"Ollama error: {e}")
        return "I couldn't generate a response. Is Ollama running?"


class ChatService:
    def answer(self, query: str) -> str:
        if not repo_context.scanned:
            return "No repository scanned yet. Please run /scan-repo first."

        # Search context for relevant entities
        relevant = repo_context.search(query, top_k=4)

        if relevant:
            code_chunks = ""
            for e in relevant:
                code_chunks += f"\n# {e.name} ({e.type}) in {e.file}\n"
                code_chunks += e.code[:500]
                code_chunks += "\n"
        else:
            # Fallback: use a code sample from all files
            code_chunks = repo_context.get_code_sample(max_chars=1200)

        prompt = (
            f"Answer the user's question based on the following code context.\n\n"
            f"Context:\n{code_chunks}\n\n"
            f"Question: {query}\n\n"
            f"Answer clearly and concisely in 2-4 sentences."
        )

        return _call_ollama(prompt, max_tokens=400)