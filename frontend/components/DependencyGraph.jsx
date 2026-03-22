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

export default function DependencyGraph() {
  const [elements, setElements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const cyRef = useRef(null);

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
          data: {
            ...edge.data,
            label: edge.data.label || 'depends_on',
          }
        }));
        setElements([...nodes, ...edges]);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

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
        'font-family': 'JetBrains Mono, monospace',
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
        'line-color': '#6b7280',
        'target-arrow-color': '#6b7280',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'label': 'data(label)',
        'font-size': '9px',
        'text-background-color': '#ffffff',
        'text-background-opacity': 0.9,
        'text-background-padding': '3px',
        'text-margin-y': '-8px',
        'color': '#374151',
        'text-valign': 'top',
      }
    },
    {
      selector: 'node:selected',
      style: {
        'border-width': '3px',
        'border-color': '#f59e0b',
      }
    },
    {
      selector: 'edge:selected',
      style: {
        'width': 3,
        'line-color': '#f59e0b',
        'target-arrow-color': '#f59e0b',
      }
    }
  ];

  return (
    <div style={{ width: '100%', height: '500px', background: '#faf8f4', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
      `}</style>

      {/* Legend */}
      {!loading && !error && elements.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px',
          zIndex: 10,
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#374151' }}>Relationships</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <div style={{ width: '20px', height: '2px', background: '#6b7280', position: 'relative' }}>
              <div style={{
                position: 'absolute',
                right: '-4px',
                top: '-3px',
                width: '0',
                height: '0',
                borderLeft: '4px solid #6b7280',
                borderTop: '2px solid transparent',
                borderBottom: '2px solid transparent'
              }}></div>
            </div>
            <span style={{ color: '#6b7280' }}>depends_on</span>
          </div>
        </div>
      )}

      {loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          background: '#faf8f4',
          color: '#6b7280',
          fontFamily: 'JetBrains Mono, monospace'
        }}>
          Excavating graph…
        </div>
      )}

      {error && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          background: '#faf8f4',
          color: '#ef4444',
          fontFamily: 'JetBrains Mono, monospace',
          textAlign: 'center',
          padding: '20px'
        }}>
          <div style={{ fontSize: '28px', marginBottom: '10px' }}>✕</div>
          <div>API Error: {error}</div>
          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
            Is the backend running on port 8001?
          </div>
        </div>
      )}

      {!loading && !error && elements.length === 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          background: '#faf8f4',
          color: '#6b7280',
          fontFamily: 'JetBrains Mono, monospace'
        }}>
          No graph data. Run Analyze first.
        </div>
      )}

      {!loading && !error && elements.length > 0 && (
        <CytoscapeComponent
          elements={elements}
          layout={layout}
          stylesheet={stylesheet}
          style={{ width: '100%', height: '100%' }}
          cy={(cy) => { cyRef.current = cy; }}
          userZoomingEnabled={false}
          userPanningEnabled={true}
          boxSelectionEnabled={true}
          autoungrabify={false}
          autounselectify={false}
        />
      )}
    </div>
  );
}