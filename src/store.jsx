// Lineage Tracker — state & data model
// People + relationships, with auto-layout positions and manual overrides.

const { useState, useEffect, useMemo, useRef, useCallback } = React;

const uid = (() => {
  let n = 0;
  return (p = 'p') => `${p}_${Date.now().toString(36)}_${(n++).toString(36)}`;
})();

const REL_KINDS = {
  parent: { label: 'Parent → Child', cls: 'parent' },
  partner: { label: 'Partner', cls: 'partner' },
  divorced: { label: 'Divorced / Separated', cls: 'divorced partner' },
  adopted: { label: 'Adopted', cls: 'adopted' },
  // sibling is derived; never stored directly
};

function emptyPerson(overrides = {}) {
  return {
    id: uid('p'),
    order: null,
    name: 'Unnamed',
    photo: null,
    birth: '',
    death: '',
    deceased: false,
    note: '',
    // manual position override (null = auto)
    x: null,
    y: null,
    ...overrides,
  };
}

function emptyRel(from, to, kind, label) {
  return { id: uid('r'), from, to, kind, label: label || '' };
}

// ---------- helpers ----------

// Smart capitalize names. Handles spaces, hyphens, apostrophes, Mc/Mac, O',
// keeps lowercase particles (de, la, van, von, etc.) lowercase except at start.
const NAME_PARTICLES = new Set(['de','del','della','di','da','dos','das','la','le','van','von','der','den','du','el','al','bin','ibn','ben','st','ste','of','y']);
function capitalizeName(input) {
  if (!input) return input;
  // collapse runs of whitespace but keep user-typed space at end
  const tokens = input.split(/(\s+)/);
  return tokens.map((tok, idx) => {
    if (/^\s+$/.test(tok)) return tok;
    return tok.split('-').map(part => {
      if (!part) return part;
      // Apostrophe handling: O'Connor, D'Angelo
      if (/^[oOdDlL]'./.test(part)) {
        return part.charAt(0).toUpperCase() + "'" + cap(part.slice(2));
      }
      // McSomething / MacSomething
      const lower = part.toLowerCase();
      if (lower.startsWith('mc') && part.length > 2) {
        return 'Mc' + cap(part.slice(2));
      }
      if (lower.startsWith('mac') && part.length > 3 && !['mack','mace','macy'].includes(lower)) {
        return 'Mac' + cap(part.slice(3));
      }
      // Particles → lowercase unless first non-space token
      const firstTokenIdx = tokens.findIndex(t => !/^\s+$/.test(t));
      if (NAME_PARTICLES.has(lower) && idx !== firstTokenIdx) {
        return lower;
      }
      return cap(part);
    }).join('-');
  }).join('');
}
function cap(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
window.capitalizeName = capitalizeName;

// ---------- main hook ----------
function useLineageStore() {
  const [people, setPeople] = useState({});       // id -> person
  const [rels, setRels] = useState({});           // id -> rel
  const [selectedId, setSelectedId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selfId, setSelfId] = useState(null);     // focal person for kinship terms

  const addPerson = useCallback((overrides = {}) => {
    const p = emptyPerson(overrides);
    setPeople(prev => ({ ...prev, [p.id]: p }));
    setSelfId(prev => prev || p.id); // first person added becomes "self"
    return p;
  }, []);

  const updatePerson = useCallback((id, patch) => {
    setPeople(prev => prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev);
  }, []);

  const removePerson = useCallback((id) => {
    setPeople(prev => {
      const n = { ...prev }; delete n[id]; return n;
    });
    setRels(prev => {
      const n = {};
      for (const r of Object.values(prev)) {
        if (r.from !== id && r.to !== id) n[r.id] = r;
      }
      return n;
    });
    setSelectedId(s => s === id ? null : s);
  }, []);

  const addRel = useCallback((from, to, kind, label) => {
    if (!from || !to || from === to) return null;
    // dedupe: same kind + same unordered pair already exists?
    const exists = Object.values(rels).some(r =>
      r.kind === kind &&
      ((r.from === from && r.to === to) || (r.from === to && r.to === from))
    );
    if (exists) return null;
    const r = emptyRel(from, to, kind, label);
    setRels(prev => ({ ...prev, [r.id]: r }));
    return r;
  }, [rels]);

  const updateRel = useCallback((id, patch) => {
    setRels(prev => prev[id] ? { ...prev, [id]: { ...prev[id], ...patch } } : prev);
  }, []);

  const removeRel = useCallback((id) => {
    setRels(prev => {
      const n = { ...prev }; delete n[id]; return n;
    });
  }, []);

  // helpers: get relationships involving a person, materialize siblings on read
  const getRelations = useCallback((id) => {
    const out = { parents: [], children: [], partners: [], divorced: [], adoptedParents: [], adoptedChildren: [], siblings: [], ties: [] };
    for (const r of Object.values(rels)) {
      if (r.kind === 'parent') {
        if (r.from === id) out.children.push({ id: r.to, relId: r.id });
        if (r.to === id) out.parents.push({ id: r.from, relId: r.id });
      } else if (r.kind === 'adopted') {
        if (r.from === id) out.adoptedChildren.push({ id: r.to, relId: r.id });
        if (r.to === id) out.adoptedParents.push({ id: r.from, relId: r.id });
      } else if (r.kind === 'partner') {
        const other = r.from === id ? r.to : (r.to === id ? r.from : null);
        if (other) out.partners.push({ id: other, relId: r.id });
      } else if (r.kind === 'other') {
        const other = r.from === id ? r.to : (r.to === id ? r.from : null);
        if (other) out.ties.push({ id: other, relId: r.id, label: r.label || 'tie' });
      } else if (r.kind === 'divorced') {
        const other = r.from === id ? r.to : (r.to === id ? r.from : null);
        if (other) out.divorced.push({ id: other, relId: r.id });
      }
    }
    // siblings: shared parent
    const myParents = new Set(out.parents.map(p => p.id).concat(out.adoptedParents.map(p => p.id)));
    const sibs = new Set();
    for (const r of Object.values(rels)) {
      if (r.kind !== 'parent' && r.kind !== 'adopted') continue;
      if (myParents.has(r.from) && r.to !== id) sibs.add(r.to);
    }
    out.siblings = [...sibs].map(sid => ({ id: sid }));
    return out;
  }, [rels]);

  return {
    people, rels,
    setPeople, setRels,
    addPerson, updatePerson, removePerson,
    addRel, removeRel, updateRel,
    getRelations,
    selectedId, setSelectedId,
    panelOpen, setPanelOpen,
    selfId, setSelfId,
  };
}

window.useLineageStore = useLineageStore;
window.REL_KINDS = REL_KINDS;
window.uid = uid;
