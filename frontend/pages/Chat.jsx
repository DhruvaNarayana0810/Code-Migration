import { useState, useRef, useEffect } from "react";
import { useApp } from "../App";

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ ...styles.msgRow, justifyContent: isUser ? "flex-end" : "flex-start" }}>
      {!isUser && <div style={styles.avatar}>AI</div>}
      <div style={{ ...styles.bubble, ...(isUser ? styles.bubbleUser : styles.bubbleAI) }}>
        {msg.content}
      </div>
      {isUser && <div style={{ ...styles.avatar, background: "#2a2420", color: "#e8c27a" }}>You</div>}
    </div>
  );
}

export default function Chat() {
  const { repo_context_scanned, setRoute } = useApp();
  const [messages, setMessages] = useState([
    { role: "ai", content: "Hi! I can answer questions about your scanned codebase. Ask me anything — what a function does, how files relate, what could be improved, etc." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const query = input.trim();
    if (!query || loading) return;

    setMessages(m => [...m, { role: "user", content: query }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setMessages(m => [...m, { role: "ai", content: data.answer || "No response." }]);
    } catch {
      setMessages(m => [...m, { role: "ai", content: "Error connecting to backend." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <style>{`@keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} } @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={styles.header}>
        <div>
          <div style={styles.eyebrow}>Step — Explore</div>
          <h1 style={styles.title}>Codebase Chat</h1>
          <p style={styles.sub}>Ask questions about your repository. The AI searches the scanned knowledge base to answer.</p>
        </div>
      </div>

      {/* Chat window */}
      <div style={styles.chatCard}>
        <div style={styles.messages}>
          {messages.map((m, i) => <Message key={i} msg={m} />)}
          {loading && (
            <div style={{ ...styles.msgRow, justifyContent: "flex-start" }}>
              <div style={styles.avatar}>AI</div>
              <div style={styles.bubbleAI}>
                <span style={styles.spinner} /> Thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={styles.inputRow}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="Ask about your codebase…"
            style={styles.input}
            disabled={loading}
          />
          <button onClick={handleSend} disabled={loading || !input.trim()} style={styles.sendBtn}>
            Send →
          </button>
        </div>
      </div>

      <div style={styles.footer}>
        <button onClick={() => setRoute("home")} style={styles.btnSecondary}>← Home</button>
        <button onClick={() => setRoute("insights")} style={styles.btnPrimary}>View Insights →</button>
      </div>
    </div>
  );
}

const styles = {
  page: { padding: "60px 64px", display: "flex", flexDirection: "column", gap: 24, animation: "fadeUp 0.4s ease" },
  header: { marginBottom: 8 },
  eyebrow: { fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", color: "#b5692a", textTransform: "uppercase", marginBottom: 10, fontFamily: "'DM Mono', monospace" },
  title: { fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 40, color: "#2a2420", marginBottom: 12, lineHeight: 1.1 },
  sub: { fontSize: 15, color: "#6b5f54", lineHeight: 1.7, maxWidth: 480, fontWeight: 300 },
  chatCard: { background: "#fff", border: "1px solid #e0d8cc", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(42,36,32,0.07)", display: "flex", flexDirection: "column" },
  messages: { flex: 1, padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16, minHeight: 400, maxHeight: 520, overflowY: "auto" },
  msgRow: { display: "flex", alignItems: "flex-end", gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: "50%", background: "#f0ebe3", border: "1px solid #e0d8cc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#9a8f82", fontFamily: "'DM Mono', monospace", flexShrink: 0 },
  bubble: { maxWidth: "72%", padding: "12px 16px", borderRadius: 12, fontSize: 14, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" },
  bubbleUser: { background: "#2a2420", color: "#f5f0e8", borderBottomRightRadius: 4 },
  bubbleAI: { background: "#faf8f4", border: "1px solid #e0d8cc", color: "#2a2420", borderBottomLeftRadius: 4, display: "flex", alignItems: "center", gap: 8 },
  inputRow: { display: "flex", gap: 12, padding: "16px 20px", borderTop: "1px solid #e0d8cc", background: "#faf8f4" },
  input: { flex: 1, border: "1.5px solid #e0d8cc", borderRadius: 10, padding: "11px 16px", fontSize: 14, fontFamily: "'DM Mono', monospace", color: "#2a2420", background: "#fff", outline: "none" },
  sendBtn: { padding: "11px 24px", borderRadius: 10, border: "none", background: "#2a2420", color: "#f5f0e8", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" },
  spinner: { display: "inline-block", width: 12, height: 12, border: "2px solid #e0d8cc", borderTop: "2px solid #b5692a", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  footer: { display: "flex", gap: 12 },
  btnSecondary: { padding: "12px 22px", borderRadius: 10, border: "1.5px solid #c4b99a", background: "transparent", color: "#6b5f54", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  btnPrimary: { padding: "12px 26px", borderRadius: 10, border: "none", background: "#2a2420", color: "#f5f0e8", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
};