// Save / load the tree. JSON round-trips everything; GEDCOM 5.5.1 is for other genealogy apps.

function downloadFile(name, text, type) {
  const blob = new Blob([text], { type: type + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10); // filenames only
// GEDCOM DATE_EXACT is DD MMM YYYY — never ISO.
const GED_MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const gedDate = (d = new Date()) => `${String(d.getDate()).padStart(2, '0')} ${GED_MONTHS[d.getMonth()]} ${d.getFullYear()}`;

function exportJSON(people, rels, selfId) {
  downloadFile(`lineage-${stamp()}.json`, JSON.stringify({
    format: 'lineage-tree', version: 1, exported: new Date().toISOString(),
    selfId, people, rels,
  }, null, 2), 'application/json');
}

// GEDCOM needs families, not edges: group children by their exact parent set, then fold in
// childless couples so partners still round-trip.
function buildFamilies(people, rels) {
  const parentsOf = {}, partners = [];
  // Adoption must survive the trip: a child adopted into a family gets PEDI adopted rather
  // than a bare CHIL/FAMC, which importers read as a birth link.
  const adoptedInto = {};
  for (const id of Object.keys(people)) { parentsOf[id] = []; adoptedInto[id] = new Set(); }
  for (const r of Object.values(rels)) {
    if (r.kind === 'parent' || r.kind === 'adopted') {
      if (people[r.from] && people[r.to]) {
        parentsOf[r.to].push(r.from);
        if (r.kind === 'adopted') adoptedInto[r.to].add(r.from);
      }
    } else if (r.kind === 'partner' || r.kind === 'divorced') {
      if (people[r.from] && people[r.to]) partners.push([r.from, r.to, r.kind]);
    }
  }
  const fams = new Map();
  const keyFor = (ids) => ids.slice().sort().join('|');
  for (const id of Object.keys(people)) {
    if (!parentsOf[id].length) continue;
    const k = keyFor(parentsOf[id]);
    if (!fams.has(k)) fams.set(k, { spouses: parentsOf[id].slice().sort(), children: [], adopted: new Set(), adoptedBy: {}, divorced: false });
    const fam = fams.get(k);
    fam.children.push(id);
    if (adoptedInto[id].size) {
      // PEDI is a property of the whole FAMC link, so it can only state "adopted by all".
      if (parentsOf[id].every(pid => adoptedInto[id].has(pid))) fam.adopted.add(id);
      // Step-parent adoption (adopted by one spouse, born to the other) needs the ADOP event.
      fam.adoptedBy[id] = fam.spouses.filter(pid => adoptedInto[id].has(pid));
    }
  }
  for (const [a, b, kind] of partners) {
    const k = keyFor([a, b]);
    if (!fams.has(k)) fams.set(k, { spouses: [a, b].sort(), children: [], adopted: new Set(), adoptedBy: {}, divorced: kind === 'divorced' });
    else if (kind === 'divorced') fams.get(k).divorced = true;
  }
  return fams;
}

function exportGEDCOM(people, rels) {
  const ids = Object.keys(people);
  const xref = {}; ids.forEach((id, i) => { xref[id] = 'I' + (i + 1); });
  const fams = buildFamilies(people, rels);
  const famList = [...fams.values()];
  const famXref = new Map(); famList.forEach((f, i) => famXref.set(f, 'F' + (i + 1)));

  const L = [];
  L.push('0 HEAD', '1 SOUR Lineage', '2 NAME Lineage Tracker', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', `1 DATE ${gedDate()}`);

  for (const id of ids) {
    const p = people[id];
    L.push(`0 @${xref[id]}@ INDI`);
    const parts = String(p.name || '').trim().split(/\s+/);
    const surname = parts.length > 1 ? parts.pop() : '';
    L.push(`1 NAME ${parts.join(' ')} /${surname}/`);
    if (p.birth) { L.push('1 BIRT', `2 DATE ${p.birth}`); }
    // 'Y' asserts the event with no detail, so it is only correct when no date follows.
    if (p.death) { L.push('1 DEAT', `2 DATE ${p.death}`); }
    else if (p.deceased) { L.push('1 DEAT Y'); }
    if (p.note) L.push(`1 NOTE ${String(p.note).replace(/\n/g, ' ')}`);
    for (const f of famList) {
      if (f.spouses.includes(id)) L.push(`1 FAMS @${famXref.get(f)}@`);
      if (f.children.includes(id)) {
        L.push(`1 FAMC @${famXref.get(f)}@`);
        if (f.adopted.has(id)) L.push('2 PEDI adopted');
        const by = f.adoptedBy[id];
        if (by && by.length) {
          // HUSB/WIFE follow the FAM's own spouse order; BOTH when every parent adopted.
          const which = by.length === f.spouses.length && f.spouses.length > 1 ? 'BOTH'
            : (f.spouses.indexOf(by[0]) === 0 ? 'HUSB' : 'WIFE');
          L.push('1 ADOP', `2 FAMC @${famXref.get(f)}@`, `3 ADOP ${which}`);
        }
      }
    }
  }

  for (const f of famList) {
    L.push(`0 @${famXref.get(f)}@ FAM`);
    f.spouses.forEach((s, i) => L.push(`1 ${i === 0 ? 'HUSB' : 'WIFE'} @${xref[s]}@`));
    if (f.divorced) L.push('1 DIV Y');
    f.children.forEach(c => L.push(`1 CHIL @${xref[c]}@`));
  }

  L.push('0 TRLR');
  downloadFile(`lineage-${stamp()}.ged`, L.join('\n'), 'text/plain');
}

function importJSON(file, onLoad, onError) {
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d || !d.people || !d.rels) throw new Error('Not a Lineage export');
      onLoad(d);
    } catch (e) { onError(e.message || 'Could not read that file'); }
  };
  rd.onerror = () => onError('Could not read that file');
  rd.readAsText(file);
}

Object.assign(window, { exportJSON, exportGEDCOM, importJSON });
