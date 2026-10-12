// Person bubble — pill/rounded card with photo, name, dates, deceased mark, and connect handle.

function Bubble({
  person,
  pos,            // {x, y}
  selected,
  matched,        // search match
  dim,            // search active but no match
  kinship,        // string label like "self", "parent", or null
  onSelect,
  onOpenDetail,
  onStartDrag,
  onAddRelative,
  onStartLink,
  linkMode,        // this bubble is a candidate link target
  isLinkSource,
  onPickLinkTarget,
  actionsAbove,
  viewScale,
  viewKey,
  onContextMenu,
  onRename,
  isDragging,
  startRenameNonce,
}) {
  const [editing, setEditing] = React.useState(false);
  const nameRef = React.useRef(null);
  const barRef = React.useRef(null);
  // Keep the action bar inside the canvas viewport. Measured rather than computed, so it
  // holds for any pan/zoom/transform-origin combination.
  const [barShift, setBarShift] = React.useState(0);
  const [place, setPlace] = React.useState(null); // measured 'above' | 'below'
  // Single pass, and deliberately NOT a function of its own output: the bar's unshifted
  // box is derived from the bubble's centre plus the bar's own width, so re-running after a
  // shift produces the same answer instead of chasing itself into a render loop.
  React.useLayoutEffect(() => {
    if (!selected || editing || linkMode || !barRef.current) {
      if (barShift) setBarShift(0);
      if (place) setPlace(null);
      return;
    }
    const bar = barRef.current.getBoundingClientRect();
    const bub = barRef.current.parentElement.getBoundingClientRect();
    const barW = bar.width, barH = bar.height;
    const rectOf = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect() : null; };
    const vpEl = document.querySelector('.canvas-viewport');
    const v = vpEl ? vpEl.getBoundingClientRect() : { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight };
    const tbBottom = (rectOf('.toolbar') || { bottom: 0 }).bottom;

    // App chrome (zoom controls, minimap) paints above the canvas world — z-index can't beat
    // it, so treat any chrome overlapping the bar's band as a hard horizontal boundary.
    const chrome = ['.zoom-controls', '.minimap-wrap:not(.hidden) .minimap'].map(rectOf).filter(Boolean);
    const boundsFor = (top, bottom) => {
      let L = v.left + 12, R = v.right - 12;
      for (const c of chrome) {
        if (c.bottom < top || c.top > bottom) continue;
        if (c.left > (v.left + v.right) / 2) R = Math.min(R, c.left - 12);
        else L = Math.max(L, c.right + 12);
      }
      return { L, R };
    };

    const bandBelow = [bub.bottom + 10, bub.bottom + 10 + barH];
    const bandAbove = [bub.top - 10 - barH, bub.top - 10];
    const widthIn = (band) => { const { L, R } = boundsFor(band[0], band[1]); return R - L; };
    const roomBelow = bandBelow[1] < v.bottom - 12 ? widthIn(bandBelow) : -1;
    const roomAbove = bandAbove[0] > tbBottom + 6 ? widthIn(bandAbove) : -1;
    let want;
    if (roomBelow >= barW) want = 'below';
    else if (roomAbove >= barW) want = 'above';
    else want = roomAbove > roomBelow ? 'above' : 'below';

    // Unshifted box: the capsule is centred on the bubble, so this never depends on barShift.
    const cx = bub.left + bub.width / 2;
    const { L, R } = boundsFor(...(want === 'above' ? bandAbove : bandBelow));
    let shift = 0;
    if (cx - barW / 2 < L) shift = L - (cx - barW / 2);
    else if (cx + barW / 2 > R && barW < R - L) shift = R - (cx + barW / 2);
    shift = shift / (viewScale || 1);

    if (want !== place) setPlace(want);
    if (Math.abs(shift - barShift) > 0.5) setBarShift(shift);
  }, [selected, editing, linkMode, viewScale, viewKey, pos.x, pos.y]);

  React.useEffect(() => { if (startRenameNonce) setEditing(true); }, [startRenameNonce]);

  React.useEffect(() => {
    if (editing && nameRef.current) {
      nameRef.current.focus({ preventScroll: true });
      // place caret at end
      const r = document.createRange();
      r.selectNodeContents(nameRef.current);
      r.collapse(false);
      const s = window.getSelection();
      s.removeAllRanges(); s.addRange(r);
    }
  }, [editing]);

  React.useEffect(() => {
    if (!editing) return;
    const onDown = (e) => { if (!nameRef.current || !nameRef.current.contains(e.target)) finishEdit(); };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [editing]);

  const finishEdit = () => {
    setEditing(false);
    const v = (nameRef.current?.innerText || '').trim() || 'Unnamed';
    onRename(v);
  };

  const initials = (person.name || '?')
    .split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() || '').join('') || '?';

  const dates = (() => {
    const b = person.birth?.toString().trim();
    const d = person.death?.toString().trim();
    if (!b && !d && !person.deceased) return null;
    if (b && d) return `${b} – ${d}`;
    if (b && person.deceased) return `${b} – ?`;
    if (b) return `b. ${b}`;
    if (d) return `d. ${d}`;
    if (person.deceased) return 'in memoriam';
    return null;
  })();

  return (
    <div
      className={[
        'bubble',
        selected ? 'selected' : '',
        person.deceased ? 'deceased' : '',
        matched ? 'match' : '',
        dim ? 'dim' : '',
        isDragging ? 'dragging' : '',
        linkMode ? 'link-target' : '',
        isLinkSource ? 'link-source' : '',
        kinship === 'self' ? 'is-self' : '',
      ].join(' ')}
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(e) => {
        if (editing) return;
        if (e.button !== 0) return;
        e.stopPropagation();
        if (linkMode) return;
        onSelect();
        onStartDrag(e);
      }}
      onClick={(e) => {
        if (editing) return;
        e.stopPropagation();
        if (linkMode) { onPickLinkTarget(e); return; }
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (linkMode) return;
        setEditing(true);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e);
      }}
    >
      <div className="bubble-row">
        <div className={`bubble-photo ${person.photo ? '' : 'placeholder'}`}>
          {person.photo
            ? <img src={person.photo} alt="" draggable="false" />
            : <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>{initials}</span>
          }
        </div>
        <div className="bubble-text">
          <div
            className="bubble-name"
            ref={nameRef}
            contentEditable={editing}
            suppressContentEditableWarning
            onBlur={finishEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); finishEdit(); }
              if (e.key === 'Escape') {
                e.preventDefault();
                if (nameRef.current) nameRef.current.innerText = person.name;
                setEditing(false);
              }
            }}
            onMouseDown={(e) => { if (editing) e.stopPropagation(); }}
          >{person.name}</div>
          {kinship && <div className="bubble-kinship">{kinship === 'self' ? '(self)' : kinship}</div>}
          {dates && <div className="bubble-meta">{dates}</div>}
        </div>
      </div>

      {person.deceased && (
        <div className="bubble-deceased-mark" title="In memoriam">
          <span className="crest">✦</span>
        </div>
      )}

      {selected && !editing && !linkMode && (
        <div
          ref={barRef}
          className={'bubble-actions' + ((place ? place === 'above' : actionsAbove) ? ' above' : '')}
          style={{ transform: `translateX(-50%) translateX(${barShift || 0}px) scale(${1 / (viewScale || 1)})` }}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="ba-label">add</span>
          <button className="ba" onClick={() => onAddRelative('child-of')}>parent</button>
          <button className="ba" onClick={() => onAddRelative('parent-of')}>child</button>
          <button className="ba" onClick={() => onAddRelative('sibling')}>sibling</button>
          <button className="ba" onClick={() => onAddRelative('partner')}>partner</button>
          <button className="ba" onClick={() => onAddRelative('other')}>tie</button>
          <span className="ba-sep"></span>
          <button className={'ba' + (isLinkSource ? ' active' : '')} onClick={onStartLink}>link</button>
          <button className="ba" onClick={onOpenDetail}>details</button>
        </div>
      )}

    </div>
  );
}

window.Bubble = Bubble;
