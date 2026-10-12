// Detail panel — slides in from right. Edit name, photo, dates, deceased, note, manage relationships.

function DetailPanel({ open, person, people, getRelations, onClose, onUpdate, onRemove, onAddRel, onRemoveRel, onUpdateRel, onSelectPerson }) {
  if (!person) return null;
  const rel = getRelations(person.id);

  const fileRef = React.useRef(null);

  const handlePhoto = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => onUpdate({ photo: e.target.result });
    reader.readAsDataURL(file);
  };

  const RelLine = ({ id, kindLabel }) => {
    const p = people[id];
    if (!p) return null;
    return (
      <div className="rel-item" onClick={() => onSelectPerson(id)}>
        <span className="rel-kind">{kindLabel}</span>
        <span className="rel-name">{p.name}</span>
      </div>
    );
  };

  return (
    <aside className={`detail-panel ${open ? '' : 'closed'}`}>
      <div className="detail-head">
        <button className="detail-close" onClick={onClose} aria-label="Close"><Icon name="close" size={14} /></button>
        <div className="detail-eyebrow">Person</div>
        <input
          className="detail-name-input"
          value={person.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          onBlur={(e) => onUpdate({ name: window.capitalizeName(e.target.value) })}
          placeholder="Unnamed"
        />
      </div>

      <div className="detail-body">
        <div className="photo-uploader">
          <div className="photo-preview">
            {person.photo
              ? <img src={person.photo} alt="" />
              : <span style={{ fontStyle: 'italic' }}>{(person.name||'?').split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase() || '?'}</span>
            }
          </div>
          <div className="photo-actions">
            <input ref={fileRef} type="file" accept="image/*" hidden
              onChange={(e) => handlePhoto(e.target.files?.[0])} />
            <button className="tbtn" onClick={() => fileRef.current?.click()}>
              <Icon name="photo" size={12} /> {person.photo ? 'Replace' : 'Upload'} photo
            </button>
            {person.photo && (
              <button className="tbtn" onClick={() => onUpdate({ photo: null })}>Remove</button>
            )}
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field-label">Born</label>
            <input className="field-input" placeholder="e.g. 1948"
              value={person.birth} onChange={(e) => onUpdate({ birth: e.target.value })} />
          </div>
          <div className="field">
            <label className="field-label">Died</label>
            <input className="field-input" placeholder="e.g. 2014"
              value={person.death} onChange={(e) => onUpdate({ death: e.target.value, deceased: e.target.value ? true : person.deceased })} />
          </div>
        </div>

        <div className="deceased-toggle">
          <div>
            <div className="field-label" style={{marginBottom:2}}>In memoriam</div>
            <div style={{fontFamily:'var(--serif)', fontSize:13, color:'var(--ink-2)'}}>Mark as deceased</div>
          </div>
          <div
            className={`toggle ${person.deceased ? 'on' : ''}`}
            onClick={() => onUpdate({ deceased: !person.deceased })}
            role="switch" aria-checked={person.deceased}
          />
        </div>

        <div className="field" style={{marginTop:18}}>
          <label className="field-label">Note</label>
          <textarea className="field-textarea" placeholder="A short remembrance, a story, a fact…"
            value={person.note} onChange={(e) => onUpdate({ note: e.target.value })} />
        </div>

        {/* Relationships */}
        <div className="field">
          <label className="field-label">Relationships</label>
          <div className="rel-list">
            {rel.parents.map(r => <RelLine key={'pa'+r.id} id={r.id} kindLabel="Parent" />)}
            {rel.adoptedParents.map(r => <RelLine key={'ap'+r.id} id={r.id} kindLabel="Adoptive Parent" />)}
            {rel.partners.map(r => <RelLine key={'pt'+r.id} id={r.id} kindLabel="Partner" />)}
            {rel.divorced.map(r => <RelLine key={'dv'+r.id} id={r.id} kindLabel="Separated" />)}
            {rel.children.map(r => <RelLine key={'ch'+r.id} id={r.id} kindLabel="Child" />)}
            {rel.adoptedChildren.map(r => <RelLine key={'ac'+r.id} id={r.id} kindLabel="Adopted Child" />)}
            {rel.siblings.map(s => <RelLine key={'sb'+s.id} id={s.id} kindLabel="Sibling" />)}
            {rel.ties.map(t => (
              <div className="rel-item tie" key={'ti'+t.relId}>
                <input className="rel-tie-input" value={t.label}
                  onChange={(e) => onUpdateRel(t.relId, { label: e.target.value })}
                  placeholder="tie" />
                <span className="rel-name" onClick={() => onSelectPerson(t.id)}>{people[t.id] ? people[t.id].name : ''}</span>
              </div>
            ))}
            {rel.parents.length+rel.partners.length+rel.children.length+rel.siblings.length+rel.divorced.length+rel.adoptedParents.length+rel.adoptedChildren.length + rel.ties.length === 0 && (
              <div style={{fontFamily:'var(--serif)', fontStyle:'italic', color:'var(--ink-3)', fontSize:14, padding:'4px 2px'}}>
                No connections yet. Select this person on the canvas and use + parent, + child, + partner, or link.
              </div>
            )}
          </div>

          <div className="add-rel">
            <button className="tbtn" onClick={() => onAddRel('parent-of')}>
              <Icon name="plus" size={11} /> Add child
            </button>
            <button className="tbtn" onClick={() => onAddRel('child-of')}>
              <Icon name="plus" size={11} /> Add parent
            </button>
            <button className="tbtn" onClick={() => onAddRel('partner')}>
              <Icon name="plus" size={11} /> Add partner
            </button>
          </div>
        </div>

        <div className="delete-row">
          <button className="tbtn danger" onClick={onRemove}>
            <Icon name="trash" size={12} /> Remove this person
          </button>
        </div>
      </div>
    </aside>
  );
}

window.DetailPanel = DetailPanel;
