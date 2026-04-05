
import { useState } from "react";

const ICONS = ["◆", "◇", "△", "○", "⬡", "◈"];

export default function SuggestionsPanel({ repo }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFetch = async () => {
    if (result) { setOpen(o => !o); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/suggest-improvements", {
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

  return (
    <div style={styles.wrapper}>
      <button onClick={handleFetch} disabled={loading} style={styles.btn}>
        {loading
          ? <><span style={styles.spinner} />Generating suggestions…</>
          : open
          ? "▲ Hide Suggestions"
          : "✦ Improvement Suggestions"}
      </button>

      {error && <div style={styles.error}>{error}</div>}

      {open && result && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div style={styles.panelTitle}>Improvement Suggestions</div>
            <div style={styles.panelSub}>{result.suggestions.length} suggestion{result.suggestions.length !== 1 ? "s" : ""} from AI analysis</div>
          </div>

          {result.suggestions.length === 0 && (
            <div style={styles.empty}>No suggestions generated. Try running Migrate first.</div>
          )}

          <div style={styles.grid}>
            {result.suggestions.map((s, i) => (
              <div key={i} style={styles.card}>
                <div style={styles.cardIcon}>{ICONS[i % ICONS.length]}</div>
                <div>
                  <div style={styles.cardTitle}>{s.title}</div>
                  {s.description && (
                    <div style={styles.cardDesc}>{s.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
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
  panelHeader: { padding: "20px 24px", borderBottom: "1px solid #f0ebe3" },
  panelTitle: { fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 18, color: "#2a2420", marginBottom: 2 },
  panelSub: { fontSize: 13, color: "#9a8f82", fontWeight: 300 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 1, background: "#f0ebe3" },
  card: { display: "flex", gap: 14, padding: "18px 20px", background: "#fff", alignItems: "flex-start" },
  cardIcon: { fontSize: 18, color: "#b5692a", flexShrink: 0, marginTop: 1 },
  cardTitle: { fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 14, color: "#2a2420", marginBottom: 4, lineHeight: 1.3 },
  cardDesc: { fontSize: 13, color: "#6b5f54", lineHeight: 1.6, fontWeight: 300, fontFamily: "'DM Sans', sans-serif" },
  empty: { padding: "24px", fontSize: 14, color: "#9a8f82", textAlign: "center", fontFamily: "'DM Sans', sans-serif" },
};