"""
modules/universal_judge.py — Module 4: Universal Differential Testing Judge

Optimized version:
- Change 4: Runnability pre-check skips non-runnable files instantly
  instead of running subprocesses and waiting for failures
"""

import json
import logging
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("UniversalJudge")

EXEC_TIMEOUT = 30
IS_WINDOWS = platform.system() == "Windows"

# Change 4: Patterns that make a file non-runnable standalone
NON_RUNNABLE_PATTERNS = [
    lambda c: "from ." in c,
    lambda c: "import ." in c,
    lambda c: "setuptools" in c,
    lambda c: "from setuptools" in c,
    lambda c: len(c.strip()) < 50,
    lambda c: c.strip().startswith("//") and len(c.strip().splitlines()) < 5,
]

# File names that are never runnable standalone
NON_RUNNABLE_NAMES = {
    "setup.py", "conf.py", "manage.py", "wsgi.py", "asgi.py",
    "__init__.py", "conftest.py",
}


def _is_runnable(file_path: Path) -> bool:
    """Quick check — returns False if file is clearly not standalone-runnable."""
    if file_path.name in NON_RUNNABLE_NAMES:
        return False
    try:
        content = file_path.read_text(encoding="utf-8", errors="replace")
        if any(check(content) for check in NON_RUNNABLE_PATTERNS):
            return False
    except Exception:
        return False
    return True


def _make_cmd(template: str, file_path: Path) -> str:
    file_str = str(file_path)
    cmd_str = template.format(
        file=f'"{file_str}"',
        dir=f'"{str(file_path.parent)}"',
        classname=file_path.stem,
    )
    if IS_WINDOWS:
        cmd_str = cmd_str.replace("-fPIC", "")
        cmd_str = cmd_str.replace(f'"{file_str}.out"', f'"{file_str}.exe"')
    return cmd_str


def _run_cmd(cmd_str: str, cwd: Optional[Path] = None) -> Tuple[int, str, str]:
    try:
        result = subprocess.run(
            cmd_str, shell=True, capture_output=True, text=True,
            timeout=EXEC_TIMEOUT, cwd=str(cwd) if cwd else None,
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", "TIMEOUT"
    except Exception as e:
        return -1, "", str(e)


def _normalize_output(raw: str) -> Any:
    raw = raw.strip()
    try:
        return {"__json__": json.loads(raw)}
    except (json.JSONDecodeError, ValueError):
        lines = [line.strip() for line in raw.splitlines() if line.strip()]
        return {"__lines__": lines}


def _outputs_match(src_out: Any, tgt_out: Any) -> bool:
    return src_out == tgt_out


class UniversalJudge:
    def __init__(self, config):
        self.config = config

    def evaluate(self, migrated_files: List[Dict]) -> List[Dict]:
        results = []
        skipped = 0

        for mf in migrated_files:
            source_file = Path(mf["source_file"]).resolve()
            target_file = Path(mf["target_file"]).resolve()
            source_lang = mf["source_lang"]
            target_lang = mf["target_lang"]

            # Change 4: Skip non-runnable files immediately — no subprocess
            if not _is_runnable(source_file):
                skipped += 1
                results.append({
                    "passed": None,
                    "message": "Skipped: non-runnable standalone file.",
                    "file": target_file.name,
                })
                continue

            result = self._check_parity(source_file, target_file, source_lang, target_lang)
            result["file"] = target_file.name
            results.append(result)

        if skipped:
            logger.info(f"  Judge: skipped {skipped} non-runnable files instantly.")

        return results

    def _check_parity(
        self,
        source_file: Path,
        target_file: Path,
        source_lang: str,
        target_lang: str,
    ) -> Dict:
        src_template = self.config.source_runners.get(source_lang)
        tgt_template = self.config.target_runners.get(target_lang)

        if not src_template:
            return {"passed": None, "message": f"No runner for source lang: {source_lang}"}
        if not tgt_template:
            return {"passed": None, "message": f"No runner for target lang: {target_lang}"}

        src_exe = src_template.split()[0]
        tgt_exe = tgt_template.split()[0]
        if not shutil.which(src_exe):
            return {"passed": None, "message": f"Source runner not found: {src_exe}"}
        if not shutil.which(tgt_exe):
            return {"passed": None, "message": f"Target runner not found: {tgt_exe}"}

        src_cmd = _make_cmd(src_template, source_file)
        src_rc, src_out, src_err = _run_cmd(src_cmd, cwd=source_file.parent)

        if src_rc != 0:
            return {"passed": None, "message": f"Source execution failed (rc={src_rc}): {src_err[:200]}", "source_output": src_err}

        tgt_cmd = _make_cmd(tgt_template, target_file)
        tgt_rc, tgt_out, tgt_err = _run_cmd(tgt_cmd, cwd=target_file.parent)

        if tgt_rc != 0:
            return {"passed": False, "message": f"Target execution failed (rc={tgt_rc}): {tgt_err[:200]}", "source_output": src_out, "target_output": tgt_err}

        src_norm = _normalize_output(src_out)
        tgt_norm = _normalize_output(tgt_out)
        passed = _outputs_match(src_norm, tgt_norm)

        return {
            "passed": passed,
            "message": "Outputs match." if passed else "Output mismatch.",
            "source_output": src_out[:500],
            "target_output": tgt_out[:500],
        }