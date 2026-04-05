import { useState, createContext, useContext } from "react";
import Home from "./pages/Home";
import Graph from "./pages/Graph";
import Output from "./pages/Output";
import Chat from "./pages/Chat";
import Insights from "./pages/Insights";

export const AppContext = createContext(null);
export function useApp() { return useContext(AppContext); }

const ROUTES = { home: Home, graph: Graph, output: Output, chat: Chat, insights: Insights };

const NAV_ITEMS = [
  { key: "home",     label: "Home",     icon: "○" },
  { key: "graph",    label: "Graph",    icon: "◎" },
  { key: "chat",     label: "Chat",     icon: "◇" },
  { key: "insights", label: "Insights", icon: "△" },
  { key: "output",   label: "Output",   icon: "◈" },
];

export default function App() {
  const [route, setRoute]               = useState("home");
  const [repo, setRepo]                 = useState("https://github.com/navdeep-G/samplemod");
  const [targetLang, setTargetLang]     = useState("typescript");
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [migrateResult, setMigrateResult] = useState(null);
  const [scanResult, setScanResult]     = useState(null);
  const [graphKey, setGraphKey]         = useState(0);
  const [status, setStatus]             = useState("idle");
  const [error, setError]               = useState(null);

  const Page = ROUTES[route] || Home;

  return (
    <AppContext.Provider value={{
      route, setRoute,
      repo, setRepo,
      targetLang, setTargetLang,
      analyzeResult, setAnalyzeResult,
      migrateResult, setMigrateResult,
      scanResult, setScanResult,
      graphKey, setGraphKey,
      status, setStatus,
      error, setError,
    }}>
      <div style={styles.shell}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html, body, #root { height: 100%; }
          body { background: #f5f0e8; overflow-y: auto; }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: #ede8df; }
          ::-webkit-scrollbar-thumb { background: #c4b99a; border-radius: 99px; }
          @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
          select option { background: #2a2420; color: #f5f0e8; }
        `}</style>

        {/* Sidebar */}
        <nav style={styles.nav}>
          <div style={styles.navLogo}>
            <div style={styles.logoMark}>⬡</div>
            <div>
              <div style={styles.logoTitle}>Code</div>
              <div style={styles.logoTitle}>Archaeologist</div>
            </div>
          </div>

          <div style={styles.navLinks}>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setRoute(item.key)}
                style={{ ...styles.navLink, ...(route === item.key ? styles.navLinkActive : {}) }}
              >
                <span style={styles.navLinkIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Scan status */}
          {scanResult && (
            <div style={styles.scanBadge}>
              <div style={{ fontSize: 9, color: "#6b7280", letterSpacing: "0.1em", marginBottom: 4 }}>KNOWLEDGE BASE</div>
              <div style={{ fontSize: 12, color: "#86efac", fontWeight: 600 }}>✓ {scanResult.files} files · {scanResult.entities} entities</div>
            </div>
          )}

          <div style={styles.navFooter}>
            <div style={styles.statusDot(status)} />
            <span style={styles.statusLabel}>
              {status === "idle" ? "Ready" :
               status === "scanning" ? "Scanning…" :
               status === "scanned" ? "Scanned" :
               status === "analyzing" ? "Analyzing…" :
               status === "analyzed" ? "Analyzed" :
               status === "migrating" ? "Migrating…" :
               status === "done" ? "Done" : "Error"}
            </span>
          </div>
        </nav>

        <main style={styles.main}>
          <Page />
        </main>
      </div>
    </AppContext.Provider>
  );
}

const styles = {
  shell: { display: "flex", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", background: "#f5f0e8" },
  nav: { width: 220, minHeight: "100vh", background: "#2a2420", display: "flex", flexDirection: "column", padding: "32px 20px", position: "sticky", top: 0, flexShrink: 0 },
  navLogo: { display: "flex", alignItems: "center", gap: 12, marginBottom: 40 },
  logoMark: { fontSize: 28, color: "#e8c27a", lineHeight: 1 },
  logoTitle: { fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 14, color: "#f5f0e8", lineHeight: 1.2 },
  navLinks: { display: "flex", flexDirection: "column", gap: 4, flex: 1 },
  navLink: { display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, border: "none", background: "transparent", color: "#9a8f82", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.2s", textAlign: "left" },
  navLinkActive: { background: "rgba(232,194,122,0.12)", color: "#e8c27a", borderLeft: "2px solid #e8c27a", paddingLeft: 12 },
  navLinkIcon: { fontSize: 16, width: 20, textAlign: "center" },
  scanBadge: { background: "rgba(134,239,172,0.08)", border: "1px solid rgba(134,239,172,0.2)", borderRadius: 8, padding: "10px 12px", marginBottom: 12 },
  navFooter: { display: "flex", alignItems: "center", gap: 8, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" },
  statusDot: (s) => ({
    width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
    background: s === "done" || s === "analyzed" || s === "scanned" ? "#86efac" :
                s === "analyzing" || s === "migrating" || s === "scanning" ? "#fcd34d" :
                s === "error" ? "#fca5a5" : "#6b7280",
    animation: (s === "analyzing" || s === "migrating" || s === "scanning") ? "pulse 1.2s ease infinite" : "none",
  }),
  statusLabel: { fontSize: 12, color: "#6b7280", fontWeight: 500 },
  main: { flex: 1, overflow: "auto" },
};