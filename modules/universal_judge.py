"""
modules/universal_judge.py — Module 4: Universal Differential Testing Judge

Executes source and target code via CLI subprocess wrappers,
captures stdout/stderr, and compares outputs via JSON parity check.
No language-specific memory bridging required — purely CLI-based.
"""

import json
import logging
import platform
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("UniversalJudge")

# Timeout per test execution (seconds)
EXEC_TIMEOUT = 30

IS_WINDOWS = platform.system() == "Windows"


def _make_cmd(template: str, file_path: Path, **kwargs) -> List[str]:
    """
    Expand a command template string into a list for subprocess.
    Handles Windows GCC: removes -fPIC, uses .exe suffix.
    """
    file_str = f'"{str(file_path)}"'  # wrap in quotes for paths with spaces
    dir_str = f'"{str(file_path.parent)}"'
    classname = file_path.stem

    cmd_str = template.format(
        file=file_str,
        dir=dir_str,
        classname=classname,
        **kwargs,
    )

    if IS_WINDOWS:
        # Strip -fPIC (not valid on Windows GCC)
        cmd_str = cmd_str.replace("-fPIC", "")
        # Replace .out with .exe for compiled targets
        cmd_str = cmd_str.replace(f"{file_str}.out", f"{file_str}.exe")

    # Split carefully — handle && chaining by using shell=True
    return cmd_str


def _run_cmd(cmd_str: str, cwd: Optional[Path] = None) -> Tuple[int, str, str]:
    """Run a shell command, return (returncode, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd_str,
            shell=True,
            capture_output=True,
            text=True,
            timeout=EXEC_TIMEOUT,
            cwd=str(cwd) if cwd else None,
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", "TIMEOUT"
    except Exception as e:
        return -1, "", str(e)


def _normalize_output(raw: str) -> Any:
    """
    Normalize output for comparison:
    1. Try to parse as JSON (structured parity)
    2. Fall back to line-by-line string comparison
    """
    raw = raw.strip()
    try:
        return {"__json__": json.loads(raw)}
    except (json.JSONDecodeError, ValueError):
        # Normalize whitespace
        lines = [line.strip() for line in raw.splitlines() if line.strip()]
        return {"__lines__": lines}


def _outputs_match(src_out: Any, tgt_out: Any) -> bool:
    """Compare normalized outputs."""
    return src_out == tgt_out


class UniversalJudge:
    def __init__(self, config):
        self.config = config

    def evaluate(self, migrated_files: List[Dict]) -> List[Dict]:
        """Run parity checks on all migrated files."""
        results = []

        for mf in migrated_files:
            source_file = Path(mf["source_file"]).resolve()
            target_file = Path(mf["target_file"]).resolve()
            source_lang = mf["source_lang"]
            target_lang = mf["target_lang"]

            result = self._check_parity(source_file, target_file, source_lang, target_lang)
            result["file"] = target_file.name
            results.append(result)

        return results

    def _check_parity(
        self,
        source_file: Path,
        target_file: Path,
        source_lang: str,
        target_lang: str,
    ) -> Dict:
        """Execute both files and compare outputs."""

        # Get runner templates
        src_template = self.config.source_runners.get(source_lang)
        tgt_template = self.config.target_runners.get(target_lang)

        if not src_template:
            return {"passed": None, "message": f"No runner for source lang: {source_lang}"}
        if not tgt_template:
            return {"passed": None, "message": f"No runner for target lang: {target_lang}"}

        # Check executables exist
        src_exe = src_template.split()[0]
        tgt_exe = tgt_template.split()[0]
        if not shutil.which(src_exe):
            msg = f"Source runner not found: {src_exe}"
            logger.warning(msg)
            return {"passed": None, "message": msg}
        if not shutil.which(tgt_exe):
            msg = f"Target runner not found: {tgt_exe}"
            logger.warning(msg)
            return {"passed": None, "message": msg}


# Skip files with relative imports — they can't run standalone
        source_content = source_file.read_text(encoding="utf-8", errors="replace")
        if "from ." in source_content or "import ." in source_content:
            return {"passed": None, "message": "Skipped: file uses relative imports, cannot run standalone."}
        
        
        # Run source
        src_cmd = _make_cmd(src_template, source_file)
        src_rc, src_out, src_err = _run_cmd(src_cmd, cwd=source_file.parent)
        logger.debug(f"Source [{src_rc}]: {src_out[:200]} / err: {src_err[:100]}")

        if src_rc != 0:
            return {
                "passed": None,
                "message": f"Source execution failed (rc={src_rc}): {src_err[:200]}",
                "source_output": src_err,
            }

        # Run target
        tgt_cmd = _make_cmd(tgt_template, target_file)
        tgt_rc, tgt_out, tgt_err = _run_cmd(tgt_cmd, cwd=target_file.parent)
        logger.debug(f"Target [{tgt_rc}]: {tgt_out[:200]} / err: {tgt_err[:100]}")

        if tgt_rc != 0:
            return {
                "passed": False,
                "message": f"Target execution failed (rc={tgt_rc}): {tgt_err[:200]}",
                "source_output": src_out,
                "target_output": tgt_err,
            }

        # Compare
        src_norm = _normalize_output(src_out)
        tgt_norm = _normalize_output(tgt_out)
        passed = _outputs_match(src_norm, tgt_norm)

        return {
            "passed": passed,
            "message": "Outputs match." if passed else "Output mismatch.",
            "source_output": src_out[:500],
            "target_output": tgt_out[:500],
            "source_normalized": src_norm,
            "target_normalized": tgt_norm,
        }