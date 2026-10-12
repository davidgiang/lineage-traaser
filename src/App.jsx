// Top-level app: wires store + canvas + panel + onboarding + toolbar.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "paperTone": "cream",
  "bubbleShape": "rounded",
  "showDates": true,
  "showInitials": true,
  "lineStyle": "sketch",
  "deceasedStyle": "crest",
  "accentHue": 35,
  "compactBubbles": false,
  "layoutMode": "auto"
}/*EDITMODE-END*/;

function App() {
  const [tweak, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const store = useLineageStore();
  const {
    people, rels,
    addPerson, updatePerson, removePerson,
    addRel, removeRel, getRelations,
    selectedId, setSelectedId,
    panelOpen, setPanelOpen,
    selfId, setSelfId,
  } = store;

  const [search, setSearch] = React.useState('');
  const [renameReq, setRenameReq] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  const [contextMenu, setContextMenu] = React.useState(null); // {id, x, y}
  const [renameId, setRenameId] = React.useState(null);
  const [showOnboarding, setShowOnboarding] = React.useState(true);
  const [fitNonce, setFitNonce] = React.useState(null);

  const canvasView = useCanvasView();

  // Auto layout
  const layout = React.useMemo(() => computeAutoLayout(people, rels), [people, rels]);
  const positions = React.useMemo(
    () => resolvePositions(people, layout.positions, tweak.layoutMode === 'auto'),
    [people, layout, tweak.layoutMode]
  );

  // Search matches
  const matchedIds = React.useMemo(() => {
    const set = new Set();
    if (!search.trim()) return set;
    const q = search.trim().toLowerCase();
    for (const p of Object.values(people)) {
      if ((p.name || '').toLowerCase().includes(q)) set.add(p.id);
    }
    return set;
  }, [search, people]);

  // Initial fit when data first appears
  const firstLayoutRef = React.useRef(false);
  React.useEffect(() => {
    if (!firstLayoutRef.current && Object.keys(people).length > 0) {
      firstLayoutRef.current = true;
      setTimeout(() => setFitNonce(Date.now()), 80);
    }
  }, [people]);

  // ESC closes panel & menus
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setPanelOpen(false);
      }
      // delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !panelOpen && !showOnboarding) {
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
        removePerson(selectedId);
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;
        e.preventDefault();
        document.querySelector('.search input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, panelOpen, showOnboarding]);

  // Add a fresh person near the canvas center
  const addBlank = (overrides = {}) => {
    const ids = Object.keys(people);
    let x, y;
    if (ids.length === 0) {
      x = 0; y = 0;
    } else {
      // Place near current view center
      const r = document.querySelector('.canvas-viewport')?.getBoundingClientRect();
      if (r) {
        const wx = (r.width / 2 - canvasView.tx) / canvasView.scale;
        const wy = (r.height / 2 - canvasView.ty) / canvasView.scale;
        x = wx - 92; y = wy - 39;
      } else { x = 0; y = 0; }
    }
    const p = addPerson({ x, y, ...overrides });
    setSelectedId(p.id);
    setRenameReq({ id: p.id, n: Date.now() });
    return p;
  };

  // Onboarding submit
  const startWithSelf = ({ name, birth }) => {
    setShowOnboarding(false);
    setTimeout(() => {
      addPerson({ name: name || 'Me', birth: birth || '', x: 0, y: 0 });
      setFitNonce(Date.now());
    }, 50);
  };

  // From context menu / detail-panel "add child/parent/partner": creates a NEW person and a relationship
  const addRelativeMarker = null;
  const addRelative = (anchorId, kind /* 'parent-of' | 'child-of' | 'partner' */) => {
    const anchor = people[anchorId];
    if (!anchor) return;
    // Position near anchor
    const apos = positions[anchorId] || { x: 0, y: 0 };
    let dx = 0, dy = 0;
    if (kind === 'parent-of') { dy = (CBH + 150); }
    else if (kind === 'child-of') { dy = -(CBH + 150); }
    else if (kind === 'partner') { dx = (CBW + 60); }
    else if (kind === 'other') { dx = (CBW + 120); dy = 60; }
    else if (kind === 'sibling') { dx = (CBW + 40); }
    // A sibling is not its own edge — it is a shared parent. Reuse the anchor's parents,
    // or stand up a placeholder parent if there are none yet.
    let sharedParents = null;
    if (kind === 'sibling') {
      const r = getRelations(anchorId);
      sharedParents = r.parents.map(p => p.id).concat(r.adoptedParents.map(p => p.id));
      if (!sharedParents.length) {
        const ph = addPerson({ name: 'Unknown parent', x: apos.x, y: apos.y - (CBH + 150) });
        addRel(ph.id, anchorId, 'parent');
        sharedParents = [ph.id];
      }
    }
    const np = addPerson({ x: apos.x + dx, y: apos.y + dy, name: 'New person' });
    if (kind === 'parent-of') addRel(anchorId, np.id, 'parent');
    else if (kind === 'child-of') addRel(np.id, anchorId, 'parent');
    else if (kind === 'partner') addRel(anchorId, np.id, 'partner');
    else if (kind === 'other') addRel(anchorId, np.id, 'other', 'friend');
    else if (kind === 'sibling') sharedParents.forEach(pid => addRel(pid, np.id, 'parent'));
    setSelectedId(np.id);
    setRenameReq({ id: np.id, n: Date.now() });
  };

  // Link two EXISTING people as siblings by giving them the same parents.
  const linkSiblings = (aId, bId) => {
    const ra = getRelations(aId), rb = getRelations(bId);
    const pa = ra.parents.map(p => p.id).concat(ra.adoptedParents.map(p => p.id));
    const pb = rb.parents.map(p => p.id).concat(rb.adoptedParents.map(p => p.id));
    let shared = pa.length ? pa : pb;
    if (!shared.length) {
      const apos = positions[aId] || { x: 0, y: 0 };
      const ph = addPerson({ name: 'Unknown parent', x: apos.x, y: apos.y - (CBH + 150) });
      addRel(ph.id, aId, 'parent');
      shared = [ph.id];
    }
    shared.forEach(pid => { addRel(pid, aId, 'parent'); addRel(pid, bId, 'parent'); });
  };

  // Commit a hand-ordered sibling row: the order becomes explicit and outranks birth year.
  const setSiblingOrder = (orderedIds) => {
    store.setPeople(prev => {
      const next = { ...prev };
      orderedIds.forEach((id, i) => { if (next[id]) next[id] = { ...next[id], order: i }; });
      return next;
    });
  };

  // The canvas world is transformed, so focusing anything inside it can make an ancestor
  // scroll to "reveal" it — which silently offsets every screen coordinate. Never scroll.
  React.useEffect(() => {
    const reset = (e) => {
      const el = e && e.target && e.target.nodeType === 1 ? e.target : null;
      for (const n of [el, document.documentElement, document.body]) {
        if (n && (n.scrollLeft || n.scrollTop)) { n.scrollLeft = 0; n.scrollTop = 0; }
      }
    };
    reset();
    window.addEventListener('scroll', reset, true);
    return () => window.removeEventListener('scroll', reset, true);
  }, []);

  const handleContextMenu = (id, e) => {
    setSelectedId(id);
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  };

  const tidy = () => {
    // Clear all manual positions
    const next = {};
    for (const p of Object.values(people)) next[p.id] = { ...p, x: null, y: null };
    store.setPeople(next);
    setTimeout(() => setFitNonce(Date.now()), 60);
  };

  const selected = selectedId ? people[selectedId] : null;

  // Apply tweaks via CSS variables on root
  const tweakStyle = {
    '--accent-hue': tweak.accentHue,
    '--bubble-radius': tweak.bubbleShape === 'pill' ? '999px' : tweak.bubbleShape === 'sharp' ? '4px' : '14px',
    '--bubble-pad-y': tweak.compactBubbles ? '6px' : '10px',
    '--clay': `oklch(0.58 0.09 ${tweak.accentHue})`,
    '--rust': `oklch(0.5 0.12 ${tweak.accentHue})`,
  };

  return (
    <div className={"app paper-" + tweak.paperTone} style={tweakStyle} data-deceased-style={tweak.deceasedStyle} data-line-style={tweak.lineStyle} data-show-dates={tweak.showDates} data-show-initials={tweak.showInitials}>
      <div className="paper-bg" />
      <div className="paper-grain" />

      <Canvas
        people={people}
        rels={rels}
        positions={positions}
        getRelations={getRelations}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        onOpenDetail={(id) => { setSelectedId(id); setPanelOpen(true); }}
        onUpdatePerson={updatePerson}
        onAddRel={addRel}
        onRemoveRel={removeRel}
        onContextMenu={handleContextMenu}
        onAddRelative={addRelative}
        onLinkSiblings={linkSiblings}
        onSetSiblingOrder={setSiblingOrder}
        panelOpen={panelOpen}
        renameReq={renameReq}
        searchQuery={search}
        matchedIds={matchedIds}
        fitNonce={fitNonce}
        lineStyle={tweak.lineStyle}
        layoutMode={tweak.layoutMode}
        selfId={selfId}
        view={canvasView}
        setView={({ scale, tx, ty }) => {
          canvasView.setScale(scale);
          canvasView.setTx(tx);
          canvasView.setTy(ty);
        }}
        fitNonce={fitNonce}
      />

      <Toolbar
        peopleCount={Object.keys(people).length}
        onAddPerson={() => addBlank({ name: 'New person' })}
        onFit={() => setFitNonce(Date.now())}
        onRecenter={tidy}
        onExportJSON={() => exportJSON(people, rels, selfId)}
        onExportGEDCOM={() => exportGEDCOM(people, rels)}
        onImport={(file) => importJSON(file, (d) => {
          store.setPeople(d.people);
          store.setRels(d.rels);
          setSelfId(d.selfId && d.people[d.selfId] ? d.selfId : null);
          setSelectedId(null); setPanelOpen(false);
          setTimeout(() => setFitNonce(Date.now()), 60);
        }, (msg) => setToast(msg))}
      />

      <SearchBar
        value={search}
        onChange={setSearch}
        matchCount={matchedIds.size}
      />

      <div className="zoom-controls" title="Zoom">
        <button onClick={() => {
          const r = document.querySelector('.canvas-viewport').getBoundingClientRect();
          const cx = r.width/2, cy = r.height/2;
          const ns = Math.min(2.4, canvasView.scale * 1.2);
          const wx = (cx - canvasView.tx) / canvasView.scale;
          const wy = (cy - canvasView.ty) / canvasView.scale;
          canvasView.setTx(cx - wx * ns);
          canvasView.setTy(cy - wy * ns);
          canvasView.setScale(ns);
        }}>+</button>
        <div className="zoom-pct">{Math.round(canvasView.scale * 100)}%</div>
        <button onClick={() => {
          const r = document.querySelector('.canvas-viewport').getBoundingClientRect();
          const cx = r.width/2, cy = r.height/2;
          const ns = Math.max(0.25, canvasView.scale / 1.2);
          const wx = (cx - canvasView.tx) / canvasView.scale;
          const wy = (cy - canvasView.ty) / canvasView.scale;
          canvasView.setTx(cx - wx * ns);
          canvasView.setTy(cy - wy * ns);
          canvasView.setScale(ns);
        }}>−</button>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className={'kb-hints' + (selectedId ? ' faded' : '')}>
        <span className="kb"><b>Drag</b> empty space to pan</span>
        <span className="kb"><b>Scroll</b> to zoom</span>
        <span className="kb"><b>Dbl-click</b> name to rename</span>
        <span className="kb"><b>Click</b> a person for actions</span>
        <span className="kb"><b>Right-click</b> for menu</span>
      </div>

      {Object.keys(people).length === 0 && !showOnboarding && (
        <div className="empty-hint">
          A blank canvas, ready for a story.
          <span className="arrow">— click "Add person" to begin —</span>
        </div>
      )}

      <DetailPanel
        open={panelOpen}
        person={selected}
        people={people}
        getRelations={getRelations}
        onClose={() => setPanelOpen(false)}
        onUpdate={(patch) => selected && updatePerson(selected.id, patch)}
        onRemove={() => { if (selected) { removePerson(selected.id); setPanelOpen(false); } }}
        onAddRel={(kind) => selected && addRelative(selected.id, kind)}
        onRemoveRel={removeRel}
        onUpdateRel={store.updateRel}
        onSelectPerson={(id) => setSelectedId(id)}
      />

      {contextMenu && people[contextMenu.id] && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          person={people[contextMenu.id]}
          isSelf={selfId === contextMenu.id}
          onClose={() => setContextMenu(null)}
          onSetSelf={() => setSelfId(contextMenu.id)}
          onOpen={() => { setSelectedId(contextMenu.id); setPanelOpen(true); }}
          onAddChild={() => addRelative(contextMenu.id, 'parent-of')}
          onAddParent={() => addRelative(contextMenu.id, 'child-of')}
          onAddPartner={() => addRelative(contextMenu.id, 'partner')}
          onMarkDeceased={() => updatePerson(contextMenu.id, { deceased: !people[contextMenu.id].deceased })}
          onResetPosition={() => updatePerson(contextMenu.id, { x: null, y: null, order: null })}
          onRename={() => { setSelectedId(contextMenu.id); setRenameReq({ id: contextMenu.id, n: Date.now() }); }}
          onRemove={() => removePerson(contextMenu.id)}
        />
      )}

      {showOnboarding && (
        <Onboarding
          onSubmit={startWithSelf}
          onSkip={() => setShowOnboarding(false)}
        />
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Paper" />
        <TweakRadio label="Tone" value={tweak.paperTone}
          options={['cream','warm','cool','dark']}
          onChange={(v) => setTweak('paperTone', v)} />
        <TweakSection label="Bubbles" />
        <TweakRadio label="Shape" value={tweak.bubbleShape}
          options={['rounded','pill','sharp']}
          onChange={(v) => setTweak('bubbleShape', v)} />
        <TweakToggle label="Compact" value={tweak.compactBubbles}
          onChange={(v) => setTweak('compactBubbles', v)} />
        <TweakToggle label="Show dates" value={tweak.showDates}
          onChange={(v) => setTweak('showDates', v)} />
        <TweakToggle label="Show initials" value={tweak.showInitials}
          onChange={(v) => setTweak('showInitials', v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Mode" value={tweak.layoutMode}
          options={['auto','free']}
          onChange={(v) => setTweak('layoutMode', v)} />
        <TweakSection label="Connections" />
        <TweakRadio label="Line style" value={tweak.lineStyle}
          options={['sketch','organic','straight']}
          onChange={(v) => setTweak('lineStyle', v)} />
        <TweakSection label="Memorial" />
        <TweakRadio label="Deceased mark" value={tweak.deceasedStyle}
          options={['crest','dim','dashed']}
          onChange={(v) => setTweak('deceasedStyle', v)} />
        <TweakSection label="Accent" />
        <TweakSlider label="Hue" value={tweak.accentHue} min={0} max={360} step={1} unit="°"
          onChange={(v) => setTweak('accentHue', v)} />
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
