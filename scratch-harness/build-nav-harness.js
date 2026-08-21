#!/usr/bin/env node
// Builds scratch-harness/nav-preview.html from the REAL stylesheets and the
// exact header-nav markup used by org-limits.html / metadata-exporter.html.
// This guarantees the preview shows exactly what a freshly-reloaded extension
// renders in Chrome (same files, same cascade, both themes).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sfir = fs.readFileSync(path.join(root, 'src', 'styles', 'sfir.css'), 'utf8');
const inspector = fs.readFileSync(path.join(root, 'src', 'inspector.css'), 'utf8');

// The exact header nav markup from org-limits.html (Export/Import/Limits/Metadata)
const navMarkup = `
<div class="slds-builder-header_container">
  <header class="slds-builder-header sfir-header-override">
    <nav class="slds-builder-header__item slds-builder-header__nav sfir-border-none">
      <ul class="slds-builder-header__nav-list">
        <li class="slds-builder-header__nav-item">
          <a class="slds-builder-header__item-action" data-page="export">
            <svg class="sfir-nav-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
            <span class="sfir-nav-label">Export</span>
          </a>
        </li>
        <li class="slds-builder-header__nav-item">
          <a class="slds-builder-header__item-action" data-page="import">
            <svg class="sfir-nav-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 8l5-5 5 5"/><path d="M12 3v12"/></svg>
            <span class="sfir-nav-label">Import</span>
          </a>
        </li>
        <li class="slds-builder-header__nav-item">
          <a class="slds-builder-header__item-action sfir-nav-active" data-page="limits">
            <svg class="sfir-nav-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            <span class="sfir-nav-label">Limits</span>
          </a>
        </li>
        <li class="slds-builder-header__nav-item">
          <a class="slds-builder-header__item-action" data-page="metadata">
            <svg class="sfir-nav-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            <span class="sfir-nav-label">Metadata</span>
          </a>
        </li>
      </ul>
    </nav>
  </header>
</div>
<div class="content" style="padding: 24px; font: 13px sans-serif; color: #f1f5f9;">
  <p>This harness inlines the REAL <code>styles/sfir.css</code> + <code>inspector.css</code> and the exact
  header-nav markup from <code>org-limits.html</code>. Toggle the theme below — the nav-list pill container
  must be dark (<code>#121212</code>) in dark mode and light (<code>#e5e9f0</code>) in light mode, with the
  active pill <code>#3b82f6</code>.</p>
  <button id="toggle-theme" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #444; background: #27272a; color: #f1f5f9; cursor: pointer;">Toggle theme</button>
  <button id="read-colors" style="padding: 8px 16px; border-radius: 8px; border: 1px solid #444; background: #27272a; color: #f1f5f9; cursor: pointer;">Read computed colors</button>
  <pre id="colors" style="margin-top: 12px; font: 11px/1.6 monospace; white-space: pre-wrap;"></pre>
</div>
<script>
  document.getElementById('toggle-theme').addEventListener('click', function () {
    document.body.classList.toggle('sfarc-dark-theme');
  });
  document.getElementById('read-colors').addEventListener('click', function () {
    var list = document.querySelector('.slds-builder-header__nav-list');
    var active = document.querySelector('.sfir-nav-active');
    var cs = getComputedStyle(list);
    var cs2 = getComputedStyle(active);
    var bg = rgbToHex(cs.backgroundColor);
    var border = rgbToHex(cs.borderColor);
    var activeBg = rgbToHex(cs2.backgroundColor);
    var activeColor = rgbToHex(cs2.color);
    document.getElementById('colors').textContent =
      'theme: ' + (document.body.classList.contains('sfarc-dark-theme') ? 'DARK' : 'LIGHT') + '\\n' +
      'nav-list bg: ' + bg + '  border: ' + border + '\\n' +
      'active pill bg: ' + activeBg + '  active text: ' + activeColor + '\\n' +
      'EXPECT: dark -> nav #121212, border #222222, pill #3b82f6, text #ffffff\\n' +
      '         light -> nav #e5e9f0, border #d4dae3, pill #3b82f6, text #ffffff';
  });
  function rgbToHex(v) {
    var m = v.match(/\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/);
    if (!m) return v;
    return '#' + [m[1], m[2], m[3]].map(function (n) { return ('0' + (+n).toString(16)).slice(-2); }).join('');
  }
</script>
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Header Nav — real CSS stack</title>
<style>
/* ---- REAL styles/sfir.css ---- */
${sfir}
/* ---- REAL inspector.css ---- */
${inspector}
body { background: #f4f6f8; margin: 0; }
body.sfarc-dark-theme { background: #09090b; }
.slds-builder-header_container { padding: 16px; }
</style>
</head>
<body class="sfarc-dark-theme">
${navMarkup}
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'nav-preview.html'), html);
console.log('Wrote scratch-harness/nav-preview.html (' + html.length + ' bytes)');
