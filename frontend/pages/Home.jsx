import { useState } from "react";
import { useApp } from "../App";
import BugRiskPanel from "../components/BugRiskPanel";
import SuggestionsPanel from "../components/SuggestionsPanel";

const LANGUAGES = ["typescript", "python", "go", "rust", "java", "csharp", "javascript"];

const FEATURES = [
  { icon: "⬡", title: "AST Parsing", desc: "Tree-Sitter extracts every function, class, and import from your codebase into a typed entity graph." },
  { icon: "◎", title: "Graph-RAG Context", desc: "Neo4j maps DEPENDS_ON relationships so the LLM sees the full dependency chain, not just a single file." },
  { icon: "◈", title: "Local LLM Translation", desc: "Ollama runs qwen2.5-coder locally — no API keys, no quotas, no data leaving your machine." },
  { icon: "△", title: "Parity Validation", desc: "Universal Judge runs both source and target code and compares stdout to verify behavioral equivalence." },
];

export default function Home() {
  const {
    repo, setRepo,
    targetLang, setTargetLang,
    setAnalyzeResult, setMigrateResult,
    setScanResult, scanResult,
    setGraphKey, setStatus, setError,
    setRoute, status, analyzeResult,
  } = useApp();

  const [localError, setLocalError] = useState(null);
  const isLoading = status === "analyzing" || status === "migrating" || status === "scanning";

  // One-time scan — populates RepoContext for all features
  const handleScan = async () => {
    if (!repo.trim()) return;
    setStatus("scanning");
    setLocalError(null);
    setError(null);
    try {
      const res = await fetch("/scan-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: repo.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setScanResult(data);
      setGraphKey(k => k + 1);
      setStatus("scanned");
    } catch (err) {
      setLocalError(err.message);
      setStatus("error");
    }
  };

  const handleAnalyze = async () => {
    if (!repo.trim()) return;
    setStatus("analyzing");
    setLocalError(null);
    try {
      const res = await fetch("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: repo.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setAnalyzeResult(data);
      setGraphKey(k => k + 1);
      setStatus("analyzed");
    } catch (err) {
      setLocalError(err.message);
      setStatus("error");
    }
  };

  const handleMigrate = async () => {
    if (!repo.trim()) return;
    setStatus("migrating");
    setLocalError(null);
    try {
      const res = await fetch("/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: repo.trim(), target_language: targetLang }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setMigrateResult(data);
      setGraphKey(k => k + 1);
      setStatus("done");
      setRoute("output");
    } catch (err) {
      setLocalError(err.message);
      setStatus("error");
    }
  };

  return (
    <div style={styles.page}>

      {/* Hero */}
      <div style={styles.hero}>
        <div style={styles.heroEyebrow}>Universal Migration Pipeline · v2.0</div>
        <h1 style={styles.heroTitle}>
          Translate legacy<br />
          <span style={styles.heroAccent}>codebases</span> with<br />
          confidence.
        </h1>
        <p style={styles.heroSub}>
          Scan once. Translate, chat, analyse bugs, and generate docs — all from a single repository scan.
        </p>

        {/* Input card */}
        <div style={styles.inputCard}>
          <div style={styles.inputLabel}>Repository URL or local path</div>
          <input
            value={repo}
            onChange={e => setRepo(e.target.value)}
            placeholder="https://github.com/user/repo"
            style={styles.input}
            disabled={isLoading}
            onKeyDown={e => e.key === "Enter" && handleScan()}
          />
          <div style={styles.inputRow}>
            <div style={{ flex: 1 }}>
              <div style={styles.inputLabel}>Target language</div>
              <select value={targetLang} onChange={e => setTargetLang(e.target.value)} style={styles.select} disabled={isLoading}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div style={styles.btnGroup}>
              {/* Primary: Scan once */}
              <button onClick={handleScan} disabled={isLoading || !repo.trim()} style={{ ...styles.btnScan, ...(isLoading ? styles.btnDisabled : {}) }}>
                {status === "scanning" ? <><span style={styles.spinner} />Scanning…</> : scanResult ? "✓ Re-scan" : "⬡ Scan Repo"}
              </button>
              <button onClick={handleAnalyze} disabled={isLoading || !repo.trim()} style={{ ...styles.btnSecondary, ...(isLoading ? styles.btnDisabled : {}) }}>
                Analyze
              </button>
              <button onClick={handleMigrate} disabled={isLoading || !repo.trim()} style={{ ...styles.btnPrimary, ...(isLoading ? styles.btnDisabled : {}) }}>
                {status === "migrating" ? <><span style={styles.spinner} />Migrating…</> : "Migrate →"}
              </button>
            </div>
          </div>

          {/* Scan result stats */}
          {scanResult && (
            <div style={styles.statsBar}>
              <div style={styles.statItem}>
                <span style={styles.statNum}>{scanResult.files}</span>
                <span style={styles.statKey}>Files scanned</span>
              </div>
              <div style={styles.statDivider} />
              <div style={styles.statItem}>
                <span style={styles.statNum}>{scanResult.entities}</span>
                <span style={styles.statKey}>Entities indexed</span>
              </div>
              <div style={{ flex: 1 }} />
              <div style={styles.quickLinks}>
                <button onClick={() => setRoute("chat")} style={styles.quickBtn}>Chat →</button>
                <button onClick={() => setRoute("insights")} style={styles.quickBtn}>Insights →</button>
                <button onClick={() => setRoute("graph")} style={styles.quickBtn}>Graph →</button>
              </div>
            </div>
          )}

          {localError && <div style={styles.error}>{localError}</div>}
        </div>
      </div>

      

      <div style={styles.divider} />

      {/* Features */}
      <div style={styles.section}>
        <div style={styles.sectionEyebrow}>How it works</div>
        <h2 style={styles.sectionTitle}>Four modules.<br />One pipeline.</h2>
        <div style={styles.featureGrid}>
          {FEATURES.map((f, i) => (
            <div key={i} style={styles.featureCard}>
              <div style={styles.featureIcon}>{f.icon}</div>
              <div style={styles.featureTitle}>{f.title}</div>
              <div style={styles.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.statsRow}>
        {[
          { num: "16", label: "Source languages" },
          { num: "12", label: "Target languages" },
          { num: "100%", label: "Local — no API keys" },
          { num: "8GB", label: "RAM friendly" },
        ].map((s, i) => (
          <div key={i} style={styles.statCard}>
            <div style={styles.statCardNum}>{s.num}</div>
            <div style={styles.statCardLabel}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: { padding: "60px 64px", maxWidth: 960, display: "flex", flexDirection: "column", gap: 0, animation: "fadeUp 0.5s ease" },
  hero: { marginBottom: 48 },
  heroEyebrow: { fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", color: "#9a8f82", textTransform: "uppercase", marginBottom: 20, fontFamily: "'DM Mono', monospace" },
  heroTitle: { fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 56, lineHeight: 1.1, color: "#2a2420", marginBottom: 24 },
  heroAccent: { color: "#b5692a", fontStyle: "italic" },
  heroSub: { fontSize: 17, color: "#6b5f54", lineHeight: 1.7, maxWidth: 540, marginBottom: 40, fontWeight: 300 },
  inputCard: { background: "#fff", border: "1px solid #e0d8cc", borderRadius: 16, padding: 28, boxShadow: "0 4px 24px rgba(42,36,32,0.07)", display: "flex", flexDirection: "column", gap: 16 },
  inputLabel: { fontSize: 12, fontWeight: 600, color: "#9a8f82", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, fontFamily: "'DM Mono', monospace" },
  input: { width: "100%", border: "1.5px solid #e0d8cc", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontFamily: "'DM Mono', monospace", color: "#2a2420", background: "#faf8f4", outline: "none" },
  inputRow: { display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" },
  select: { width: "100%", border: "1.5px solid #e0d8cc", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontFamily: "'DM Mono', monospace", color: "#2a2420", background: "#faf8f4", outline: "none", cursor: "pointer" },
  btnGroup: { display: "flex", gap: 8, alignItems: "center", flexShrink: 0, flexWrap: "wrap" },
  btnScan: { display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 10, border: "none", background: "#b5692a", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" },
  btnSecondary: { display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", borderRadius: 10, border: "1.5px solid #c4b99a", background: "transparent", color: "#6b5f54", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" },
  btnPrimary: { display: "flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 10, border: "none", background: "#2a2420", color: "#f5f0e8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" },
  btnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  spinner: { display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid currentColor", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  statsBar: { display: "flex", alignItems: "center", gap: 20, background: "#faf8f4", border: "1px solid #e0d8cc", borderRadius: 10, padding: "12px 18px", flexWrap: "wrap" },
  statItem: { display: "flex", flexDirection: "column", gap: 2 },
  statNum: { fontSize: 22, fontWeight: 700, color: "#b5692a", fontFamily: "'Playfair Display', serif", lineHeight: 1 },
  statKey: { fontSize: 11, color: "#9a8f82", letterSpacing: "0.06em" },
  statDivider: { width: 1, height: 32, background: "#e0d8cc" },
  quickLinks: { display: "flex", gap: 8 },
  quickBtn: { padding: "7px 14px", borderRadius: 8, border: "1.5px solid #c4b99a", background: "transparent", color: "#b5692a", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  error: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#b91c1c" },
  insightsSection: { marginBottom: 48 },
  insightsEyebrow: { fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", color: "#b5692a", textTransform: "uppercase", marginBottom: 10, fontFamily: "'DM Mono', monospace" },
  insightsTitle: { fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 32, color: "#2a2420", marginBottom: 8, lineHeight: 1.2 },
  insightsSub: { fontSize: 14, color: "#9a8f82", marginBottom: 20, fontWeight: 300 },
  insightsGrid: { display: "flex", flexDirection: "column", gap: 16 },
  divider: { height: 1, background: "#e0d8cc", margin: "0 0 48px" },
  section: { marginBottom: 48 },
  sectionEyebrow: { fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", color: "#b5692a", textTransform: "uppercase", marginBottom: 12, fontFamily: "'DM Mono', monospace" },
  sectionTitle: { fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 36, color: "#2a2420", marginBottom: 40, lineHeight: 1.2 },
  featureGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 },
  featureCard: { background: "#fff", border: "1px solid #e0d8cc", borderRadius: 14, padding: 24 },
  featureIcon: { fontSize: 22, color: "#b5692a", marginBottom: 12 },
  featureTitle: { fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 17, color: "#2a2420", marginBottom: 8 },
  featureDesc: { fontSize: 13, color: "#7a6f65", lineHeight: 1.6, fontWeight: 300 },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 64 },
  statCard: { background: "#fff", border: "1px solid #e0d8cc", borderRadius: 14, padding: "24px 20px", textAlign: "center" },
  statCardNum: { fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 36, color: "#b5692a", marginBottom: 6 },
  statCardLabel: { fontSize: 13, color: "#9a8f82", fontWeight: 400 },
};