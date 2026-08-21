// Builds scratch-harness/excel-glass-preview.html — renders the REAL Excel Tools
// toolbar markup (from data-import.js) with the REAL data-import.css, over a
// colorful gradient table background so the glassmorphism blur is visible.
const fs = require('fs');
const path = require('path');

const cssFiles = [
  'src/styles/slds/slds.css',
  'src/button.css',
  'src/styles/sfir.css',
  'src/data-load.css',
  'src/data-import.css',
  'src/glass-toast.css',
  'src/custom-dropdown.css',
  'src/controls.css'
];
const css = cssFiles
  .map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(__dirname, '..', f), 'utf8'))
  .join('\n');

// Excel Tools toolbar markup matching data-import.js render()
const toolbar = `
<div class="sfarc-excel-toolbar" style="position:fixed; top:120px; right:40px;">
  <div class="sfarc-excel-toolbar-header" title="Drag to move">
    <span class="sfarc-excel-grip" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
    </span>
    <span class="sfarc-excel-toolbar-title">Excel Tools</span>
    <span class="sfarc-excel-count">3 selected</span>
    <button class="sfarc-excel-close" title="Close Excel Tools">×</button>
  </div>
  <div class="sfarc-excel-body">
    <div class="sfarc-excel-section">
      <div class="sfarc-excel-section-title">Edit cell</div>
      <div class="sfarc-excel-row">
        <input type="number" min="1" class="sfarc-excel-input" value="1">
        <select class="sfarc-excel-select"><option>AccountSource</option></select>
      </div>
      <div class="sfarc-excel-row">
        <input type="text" class="sfarc-excel-input wide" placeholder="New value">
        <button class="sfarc-excel-btn primary">Apply</button>
      </div>
    </div>
    <div class="sfarc-excel-section">
      <div class="sfarc-excel-section-title">Bulk update column</div>
      <div class="sfarc-excel-row">
        <select class="sfarc-excel-select"><option>AccountSource</option></select>
        <select class="sfarc-excel-select sfarc-excel-scope"><option>All rows</option></select>
      </div>
      <div class="sfarc-excel-row">
        <input type="text" class="sfarc-excel-input wide" placeholder="New value">
        <button class="sfarc-excel-btn primary">Apply</button>
      </div>
    </div>
    <div class="sfarc-excel-section">
      <div class="sfarc-excel-section-title">Delete rows</div>
      <div class="sfarc-excel-row">
        <input type="text" class="sfarc-excel-input wide" placeholder="e.g. 2,5,8-12">
        <button class="sfarc-excel-btn danger">Delete</button>
      </div>
    </div>
    <div class="sfarc-excel-section">
      <div class="sfarc-excel-section-title">Delete column</div>
      <div class="sfarc-excel-row">
        <select class="sfarc-excel-select"><option>AccountSource</option></select>
        <button class="sfarc-excel-btn danger">Delete</button>
      </div>
    </div>
    <div class="sfarc-excel-tip">Tip: click a cell to select its row · Ctrl/Cmd+click to multi-select rows</div>
  </div>
</div>
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Excel Tools — Glassmorphism</title>
<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .bg { position: fixed; inset: 0; z-index: 0;
    background:
      radial-gradient(circle at 20% 30%, rgba(33, 150, 243, 0.55), transparent 55%),
      radial-gradient(circle at 75% 20%, rgba(139, 92, 246, 0.5), transparent 55%),
      radial-gradient(circle at 30% 80%, rgba(16, 185, 129, 0.5), transparent 55%),
      radial-gradient(circle at 85% 75%, rgba(245, 158, 11, 0.5), transparent 55%),
      linear-gradient(135deg, #0f172a, #1e293b);
  }
  table.grid { position: absolute; top: 24px; left: 24px; border-collapse: collapse; background: rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden; }
  table.grid th, table.grid td { border: 1px solid rgba(255,255,255,0.15); padding: 8px 14px; font-size: 12px; color: #e2e8f0; }
  table.grid th { background: rgba(255,255,255,0.1); font-weight: 600; color: #fff; }
</style>
<style>${css}</style>
</head>
<body>
<div class="bg"></div>
<table class="grid">
  <tr><th>Account Name</th><th>BillingAddress.city</th><th>Status</th></tr>
  <tr><td>Institution A</td><td>Lexington</td><td>Active</td></tr>
  <tr><td>Jussie Corp</td><td>Michigan Ave</td><td>Pending</td></tr>
  <tr><td>5th Avenue Co</td><td>Manhattan</td><td>Active</td></tr>
  <tr><td>Euclid Lane</td><td>Cleveland</td><td>Inactive</td></tr>
  <tr><td>Park Row 17</td><td>Brooklyn</td><td>Active</td></tr>
</table>
${toolbar}
</body>
</html>
`;

const out = path.join(__dirname, 'excel-glass-preview.html');
fs.writeFileSync(out, html);
console.log('Wrote ' + out);
