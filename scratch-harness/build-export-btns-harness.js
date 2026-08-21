const fs = require('fs');
const path = require('path');

const load = (p) => fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';

const css = [
  load('src/button.css'),
  load('src/styles/slds/slds.css'),
  load('src/styles/sfir.css'),
  load('src/data-load.css'),
  load('src/data-export.css'),
  load('src/glass-toast.css'),
  load('src/custom-dropdown.css'),
  load('src/controls.css')
].join('\n');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>body { margin: 0; background: #ffffff; font-family: -apple-system, sans-serif; }</style>
<style>${css}</style>
</head>
<body>
  <!-- Query toolbar buttons (image 2) -->
  <div class="sfir-buttons-row">
    <div class="autocomplete-header">
      <ul class="slds-button-group-row flex-right">
        <li class="slds-button-group-item">
          <button class="slds-button slds-button_neutral sfir-save-query-btn-hdr"><svg class="sfir-btn-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;color:#eab308;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>Save Query</button>
        </li>
        <li class="slds-button-group-item">
          <button class="slds-button slds-button_neutral copy-id"><svg class="sfir-btn-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Export Query</button>
        </li>
        <li class="slds-button-group-item">
          <button class="slds-button slds-button_neutral"><svg class="sfir-btn-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Query Plan</button>
        </li>
        <li class="slds-button-group-item">
          <button class="slds-button slds-button_neutral"><svg class="sfir-btn-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>Account Field Info</button>
        </li>
      </ul>
    </div>
  </div>
  <!-- Result bar buttons (image 1) -->
  <div class="result-bar-row-1" style="padding: 10px;">
    <button class="slds-button slds-button_neutral"><span class="sfir-btn-label">Hide query</span></button>
    <div class="sfir-copy-dropdown-wrapper">
      <button type="button" class="slds-button slds-button_neutral sfir-copy-main-btn">
        <svg class="slds-button__icon slds-button__icon_left" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
    </div>
    <button class="slds-button slds-button_neutral" disabled><span class="sfir-btn-label">CSV</span></button>
  </div>
</body>
</html>`;

const out = path.join(__dirname, 'export-btns-preview.html');
fs.writeFileSync(out, html);
console.log('Wrote', out, html.length, 'bytes');
