// Dev-only sanity test for the getVisibleCommands optimization in main.js:
// precomputed lowercased _searchKey + stable filter (no per-keystroke sort).
const commands = [
  { id: 'objects', name: 'Search Objects', category: '', features: 'Data, Fields, Schema' },
  { id: 'code-search', name: 'Global Code Search', category: 'Developer Tools', features: 'Apex, LWC, Search' },
  { id: 'lwc', name: 'Lightning Web Components', category: 'Developer Tools', features: 'LWC, JS, XML' },
  { id: 'org', name: 'Org Details', features: 'Limits, Version, Namespace' }
];
// Same as sfarcRefreshCommandSearchKeys()
for (const c of commands) c._searchKey = `${c.name || ''} ${c.category || ''} ${c.features || ''}`.toLowerCase();
commands.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

function getVisibleCommands(query, currentSearchMode) {
  let vis = commands;
  if (currentSearchMode === 'features') {
    vis = vis.filter(c => !c.isShortcut && (!c.url || c.url.startsWith('sfi:')));
  } else if (currentSearchMode === 'shortcuts') {
    vis = vis.filter(c => !!c.isShortcut || (c.url && !c.url.startsWith('sfi:')));
  }
  if (query) {
    const q = query.toLowerCase();
    vis = vis.filter(c => c._searchKey.includes(q));
  }
  return [...vis]; // defensive copy, no re-sort
}

let failures = 0;
const assert = (cond, msg) => {
  if (cond) console.log('PASS:', msg);
  else { failures++; console.error('FAIL:', msg); }
};

let r = getVisibleCommands('apex', 'features');
assert(r.length === 1 && r[0].id === 'code-search', "'apex' in features mode -> Global Code Search");

r = getVisibleCommands('LWC', 'features');
assert(r.length === 2 && r[0].id === 'code-search' && r[1].id === 'lwc', "'LWC' matches features + name, A-Z order preserved (no re-sort)");

r = getVisibleCommands('', 'features');
assert(r.length === 4, 'empty query returns all');
assert(r.map(c => c.name).join('|') === 'Global Code Search|Lightning Web Components|Org Details|Search Objects', 'stable A-Z order retained');

r = getVisibleCommands('developer tools', 'features');
assert(r.length === 2, "'developer tools' matches category");

r = getVisibleCommands('schema', 'features');
assert(r.length === 1 && r[0].id === 'objects', "'schema' matches features of Search Objects");

r = getVisibleCommands('org', 'features');
assert(r.length === 1 && r[0].id === 'org', "'org' matches Org Details by name");

// Mode filter still composes: nothing is a shortcut in this fixture
r = getVisibleCommands('', 'shortcuts');
assert(r.length === 0, "'shortcuts' mode with no shortcuts -> empty");

process.exit(failures === 0 ? 0 : 1);
