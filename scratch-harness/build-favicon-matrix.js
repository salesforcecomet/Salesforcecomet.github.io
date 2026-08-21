// Render the real per-page favicons (via colored-favicon.js) for a matrix of
// tool pages so we can visually confirm each browser-tab glyph in org color.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const cf = fs.readFileSync(path.join(ROOT, 'src/colored-favicon.js'), 'utf8');

const samples = [
  ['data-export.html', 'Data Export'],
  ['data-import.html', 'Data Import'],
  ['org-limits.html', 'Org Limits'],
  ['metadata-exporter.html', 'Metadata Exporter'],
  ['rest-explorer.html', 'REST Explorer'],
  ['graphql-explorer.html', 'GraphQL Explorer'],
  ['record-clone.html', 'Record Clone'],
  ['bulk-permission-wizard.html', 'Bulk Permission Wizard'],
  ['code-coverage.html', 'Code Coverage'],
  ['event-monitor.html', 'Event Monitor'],
  ['log-viewer.html', 'Log Viewer'],
  ['anonymous-apex.html', 'Anonymous Apex'],
  ['automation-cascade.html', 'Automation Cascade'],
  ['api-statistics.html', 'API Statistics'],
  ['record-viewer.html', 'Record Viewer'],
  ['bulk-field-builder.html', 'Bulk Field Builder'],
  ['code-editor.html', 'Code Editor'],
  ['data-builder.html', 'Data Builder'],
  ['diff-checker.html', 'Diff Checker']
];

const glyphs = samples.map(([file, label]) => {
  const html = fs.readFileSync(path.join(ROOT, 'src', file), 'utf8');
  const m = html.match(/window\.__sfarcFaviconPaths = (\[[^\n]*\]);/);
  return { label, paths: m ? JSON.parse(m[1]) : null };
});

const cards = glyphs.map((g, i) => `
  <div class="card" style="animation-delay: ${i * 0.03}s">
    <div class="cell" id="cell-${i}" data-paths='${JSON.stringify(g.paths || [])}'><img width="32" height="32"></div>
    <div class="lbl">${g.label}</div>
  </div>`).join('');

const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Per-Tool Browser Favicons (org color)</title>
<style>
  body { background: #101216; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; padding: 24px; }
  h2 { color: #f8fafc; margin: 0 0 4px; font-size: 16px; }
  .sub { color: #94a3b8; font-size: 12px; margin-bottom: 18px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; max-width: 900px; }
  .card { background: #1b1e24; border: 1px solid #2a2e37; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; align-items: center; gap: 8px; animation: in .4s ease both; }
  .cell { width: 44px; height: 44px; border-radius: 8px; background: #23272f; display: flex; align-items: center; justify-content: center; }
  .lbl { font-size: 11px; color: #cbd5e1; text-align: center; }
  @keyframes in { from { opacity: 0; transform: translateY(6px); } }
  button { margin-bottom: 16px; padding: 6px 12px; border-radius: 8px; border: 1px solid #333; background: #1e2024; color: #e2e8f0; cursor: pointer; font-size: 12px; }
</style>
</head>
<body>
<h2>Browser-tab favicons — each tool's glyph in the org color</h2>
<div class="sub">colored-favicon.js renders these when each page opens in a new tab (e.g. ?host=…)</div>
<button onclick="cycle()">Cycle org color</button>
<div class="grid">${cards}</div>
<script>${cf}</script>
<script>
  const colors = ['#38bdf8', '#f472b6', '#4ade80', '#facc15', '#a78bfa'];
  let ci = 0;
  function cycle() {
    ci = (ci + 1) % colors.length;
    document.documentElement.style.setProperty('--sfarc-org-color', colors[ci]);
    render();
  }
  function render() {
    document.querySelectorAll('.cell').forEach(cell => {
      const paths = JSON.parse(cell.dataset.paths);
      if (!paths || !paths.length) return;
      const color = getComputedStyle(document.documentElement).getPropertyValue('--sfarc-org-color').trim() || '#38bdf8';
      const dot = '';
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">' +
        paths.map(d => '<path d="' + d + '" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>').join('') + dot + '</svg>';
      cell.querySelector('img').src = 'data:image/svg+xml;base64,' + btoa(svg);
    });
  }
  document.documentElement.style.setProperty('--sfarc-org-color', colors[0]);
  render();
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, 'favicon-matrix.html'), out);
console.log('wrote scratch-harness/favicon-matrix.html (' + glyphs.filter(g => g.paths).length + ' glyphs)');
