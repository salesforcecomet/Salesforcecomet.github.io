// Builds scratch-harness/pagination-preview.html: inlines the REAL
// src/inspector.css and renders the debug-log toolbar (delete button in its
// sfarc-debug-btn-group) plus the pagination bar (prev/next also wrapped in
// sfarc-debug-btn-group). The theme class is toggled on #sfarc-panel exactly
// like theme-manager does, and computed styles are compared.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/inspector.css'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Pagination vs delete button — background comparison</title>
<style>
  body { background: #eef1f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 30px; }
  .panel { background: #fff; border: 1px solid #d7dde4; border-radius: 10px; padding: 14px; max-width: 420px; transition: background 0.2s; }
  .pagination { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; margin-top: 12px; background: #f4f6f8; border-top: 1px solid #d7dde4; border-radius: 0 0 10px 10px; transition: background 0.2s; }
  .pagination-controls { display: flex; align-items: center; gap: 8px; }
  .page-info { font-size: 12px; color: #55657a; }
  button.toggle { margin-bottom: 14px; padding: 6px 14px; border-radius: 6px; border: 1px solid #cdd4dd; background: #fff; cursor: pointer; font-size: 12px; }
  pre { font: 11px ui-monospace, Menlo, monospace; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-top: 14px; white-space: pre-wrap; }
</style>
<style>${css}</style>
</head>
<body>
<button class="toggle" id="toggle">Toggle dark theme</button>
<div class="panel" id="sfarc-panel">
  <div style="display:flex; gap:4px; align-items:center; padding:8px;">
    <div class="sfarc-debug-btn-group sfarc-danger">
      <button class="sfarc-debug-icon-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
    </div>
  </div>
  <div class="pagination">
    <div>
      <select style="height:28px; border:1px solid #d0d0d0; border-radius:6px; padding:0 8px; font-size:12px;"><option>15</option></select>
    </div>
    <div class="pagination-controls">
      <div class="sfarc-debug-btn-group">
        <button class="sfarc-debug-icon-btn" disabled><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7 1L3 5L7 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
      <span class="page-info">Page 1 of 5</span>
      <div class="sfarc-debug-btn-group">
        <button class="sfarc-debug-icon-btn"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 1L7 5L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
    </div>
  </div>
</div>
<pre id="out">measuring…</pre>
<script>
  function measure() {
    const panel = document.getElementById('sfarc-panel');
    const theme = panel.classList.contains('sfarc-dark-theme') ? 'DARK' : 'LIGHT';
    const btn = panel.querySelector('.sfarc-debug-btn-group.sfarc-danger .sfarc-debug-icon-btn');
    const prevGrp = panel.querySelector('.pagination-controls .sfarc-debug-btn-group');
    const prevBtn = prevGrp.querySelector('button');
    const gs = getComputedStyle(prevGrp), bs = getComputedStyle(prevBtn);
    return theme + ' | delete btn: ' + getComputedStyle(btn).backgroundColor + ' | prev group bg: ' + gs.backgroundColor +
      ' | prev btn bg: ' + bs.backgroundColor + ' border: ' + bs.borderTopWidth + ' | size: ' +
      Math.round(prevBtn.getBoundingClientRect().width) + 'x' + Math.round(prevBtn.getBoundingClientRect().height);
  }
  document.getElementById('toggle').addEventListener('click', () => {
    const p = document.getElementById('sfarc-panel');
    p.classList.toggle('sfarc-dark-theme');
    document.getElementById('out').textContent = measure();
  });
  setTimeout(() => { document.getElementById('out').textContent = measure(); }, 80);
  window.__measure = measure;
<\/script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'scratch-harness/pagination-preview.html'), html);
console.log('Wrote scratch-harness/pagination-preview.html (' + html.length + ' bytes)');
