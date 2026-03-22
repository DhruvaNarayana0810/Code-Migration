import { useApp } from "../App";
import DependencyGraph from "../components/DependencyGraph";

export default function Graph() {
  const { analyzeResult, graphKey, setRoute } = useApp();

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Step 2 of 3</div>
          <h1 style={styles.title}>Dependency Graph</h1>
          <p style={styles.sub}>
            Entity relationships extracted from your repository and stored in Neo4j.
            Click any node to explore its connections.
          </p>
        </div>
        {analyzeResult && (
          <div style={styles.badge}>
            <span style={styles.badgeNum}>{analyzeResult.entities_found}</span>
            <span style={styles.badgeLabel}>entities found</span>
          </div>
        )}
      </div>

      {!analyzeResult && (
        <div style={styles.empty}>
          <div style={styles.emptyIcon}>◎</div>
          <div style={styles.emptyTitle}>No graph yet</div>
          <div style={styles.emptySub}>Run Analyze from the home page first.</div>
          <button onClick={() => setRoute("home")} style={styles.emptyBtn}>← Go to Home</button>
        </div>
      )}

      {analyzeResult && (
        <div style={styles.graphCard}>
          <DependencyGraph key={graphKey} />
        </div>
      )}

      {analyzeResult && (
        <div style={styles.footer}>
          <button onClick={() => setRoute("home")} style={styles.btnSecondary}>← Back</button>
          <button onClick={() => setRoute("output")} style={styles.btnPrimary}>View Output →</button>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { padding: "60px 64px", animation: "fadeUp 0.4s ease" },
  header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 40, flexWrap: "wrap" },
  eyebrow: { fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", color: "#b5692a", textTransform: "uppercase", marginBottom: 10, fontFamily: "'DM Mono', monospace" },
  title: { fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 40, color: "#2a2420", marginBottom: 14, lineHeight: 1.1 },
  sub: { fontSize: 15, color: "#6b5f54", lineHeight: 1.7, maxWidth: 480, fontWeight: 300 },
  badge: { background: "#fff", border: "1px solid #e0d8cc", borderRadius: 14, padding: "20px 28px", textAlign: "center", flexShrink: 0 },
  badgeNum: { display: "block", fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 40, color: "#b5692a", lineHeight: 1 },
  badgeLabel: { fontSize: 12, color: "#9a8f82", fontWeight: 500, letterSpacing: "0.06em" },
  graphCard: { background: "#fff", border: "1px solid #e0d8cc", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(42,36,32,0.07)", marginBottom: 32 },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "80px 0", textAlign: "center" },
  emptyIcon: { fontSize: 48, color: "#c4b99a" },
  emptyTitle: { fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#2a2420", fontWeight: 600 },
  emptySub: { fontSize: 15, color: "#9a8f82", fontWeight: 300 },
  emptyBtn: { marginTop: 8, padding: "10px 22px", borderRadius: 10, border: "1.5px solid #c4b99a", background: "transparent", color: "#6b5f54", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  footer: { display: "flex", gap: 12 },
  btnSecondary: { padding: "12px 22px", borderRadius: 10, border: "1.5px solid #c4b99a", background: "transparent", color: "#6b5f54", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  btnPrimary: { padding: "12px 26px", borderRadius: 10, border: "none", background: "#2a2420", color: "#f5f0e8", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
};