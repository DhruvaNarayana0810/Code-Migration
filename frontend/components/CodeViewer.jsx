import { useState } from "react";
import Editor from "@monaco-editor/react";

const PARITY_CONFIG = {
  PASS: { color: "#166534", bg: "#dcfce7", border: "#86efac", symbol: "✓" },
  FAIL: { color: "#991b1b", bg: "#fee2e2", border: "#fca5a5", symbol: "✕" },
  SKIP: { color: "#854d0e", bg: "#fef9c3", border: "#fde047", symbol: "⊘" },
};

export default function CodeViewer({
  files = [],
  parity = null,
  confidenceScore = null,
  executionTimeMs = null,
  language = "typescript",
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const currentFile = files[selectedIndex] || null;
  const parityConf = parity ? PARITY_CONFIG[parity] || PARITY_CONFIG.FAIL : null;
  const isEmpty = files.length === 0;
  const pct = confidenceScore !== null ? Math.round(confidenceScore * 100) : null;
  const confColor = pct >= 70 ? "#166534" : pct >= 40 ? "#854d0e" : "#991b1b";
  const confBg = pct >= 70 ? "#dcfce7" : pct >= 40 ? "#fef9c3" : "#fee2e2";

  const handleCopy = () => {
    if (!currentFile) return;
    navigator.clipboard.writeText(currentFile.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", width: "100%" }}>

      {/* Metrics bar */}
      {(parityConf || pct !== null) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, padding: "16px 20px", borderBottom: "1px solid #e0d8cc", background: "#faf8f4" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {parityConf && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: parityConf.color, background: parityConf.bg, border: `1px solid ${parityConf.border}` }}>
                {parityConf.symbol} Parity {parity}
              </div>
            )}
            {pct !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, color: confColor, background: confBg }}>
                {pct}% confidence
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {executionTimeMs !== null && <Chip label="Time" value={`${(executionTimeMs / 1000).toFixed(2)}s`} />}
            <Chip label="Files" value={files.length} />
            <Chip label="Lang" value={language} />
          </div>
        </div>
      )}

      {/* File selector */}
      {!isEmpty && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid #e0d8cc", background: "#fff" }}>
          <span style={{ fontSize: 12, color: "#9a8f82", fontWeight: 500, whiteSpace: "nowrap", fontFamily: "'DM Mono', monospace" }}>File</span>
          <select
            value={selectedIndex}
            onChange={e => setSelectedIndex(Number(e.target.value))}
            style={{ flex: 1, border: "1px solid #e0d8cc", borderRadius: 6, padding: "6px 10px", fontSize: 13, fontFamily: "'DM Mono', monospace", color: "#2a2420", background: "#faf8f4", outline: "none", cursor: "pointer" }}
          >
            {files.map((f, i) => <option key={i} value={i}>{f.filename}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "#c4b99a", whiteSpace: "nowrap" }}>{selectedIndex + 1} / {files.length}</span>
          <button
            onClick={handleCopy}
            disabled={isEmpty}
            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #e0d8cc", background: copied ? "#dcfce7" : "#fff", color: copied ? "#166534" : "#6b5f54", fontSize: 12, fontWeight: 600, cursor: isEmpty ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s" }}
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      )}

      {/* Monaco Editor */}
      <div style={{ height: 500 }}>
        {isEmpty ? (
          <div style={{ height: "100%", background: "#faf8f4", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ fontSize: 40, color: "#c4b99a" }}>◈</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#2a2420", fontWeight: 600 }}>No output yet</div>
            <div style={{ fontSize: 14, color: "#9a8f82", fontWeight: 300 }}>Run migrate to generate code.</div>
          </div>
        ) : (
          <Editor
            height={500}
            language={language}
            value={currentFile?.code || ""}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'DM Mono', monospace",
              lineHeight: 22,
              padding: { top: 16, bottom: 16 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              contextmenu: false,
              overviewRulerLanes: 0,
              scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
              lineNumbers: "on",
              folding: true,
            }}
          />
        )}
      </div>
    </div>
  );
}

function Chip({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#fff", border: "1px solid #e0d8cc", borderRadius: 6, padding: "4px 10px", minWidth: 48 }}>
      <span style={{ fontSize: 9, color: "#c4b99a", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#2a2420" }}>{value}</span>
    </div>
  );
}