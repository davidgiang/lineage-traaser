// Canvas: pan/zoom, bubble dragging, drag-to-connect. Composes Bubbles + ConnectionsLayer.

const { BUBBLE_W: CBW, BUBBLE_H: CBH } = window.LAYOUT_CONST;

function useCanvasView() {
  const [scale, setScale] = React.useState(1);
  const [tx, setTx] = React.useState(0);
  const [ty, setTy] = React.useState(0);
  return { scale, setScale, tx, setTx, ty, setTy };
}

function Canvas({
  people, rels, positions, getRelations,
  selectedId, setSelectedId,
  onOpenDetail,
  onUpdatePerson, onAddRel, onRemoveRel, onContextMenu,
  onAddRelative,
  onLinkSiblings,
  onSetSiblingOrder,
  panelOpen,
  renameReq,
  searchQuery, matchedIds,
  view, setView,
  fitNonce,
  lineStyle,
  layoutMode,
  selfId,
}) {
  const viewportRef = React.useRef(null);
  const [panning, setPanning] = React.useState(false);
  const [draggingId, setDraggingId] = React.useState(null);

  // link mode: click a source's "link" action, then click another person
  const [linkFrom, setLinkFrom] = React.useState(null);
  const [hoveredRelId, setHoveredRelId] = React.useState(null);
  const [pendingConnection, setPendingConnection] = React.useState(null); // {from, to, screenX, screenY}

  const dragRef = React.useRef(null);
  const panRef = React.useRef(null);

  // Convert screen → world
  const toWorld = (sx, sy) => {
    const r = viewportRef.current.getBoundingClientRect();
    return {
      x: (sx - r.left - view.tx) / view.scale,
      y: (sy - r.top - view.ty) / view.scale,
    };
  };

  // Wheel zoom (cursor-anchored)
  const onWheel = (e) => {
    e.preventDefault();
    const r = viewportRef.current.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    const newScale = Math.min(2.4, Math.max(0.25, view.scale * factor));
    // anchor to cursor: world point under cursor stays put
    const wx = (cx - view.tx) / view.scale;
    const wy = (cy - view.ty) / view.scale;
    const newTx = cx - wx * newScale;
    const newTy = cy - wy * newScale;
    setView({ scale: newScale, tx: newTx, ty: newTy });
  };

  // Background pan
  const onMouseDownBg = (e) => {
    if (e.button !== 0) return;
    setSelectedId(null);
    setPanning(true);
    panRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  };

  // Bubble drag
  // Everyone sharing this person's exact parent set — the row they can be reordered within.
  const siblingGroupOf = (id) => {
    const keyOf = (pid) => {
      const r = getRelations(pid);
      return r.parents.concat(r.adoptedParents).map(p => p.id).sort().join('|');
    };
    const k = keyOf(id);
    if (!k) return [];
    return Object.keys(people).filter(pid => keyOf(pid) === k);
  };

  const startBubbleDrag = (id, e) => {
    if (layoutMode === 'auto') {
      // Auto layout owns coordinates, so dragging reorders the sibling row instead of moving.
      const group = siblingGroupOf(id);
      if (group.length < 2) return;
      setDraggingId(id);
      dragRef.current = { id, mode: 'reorder', group };
      return;
    }
    setDraggingId(id);
    const startWorld = toWorld(e.clientX, e.clientY);
    const p = positions[id];
    dragRef.current = {
      id,
      offsetX: startWorld.x - p.x,
      offsetY: startWorld.y - p.y,
      moved: false,
    };
  };

  // Cancel link mode on Escape
  React.useEffect(() => {
    if (!linkFrom) return;
    const onKey = (e) => { if (e.key === 'Escape') setLinkFrom(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [linkFrom]);

  React.useEffect(() => {
    const onMove = (e) => {
      if (panning && panRef.current) {
        const dx = e.clientX - panRef.current.x;
        const dy = e.clientY - panRef.current.y;
        setView({ scale: view.scale, tx: panRef.current.tx + dx, ty: panRef.current.ty + dy });
      } else if (draggingId && dragRef.current && dragRef.current.mode === 'reorder') {
        const w = toWorld(e.clientX, e.clientY);
        const g = dragRef.current.group.filter(id => positions[id])
          .sort((a, b) => positions[a].x - positions[b].x);
        const cur = g.indexOf(draggingId);
        if (cur < 0) return;
        let target = cur;
        for (let i = 0; i < g.length; i++) {
          const cx = positions[g[i]].x + CBW / 2;
          if (i < cur && w.x < cx) { target = i; break; }
          if (i > cur && w.x > cx) target = i;
        }
        if (target !== cur) {
          const arr = g.slice();
          arr.splice(cur, 1);
          arr.splice(target, 0, draggingId);
          onSetSiblingOrder(arr);
        }
      } else if (draggingId && dragRef.current) {
        const w = toWorld(e.clientX, e.clientY);
        const newX = w.x - dragRef.current.offsetX;
        const newY = w.y - dragRef.current.offsetY;
        dragRef.current.moved = true;
        onUpdatePerson(draggingId, { x: newX, y: newY });
      }
    };
    const onUp = (e) => {
      if (panning) { setPanning(false); panRef.current = null; }
      if (draggingId) {
        setDraggingId(null);
        dragRef.current = null;
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panning, draggingId, view.scale, view.tx, view.ty, positions]);

  // Pan to recenter viewport on a world point (used by minimap)
  const panToWorldCenter = (wx, wy) => {
    const r = viewportRef.current.getBoundingClientRect();
    const newTx = r.width / 2 - wx * view.scale;
    const newTy = r.height / 2 - wy * view.scale;
    setView({ scale: view.scale, tx: newTx, ty: newTy });
  };

  // Fit-to-view
  React.useEffect(() => {
    if (fitNonce == null) return;
    const ids = Object.keys(positions);
    if (ids.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of ids) {
      const p = positions[id];
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + CBW);
      maxY = Math.max(maxY, p.y + CBH);
    }
    const r = viewportRef.current.getBoundingClientRect();
    // Fit into the rect that is actually visible — fixed chrome (toolbar, search, hint
    // strip, minimap) permanently covers bands of the viewport, so exclude them.
    const rc = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect() : null; };
    const topChrome = ['.toolbar', '.search'].map(rc).filter(Boolean);
    const bottomChrome = ['.kb-hints', '.minimap'].map(rc).filter(Boolean);
    const safeTop = (topChrome.length ? Math.max(...topChrome.map(c => c.bottom - r.top)) : 0) + 16;
    const safeBottom = (bottomChrome.length ? Math.min(...bottomChrome.map(c => c.top - r.top)) : r.height) - 16;
    const safeLeft = 16, safeRight = r.width - 16;
    const availW = Math.max(160, safeRight - safeLeft);
    const treeW = (maxX - minX) || 1, treeH = (maxY - minY) || 1;
    // The bottom chrome only occupies the two corners, so try the full height first and
    // fall back to the inset box only if the fitted content actually runs into it.
    const fitInto = (top, bottom) => {
      const availH = Math.max(160, bottom - top);
      const s = Math.min(1.2, Math.max(0.3, Math.min(availW / treeW, availH / treeH)));
      return { s, tx: safeLeft + (availW - treeW * s) / 2 - minX * s, ty: top + (availH - treeH * s) / 2 - minY * s };
    };
    const pick = (f) => {
      const box = {
        left: r.left + f.tx + minX * f.s, top: r.top + f.ty + minY * f.s,
        right: r.left + f.tx + minX * f.s + treeW * f.s, bottom: r.top + f.ty + minY * f.s + treeH * f.s,
      };
      return bottomChrome.some(c => box.right > c.left && box.left < c.right && box.bottom > c.top && box.top < c.bottom);
    };
    const full = fitInto(safeTop, r.height - 16);
    const f = pick(full) ? fitInto(safeTop, safeBottom) : full;
    setView({ scale: f.s, tx: f.tx, ty: f.ty });
  }, [fitNonce]);

  // Compute bounds for SVG layer
  const bounds = React.useMemo(() => {
    const ids = Object.keys(positions);
    if (!ids.length) return { x: 0, y: 0, w: 1000, h: 800 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of ids) {
      const p = positions[id];
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + CBW);
      maxY = Math.max(maxY, p.y + CBH);
    }
    // include origin so the layer never shifts unexpectedly for all-positive trees
    const x0 = Math.min(0, minX), y0 = Math.min(0, minY);
    return { x: x0, y: y0, w: Math.max(maxX, 0) - x0, h: Math.max(maxY, 0) - y0 };
  }, [positions]);

  // Compute viewport rect in world coords for minimap
  const viewportWorldRect = React.useMemo(() => {
    const r = viewportRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0, w: 1000, h: 800 };
    return {
      x: -view.tx / view.scale,
      y: -view.ty / view.scale,
      w: r.width / view.scale,
      h: r.height / view.scale,
    };
  }, [view.scale, view.tx, view.ty, bounds]);

  // Pending connection picker — submit selected kind
  const submitConnection = (kind, label) => {
    const { from, to, autoCreated, newPersonId } = pendingConnection;
    if (kind === 'parent-of') onAddRel(from, to, 'parent');
    else if (kind === 'child-of') onAddRel(to, from, 'parent');
    else if (kind === 'partner') onAddRel(from, to, 'partner');
    else if (kind === 'divorced') onAddRel(from, to, 'divorced');
    else if (kind === 'adopted-child') onAddRel(to, from, 'adopted');
    else if (kind === 'adopted-parent') onAddRel(from, to, 'adopted');
    else if (kind === 'other') onAddRel(from, to, 'other', label);
    else if (kind === 'sibling') onLinkSiblings(from, to);
    setPendingConnection(null);
    // If we just made a new person, open their detail panel for filling in info
    if (autoCreated && newPersonId) {
      setSelectedId(newPersonId);
      onOpenDetail(newPersonId);
    }
  };
  const cancelPendingConnection = () => {
    // If user cancels and the person was auto-created, still keep them but no relation
    if (pendingConnection?.autoCreated && pendingConnection.newPersonId) {
      setSelectedId(pendingConnection.newPersonId);
      onOpenDetail(pendingConnection.newPersonId);
    }
    setPendingConnection(null);
  };

  // Keep the selected bubble's action ring clear of the toolbar, panel and viewport edges
  React.useEffect(() => {
    if (!selectedId) return;
    const p = positions[selectedId];
    const vp = viewportRef.current;
    if (!p || !vp) return;
    const r = vp.getBoundingClientRect();
    const tb = document.querySelector('.toolbar');
    const topGuard = (tb ? tb.getBoundingClientRect().bottom - r.top : 60) + 20;
    // Horizontal safety is handled by the bar's own clamp (barShift) — only vertical
    // clearance needs a pan, so a Fit stays fitted when you select someone.
    const left = p.x * view.scale + view.tx;
    const right = (p.x + CBW) * view.scale + view.tx;
    const top = p.y * view.scale + view.ty - 52;
    const bottom = (p.y + CBH) * view.scale + view.ty + 52;
    let dx = 0, dy = 0;
    if (top < topGuard) dy = topGuard - top;
    else if (bottom > r.height - 16) dy = (r.height - 16) - bottom;
    // bottom-right chrome (zoom controls) — pan up so the ring clears it
    const zc = document.querySelector('.zoom-controls');
    if (zc) {
      const z = zc.getBoundingClientRect();
      const zTop = z.top - r.top, zLeft = z.left - r.left;
      if (right + dx > zLeft - 12 && bottom + dy > zTop - 12 && top + dy < z.bottom - r.top) {
        dy = Math.min(dy, (zTop - 12) - bottom);
      }
    }
    if (dx || dy) setView({ scale: view.scale, tx: view.tx + dx, ty: view.ty + dy });
  }, [selectedId, panelOpen]);

  // Hide the (passive) minimap when the selected bubble's action ring would sit under it
  const ringNearMinimap = React.useMemo(() => {
    if (!selectedId || !positions[selectedId] || !viewportRef.current) return false;
    const r = viewportRef.current.getBoundingClientRect();
    const p = positions[selectedId];
    const left = p.x * view.scale + view.tx - 90;
    const right = (p.x + CBW) * view.scale + view.tx + 90;
    const top = p.y * view.scale + view.ty - 50;
    const bottom = (p.y + CBH) * view.scale + view.ty + 50;
    const mm = { left: r.width - 250, top: r.height - 190, right: r.width, bottom: r.height };
    return right > mm.left && left < mm.right && bottom > mm.top && top < mm.bottom;
  }, [selectedId, positions, view.scale, view.tx, view.ty]);

  return (
    <>
      <div
        ref={viewportRef}
        className={`canvas-viewport ${panning ? 'panning' : ''} ${linkFrom ? 'linking' : ''}`}
        onMouseDown={onMouseDownBg}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="canvas-world"
          style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }}
        >
          <ConnectionsLayer
            rels={rels}
            positions={positions}
            people={people}
            getRelations={getRelations}
            onRemoveRel={onRemoveRel}
            hoveredRelId={hoveredRelId}
            setHoveredRelId={setHoveredRelId}
            bounds={bounds}
            lineStyle={lineStyle}
          />

          {Object.values(people).map(p => {
            const pos = positions[p.id];
            if (!pos) return null;
            const vpRect = viewportRef.current ? viewportRef.current.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
            const actionsAbove = (pos.y + CBH) * view.scale + view.ty > vpRect.height - 96;
            const matched = searchQuery && matchedIds.has(p.id);
            const dim = !!searchQuery && !matched;
            return (
              <Bubble
                key={p.id}
                person={p}
                pos={pos}
                selected={selectedId === p.id}
                matched={matched}
                dim={dim}
                kinship={selfId ? window.deriveKinship(p.id, selfId, getRelations, Object.keys(people)) : null}
                isDragging={draggingId === p.id}
                actionsAbove={actionsAbove}
                viewScale={view.scale}
                viewKey={view.scale + '|' + Math.round(view.tx) + '|' + Math.round(view.ty)}
                startRenameNonce={renameReq && renameReq.id === p.id ? renameReq.n : 0}
                onSelect={() => setSelectedId(p.id)}
                onOpenDetail={() => onOpenDetail(p.id)}
                onStartDrag={(e) => startBubbleDrag(p.id, e)}
                onAddRelative={(kind) => onAddRelative(p.id, kind)}
                onStartLink={() => setLinkFrom(linkFrom === p.id ? null : p.id)}
                isLinkSource={linkFrom === p.id}
                linkMode={!!linkFrom && linkFrom !== p.id}
                onPickLinkTarget={(e) => {
                  setPendingConnection({ from: linkFrom, to: p.id, screenX: e.clientX, screenY: e.clientY });
                  setLinkFrom(null);
                }}
                onContextMenu={(e) => onContextMenu(p.id, e)}
                onRename={(name) => onUpdatePerson(p.id, { name: window.capitalizeName(name) })}
              />
            );
          })}
        </div>
      </div>

      {pendingConnection && (
        <RelPicker
          x={pendingConnection.screenX}
          y={pendingConnection.screenY}
          fromPerson={people[pendingConnection.from]}
          toPerson={people[pendingConnection.to]}
          onPick={submitConnection}
          onClose={cancelPendingConnection}
        />
      )}

      {linkFrom && people[linkFrom] && (
        <div className="link-hint">
          <span>Click a person to link with <b>{people[linkFrom].name}</b></span>
          <button onClick={() => setLinkFrom(null)}>cancel</button>
        </div>
      )}

      <div className={'minimap-wrap' + (ringNearMinimap ? ' hidden' : '')}>
      <Minimap
        positions={positions}
        viewport={viewportWorldRect}
        worldBounds={bounds}
        onPan={({ centerWorld }) => panToWorldCenter(centerWorld.x, centerWorld.y)}
      />
      </div>
    </>
  );
}

window.Canvas = Canvas;
window.useCanvasView = useCanvasView;
