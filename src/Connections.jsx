// Connection paths between bubbles. Renders an SVG layer.
// Geometry: parent→child use orthogonal "T" with rounded corners; partner is short straight line between adjacent bubbles.
// Adds slight wobble for hand-drawn feel.

const { BUBBLE_W: BW, BUBBLE_H: BH } = window.LAYOUT_CONST;

// Cheap deterministic noise per id pair so re-renders are stable.
function jitter(seed, range = 1.5) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // map to [-range, range]
  return ((h >>> 0) / 0xffffffff - 0.5) * 2 * range;
}

function bubbleAnchor(pos, side) {
  // pos is top-left of bubble box of size BW x BH
  switch (side) {
    case 'top':    return { x: pos.x + BW/2, y: pos.y };
    case 'bottom': return { x: pos.x + BW/2, y: pos.y + BH };
    case 'left':   return { x: pos.x, y: pos.y + BH/2 };
    case 'right':  return { x: pos.x + BW, y: pos.y + BH/2 };
    case 'center': return { x: pos.x + BW/2, y: pos.y + BH/2 };
  }
}

// Smoothly curved orthogonal path
function smoothPath(pts, straight = false) {
  if (pts.length < 2) return '';
  if (straight) {
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
    return d;
  }
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], cur = pts[i], nxt = pts[i + 1];
    const r = 14;
    const dx1 = Math.sign(cur.x - prev.x), dy1 = Math.sign(cur.y - prev.y);
    const dx2 = Math.sign(nxt.x - cur.x), dy2 = Math.sign(nxt.y - cur.y);
    const p1 = { x: cur.x - dx1 * r, y: cur.y - dy1 * r };
    const p2 = { x: cur.x + dx2 * r, y: cur.y + dy2 * r };
    d += ` L ${p1.x} ${p1.y} Q ${cur.x} ${cur.y} ${p2.x} ${p2.y}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function ConnectionsLayer({ rels, positions, people, getRelations, onRemoveRel, hoveredRelId, setHoveredRelId, previewLine, bounds, lineStyle }) {
  const paths = [];
  const isStraight = lineStyle !== 'organic';

  // For straight mode, use a single direct line; otherwise use orthogonal with rounded corners.
  function buildParentChildPath(startX, startY, endX, endY, seed) {
    if (isStraight) {
      // Direct diagonal line
      return `M ${startX} ${startY} L ${endX} ${endY}`;
    }
    // Organic mode: if start and end are nearly aligned (vertically or horizontally),
    // draw a clean direct line — no pivot, no wobble.
    const dxAbs = Math.abs(endX - startX);
    const dyAbs = Math.abs(endY - startY);
    if (dxAbs < 24 || dyAbs < 24) {
      return `M ${startX} ${startY} L ${endX} ${endY}`;
    }
    const midY = (startY + endY) / 2 + jitter(seed, 4);
    const pts = [
      { x: startX, y: startY },
      { x: startX, y: midY },
      { x: endX, y: midY },
      { x: endX, y: endY },
    ];
    return smoothPath(pts);
  }

  // Track partner pairs to compute child anchor (midpoint between partners)
  const partnerMid = {}; // "a|b" sorted -> midpoint x,y
  for (const r of Object.values(rels)) {
    if ((r.kind === 'partner' || r.kind === 'divorced') && positions[r.from] && positions[r.to]) {
      const a = bubbleAnchor(positions[r.from], 'right');
      const b = bubbleAnchor(positions[r.to], 'left');
      // pick whichever is left
      const left = positions[r.from].x < positions[r.to].x ? r.from : r.to;
      const right = left === r.from ? r.to : r.from;
      const lp = bubbleAnchor(positions[left], 'right');
      const rp = bubbleAnchor(positions[right], 'left');
      const key = [r.from, r.to].sort().join('|');
      partnerMid[key] = { x: (lp.x + rp.x)/2, y: (lp.y + rp.y)/2 };
      // line itself
      paths.push({
        id: r.id,
        kind: r.kind,
        cls: `conn ${r.kind}`,
        d: `M ${lp.x} ${lp.y} L ${rp.x} ${rp.y}`,
        labelPos: { x: (lp.x + rp.x)/2, y: lp.y - 8 },
        label: r.kind === 'divorced' ? 'separated' : null,
      });
    }
  }

  // Other ties (friend, godparent, mentor…) — non-structural, straight center-to-center
  for (const r of Object.values(rels)) {
    if (r.kind !== 'other') continue;
    const A = positions[r.from], B = positions[r.to];
    if (!A || !B) continue;
    const a = bubbleAnchor(A, 'center'), b2 = bubbleAnchor(B, 'center');
    paths.push({
      id: r.id,
      kind: 'other',
      cls: 'conn other',
      d: `M ${a.x} ${a.y} L ${b2.x} ${b2.y}`,
      labelPos: { x: (a.x + b2.x)/2, y: (a.y + b2.y)/2 - 6 },
      label: r.label || 'tie',
    });
  }

  // Parent → children, drawn as one family bus:
  //   parents drop to a couple junction → single trunk down → horizontal sibling bar → one stub per child.
  // This replaces N×M diagonals with a single readable structure.
  const families = {}; // parentSetKey -> { parents:[ids], kids: Map(childId -> rel) }
  for (const r of Object.values(rels)) {
    if (r.kind !== 'parent' && r.kind !== 'adopted') continue;
    if (!positions[r.from] || !positions[r.to]) continue;
    const cr = getRelations(r.to);
    const ps = cr.parents.concat(cr.adoptedParents).map(p => p.id)
      .filter(pid => positions[pid]).sort();
    const key = ps.join('|') || r.from;
    if (!families[key]) families[key] = { parents: ps.length ? ps : [r.from], kids: new Map() };
    // Keep every edge, not the first: a child can be born to one parent and adopted by the
    // other, and the stub must render the same way whatever order rels are stored in.
    if (!families[key].kids.has(r.to)) families[key].kids.set(r.to, []);
    families[key].kids.get(r.to).push(r);
  }

  const placedBars = []; // {y, x1, x2} — keeps blended families from sharing one bar line
  for (const key of Object.keys(families)) {
    const fam = families[key];
    const pPos = fam.parents.map(id => positions[id]).filter(Boolean);
    const kids = [...fam.kids.entries()];
    if (!pPos.length || !kids.length) continue;

    const parentBottom = Math.max(...pPos.map(p => p.y + BH));
    const junctionX = pPos.reduce((s2, p) => s2 + p.x + BW/2, 0) / pPos.length;
    const kidTop = Math.min(...kids.map(([cid]) => positions[cid].y));

    // Child sits above/level with the parents (manual layout) — fall back to direct lines.
    if (kidTop <= parentBottom + 24) {
      for (const [cid, edges] of kids) {
        const ch = positions[cid];
        const anyAdopted = edges.some(e => e.kind === 'adopted');
        paths.push({
          id: edges[0].id, kind: edges[0].kind, cls: 'conn ' + (anyAdopted ? 'adopted' : ''),
          d: `M ${junctionX} ${parentBottom} L ${ch.x + BW/2} ${ch.y + BH/2}`,
          labelPos: null, label: null,
        });
      }
      continue;
    }

    const coupleY = parentBottom + Math.min(26, (kidTop - parentBottom) / 3);
    let busY = kidTop - Math.min(30, (kidTop - coupleY) / 2);
    // Families sharing a children's row would otherwise draw collinear bars (blended
    // families, half-siblings). Lift this bar until its x-range is clear of the others.
    const kidCxs = kids.map(([cid]) => positions[cid].x + BW/2);
    const spanL = Math.min(junctionX, ...kidCxs) - 4;
    const spanR = Math.max(junctionX, ...kidCxs) + 4;
    for (let guard = 0; guard < 12; guard++) {
      const clash = placedBars.some(b => Math.abs(b.y - busY) < 9 && b.x2 > spanL && b.x1 < spanR);
      if (!clash) break;
      busY -= 11;
    }
    busY = Math.max(busY, coupleY + 8);
    placedBars.push({ y: busY, x1: spanL, x2: spanR });

    // each parent drops to the couple line and runs in to the junction
    pPos.forEach((p, i) => {
      const pcx = p.x + BW/2;
      const pts = [{ x: pcx, y: p.y + BH }, { x: pcx, y: coupleY }, { x: junctionX, y: coupleY }];
      paths.push({
        id: 'stem:' + key + ':' + i, kind: 'stem', cls: 'conn', static: true,
        d: isStraight ? pts.map((q, j) => (j ? 'L' : 'M') + ` ${q.x} ${q.y}`).join(' ') : smoothPath(pts),
        labelPos: null, label: null,
      });
    });

    // trunk + sibling bar
    const kidXs = kids.map(([cid]) => positions[cid].x + BW/2).sort((a, b) => a - b);
    const barLeft = Math.min(kidXs[0], junctionX);
    const barRight = Math.max(kidXs[kidXs.length - 1], junctionX);
    paths.push({
      id: 'trunk:' + key, kind: 'trunk', cls: 'conn', static: true,
      d: `M ${junctionX} ${coupleY} L ${junctionX} ${busY}`,
      labelPos: null, label: null,
    });
    if (barRight - barLeft > 1) {
      paths.push({
        id: 'bar:' + key, kind: 'bar', cls: 'conn', static: true,
        d: `M ${barLeft} ${busY} L ${barRight} ${busY}`,
        labelPos: null, label: null,
      });
    }

    // one stub per child
    for (const [cid, edges] of kids) {
      const ch = positions[cid];
      const cx = ch.x + BW/2;
      const adoptive = edges.filter(e => e.kind === 'adopted');
      const allAdopted = adoptive.length === edges.length && edges.length > 0;
      const firstName = (id) => String((people[id] || {}).name || '').trim().split(/\s+/)[0] || 'parent';
      const label = allAdopted ? 'adopted'
        : (adoptive.length ? 'adopted by ' + adoptive.map(e => firstName(e.from)).join(' & ') : null);
      paths.push({
        id: edges[0].id, kind: allAdopted ? 'adopted' : edges[0].kind,
        cls: 'conn ' + (adoptive.length ? 'adopted' : ''),
        d: `M ${cx} ${busY} L ${cx} ${ch.y}`,
        labelPos: label ? { x: cx + 6, y: (busY + ch.y)/2 } : null,
        label,
      });
    }
  }

  // Sibling indicators (subtle): for visualization only — derived horizontal tie
  // Skipped to avoid clutter; partners + parent lines already convey siblings.

  const padding = 400;
  const bx = (bounds?.x || 0) - padding;
  const by = (bounds?.y || 0) - padding;
  const w = (bounds?.w || 1000) + padding * 2;
  const h = (bounds?.h || 800) + padding * 2;

  return (
    <svg className="connections-svg"
      width={w} height={h}
      style={{ left: bx, top: by }}
      viewBox={`${bx} ${by} ${w} ${h}`}
    >
      {/* hand-drawn filter */}
      <defs>
        <filter id="rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="1" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="0.4" />
        </filter>
      </defs>

      {paths.map(p => (
        <g key={p.id}>
          {!p.static && <path d={p.d} className="conn-hit"
            onMouseEnter={() => setHoveredRelId(p.id)}
            onMouseLeave={() => setHoveredRelId(null)}
            onContextMenu={(e) => { e.preventDefault(); onRemoveRel(p.id); }}
            onDoubleClick={(e) => { e.preventDefault(); onRemoveRel(p.id); }}
          />}
          <path
            d={p.d}
            className={p.cls + (hoveredRelId === p.id ? ' hover' : '')}
            filter={isStraight ? undefined : "url(#rough)"}
            shapeRendering={isStraight ? 'crispEdges' : undefined}
          />
          {p.label && (
            <text className="conn-label" x={p.labelPos.x} y={p.labelPos.y} textAnchor="middle">
              {p.label}
            </text>
          )}
        </g>
      ))}

      {previewLine && (
        <path d={previewLine} className="conn preview" />
      )}
    </svg>
  );
}

window.ConnectionsLayer = ConnectionsLayer;
window.bubbleAnchor = bubbleAnchor;
