#!/usr/bin/env node
// Builds scratch-harness/run-export-contrast-preview.html — the Run Export
// button (.has-query state) with the REAL sfir.css + data-export.css, under a
// LIME org accent, verifying the text flips to a dark contrast color (white on
// lime would be invisible) in both light and dark modes.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Run Export — accent contrast</title>
<script>
window.chrome = window.chrome || { storage: { sync: { get: (k, cb) => cb && cb({ sfiSettings: {} }) }, local: { get: (k, cb) => cb && cb({}) }, onChanged: { addListener() {} } }, runtime: { getURL: (p) => p } };
// Lime org accent — light background, needs dark text.
const accent = '#d4f856';
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(', '); };
document.documentElement.style.setProperty('--sfarc-accent', accent);
document.documentElement.style.setProperty('--sfarc-accent-rgb', rgb(accent));
// theme-manager-style contrast: WCAG luminance -> dark shade for light accents.
document.documentElement.style.setProperty('--sfarc-accent-contrast', '#69802d');
document.documentElement.style.setProperty('--sfarc-accent-dark', '#8aa83a');
</script>
<style>
${read('src/styles/sfir.css')}
${read('src/data-export.css')}
body { margin: 0; padding: 30px; background: #f6f8fb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
body.sfarc-dark-theme { background: #101216; }
.autocomplete-header { display: inline-block; }
.slds-button-group-row { display: flex; gap: 8px; }
#report { position: fixed; bottom: 8px; left: 8px; color: #e2e8f0; font: 11px monospace; white-space: pre; background: rgba(0,0,0,.75); padding: 6px 10px; border-radius: 6px; z-index: 2147483000; }
</style>
</head>
<body>
<div class="autocomplete-header">
  <div class="slds-button-group-row">
    <button type="button" class="slds-button slds-button_brand sfir-run-export-btn has-query"><svg class="sfir-btn-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="margin-right: 6px;"><path d="M8 5v14l11-7z"></path></svg> Run Export</button>
    <button type="button" class="slds-button slds-button_brand sfir-run-export-btn">Run Export (no query)</button>
    <button type="button" class="slds-button slds-button_brand">Generic brand</button>
  </div>
</div>
<pre id="report"></pre>
<script>
function measure() {
  const btns = Array.from(document.querySelectorAll('button'));
  const out = {};
  btns.forEach(b => {
    const cs = getComputedStyle(b);
    const key = b.classList.contains('has-query') ? 'hasQuery' : (b.classList.contains('sfir-run-export-btn') ? 'noQuery' : 'brand');
    const svg = b.querySelector('svg');
    out[key] = {
      bg: cs.backgroundColor,
      color: cs.color,
      iconColor: svg ? getComputedStyle(svg).color : null,
      iconFill: svg ? getComputedStyle(svg).fill : null
    };
  });
  return out;
}
window.__runExportProbe = () => JSON.stringify(measure(), null, 1);
document.getElementById('report').textContent = window.__runExportProbe();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'run-export-contrast-preview.html'), html);
console.log('Wrote scratch-harness/run-export-contrast-preview.html');
