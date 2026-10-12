// Right-click menu on a bubble.

function ContextMenu({ x, y, person, isSelf, onClose, onOpen, onAddChild, onAddParent, onAddPartner, onMarkDeceased, onResetPosition, onRename, onRemove, onSetSelf }) {
  React.useEffect(() => {
    const close = () => onClose();
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', (e) => e.key === 'Escape' && onClose());
    return () => window.removeEventListener('mousedown', close);
  }, []);

  // Clamp to viewport
  const W = 220, H = 320;
  const vx = Math.min(x, window.innerWidth - W - 8);
  const vy = Math.min(y, window.innerHeight - H - 8);

  const stop = (e) => e.stopPropagation();

  return (
    <div className="ctx-menu" style={{ left: vx, top: vy }} onMouseDown={stop}>
      <div className="ctx-item" onClick={() => { onOpen(); onClose(); }}>
        <Icon name="pencil" size={13} /> Open details
      </div>
      <div className="ctx-item" onClick={() => { onRename(); onClose(); }}>
        <Icon name="pencil" size={13} /> Rename inline
      </div>
      <div className="ctx-sep" />
      <div className="ctx-item" onClick={() => { onAddChild(); onClose(); }}>
        <Icon name="plus" size={13} /> Add child
      </div>
      <div className="ctx-item" onClick={() => { onAddParent(); onClose(); }}>
        <Icon name="plus" size={13} /> Add parent
      </div>
      <div className="ctx-item" onClick={() => { onAddPartner(); onClose(); }}>
        <Icon name="plus" size={13} /> Add partner
      </div>
      <div className="ctx-sep" />
      <div className="ctx-item" onClick={() => { onMarkDeceased(); onClose(); }}>
        <span style={{fontSize:12}}>✦</span> {person.deceased ? 'Unmark deceased' : 'Mark deceased'}
      </div>
      <div className="ctx-item" onClick={() => { onResetPosition(); onClose(); }}>
        <Icon name="recenter" size={13} /> Clear manual order
      </div>
      {!isSelf && onSetSelf && (
        <div className="ctx-item" onClick={() => { onSetSelf(); onClose(); }}>
          <span style={{fontSize:12}}>★</span> Set as self
        </div>
      )}
      <div className="ctx-sep" />
      <div className="ctx-item danger" onClick={() => { onRemove(); onClose(); }}>
        <Icon name="trash" size={13} /> Remove person
      </div>
    </div>
  );
}

// shown when user drags a connection from one bubble onto another — pick relationship type.
function RelPicker({ x, y, fromPerson, toPerson, onPick, onClose }) {
  const [tieLabel, setTieLabel] = React.useState('');
  React.useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const W = 260;
  const vx = Math.min(x, window.innerWidth - W - 8);
  const vy = Math.min(y, window.innerHeight - 280);

  const Row = ({ kind, label, swatch }) => (
    <div className="rel-picker-row" onClick={() => onPick(kind)}>
      <svg className="swatch" viewBox="0 0 24 12" width="24" height="12">{swatch}</svg>
      {label}
    </div>
  );

  return (
    <div className="rel-picker" style={{ left: vx, top: vy }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="rel-picker-title">
        <b style={{color:'var(--ink)', letterSpacing:'normal', textTransform:'none', fontFamily:'var(--serif)', fontSize:12, fontStyle:'italic'}}>{fromPerson.name}</b>
        {' → '}
        <b style={{color:'var(--ink)', letterSpacing:'normal', textTransform:'none', fontFamily:'var(--serif)', fontSize:12, fontStyle:'italic'}}>{toPerson.name}</b>
      </div>
      <Row kind="parent-of" label="Is parent of" swatch={<line x1="2" y1="6" x2="22" y2="6" stroke="#6e6354" strokeWidth="1.6" />} />
      <Row kind="child-of" label="Is child of" swatch={<line x1="2" y1="6" x2="22" y2="6" stroke="#6e6354" strokeWidth="1.6" />} />
      <Row kind="sibling" label="Sibling of" swatch={<line x1="2" y1="6" x2="22" y2="6" stroke="#6e6354" strokeWidth="1.2" strokeDasharray="2 3" />} />
      <Row kind="partner" label="Partner / spouse" swatch={<line x1="2" y1="6" x2="22" y2="6" stroke="oklch(0.5 0.12 35)" strokeWidth="1.8" />} />
      <Row kind="divorced" label="Separated / divorced" swatch={<line x1="2" y1="6" x2="22" y2="6" stroke="oklch(0.5 0.12 35)" strokeWidth="1.8" strokeDasharray="3 3" />} />
      <Row kind="adopted-child" label="Adopted by" swatch={<line x1="2" y1="6" x2="22" y2="6" stroke="#6e6354" strokeWidth="2" strokeDasharray="1 3" />} />
      <Row kind="adopted-parent" label="Adopted as parent of" swatch={<line x1="2" y1="6" x2="22" y2="6" stroke="#6e6354" strokeWidth="2" strokeDasharray="1 3" />} />
      <div className="rel-picker-tie">
        <svg className="swatch" viewBox="0 0 24 12" width="24" height="12"><line x1="2" y1="6" x2="22" y2="6" stroke="#8d8271" strokeWidth="1.4" strokeDasharray="1 4" /></svg>
        <input autoFocus={false} placeholder="other tie — friend, godparent…" value={tieLabel}
          onChange={(e) => setTieLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && tieLabel.trim()) onPick('other', tieLabel.trim()); }} />
        <button disabled={!tieLabel.trim()} onClick={() => tieLabel.trim() && onPick('other', tieLabel.trim())}>add</button>
      </div>
    </div>
  );
}

window.ContextMenu = ContextMenu;
window.RelPicker = RelPicker;
