import { useState } from "react";

const RISK_COLORS = {
  Low:    { color: "#166534", bg: "#dcfce7", border: "#86efac" },
  Medium: { color: "#854d0e", bg: "#fef9c3", border: "#fde047" },
  High:   { color: "#991b1b", bg: "#fee2e2", border: "#fca5a5" },
};

function MetricRow({ label, before, after }) {
  const improved = after < before;
  const regressed = after > before;
  const delta = after - before;
  const sign = delta > 0 ? "+" : "";

  return (
    <tr>
      <td style={td.label}>{label}</td>
      <td style={td.val}>{before}</td>
      <td style={td.val}>{after}</td>
      <td style={{
        ...td.val,
        color: improved ? "#166534" : regressed ? "#991b1b" : "#6b5f54",
        fontWeight: 600,
      }}>
        {delta === 0 ? "—" : `${sign}${delta}`}
        {improved && " ↓"}{regressed && " ↑"}
      </td>
    </tr>
  );
}

export default function MigrationAnalysis({ repo, targetLang }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFetch = async () => {
    if (result) { setOpen(o => !o); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/analyze-migration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_language: targetLang }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
      setOpen(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const m = result?.metrics;

  return (
    <div style={styles.wrapper}>
      {/* Trigger button */}
      <button onClick={handleFetch} disabled={loading} style={styles.btn}>
        {loading
          ? <><span style={styles.spinner} /> Analyzing…</>
          : open
          ? "▲ Hide Analysis"
          : "⚖ Compare Source vs Target"}
      </button>

      {error && <div style={styles.error}>{error}</div>}

      {/* Panel */}
      {open && result && (
        <div style={styles.panel}>

          {/* Metrics table */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Code Metrics</div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={th.label}>Metric</th>
                  <th style={th.val}>Before</th>
                  <th style={th.val}>After ({targetLang})</th>
                  <th style={th.val}>Delta</th>
                </tr>
              </thead>
              <tbody>
                <MetricRow label="Lines of Code" before={m.before.loc} after={m.after.loc} />
                <MetricRow label="Functions" before={m.before.functions} after={m.after.functions} />
                <MetricRow label="Complexity" before={m.before.complexity} after={m.after.complexity} />
                <MetricRow label="Dependencies" before={m.before.dependencies} after={m.after.dependencies} />
              </tbody>
            </table>
          </div>

          {/* LLM Analysis */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>AI Analysis</div>
            <div style={styles.analysisBox}>
              {result.analysis.split("\n").map((line, i) => (
                <p key={i} style={{ margin: "4px 0", color: line.startsWith("-") ? "#2a2420" : "#6b5f54" }}>
                  {line}
                </p>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: 12 },
  btn: {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "10px 20px", borderRadius: 10,
    border: "1.5px solid #c4b99a", background: "#fff",
    color: "#2a2420", fontSize: 13, fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
    transition: "all 0.2s", alignSelf: "flex-start",
  },
  spinner: { display: "inline-block", width: 11, height: 11, border: "2px solid #e0d8cc", borderTop: "2px solid #b5692a", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  error: { background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991b1b" },
  panel: { background: "#fff", border: "1px solid #e0d8cc", borderRadius: 14, overflow: "hidden", animation: "fadeUp 0.3s ease" },
  section: { padding: "20px 24px", borderBottom: "1px solid #f0ebe3" },
  sectionTitle: { fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 16, color: "#2a2420", marginBottom: 14 },
  table: { width: "100%", borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 13 },
  analysisBox: { background: "#faf8f4", border: "1px solid #e0d8cc", borderRadius: 8, padding: "16px 18px", fontSize: 13, lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif" },
};

const th = {
  label: { textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "#9a8f82", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", borderBottom: "1px solid #e0d8cc" },
  val: { textAlign: "center", padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "#9a8f82", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", borderBottom: "1px solid #e0d8cc" },
};

const td = {
  label: { padding: "10px 12px", color: "#2a2420", fontWeight: 500, borderBottom: "1px solid #f0ebe3" },
  val: { textAlign: "center", padding: "10px 12px", color: "#6b5f54", borderBottom: "1px solid #f0ebe3" },
};