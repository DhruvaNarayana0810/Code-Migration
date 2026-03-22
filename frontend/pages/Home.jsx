import { useState } from "react";
import { useApp } from "../App";

const LANGUAGES = ["typescript", "python", "go", "rust", "java", "csharp", "javascript"];

const FEATURES = [
  { icon: "⬡", title: "AST Parsing", desc: "Tree-Sitter extracts every function, class, and import from your codebase into a typed entity graph." },
  { icon: "◎", title: "Graph-RAG Context", desc: "Neo4j maps DEPENDS_ON relationships so the LLM sees the full dependency chain, not just a single file." },
  { icon: "◈", title: "Local LLM Translation", desc: "Ollama runs qwen2.5-coder locally — no API keys, no quotas, no data leaving your machine." },
  { icon: "△", title: "Parity Validation", desc: "Universal Judge runs both source and target code and compares stdout to verify behavioral equivalence." },
];

export default function Home() {
  const { repo, setRepo, targetLang, setTargetLang, setAnalyzeResult, setMigrateResult, setGraphKey, setStatus, setError, setRoute, status } = useApp();
  const [localError, setLocalError] = useState(null);

  const isLoading = status === "analyzing" || status === "migrating";

  const handleAnalyze = async () => {
    if (!repo.trim()) return;
    setStatus("analyzing");
    setLocalError(null);
    setError(null);
    setAnalyzeResult(null);
    setMigrateResult(null);
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
      setRoute("graph");
    } catch (err) {
      setLocalError(err.message);
      setStatus("error");
    }
  };

  const handleMigrate = async () => {
    if (!repo.trim()) return;
    setStatus("migrating");
    setLocalError(null);
    setError(null);
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
          Code Archaeologist parses your repository's AST, maps entity dependencies in Neo4j,
          and translates each file using a local LLM — preserving logic, types, and structure.
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
            onKeyDown={e => e.key === "Enter" && handleAnalyze()}
          />
          <div style={styles.inputRow}>
            <div style={{ flex: 1 }}>
              <div style={styles.inputLabel}>Target language</div>
              <select value={targetLang} onChange={e => setTargetLang(e.target.value)} style={styles.select} disabled={isLoading}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div style={styles.btnGroup}>
              <button onClick={handleAnalyze} disabled={isLoading || !repo.trim()} style={{ ...styles.btnSecondary, ...(isLoading ? styles.btnDisabled : {}) }}>
                {status === "analyzing" ? <><span style={styles.spinner} />Analyzing…</> : "Analyze"}
              </button>
              <button onClick={handleMigrate} disabled={isLoading || !repo.trim()} style={{ ...styles.btnPrimary, ...(isLoading ? styles.btnDisabled : {}) }}>
                {status === "migrating" ? <><span style={styles.spinner} />Migrating…</> : "Migrate →"}
              </button>
            </div>
          </div>
          {localError && (
            <div style={styles.error}>{localError}</div>
          )}
        </div>
      </div>

      {/* Divider */}
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

      {/* Divider */}
      <div style={styles.divider} />

      {/* Stats row */}
      <div style={styles.statsRow}>
        {[
          { num: "16", label: "Source languages" },
          { num: "12", label: "Target languages" },
          { num: "100%", label: "Local — no API keys" },
          { num: "8GB", label: "RAM friendly" },
        ].map((s, i) => (
          <div key={i} style={styles.statCard}>
            <div style={styles.statNum}>{s.num}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

    </div>
  );
}

const styles = {
  page: { padding: "60px 64px", maxWidth: 900, animation: "fadeUp 0.5s ease" },
  hero: { marginBottom: 64 },
  heroEyebrow: { fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", color: "#9a8f82", textTransform: "uppercase", marginBottom: 20, fontFamily: "'DM Mono', monospace" },
  heroTitle: { fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 56, lineHeight: 1.1, color: "#2a2420", marginBottom: 24 },
  heroAccent: { color: "#b5692a", fontStyle: "italic" },
  heroSub: { fontSize: 17, color: "#6b5f54", lineHeight: 1.7, maxWidth: 540, marginBottom: 40, fontWeight: 300 },
  inputCard: { background: "#fff", border: "1px solid #e0d8cc", borderRadius: 16, padding: 28, boxShadow: "0 4px 24px rgba(42,36,32,0.07)", display: "flex", flexDirection: "column", gap: 16 },
  inputLabel: { fontSize: 12, fontWeight: 600, color: "#9a8f82", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, fontFamily: "'DM Mono', monospace" },
  input: { width: "100%", border: "1.5px solid #e0d8cc", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontFamily: "'DM Mono', monospace", color: "#2a2420", background: "#faf8f4", outline: "none", transition: "border-color 0.2s" },
  inputRow: { display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" },
  select: { width: "100%", border: "1.5px solid #e0d8cc", borderRadius: 10, padding: "12px 16px", fontSize: 14, fontFamily: "'DM Mono', monospace", color: "#2a2420", background: "#faf8f4", outline: "none", cursor: "pointer" },
  btnGroup: { display: "flex", gap: 10, alignItems: "center", flexShrink: 0 },
  btnSecondary: { display: "flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: 10, border: "1.5px solid #c4b99a", background: "transparent", color: "#6b5f54", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s", whiteSpace: "nowrap" },
  btnPrimary: { display: "flex", alignItems: "center", gap: 8, padding: "12px 26px", borderRadius: 10, border: "none", background: "#2a2420", color: "#f5f0e8", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s", whiteSpace: "nowrap" },
  btnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  spinner: { display: "inline-block", width: 12, height: 12, border: "2px solid rgba(0,0,0,0.15)", borderTop: "2px solid currentColor", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  error: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#b91c1c" },
  divider: { height: 1, background: "#e0d8cc", margin: "0 0 64px" },
  section: { marginBottom: 64 },
  sectionEyebrow: { fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", color: "#b5692a", textTransform: "uppercase", marginBottom: 12, fontFamily: "'DM Mono', monospace" },
  sectionTitle: { fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 36, color: "#2a2420", marginBottom: 40, lineHeight: 1.2 },
  featureGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 },
  featureCard: { background: "#fff", border: "1px solid #e0d8cc", borderRadius: 14, padding: 24, transition: "box-shadow 0.2s" },
  featureIcon: { fontSize: 22, color: "#b5692a", marginBottom: 12 },
  featureTitle: { fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 17, color: "#2a2420", marginBottom: 8 },
  featureDesc: { fontSize: 13, color: "#7a6f65", lineHeight: 1.6, fontWeight: 300 },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 64 },
  statCard: { background: "#fff", border: "1px solid #e0d8cc", borderRadius: 14, padding: "24px 20px", textAlign: "center" },
  statNum: { fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 36, color: "#b5692a", marginBottom: 6 },
  statLabel: { fontSize: 13, color: "#9a8f82", fontWeight: 400 },
};