#!/usr/bin/env node
// Builds scratch-harness/export-nav-preview.html from the REAL stylesheets in
// the EXACT order data-export.html loads them, with the exact nav markup from
// data-export.js (including the sfir-nav-icon svgs and the active Export tab).
// Measures computed colors of the active + inactive labels in both themes.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const load = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');

// data-export.html link order:
//   button.css, styles/slds/slds.css, styles/sfir.css, data-load.css,
//   data-export.css, glass-toast.css, custom-dropdown.css, controls.css
const cssFiles = [
  'button.css',
  'styles/slds/slds.css',
  'styles/sfir.css',
  'data-load.css',
  'data-export.css',
  'glass-toast.css',
  'custom-dropdown.css',
  'controls.css',
];

const cssBundle = cssFiles.map(f => `/* ===== ${f} ===== */\n${load(f)}`).join('\n\n');

// Exact nav markup from data-export.js (host arg elided)
const navMarkup = `
<div class="slds-builder-header_container">
  <header class="slds-builder-header sfir-header-override">
    <nav class="slds-builder-header__item slds-builder-header__nav sfir-border-none">
      <ul class="slds-builder-header__nav-list">
        <li class="slds-builder-header__nav-item">
          <a class="slds-builder-header__item-action sfir-nav-active" href="data-export.html">
            <svg class="sfir-nav-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
            <span class="sfir-nav-label">Export</span>
          </a>
        </li>
        <li class="slds-builder-header__nav-item">
          <a class="slds-builder-header__item-action" href="data-import.html">
            <svg class="sfir-nav-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 8l5-5 5 5"/><path d="M12 3v12"/></svg>
            <span class="sfir-nav-label">Import</span>
          </a>
        </li>
        <li class="slds-builder-header__nav-item">
          <a class="slds-builder-header__item-action" href="org-limits.html">
            <svg class="sfir-nav-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            <span class="sfir-nav-label">Limits</span>
          </a>
        </li>
        <li class="slds-builder-header__nav-item">
          <a class="slds-builder-header__item-action" href="metadata-exporter.html">
            <svg class="sfir-nav-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            <span class="sfir-nav-label">Metadata</span>
          </a>
        </li>
      </ul>
    </nav>
  </header>
</div>
<div class="content" style="padding: 24px; font: 13px sans-serif; color: #f1f5f9;">
  <p>Real Export-page CSS stack (8 stylesheets, exact order) + exact nav markup from data-export.js.
  Active tab = Export. Toggle theme and read colors — active text must be white (#ffffff) on the
  #3b82f6 pill in BOTH themes; inactive text dark #64748b / light #cbd5e1.</p>
  <button id="toggle-theme">Toggle theme</button>
  <button id="read-colors">Read computed colors</button>
  <pre id="colors"></pre>
</div>
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Export page nav — real CSS stack</title>
<style>
${cssBundle}
body { background: #f4f6f8; margin: 0; }
body.sfarc-dark-theme { background: #09090b; }
.slds-builder-header_container { padding: 16px; }
#toggle-theme, #read-colors { padding: 8px 16px; border-radius: 8px; border: 1px solid #444; background: #27272a; color: #f1f5f9; cursor: pointer; margin-right: 8px; }
#colors { margin-top: 12px; font: 11px/1.6 monospace; white-space: pre-wrap; }
</style>
</head>
<body class="sfarc-dark-theme">
${navMarkup}
<script>
document.getElementById('toggle-theme').addEventListener('click', function () {
  document.body.classList.toggle('sfarc-dark-theme');
});
document.getElementById('read-colors').addEventListener('click', function () {
  function rgbToHex(v) {
    var m = v.match(/\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/);
    if (!m) return v;
    return '#' + [m[1], m[2], m[3]].map(function (n) { return ('0' + (+n).toString(16)).slice(-2); }).join('');
  }
  var list = document.querySelector('.slds-builder-header__nav-list');
  var active = document.querySelector('.sfir-nav-active');
  var inactive = document.querySelectorAll('.slds-builder-header__item-action:not(.sfir-nav-active)')[0];
  var label = active.querySelector('.sfir-nav-label');
  var icon = active.querySelector('.sfir-nav-icon');
  var cs = getComputedStyle(list);
  var a = getComputedStyle(active);
  var il = getComputedStyle(inactive);
  var lb = getComputedStyle(label);
  var ic = getComputedStyle(icon);
  document.getElementById('colors').textContent =
    'theme: ' + (document.body.classList.contains('sfarc-dark-theme') ? 'DARK' : 'LIGHT') + '\\n' +
    'nav-list bg: ' + rgbToHex(cs.backgroundColor) + '\\n' +
    'active pill bg: ' + rgbToHex(a.backgroundColor) + '  active text: ' + rgbToHex(a.color) + '\\n' +
    '  label span color: ' + rgbToHex(lb.color) + '  icon color: ' + rgbToHex(ic.color) + '\\n' +
    'inactive text: ' + rgbToHex(il.color) + '\\n' +
    'EXPECT dark -> nav #121212, pill #3b82f6, active #ffffff, inactive #cbd5e1\\n' +
    'EXPECT light -> nav #e5e9f0, pill #3b82f6, active #ffffff, inactive #64748b';
});
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'export-nav-preview.html'), html);
console.log('Wrote scratch-harness/export-nav-preview.html (' + html.length + ' bytes)');
