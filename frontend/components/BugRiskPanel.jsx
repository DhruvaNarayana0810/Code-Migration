import { useState } from "react";

const RISK_STYLE = {
  high:   { label: "High",   color: "#991b1b", bg: "#fee2e2", border: "#fca5a5", dot: "#ef4444" },
  medium: { label: "Medium", color: "#854d0e", bg: "#fef9c3", border: "#fde047", dot: "#f59e0b" },
};

function RiskItem({ item, style }) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.round(item.risk_score * 100);

  return (
    <div style={{ ...styles.item, border: `1px solid ${style.border}`, background: style.bg }}>
      <div style={styles.itemHeader} onClick={() => setExpanded(e => !e)}>
        <div style={styles.itemLeft}>
          <div style={{ ...styles.dot, background: style.dot }} />
          <div>
            <div style={{ ...styles.itemName, color: style.color }}>{item.name}</div>
            {item.file && <div style={styles.itemFile}>{item.file.split(/[\\/]/).pop()}</div>}
          </div>
        </div>
        <div style={styles.itemRight}>
          <div style={{ ...styles.score, color: style.color }}>{pct}%</div>
          <div style={styles.chevron}>{expanded ? "▲" : "▼"}</div>
        </div>
      </div>
      {expanded && (
        <div style={styles.reason}>{item.reason}</div>
      )}
    </div>
  );
}

export default function BugRiskPanel({ repo }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFetch = async () => {
    if (result) { setOpen(o => !o); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/bug-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: repo }),
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

  const totalRisk = result ? result.high_risk.length + result.medium_risk.length : 0;

  return (
    <div style={styles.wrapper}>
      <button onClick={handleFetch} disabled={loading} style={styles.btn}>
        {loading
          ? <><span style={styles.spinner} />Analyzing risks…</>
          : open
          ? "▲ Hide Bug Risk"
          : "🔍 Predict Bug Risk"}
      </button>

      {error && <div style={styles.error}>{error}</div>}

      {open && result && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <div style={styles.panelTitle}>Bug Risk Analysis</div>
              <div style={styles.panelSub}>{totalRisk} potentially risky function{totalRisk !== 1 ? "s" : ""} detected</div>
            </div>
            <div style={styles.summary}>
              <div style={{ ...styles.summaryBadge, background: "#fee2e2", color: "#991b1b" }}>
                {result.high_risk.length} High
              </div>
              <div style={{ ...styles.summaryBadge, background: "#fef9c3", color: "#854d0e" }}>
                {result.medium_risk.length} Medium
              </div>
            </div>
          </div>

          {result.high_risk.length === 0 && result.medium_risk.length === 0 && (
            <div style={styles.empty}>No high-risk functions detected. Codebase looks clean.</div>
          )}

          {result.high_risk.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>High Risk</div>
              <div style={styles.list}>
                {result.high_risk.map((item, i) => (
                  <RiskItem key={i} item={item} style={RISK_STYLE.high} />
                ))}
              </div>
            </div>
          )}

          {result.medium_risk.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Medium Risk</div>
              <div style={styles.list}>
                {result.medium_risk.map((item, i) => (
                  <RiskItem key={i} item={item} style={RISK_STYLE.medium} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: 12 },
  btn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "1.5px solid #c4b99a", background: "#fff", color: "#2a2420", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", alignSelf: "flex-start", transition: "all 0.2s" },
  spinner: { display: "inline-block", width: 11, height: 11, border: "2px solid #e0d8cc", borderTop: "2px solid #b5692a", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  error: { background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991b1b" },
  panel: { background: "#fff", border: "1px solid #e0d8cc", borderRadius: 14, overflow: "hidden", animation: "fadeUp 0.3s ease" },
  panelHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #f0ebe3", flexWrap: "wrap", gap: 12 },
  panelTitle: { fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 18, color: "#2a2420", marginBottom: 2 },
  panelSub: { fontSize: 13, color: "#9a8f82", fontWeight: 300 },
  summary: { display: "flex", gap: 8 },
  summaryBadge: { padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" },
  section: { padding: "16px 24px", borderBottom: "1px solid #f0ebe3" },
  sectionLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a8f82", fontFamily: "'DM Mono', monospace", marginBottom: 10 },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  item: { borderRadius: 8, overflow: "hidden", cursor: "pointer" },
  itemHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", gap: 12 },
  itemLeft: { display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  dot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  itemName: { fontSize: 13, fontWeight: 600, fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  itemFile: { fontSize: 11, color: "#9a8f82", marginTop: 1 },
  itemRight: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  score: { fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace" },
  chevron: { fontSize: 10, color: "#9a8f82" },
  reason: { padding: "8px 14px 12px", fontSize: 13, color: "#6b5f54", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif", borderTop: "1px solid rgba(0,0,0,0.06)" },
  empty: { padding: "24px", fontSize: 14, color: "#9a8f82", textAlign: "center", fontFamily: "'DM Sans', sans-serif" },
};