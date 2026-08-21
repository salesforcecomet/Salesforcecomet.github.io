#!/usr/bin/env node
// Builds scratch-harness/import-actions-real.html from ALL the real
// stylesheets data-import.html loads, in the exact same order, with the exact
// action-bar markup from data-import.js. The earlier harness only inlined
// data-import.css — controls.css (loaded last, with !important) was overriding
// the label-button width, which the preview never showed. This harness loads
// the complete cascade so the preview matches Chrome exactly.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const order = [
    'button.css',
    'data-load.css',
    'styles/slds/slds.css',
    'styles/sfir.css',
    'custom-dropdown.css',
    'data-import.css',
    'glass-toast.css',
    'controls.css'
];

const cssBlocks = order.map(f => {
    const full = path.join(root, 'src', f);
    const css = fs.readFileSync(full, 'utf8');
    return `/* ==== ${f} ==== */\n${css}`;
}).join('\n\n');

// Exact action-bar markup (from data-import.js ~line 2414): Run primary + 3
// icon+label buttons + 4 status pills, plus a wide/narrow resize control.
const markup = `
<div class="page" style="padding: 16px;">
  <div class="sfarc-import-actions">
    <div class="sfarc-action-group">
      <button class="sfarc-btn sfarc-btn-primary" title="Run Insert">
        <svg class="sfarc-btn-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>
        <span class="sfarc-btn-label">Run Insert</span>
      </button>
      <button class="sfarc-btn sfarc-btn-icon sfarc-btn-icon-label" title="Resume queued records">
        <svg class="sfarc-btn-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>
        <span class="sfarc-btn-label">Resume</span>
      </button>
      <button class="sfarc-btn sfarc-btn-icon sfarc-btn-icon-label" title="Retry failed records">
        <svg class="sfarc-btn-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        <span class="sfarc-btn-label">Retry failed</span>
      </button>
      <button class="sfarc-btn sfarc-btn-icon sfarc-btn-icon-label" title="Hide Configuration">
        <svg class="sfarc-btn-icon-svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
        <span class="sfarc-btn-label">Hide config</span>
      </button>
    </div>
    <div class="sfarc-action-group">
      <button class="sfarc-btn sfarc-btn-icon sfarc-btn-icon-label" title="Excel-like editing toolbar: edit cells, bulk update a column, delete rows/columns">
        <svg class="sfarc-btn-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        <span class="sfarc-btn-label">Excel tools</span>
      </button>
      <div class="sfarc-copy-dropdown">
        <button class="sfarc-btn sfarc-btn-secondary sfarc-copy-btn" title="Copy the import result or the import options">
          Copy
          <svg class="sfarc-copy-chevron" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
        </button>
      </div>
      <button class="sfarc-btn sfarc-btn-icon sfarc-btn-icon-label" title="Skip all unknown fields (ignore them on future imports)">
        <svg class="sfarc-btn-icon-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 4 15 12 5 20"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
        <span class="sfarc-btn-label">Skip unknown</span>
      </button>
    </div>
    <div class="sfarc-status-pills">
      <span class="sfarc-status-pill">0 Queued</span>
      <span class="sfarc-status-pill">0 Processing</span>
      <span class="sfarc-status-pill">0 Succeeded</span>
      <span class="sfarc-status-pill">0 Failed</span>
    </div>
  </div>
  <div style="margin-top: 20px;">
    <button id="narrow" style="padding: 8px 14px; border-radius: 6px; border: 1px solid #999; background: #fff; cursor: pointer;">Simulate narrow window (620px)</button>
    <button id="wide" style="padding: 8px 14px; border-radius: 6px; border: 1px solid #999; background: #fff; cursor: pointer;">Restore wide</button>
    <button id="dark" style="padding: 8px 14px; border-radius: 6px; border: 1px solid #999; background: #fff; cursor: pointer;">Toggle dark</button>
    <button id="read" style="padding: 8px 14px; border-radius: 6px; border: 1px solid #999; background: #fff; cursor: pointer;">Check overlaps</button>
    <pre id="out" style="margin-top: 12px; font: 11px/1.6 monospace; white-space: pre-wrap;"></pre>
  </div>
</div>
<script>
  var out = document.getElementById('out');
  function check() {
    var lines = [];
    document.querySelectorAll('.sfarc-import-actions button').forEach(function (b) {
      var r = b.getBoundingClientRect();
      var label = b.querySelector('.sfarc-btn-label');
      var labelVisible = label && getComputedStyle(label).display !== 'none';
      lines.push((b.className.indexOf('sfarc-btn-primary') >= 0 ? 'PRIMARY ' : '        ') +
        (label ? label.textContent.trim() : '') +
        '  w=' + Math.round(r.width) + 'px h=' + Math.round(r.height) +
        '  labelVisible=' + labelVisible);
    });
    // overlap detection between adjacent buttons
    var btns = Array.prototype.slice.call(document.querySelectorAll('.sfarc-import-actions .sfarc-action-group button'));
    var overlaps = [];
    for (var i = 0; i < btns.length - 1; i++) {
      var a = btns[i].getBoundingClientRect();
      var b = btns[i + 1].getBoundingClientRect();
      if (b.left < a.right) overlaps.push('OVERLAP: ' + btns[i].textContent.trim() + ' & ' + btns[i + 1].textContent.trim() + ' (gap ' + Math.round(b.left - a.right) + 'px)');
    }
    var pills = document.querySelectorAll('.sfarc-status-pill');
    lines.push('status pills: ' + pills.length + ' (w=' + Math.round(pills[0].getBoundingClientRect().width) + 'px first)');
    lines.push(overlaps.length ? overlaps.join('\\n') : 'NO OVERLAPS');
    out.textContent = lines.join('\\n');
  }
  document.getElementById('narrow').addEventListener('click', function () {
    var c = document.querySelector('.sfarc-import-actions');
    c.style.setProperty('container-name', 'sfarc-import-actions');
    c.style.setProperty('container-type', 'inline-size');
    c.style.width = '560px';
    setTimeout(check, 100);
  });
  document.getElementById('wide').addEventListener('click', function () {
    var c = document.querySelector('.sfarc-import-actions');
    c.style.width = '100%';
    setTimeout(check, 100);
  });
  document.getElementById('dark').addEventListener('click', function () {
    document.body.classList.toggle('sfarc-dark-theme');
    setTimeout(check, 250);
  });
  document.getElementById('read').addEventListener('click', check);
  setTimeout(check, 200);
</script>
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Data Import action bar — FULL real CSS stack</title>
<style>
${cssBlocks}
body { background: #f0f2f5; margin: 0; }
body.sfarc-dark-theme { background: #1a1a1a; }
</style>
</head>
<body>
${markup}
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'import-actions-real.html'), html);
console.log('Wrote scratch-harness/import-actions-real.html (' + html.length + ' bytes)');
