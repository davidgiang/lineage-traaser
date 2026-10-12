// Auto-layout: assign generations top→bottom, partners side-by-side, siblings spaced.
// Returns {positions: {id: {x,y,gen}}, bounds}

const BUBBLE_W = 184;
const BUBBLE_H = 78;
const GEN_GAP = 150;     // vertical between generations
const SIB_GAP = 36;      // horizontal between siblings
const PARTNER_GAP = 28;  // horizontal between partners
const FAMILY_GAP = 80;   // horizontal between separate families

function computeAutoLayout(people, rels) {
  const ids = Object.keys(people);
  if (ids.length === 0) return { positions: {}, bounds: { w: 0, h: 0 } };

  // Build adjacency
  const parentsOf = {};   // id -> [parent ids]
  const childrenOf = {};  // id -> [child ids]
  const partnersOf = {};  // id -> [partner ids]
  for (const id of ids) { parentsOf[id] = []; childrenOf[id] = []; partnersOf[id] = []; }
  for (const r of Object.values(rels)) {
    if (r.kind === 'parent' || r.kind === 'adopted') {
      if (people[r.from] && people[r.to]) {
        childrenOf[r.from].push(r.to);
        parentsOf[r.to].push(r.from);
      }
    } else if (r.kind === 'partner' || r.kind === 'divorced') {
      if (people[r.from] && people[r.to]) {
        partnersOf[r.from].push(r.to);
        partnersOf[r.to].push(r.from);
      }
    }
  }
  // Implicit partners: anyone who shares a child is treated as a partner for layout/clustering.
  for (const cid of ids) {
    const par = parentsOf[cid];
    for (let i = 0; i < par.length; i++) {
      for (let j = i + 1; j < par.length; j++) {
        const a = par[i], b = par[j];
        if (!partnersOf[a].includes(b)) partnersOf[a].push(b);
        if (!partnersOf[b].includes(a)) partnersOf[b].push(a);
      }
    }
  }

  // Generation assignment.
  // Partners (explicit or implied by a shared child) must share a generation, so solve over
  // "units" — a person plus everyone they are partnered with — instead of individuals.
  // Otherwise an in-law with no parents of their own lands on the root row.
  const unit = {};                       // id -> unit root id (union-find)
  const find = (x) => { while (unit[x] !== x) { unit[x] = unit[unit[x]]; x = unit[x]; } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) unit[ra] = rb; };
  for (const id of ids) unit[id] = id;
  for (const id of ids) for (const p of partnersOf[id]) union(id, p);

  // unit-level parent edges
  const unitParents = {};
  for (const id of ids) unitParents[find(id)] = unitParents[find(id)] || new Set();
  for (const id of ids) {
    for (const p of parentsOf[id]) {
      const cu = find(id), pu = find(p);
      if (cu !== pu) unitParents[cu].add(pu);
    }
  }
  // longest-path relaxation (bounded, so cycles can't hang)
  const unitGen = {};
  for (const u of Object.keys(unitParents)) unitGen[u] = 0;
  for (let pass = 0; pass < Object.keys(unitParents).length + 1; pass++) {
    let changed = false;
    for (const u of Object.keys(unitParents)) {
      for (const pu of unitParents[u]) {
        if (unitGen[u] < unitGen[pu] + 1) { unitGen[u] = unitGen[pu] + 1; changed = true; }
      }
    }
    if (!changed) break;
  }
  const gen = {};
  for (const id of ids) gen[id] = unitGen[find(id)] ?? 0;

  // Group by generation
  const byGen = {};
  for (const id of ids) {
    (byGen[gen[id]] = byGen[gen[id]] || []).push(id);
  }
  const gens = Object.keys(byGen).map(Number).sort((a,b)=>a-b);

  // For each generation, order: try to keep partners adjacent, siblings adjacent.
  // Strategy: walk top→bottom. Place top gen by family clusters. Then place each
  // subsequent gen by averaging parents' positions.

  // Initial cluster build for top generation: family units (a person + partners + ungrouped roots)
  const positions = {}; // id -> {x,y}
  let cursorX = 0;

  function placeTopUnit(seedId, placed) {
    const cluster = [];
    const seen = new Set();
    const stack = [seedId];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id) || placed.has(id)) continue;
      seen.add(id);
      cluster.push(id);
      for (const p of partnersOf[id]) if (!placed.has(p)) stack.push(p);
    }
    // Place horizontally
    for (let i = 0; i < cluster.length; i++) {
      positions[cluster[i]] = { x: cursorX + i * (BUBBLE_W + PARTNER_GAP), y: 0 };
      placed.add(cluster[i]);
    }
    cursorX += cluster.length * (BUBBLE_W + PARTNER_GAP) + FAMILY_GAP;
  }

  if (gens.length) {
    const placed = new Set();
    const topGen = byGen[gens[0]];
    for (const id of topGen) {
      if (placed.has(id)) continue;
      placeTopUnit(id, placed);
    }
  }

  // Subsequent gens
  for (let gi = 1; gi < gens.length; gi++) {
    const g = gens[gi];
    const ids = byGen[g];
    // Group into family units (same parent set or partner with same)
    const placed = new Set();
    let xCursor = 0;

    // Sort by parents' avg x so siblings cluster, then within a sibling group by:
    // explicit manual order → birth year (only once a full 4-digit year is typed, so the
    // row doesn't reshuffle mid-keystroke) → creation order.
    const yearOf = (id) => {
      const y = parseInt(String(people[id].birth || '').trim(), 10);
      return (isFinite(y) && y >= 1000) ? y : Infinity;
    };
    const desired = ids.map((id, i) => {
      const par = parentsOf[id];
      const avg = par.length ? par.reduce((s,p)=>s+(positions[p]?.x ?? 0),0)/par.length : Infinity;
      return { id, key: avg, seq: i };
    }).sort((a, b) => {
      if (a.key !== b.key) return a.key - b.key;
      const oa = people[a.id].order, ob = people[b.id].order;
      if (oa != null && ob != null && oa !== ob) return oa - ob;
      if (oa != null && ob == null) return -1;
      if (ob != null && oa == null) return 1;
      const ya = yearOf(a.id), yb = yearOf(b.id);
      if (ya !== yb) return ya - yb;
      return a.seq - b.seq;
    });

    for (const { id } of desired) {
      if (placed.has(id)) continue;
      // Build a cluster: this person + partners (any not yet placed in this gen)
      const cluster = [id];
      placed.add(id);
      for (const pid of partnersOf[id]) {
        if (gen[pid] === g && !placed.has(pid)) {
          cluster.push(pid);
          placed.add(pid);
        }
      }
      // Compute desired x = average of all members' parents' x; fallback to xCursor
      let desiredX = xCursor;
      const parentXs = [];
      for (const cid of cluster) {
        for (const pid of parentsOf[cid]) {
          if (positions[pid]) parentXs.push(positions[pid].x);
        }
      }
      if (parentXs.length) {
        const avg = parentXs.reduce((s,x)=>s+x,0)/parentXs.length;
        // center cluster on avg
        const clusterWidth = cluster.length * BUBBLE_W + (cluster.length - 1) * PARTNER_GAP;
        desiredX = avg + (BUBBLE_W/2) - (clusterWidth/2);
      }
      // Avoid overlap with already-placed siblings on this row
      desiredX = Math.max(desiredX, xCursor);
      for (let i = 0; i < cluster.length; i++) {
        positions[cluster[i]] = { x: desiredX + i * (BUBBLE_W + PARTNER_GAP), y: g * (BUBBLE_H + GEN_GAP) };
      }
      const clusterRight = desiredX + cluster.length * BUBBLE_W + (cluster.length - 1) * PARTNER_GAP;
      xCursor = clusterRight + SIB_GAP;
    }
  }

  // Bottom-up pass: pull each couple back over the middle of their children, so a parent
  // sits above the centre of the sibling row instead of above its leftmost child.
  for (let gi = gens.length - 2; gi >= 0; gi--) {
    const row = byGen[gens[gi]].filter(id => positions[id]);
    if (!row.length) continue;
    // clusters = partners kept together, ordered left→right
    const seen = new Set();
    const clusters = [];
    for (const id of row.slice().sort((a, b) => positions[a].x - positions[b].x)) {
      if (seen.has(id)) continue;
      const members = [id];
      seen.add(id);
      for (const p of partnersOf[id]) {
        if (gen[p] === gens[gi] && positions[p] && !seen.has(p)) { members.push(p); seen.add(p); }
      }
      members.sort((a, b) => positions[a].x - positions[b].x);
      const kidBoxes = [];
      for (const m of members) {
        for (const c of childrenOf[m]) if (positions[c]) kidBoxes.push(positions[c].x);
      }
      const width = members.length * BUBBLE_W + (members.length - 1) * PARTNER_GAP;
      const desiredX = kidBoxes.length
        ? (Math.min(...kidBoxes) + Math.max(...kidBoxes) + BUBBLE_W) / 2 - width / 2
        : positions[members[0]].x;
      clusters.push({ members, width, desiredX });
    }
    // sweep left→right, keeping clusters from colliding
    clusters.sort((a, b) => a.desiredX - b.desiredX);
    let cursor = -Infinity;
    for (const cl of clusters) {
      const x = Math.max(cl.desiredX, cursor);
      cl.members.forEach((m, i) => { positions[m].x = x + i * (BUBBLE_W + PARTNER_GAP); });
      cursor = x + cl.width + FAMILY_GAP;
    }
  }

  // Compute bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const id of Object.keys(positions)) {
    const { x, y } = positions[id];
    if (x < minX) minX = x;
    if (x + BUBBLE_W > maxX) maxX = x + BUBBLE_W;
    if (y < minY) minY = y;
    if (y + BUBBLE_H > maxY) maxY = y + BUBBLE_H;
  }
  if (!isFinite(minX)) { minX = 0; maxX = 0; minY = 0; maxY = 0; }
  // Shift to start at 0
  for (const id of Object.keys(positions)) {
    positions[id].x -= minX;
    positions[id].y -= minY;
    positions[id].gen = gen[id];
  }
  return {
    positions,
    bounds: { w: maxX - minX, h: maxY - minY },
  };
}

// resolved positions: manual override wins over auto, unless forceAuto.
function resolvePositions(people, autoPositions, forceAuto = false) {
  const out = {};
  for (const id of Object.keys(people)) {
    const p = people[id];
    const auto = autoPositions[id] || { x: 0, y: 0, gen: 0 };
    out[id] = {
      x: forceAuto ? auto.x : (p.x ?? auto.x),
      y: forceAuto ? auto.y : (p.y ?? auto.y),
      gen: auto.gen ?? 0,
    };
  }
  return out;
}

window.computeAutoLayout = computeAutoLayout;
window.resolvePositions = resolvePositions;
window.LAYOUT_CONST = { BUBBLE_W, BUBBLE_H, GEN_GAP, SIB_GAP, PARTNER_GAP, FAMILY_GAP };
