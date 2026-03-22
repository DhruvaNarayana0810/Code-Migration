"""
config.py — Central configuration for Code Archaeologist.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()


# Maps file extensions → (tree-sitter grammar name, language display name)
EXTENSION_MAP = {
    ".py": ("python", "python"),
    ".js": ("javascript", "javascript"),
    ".ts": ("typescript", "typescript"),
    ".tsx": ("tsx", "typescript"),
    ".jsx": ("javascript", "javascript"),
    ".java": ("java", "java"),
    ".c": ("c", "c"),
    ".h": ("c", "c"),
    ".cpp": ("cpp", "cpp"),
    ".hpp": ("cpp", "cpp"),
    ".cs": ("c_sharp", "csharp"),
    ".go": ("go", "go"),
    ".rs": ("rust", "rust"),
    ".rb": ("ruby", "ruby"),
    ".php": ("php", "php"),
    ".swift": ("swift", "swift"),
    ".kt": ("kotlin", "kotlin"),
    ".scala": ("scala", "scala"),
    ".lua": ("lua", "lua"),
}

# Target language → file extension for output files
TARGET_EXTENSION = {
    "python": ".py",
    "javascript": ".js",
    "typescript": ".ts",
    "go": ".go",
    "rust": ".rs",
    "java": ".java",
    "csharp": ".cs",
    "cpp": ".cpp",
    "ruby": ".rb",
    "php": ".php",
    "swift": ".swift",
    "kotlin": ".kt",
}

# Target language → CLI runner command template
# {file} is replaced with the file path
TARGET_RUNNERS = {
    "python": "python {file}",
    "javascript": "node {file}",
    "typescript": "ts-node {file}",
    "go": "go run {file}",
    "rust": "rustc {file} -o {file}.out && {file}.out",
    "java": "javac {file} && java -cp {dir} {classname}",
    "csharp": "dotnet-script {file}",
    "ruby": "ruby {file}",
    "php": "php {file}",
    "typescript": "npx ts-node {file}",
}

SOURCE_RUNNERS = {
    "python": "python {file}",
    "javascript": "node {file}",
    "typescript": "ts-node {file}",
    "go": "go run {file}",
    "java": "javac {file} && java -cp {dir} {classname}",
    "ruby": "ruby {file}",
    "php": "php {file}",
    "c": "gcc {file} -o {file}.out && {file}.out",
    "cpp": "g++ {file} -o {file}.out && {file}.out",
    "rust": "rustc {file} -o {file}.out && {file}.out",
}


class Config:
    def __init__(self, args):
        self.repo = args.repo
        self.target_lang = args.target_lang.lower()
        self.output_dir = Path(args.output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.source_lang_override = getattr(args, "source_lang", None)
        self.chunk_size = getattr(args, "chunk_size", 10)
        self.skip_judge = getattr(args, "skip_judge", False)

        # Neo4j
        self.neo4j_uri = getattr(args, "neo4j_uri", "bolt://127.0.0.1:7687")
        self.neo4j_user = getattr(args, "neo4j_user", "neo4j")
        self.neo4j_password = getattr(args, "neo4j_password", "omnamahshivaya")

        # Gemini
        self.gemini_api_key = "unused"  # Ollama is used instead

        self.work_dir = Path("./workdir")
        self.work_dir.mkdir(exist_ok=True)

        self.extension_map = EXTENSION_MAP
        self.target_extension = TARGET_EXTENSION.get(self.target_lang, ".txt")
        self.target_runners = TARGET_RUNNERS
        self.source_runners = SOURCE_RUNNERS