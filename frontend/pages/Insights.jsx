import { useState } from "react";
import { useApp } from "../App";
import MigrationAnalysis from "../components/MigrationAnalysis";

const ICONS = ["◆", "◇", "△", "○", "⬡", "◈"];

const RISK_STYLE = {
  high:   { color: "#991b1b", bg: "#fee2e2", border: "#fca5a5", dot: "#ef4444" },
  medium: { color: "#854d0e", bg: "#fef9c3", border: "#fde047", dot: "#f59e0b" },
};

function Section({ title, eyebrow, children }) {
  return (
    <div style={sec.wrapper}>
      <div style={sec.eyebrow}>{eyebrow}</div>
      <h2 style={sec.title}>{title}</h2>
      {children}
    </div>
  );
}

function LoadBtn({ onClick, loading, done, label, doneLabel }) {
  return (
    <button onClick={onClick} disabled={loading} style={styles.btn}>
      {loading ? <><span style={styles.spinner} />{label}…</> : done ? doneLabel : label}
    </button>
  );
}

function RiskItem({ item, styleKey }) {
  const [expanded, setExpanded] = useState(false);
  const s = RISK_STYLE[styleKey];
  return (
    <div style={{ border: `1px solid ${s.border}`, background: s.bg, borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: s.color, fontFamily: "'DM Mono', monospace" }}>{item.name}</div>
            {item.file && <div style={{ fontSize: 11, color: "#9a8f82" }}>{item.file}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: s.color, fontFamily: "'DM Mono', monospace" }}>{Math.round(item.risk_score * 100)}%</span>
          <span style={{ fontSize: 10, color: "#9a8f82" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>
      {expanded && <div style={{ padding: "8px 14px 12px", fontSize: 13, color: "#6b5f54", lineHeight: 1.6, borderTop: "1px solid rgba(0,0,0,0.06)", fontFamily: "'DM Sans', sans-serif" }}>{item.reason}</div>}
    </div>
  );
}

export default function Insights() {
  const { setRoute, repo, targetLang } = useApp();

  const [bugData, setBugData]       = useState(null);
  const [sugData, setSugData]       = useState(null);
  const [docData, setDocData]       = useState(null);
  const [loadBug, setLoadBug]       = useState(false);
  const [loadSug, setLoadSug]       = useState(false);
  const [loadDoc, setLoadDoc]       = useState(false);

  const fetchBug = async () => {
    if (bugData) return;
    setLoadBug(true);
    try { const r = await fetch("/bug-risk"); setBugData(await r.json()); } finally { setLoadBug(false); }
  };

  const fetchSug = async () => {
    if (sugData) return;
    setLoadSug(true);
    try { const r = await fetch("/suggestions"); setSugData(await r.json()); } finally { setLoadSug(false); }
  };

  const fetchDoc = async () => {
    if (docData) return;
    setLoadDoc(true);
    try { const r = await fetch("/generate-docs"); setDocData(await r.json()); } finally { setLoadDoc(false); }
  };

  const totalRisk = bugData ? bugData.high_risk.length + bugData.medium_risk.length : 0;

  return (
    <div style={styles.page}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={styles.header}>
        <div style={styles.eyebrow}>Step — Analyse</div>
        <h1 style={styles.title}>Code Insights</h1>
        <p style={styles.sub}>All insights read from the scanned knowledge base — no re-scanning required.</p>
      </div>

      {/* Bug Risk */}
      <Section eyebrow="Analysis 1" title="Bug Risk Predictor">
        <LoadBtn onClick={fetchBug} loading={loadBug} done={!!bugData} label="🔍 Run Bug Risk Analysis" doneLabel="✓ Bug Risk Loaded" />
        {bugData && (
          <div style={styles.panel}>
            <div style={styles.panelHead}>
              <div>
                <div style={styles.panelTitle}>Bug Risk Analysis</div>
                <div style={styles.panelSub}>{totalRisk} risky function{totalRisk !== 1 ? "s" : ""} detected</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ ...styles.badge, background: "#fee2e2", color: "#991b1b" }}>{bugData.high_risk.length} High</span>
                <span style={{ ...styles.badge, background: "#fef9c3", color: "#854d0e" }}>{bugData.medium_risk.length} Medium</span>
              </div>
            </div>
            {totalRisk === 0 && <div style={styles.empty}>No risky functions detected. Codebase looks clean.</div>}
            {bugData.high_risk.length > 0 && (
              <div style={styles.riskSection}>
                <div style={styles.riskLabel}>High Risk</div>
                {bugData.high_risk.map((item, i) => <RiskItem key={i} item={item} styleKey="high" />)}
              </div>
            )}
            {bugData.medium_risk.length > 0 && (
              <div style={styles.riskSection}>
                <div style={styles.riskLabel}>Medium Risk</div>
                {bugData.medium_risk.map((item, i) => <RiskItem key={i} item={item} styleKey="medium" />)}
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Suggestions */}
      <Section eyebrow="Analysis 2" title="Improvement Suggestions">
        <LoadBtn onClick={fetchSug} loading={loadSug} done={!!sugData} label="✦ Generate Suggestions" doneLabel="✓ Suggestions Loaded" />
        {sugData && (
          <div style={styles.panel}>
            <div style={styles.panelHead}>
              <div style={styles.panelTitle}>Improvement Suggestions</div>
              <div style={styles.panelSub}>{sugData.suggestions?.length || 0} suggestions from AI analysis</div>
            </div>
            <div style={styles.grid}>
              {(sugData.suggestions || []).map((s, i) => (
                <div key={i} style={styles.card}>
                  <div style={styles.cardIcon}>{ICONS[i % ICONS.length]}</div>
                  <div>
                    <div style={styles.cardTitle}>{s.title}</div>
                    {s.description && <div style={styles.cardDesc}>{s.description}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Documentation */}
      <Section eyebrow="Analysis 3" title="Auto Documentation">
        <LoadBtn onClick={fetchDoc} loading={loadDoc} done={!!docData} label="📄 Generate Docs" doneLabel="✓ Docs Loaded" />
        {docData && (
          <div style={styles.panel}>
            {docData.overview && (
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #f0ebe3" }}>
                <div style={styles.panelTitle}>Project Overview</div>
                <p style={{ fontSize: 14, color: "#6b5f54", lineHeight: 1.7, marginTop: 10, fontFamily: "'DM Sans', sans-serif" }}>{docData.overview}</p>
              </div>
            )}
            {(docData.files || []).map((f, i) => (
              <div key={i} style={{ padding: "16px 24px", borderBottom: "1px solid #f0ebe3" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#b5692a", marginBottom: 6 }}>{f.filename}</div>
                <p style={{ fontSize: 13, color: "#6b5f54", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>{f.summary}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Migration Analysis */}
      <Section eyebrow="Analysis 4" title="Migration Analysis">
        <MigrationAnalysis repo={repo} targetLang={targetLang} />
      </Section>

      <div style={styles.footer}>
        <button onClick={() => setRoute("chat")} style={styles.btnSecondary}>← Chat</button>
        <button onClick={() => setRoute("graph")} style={styles.btnPrimary}>View Graph →</button>
      </div>
    </div>
  );
}

const styles = {
  page: { padding: "60px 64px", display: "flex", flexDirection: "column", gap: 32, animation: "fadeUp 0.4s ease" },
  header: { marginBottom: 0 },
  eyebrow: { fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", color: "#b5692a", textTransform: "uppercase", marginBottom: 10, fontFamily: "'DM Mono', monospace" },
  title: { fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 40, color: "#2a2420", marginBottom: 12, lineHeight: 1.1 },
  sub: { fontSize: 15, color: "#6b5f54", lineHeight: 1.7, maxWidth: 480, fontWeight: 300 },
  btn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: "1.5px solid #c4b99a", background: "#fff", color: "#2a2420", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", marginBottom: 16 },
  spinner: { display: "inline-block", width: 11, height: 11, border: "2px solid #e0d8cc", borderTop: "2px solid #b5692a", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  panel: { background: "#fff", border: "1px solid #e0d8cc", borderRadius: 14, overflow: "hidden" },
  panelHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid #f0ebe3", flexWrap: "wrap", gap: 10 },
  panelTitle: { fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 18, color: "#2a2420" },
  panelSub: { fontSize: 13, color: "#9a8f82", fontWeight: 300, marginTop: 2 },
  badge: { padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700 },
  riskSection: { padding: "14px 24px" },
  riskLabel: { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a8f82", fontFamily: "'DM Mono', monospace", marginBottom: 8 },
  empty: { padding: 24, fontSize: 14, color: "#9a8f82", textAlign: "center" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 1, background: "#f0ebe3" },
  card: { display: "flex", gap: 14, padding: "18px 20px", background: "#fff", alignItems: "flex-start" },
  cardIcon: { fontSize: 18, color: "#b5692a", flexShrink: 0, marginTop: 1 },
  cardTitle: { fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 14, color: "#2a2420", marginBottom: 4, lineHeight: 1.3 },
  cardDesc: { fontSize: 13, color: "#6b5f54", lineHeight: 1.6, fontWeight: 300, fontFamily: "'DM Sans', sans-serif" },
  footer: { display: "flex", gap: 12 },
  btnSecondary: { padding: "12px 22px", borderRadius: 10, border: "1.5px solid #c4b99a", background: "transparent", color: "#6b5f54", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  btnPrimary: { padding: "12px 26px", borderRadius: 10, border: "none", background: "#2a2420", color: "#f5f0e8", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
};

const sec = {
  wrapper: { display: "flex", flexDirection: "column" },
  eyebrow: { fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", color: "#b5692a", textTransform: "uppercase", marginBottom: 4, fontFamily: "'DM Mono', monospace" },
  title: { fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 26, color: "#2a2420", marginBottom: 16, lineHeight: 1.2 },
};