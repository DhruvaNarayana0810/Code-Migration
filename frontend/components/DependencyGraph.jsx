import { useEffect, useState, useRef } from "react";

const NODE_COLORS = {
  function: "#3b82f6",
  class:    "#f97316",
  module:   "#22c55e",
  unknown:  "#a78bfa",
};

const NODE_RADIUS = 28;
const WIDTH = 900;
const HEIGHT = 500;

// Simple force-directed layout using iterative relaxation
function computeLayout(nodes, edges) {
  if (nodes.length === 0) return {};

  // Initialize positions in a circle
  const positions = {};
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    positions[n.data.id] = {
      x: WIDTH / 2 + (Math.min(WIDTH, HEIGHT) / 2 - 80) * Math.cos(angle),
      y: HEIGHT / 2 + (Math.min(WIDTH, HEIGHT) / 2 - 80) * Math.sin(angle),
    };
  });

  // Run force iterations
  const k = Math.sqrt((WIDTH * HEIGHT) / Math.max(nodes.length, 1));
  for (let iter = 0; iter < 200; iter++) {
    const disp = {};
    nodes.forEach((n) => { disp[n.data.id] = { x: 0, y: 0 }; });

    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i].data.id;
        const b = nodes[j].data.id;
        const dx = positions[a].x - positions[b].x;
        const dy = positions[a].y - positions[b].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const force = (k * k) / dist;
        disp[a].x += (dx / dist) * force;
        disp[a].y += (dy / dist) * force;
        disp[b].x -= (dx / dist) * force;
        disp[b].y -= (dy / dist) * force;
      }
    }

    // Attraction along edges
    edges.forEach((e) => {
      const a = e.data.source;
      const b = e.data.target;
      if (!positions[a] || !positions[b]) return;
      const dx = positions[a].x - positions[b].x;
      const dy = positions[a].y - positions[b].y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
      const force = (dist * dist) / k;
      disp[a].x -= (dx / dist) * force;
      disp[a].y -= (dy / dist) * force;
      disp[b].x += (dx / dist) * force;
      disp[b].y += (dy / dist) * force;
    });

    // Apply displacement with cooling
    const temp = Math.max(10, 50 * (1 - iter / 200));
    nodes.forEach((n) => {
      const id = n.data.id;
      const d = disp[id];
      const len = Math.max(Math.sqrt(d.x * d.x + d.y * d.y), 0.01);
      positions[id].x += (d.x / len) * Math.min(len, temp);
      positions[id].y += (d.y / len) * Math.min(len, temp);
      // Clamp to canvas
      positions[id].x = Math.max(NODE_RADIUS + 10, Math.min(WIDTH - NODE_RADIUS - 10, positions[id].x));
      positions[id].y = Math.max(NODE_RADIUS + 10, Math.min(HEIGHT - NODE_RADIUS - 10, positions[id].y));
    });
  }

  return positions;
}

// Compute arrow endpoint on node circumference
function edgeEndpoints(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
  return {
    x1: from.x + (dx / dist) * NODE_RADIUS,
    y1: from.y + (dy / dist) * NODE_RADIUS,
    x2: to.x - (dx / dist) * (NODE_RADIUS + 8),
    y2: to.y - (dy / dist) * (NODE_RADIUS + 8),
    mx: (from.x + to.x) / 2,
    my: (from.y + to.y) / 2,
  };
}

export default function DependencyGraph() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [positions, setPositions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    fetch("/graph")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => {
        const n = data.nodes || [];
        const e = data.edges || [];
        setNodes(n);
        setEdges(e);
        setPositions(computeLayout(n, e));
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  // Drag handlers
  const onMouseDown = (e, id) => {
    e.preventDefault();
    setDragging(id);
    setSelected(id);
  };

  const onMouseMove = (e) => {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    setPositions((prev) => ({
      ...prev,
      [dragging]: {
        x: Math.max(NODE_RADIUS + 10, Math.min(WIDTH - NODE_RADIUS - 10, (e.clientX - rect.left) * scaleX)),
        y: Math.max(NODE_RADIUS + 10, Math.min(HEIGHT - NODE_RADIUS - 10, (e.clientY - rect.top) * scaleY)),
      },
    }));
  };

  const onMouseUp = () => setDragging(null);

  const connectedIds = selected
    ? new Set([selected, ...edges.filter(e => e.data.source === selected || e.data.target === selected).flatMap(e => [e.data.source, e.data.target])])
    : null;

  return (
    <div style={styles.wrapper}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.headerIcon}>⬡</span>
          <div>
            <div style={styles.headerTitle}>DEPENDENCY GRAPH</div>
            <div style={styles.headerSub}>Code Archaeologist · Live View</div>
          </div>
        </div>
        <div style={styles.statsRow}>
          {[{ label: "NODES", val: nodes.length, color: "#3b82f6" }, { label: "EDGES", val: edges.length, color: "#7a6f65" }].map(s => (
            <div key={s.label} style={styles.statPill}>
              <span style={{ ...styles.statVal, color: s.color }}>{s.val}</span>
              <span style={styles.statLabel}>{s.label}</span>
            </div>
          ))}
          <button onClick={() => setSelected(null)} style={styles.resetBtn}>RESET</button>
        </div>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} style={styles.legendItem}>
            <div style={{ ...styles.legendDot, background: color }} />
            <span style={styles.legendLabel}>{type}</span>
          </div>
        ))}
      </div>

      {/* SVG Canvas */}
      <div style={styles.canvasWrap}>
        {loading && (
          <div style={styles.overlay}>
            <div style={styles.spinner} />
            <div style={styles.overlayText}>Excavating graph…</div>
          </div>
        )}
        {error && (
          <div style={styles.overlay}>
            <div style={{ fontSize: 28, color: "#ef4444" }}>✕</div>
            <div style={styles.overlayText}>API Error: {error}</div>
            <div style={{ fontSize: 10, color: "#4b5563", marginTop: 4 }}>Is the backend running on port 8000?</div>
          </div>
        )}
        {!loading && !error && nodes.length === 0 && (
          <div style={styles.overlay}>
            <div style={styles.overlayText}>No graph data. Run Analyze first.</div>
          </div>
        )}

        {!loading && !error && nodes.length > 0 && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            style={styles.svg}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onClick={(e) => { if (e.target === svgRef.current) setSelected(null); }}
          >
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#6b5f54" />
              </marker>
              <marker id="arrow-highlight" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#b5692a" />
              </marker>
              {/* Subtle grid pattern */}
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e8e0d4" strokeWidth="1" />
              </pattern>
              {/* Glow filter */}
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Background grid */}
            <rect width={WIDTH} height={HEIGHT} fill="#faf8f4" />
            <rect width={WIDTH} height={HEIGHT} fill="url(#grid)" opacity="0.5" />

            {/* Edges */}
            {edges.map((e, i) => {
              const from = positions[e.data.source];
              const to = positions[e.data.target];
              if (!from || !to) return null;
              const ep = edgeEndpoints(from, to);
              const isHighlighted = selected && (e.data.source === selected || e.data.target === selected);
              const isFaded = selected && !isHighlighted;
              return (
                <g key={i} opacity={isFaded ? 0.08 : 1} style={{ transition: "opacity 0.2s" }}>
                  <line
                    x1={ep.x1} y1={ep.y1} x2={ep.x2} y2={ep.y2}
                    stroke={isHighlighted ? "#b5692a" : "#6b5f54"}
                    strokeWidth={isHighlighted ? 2.5 : 1.5}
                    markerEnd={isHighlighted ? "url(#arrow-highlight)" : "url(#arrow)"}
                    strokeDasharray={isHighlighted ? "none" : "none"}
                  />
                  {isHighlighted && e.data.label && (
                    <text x={ep.mx} y={ep.my - 6} textAnchor="middle" fill="#b5692a" fontSize="9" fontFamily="DM Mono">
                      {e.data.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((n) => {
              const id = n.data.id;
              const pos = positions[id];
              if (!pos) return null;
              const color = NODE_COLORS[n.data.type] || NODE_COLORS.unknown;
              const isSelected = selected === id;
              const isFaded = connectedIds && !connectedIds.has(id);
              return (
                <g
                  key={id}
                  transform={`translate(${pos.x},${pos.y})`}
                  onMouseDown={(e) => onMouseDown(e, id)}
                  style={{ cursor: dragging === id ? "grabbing" : "grab", transition: "opacity 0.2s" }}
                  opacity={isFaded ? 0.1 : 1}
                >
                  {/* Outer ring for selected */}
                  {isSelected && (
                    <circle r={NODE_RADIUS + 8} fill="none" stroke={color} strokeWidth={1.5} opacity={0.4} filter="url(#glow)" />
                  )}
                  {/* Node circle */}
                  <circle
                    r={NODE_RADIUS}
                    fill={color}
                    fillOpacity={isSelected ? 1 : 0.85}
                    stroke={isSelected ? "#ffffff" : color}
                    strokeWidth={isSelected ? 2 : 1}
                    filter={isSelected ? "url(#glow)" : "none"}
                  />
                  {/* Inner ring detail */}
                  <circle r={NODE_RADIUS - 6} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
                  {/* Label */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={n.data.label.length > 8 ? "8" : "10"}
                    fontFamily="JetBrains Mono"
                    fontWeight="700"
                    style={{ userSelect: "none", pointerEvents: "none" }}
                  >
                    {n.data.label.length > 10 ? n.data.label.slice(0, 9) + "…" : n.data.label}
                  </text>
                  {/* Type badge */}
                  <text
                    y={NODE_RADIUS + 12}
                    textAnchor="middle"
                    fill={color}
                    fontSize="8"
                    fontFamily="JetBrains Mono"
                    style={{ userSelect: "none", pointerEvents: "none" }}
                    opacity={0.8}
                  >
                    {n.data.type}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Selected info */}
      {selected && (
        <div style={styles.infoBar}>
          <span style={{ color: NODE_COLORS[nodes.find(n => n.data.id === selected)?.data.type] || "#a78bfa", fontSize: 10, letterSpacing: "0.1em" }}>
            {nodes.find(n => n.data.id === selected)?.data.type?.toUpperCase()}
          </span>
          <span style={{ color: "#2a2420", fontWeight: 700, fontSize: 13 }}>{selected}</span>
          <span style={{ color: "#9a8f82", fontSize: 10 }}>
            {edges.filter(e => e.data.source === selected || e.data.target === selected).length} connections
          </span>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", width: "100%", background: "#faf8f4", borderRadius: "10px", overflow: "hidden", fontFamily: "'DM Mono', monospace" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #e0d8cc", flexWrap: "wrap", gap: 12 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  headerIcon: { fontSize: 28, color: "#b5692a" },
  headerTitle: { fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 16, letterSpacing: "0.05em", color: "#2a2420" },
  headerSub: { fontSize: 10, color: "#9a8f82", letterSpacing: "0.05em", marginTop: 2 },
  statsRow: { display: "flex", alignItems: "center", gap: 10 },
  statPill: { display: "flex", flexDirection: "column", alignItems: "center", background: "#fff", border: "1px solid #e0d8cc", borderRadius: 6, padding: "6px 14px", minWidth: 60 },
  statVal: { fontSize: 18, fontWeight: 700, lineHeight: 1 },
  statLabel: { fontSize: 9, color: "#9a8f82", letterSpacing: "0.12em", marginTop: 2 },
  resetBtn: { background: "transparent", border: "1px solid #e0d8cc", color: "#9a8f82", padding: "6px 12px", fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, borderRadius: 6, cursor: "pointer" },
  legend: { display: "flex", gap: 16, padding: "8px 20px", borderBottom: "1px solid #e0d8cc", background: "#fff" },
  legendItem: { display: "flex", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: "50%" },
  legendLabel: { fontSize: 11, color: "#6b5f54", letterSpacing: "0.04em", fontFamily: "'DM Sans', sans-serif" },
  canvasWrap: { position: "relative", width: "100%", background: "#faf8f4", minHeight: 480 },
  overlay: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "#faf8f4", minHeight: 480 },
  overlayText: { fontSize: 14, color: "#6b5f54", fontFamily: "'DM Sans', sans-serif" },
  spinner: { width: 32, height: 32, border: "2px solid #e0d8cc", borderTop: "2px solid #b5692a", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  svg: { width: "100%", display: "block", minHeight: 480 },
  infoBar: { display: "flex", alignItems: "center", gap: 16, padding: "10px 20px", borderTop: "1px solid #e0d8cc", background: "#fff" },
};