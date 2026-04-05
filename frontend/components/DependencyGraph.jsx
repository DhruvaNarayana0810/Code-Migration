import { useEffect, useState, useRef } from "react";
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';

cytoscape.use(coseBilkent);

const NODE_COLORS = {
  function: "#3b82f6",
  class:    "#f97316",
  module:   "#22c55e",
  unknown:  "#a78bfa",
  file:     "#6b7280",
};

const RISK_STYLE = {
  Low:    { color: "#166534", bg: "#dcfce7" },
  Medium: { color: "#854d0e", bg: "#fef9c3" },
  High:   { color: "#991b1b", bg: "#fee2e2" },
};

export default function DependencyGraph() {
  const [elements, setElements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tooltip, setTooltip] = useState(null); // { x, y, data, loading }
  const cyRef = useRef(null);
  const tooltipTimeout = useRef(null);

  useEffect(() => {
    setLoading(true);
    fetch("/graph")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => {
        const nodes = (data.nodes || []).map(node => ({
          data: {
            ...node.data,
            label: node.data.label,
            color: NODE_COLORS[node.data.type] || NODE_COLORS.unknown,
          }
        }));
        const edges = (data.edges || []).map(edge => ({
          data: { ...edge.data, label: edge.data.label || 'depends_on' }
        }));
        setElements([...nodes, ...edges]);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  // Wire up hover events after cy is ready
  const handleCy = (cy) => {
    cyRef.current = cy;

    cy.on("mouseover", "node", (evt) => {
      clearTimeout(tooltipTimeout.current);
      const node = evt.target;
      const pos = evt.renderedPosition || { x: 0, y: 0 };
      const container = cy.container().getBoundingClientRect();

      const x = container.left + pos.x + 16;
      const y = container.top + pos.y - 10;

      setTooltip({ x, y, data: null, loading: true, name: node.data("label") });

      // Fetch entity info
      fetch(`/entity-info?entity_name=${encodeURIComponent(node.data("label"))}`)
        .then(r => r.json())
        .then(data => setTooltip(t => t ? { ...t, data, loading: false } : null))
        .catch(() => setTooltip(t => t ? { ...t, loading: false } : null));
    });

    cy.on("mouseout", "node", () => {
      tooltipTimeout.current = setTimeout(() => setTooltip(null), 200);
    });
  };

  const layout = {
    name: 'cose-bilkent',
    animate: true,
    animationDuration: 1000,
    nodeDimensionsIncludeLabels: true,
  };

  const stylesheet = [
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)',
        'label': 'data(label)',
        'color': '#374151',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': '8px',
        'font-size': '11px',
        'font-weight': '600',
        'font-family': 'DM Mono, monospace',
        'width': '30px',
        'height': '30px',
        'border-width': '2px',
        'border-color': '#ffffff',
        'border-opacity': 0.9,
      }
    },
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': '#6b5f54',
        'target-arrow-color': '#6b5f54',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'label': 'data(label)',
        'font-size': '9px',
        'text-background-color': '#faf8f4',
        'text-background-opacity': 0.9,
        'text-background-padding': '3px',
        'text-margin-y': '-8px',
        'color': '#6b5f54',
        'text-valign': 'top',
      }
    },
    {
      selector: 'node:selected',
      style: { 'border-width': '3px', 'border-color': '#b5692a' }
    },
    {
      selector: 'edge:selected',
      style: { 'width': 3, 'line-color': '#b5692a', 'target-arrow-color': '#b5692a' }
    }
  ];

  return (
    <div style={{ width: '100%', height: '500px', background: '#faf8f4', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap');
        @keyframes tooltipFade { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Node type legend */}
      {!loading && !error && elements.length > 0 && (
        <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,0.95)', borderRadius: 8, padding: '12px', boxShadow: '0 2px 8px rgba(42,36,32,0.1)', fontFamily: 'DM Sans, sans-serif', fontSize: 12, zIndex: 10, border: '1px solid #e0d8cc' }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: '#2a2420', fontSize: 11, letterSpacing: '0.04em' }}>Node types</div>
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ color: '#6b5f54' }}>{type}</span>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9a8f82', fontFamily: 'DM Sans, sans-serif' }}>
          Loading graph…
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#991b1b', fontFamily: 'DM Sans, sans-serif', textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>✕</div>
          <div>API Error: {error}</div>
          <div style={{ fontSize: 12, color: '#9a8f82', marginTop: 4 }}>Is the backend running?</div>
        </div>
      )}
      {!loading && !error && elements.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9a8f82', fontFamily: 'DM Sans, sans-serif' }}>
          No graph data. Run Analyze first.
        </div>
      )}

      {!loading && !error && elements.length > 0 && (
        <CytoscapeComponent
          elements={elements}
          layout={layout}
          stylesheet={stylesheet}
          style={{ width: '100%', height: '100%' }}
          cy={handleCy}
          userZoomingEnabled={true}
          userPanningEnabled={true}
          boxSelectionEnabled={true}
          autoungrabify={false}
          autounselectify={false}
        />
      )}

      {/* Hover tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(tooltip.x, window.innerWidth - 280),
            top: tooltip.y,
            width: 260,
            background: '#2a2420',
            border: '1px solid #4a3f38',
            borderRadius: 10,
            padding: '14px 16px',
            zIndex: 9999,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            fontFamily: 'DM Sans, sans-serif',
            animation: 'tooltipFade 0.18s ease',
            pointerEvents: 'none',
          }}
          onMouseEnter={() => clearTimeout(tooltipTimeout.current)}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Name */}
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600, color: '#e8c27a', marginBottom: 8, wordBreak: 'break-all' }}>
            {tooltip.name}
          </div>

          {tooltip.loading ? (
            <div style={{ fontSize: 12, color: '#9a8f82' }}>Fetching info…</div>
          ) : tooltip.data ? (
            <>
              {/* Summary */}
              <div style={{ fontSize: 12, color: '#c4b99a', lineHeight: 1.6, marginBottom: 10 }}>
                {tooltip.data.summary?.split('\n')[0] || 'No summary available.'}
              </div>

              {/* Dependencies */}
              {tooltip.data.dependencies?.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: '#6b5f54', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Dependencies</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {tooltip.data.dependencies.slice(0, 5).map(d => (
                      <span key={d} style={{ background: '#3a302a', color: '#c4b99a', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontFamily: 'DM Mono, monospace' }}>{d}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 10, color: '#6b5f54', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Risk</div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  ...( RISK_STYLE[tooltip.data.risk] || RISK_STYLE.Low )
                }}>
                  {tooltip.data.risk || 'Low'}
                </span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#9a8f82' }}>No data available.</div>
          )}
        </div>
      )}
    </div>
  );
}