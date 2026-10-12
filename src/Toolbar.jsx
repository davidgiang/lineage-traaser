// Top toolbar (brand + add + fit) and search bar.

function Toolbar({ onAddPerson, onFit, onRecenter, onExportJSON, onExportGEDCOM, onImport, peopleCount }) {
  const [menu, setMenu] = React.useState(false);
  const fileRef = React.useRef(null);
  React.useEffect(() => {
    if (!menu) return;
    const close = (e) => { if (!e.target.closest('.save-wrap')) setMenu(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menu]);
  return (
    <div className="toolbar">
      <div className="brand">
        <div className="brand-mark">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="2" />
            <circle cx="6" cy="14" r="2" />
            <circle cx="18" cy="14" r="2" />
            <path d="M12 7v3M12 10c0 1.5-3 2-6 2M12 10c0 1.5 3 2 6 2" />
            <circle cx="9" cy="20" r="1.4" />
            <circle cx="15" cy="20" r="1.4" />
            <path d="M6 16v1c0 1.2 1.4 2 3 2M18 16v1c0 1.2-1.4 2-3 2" />
          </svg>
        </div>
        <div>
          <div className="brand-name">Lineage</div>
          <div className="brand-sub">Family tree · {peopleCount} {peopleCount === 1 ? 'person' : 'people'}</div>
        </div>
      </div>

      <button className="tbtn primary" onClick={onAddPerson}>
        <Icon name="plus" size={12} /> Add person
      </button>
      <button className="tbtn" onClick={onFit} title="Fit to view">
        <Icon name="fit" size={13} /> Fit
      </button>
      <button className="tbtn" onClick={onRecenter} title="Reset positions">
        <Icon name="recenter" size={13} /> Tidy
      </button>

      <div className="save-wrap">
        <button className="tbtn" onClick={() => setMenu(m => !m)} title="Save or load this tree">
          <Icon name="download" size={13} /> Save
        </button>
        {menu && (
          <div className="save-menu">
            <div className="save-head">Export</div>
            <button onClick={() => { setMenu(false); onExportJSON(); }}>
              <Icon name="download" size={13} />
              <span><b>Lineage file</b><i>.json — keeps everything, reopen here</i></span>
            </button>
            <button onClick={() => { setMenu(false); onExportGEDCOM(); }}>
              <Icon name="download" size={13} />
              <span><b>GEDCOM</b><i>.ged — for Ancestry, MyHeritage, Gramps</i></span>
            </button>
            <div className="save-head">Import</div>
            <button onClick={() => { setMenu(false); fileRef.current.click(); }}>
              <Icon name="upload" size={13} />
              <span><b>Open a Lineage file</b><i>replaces the current tree</i></span>
            </button>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) onImport(f); }} />
      </div>
    </div>
  );
}

function SearchBar({ value, onChange, matchCount }) {
  return (
    <div className="search">
      <Icon name="search" size={14} color="var(--ink-3)" />
      <input
        type="text"
        placeholder="Search by name…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && <span className="search-count">{matchCount} match{matchCount === 1 ? '' : 'es'}</span>}
    </div>
  );
}

window.Toolbar = Toolbar;
window.SearchBar = SearchBar;
