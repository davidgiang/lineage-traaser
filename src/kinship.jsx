// Derive kinship terms relative to a "self" person.
// Walks the parent/partner graph to find the closest common ancestor (consanguineal)
// or partner-of-blood-relation (affinal/in-law) and returns a human-readable label.
//
// Algorithm:
// 1. For self, BFS up through parent edges to build a map: ancestorId -> generationsUp.
// 2. For target T, BFS up to find closest ancestor that is also self's ancestor.
//    That gives (a, b) where a = gen from self, b = gen from T to common ancestor.
// 3. Translate (a, b) into label:
//      a=0,b=0 → self
//      a=0,b>0 → child / grandchild / great-grandchild...
//      a>0,b=0 → parent / grandparent / great-grandparent...
//      a=b   → sibling (a=1) / cousin (a=2) / 2nd cousin (a=3)...
//      a<b   → niece/nephew (a=1) / grand-niece (a=2) / etc.
//      a>b   → aunt/uncle (b=1) / great-aunt (b=2) / etc.
// 4. If no consanguineal path: try via partner — e.g. partner of self = "partner",
//    parent of partner = "parent-in-law", partner of sibling = "sibling-in-law".
// 5. Otherwise: "unrelated".

function buildAncestorMap(personId, getRelations) {
  // Map ancestorId -> minimum generations up
  const map = new Map();
  map.set(personId, 0);
  const queue = [[personId, 0]];
  while (queue.length) {
    const [id, gen] = queue.shift();
    const rel = getRelations(id);
    const parents = rel.parents.concat(rel.adoptedParents);
    for (const p of parents) {
      const existing = map.get(p.id);
      if (existing === undefined || existing > gen + 1) {
        map.set(p.id, gen + 1);
        queue.push([p.id, gen + 1]);
      }
    }
  }
  return map;
}

function ordinal(n) {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function greatPrefix(n) {
  // n=0 → '', n=1 → 'great-', n=2 → 'great-great-', etc.
  if (n <= 0) return '';
  if (n === 1) return 'great-';
  if (n === 2) return 'great-great-';
  return `${n}×great-`;
}

// Translate (a=gen from self, b=gen from target) to label.
// Both > 0 unless one is the common ancestor.
function consanguineLabel(a, b) {
  if (a === 0 && b === 0) return 'self';
  if (a === 0) {
    // target is descendant of self
    if (b === 1) return 'child';
    if (b === 2) return 'grandchild';
    return `${greatPrefix(b - 2)}grandchild`;
  }
  if (b === 0) {
    // target is ancestor of self
    if (a === 1) return 'parent';
    if (a === 2) return 'grandparent';
    return `${greatPrefix(a - 2)}grandparent`;
  }
  if (a === b) {
    if (a === 1) return 'sibling';
    if (a === 2) return 'cousin';
    return `${ordinal(a - 1)} cousin`;
  }
  // a !== b, both > 0
  const removed = Math.abs(a - b);
  if (a > b) {
    // self is further from common ancestor → target is on aunt/uncle side
    // b=1 → aunt/uncle; b=2 → grand-aunt/uncle; etc.
    const base = b === 1 ? 'aunt/uncle' : `${greatPrefix(b - 1)}aunt/uncle`;
    if (a - b === 1) return base; // direct aunt/uncle of self level
    // For higher cousin-removal scenarios, fall back to "Nth cousin M removed"
    if (b >= 2) {
      return `${ordinal(b)} cousin ${removed}× removed`;
    }
    return base;
  }
  // a < b → target is niece/nephew side
  if (a === 1) {
    if (b === 2) return 'niece/nephew';
    return `${greatPrefix(b - 2)}niece/nephew`;
  }
  // a >= 2: cousin once/twice removed downward
  return `${ordinal(a)} cousin ${removed}× removed`;
}

// Build map of implicit partners — anyone who shares a child is treated as a partner.
function buildImplicitPartners(getRelations, allIds) {
  const map = new Map();
  if (!allIds) return map;
  for (const cid of allIds) {
    const rel = getRelations(cid);
    const parents = rel.parents.concat(rel.adoptedParents).map(p => p.id);
    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        const a = parents[i], b = parents[j];
        if (!map.has(a)) map.set(a, new Set());
        if (!map.has(b)) map.set(b, new Set());
        map.get(a).add(b);
        map.get(b).add(a);
      }
    }
  }
  return map;
}

// Main entry: returns label string, or null if cannot derive.
function deriveKinship(targetId, selfId, getRelations, allIds) {
  if (!selfId || !targetId) return null;
  if (targetId === selfId) return 'self';

  const implicit = buildImplicitPartners(getRelations, allIds);

  // Direct partner / divorced check (explicit + implicit co-parent)
  const selfRel = getRelations(selfId);
  if (selfRel.partners.some(p => p.id === targetId)) return 'partner';
  if (selfRel.divorced.some(p => p.id === targetId)) return 'ex-partner';
  if (implicit.get(selfId)?.has(targetId)) return 'partner';

  // 1. Try consanguineal: find common ancestor.
  const selfAncestors = buildAncestorMap(selfId, getRelations);
  const targetAncestors = buildAncestorMap(targetId, getRelations);

  let best = null; // { a, b, ancestor }
  for (const [aId, b] of targetAncestors) {
    const a = selfAncestors.get(aId);
    if (a === undefined) continue;
    if (!best || (a + b) < (best.a + best.b) || ((a + b) === (best.a + best.b) && Math.abs(a - b) < Math.abs(best.a - best.b))) {
      best = { a, b, ancestor: aId };
    }
  }
  if (best) {
    return consanguineLabel(best.a, best.b);
  }

  // 2. Try affinal (in-law): target = partner of a blood relative, OR target's blood relative is self's partner.
  // 2a. target is partner of someone X; if X is blood relative of self → in-law term.
  const targetRel = getRelations(targetId);
  const targetPartners = targetRel.partners.concat(targetRel.divorced);
  for (const tp of targetPartners) {
    const label = deriveKinship(tp.id, selfId, getRelations);
    if (!label || label === 'unrelated' || label === 'self') continue;
    // Map "sibling" → "sibling-in-law", "parent" → "parent-in-law", "child" → "child-in-law"
    if (label === 'sibling') return 'sibling-in-law';
    if (label === 'parent') return 'parent-in-law';
    if (label === 'child') return 'child-in-law';
    if (label === 'grandparent') return 'grandparent-in-law';
    if (label === 'grandchild') return 'grandchild-in-law';
    if (label.endsWith('aunt/uncle')) return label + ' (by marriage)';
    if (label.includes('niece/nephew')) return label + ' (by marriage)';
    if (label.includes('cousin')) return label + ' (by marriage)';
    return label + ' (by marriage)';
  }

  // 2b. target is blood relative of self's partner → step / in-law
  for (const sp of selfRel.partners.concat(selfRel.divorced)) {
    const label = deriveKinship(targetId, sp.id, getRelations);
    if (!label || label === 'unrelated' || label === 'self') continue;
    if (label === 'parent') return 'parent-in-law';
    if (label === 'sibling') return 'sibling-in-law';
    if (label === 'child') return 'step-child';
    if (label === 'grandparent') return 'grandparent-in-law';
    if (label === 'grandchild') return 'step-grandchild';
    return label + ' (in-law)';
  }

  return 'unrelated';
}

window.deriveKinship = deriveKinship;
