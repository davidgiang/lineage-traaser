// Minimap — shows all bubbles as small rects + viewport rect; drag the rect to pan.

function Minimap({ positions, viewport, worldBounds, onPan }) {
  const W = 220, H = 150;
  const pad = 16;
  const inner = { w: W - pad*2, h: H - pad*2 };

  const ids = Object.keys(positions);
  if (ids.length === 0) return null;

  // World extents: include all positions
  const { BUBBLE_W: BW, BUBBLE_H: BH } = window.LAYOUT_CONST;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const id of ids) {
    const p = positions[id];
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + BW);
    maxY = Math.max(maxY, p.y + BH);
  }
  // Include viewport
  minX = Math.min(minX, viewport.x);
  minY = Math.min(minY, viewport.y);
  maxX = Math.max(maxX, viewport.x + viewport.w);
  maxY = Math.max(maxY, viewport.y + viewport.h);

  const worldW = maxX - minX || 1;
  const worldH = maxY - minY || 1;
  const scale = Math.min(inner.w / worldW, inner.h / worldH);
  const offX = pad + (inner.w - worldW * scale) / 2;
  const offY = pad + (inner.h - worldH * scale) / 2;

  const toMini = (x, y) => ({ x: offX + (x - minX) * scale, y: offY + (y - minY) * scale });

  const ref = React.useRef(null);
  const dragRef = React.useRef(null);

  const handlePointer = (e) => {
    const r = ref.current.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    // map back to world center
    const wx = (mx - offX) / scale + minX;
    const wy = (my - offY) / scale + minY;
    onPan({ centerWorld: { x: wx, y: wy } });
  };

  return (
    <div className="minimap" ref={ref}
      onMouseDown={(e) => { dragRef.current = true; handlePointer(e); }}
      onMouseMove={(e) => { if (dragRef.current) handlePointer(e); }}
      onMouseUp={() => { dragRef.current = false; }}
      onMouseLeave={() => { dragRef.current = false; }}
    >
      <div className="minimap-label">Map</div>
      <svg viewBox={`0 0 ${W} ${H}`}>
        {ids.map(id => {
          const p = positions[id];
          const a = toMini(p.x, p.y);
          const w = BW * scale;
          const h = BH * scale;
          return <rect key={id} className="node" x={a.x} y={a.y} width={Math.max(2,w)} height={Math.max(2,h)} rx={2} />;
        })}
        {/* Viewport rect */}
        {(() => {
          const a = toMini(viewport.x, viewport.y);
          return (
            <rect className="viewport-rect"
              x={a.x} y={a.y}
              width={Math.max(6, viewport.w * scale)}
              height={Math.max(6, viewport.h * scale)}
              rx={3}
            />
          );
        })()}
      </svg>
    </div>
  );
}

window.Minimap = Minimap;
