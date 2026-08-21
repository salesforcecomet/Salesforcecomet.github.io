#!/usr/bin/env node
// Builds scratch-harness/embed-class-preview.html — verifies that the REAL
// theme-manager.js applies the sfir-embedded class when the page is opened
// with ?sfirEmbed=1 (external script, CSP-safe), and that sfir-embed.css then
// hides the page's own header + collapses the limits toolbar margin.
// Navigate to the harness WITH ?sfirEmbed=1 in the URL to test.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Embed class — ?sfirEmbed=1</title>
<script>
window.chrome = { storage: { sync: { get: (k, cb) => cb && cb({ sfiSettings: {} }) }, local: { get: (k, cb) => cb && cb({}) }, onChanged: { addListener() {} } }, runtime: { getURL: (p) => p } };
</script>
<script>
${read('src/theme-manager.js')}
</script>
<style>
${read('src/styles/sfir.css')}
${read('src/sfir-embed.css')}
body { margin: 0; font-family: -apple-system, sans-serif; }
#probe { position: fixed; bottom: 8px; left: 8px; color: #e2e8f0; font: 11px monospace; white-space: pre; background: rgba(0,0,0,.8); padding: 8px 12px; border-radius: 8px; z-index: 2147483000; }
</style>
</head>
<body class="sfarc-dark-theme">
<!-- Same header structure org-limits.html / metadata-exporter.html use -->
<div class="slds-builder-header_container">
  <header class="slds-builder-header sfir-header-override">
    <nav class="slds-builder-header__item slds-builder-header__nav sfir-border-none">
      <ul class="slds-builder-header__nav-list">
        <li class="slds-builder-header__nav-item"><a class="slds-builder-header__item-action" data-page="export">Export</a></li>
        <li class="slds-builder-header__nav-item"><a class="slds-builder-header__item-action" data-page="import">Import</a></li>
        <li class="slds-builder-header__nav-item"><a class="slds-builder-header__item-action sfir-nav-active" data-page="limits">Limits</a></li>
        <li class="slds-builder-header__nav-item"><a class="slds-builder-header__item-action" data-page="metadata">Metadata</a></li>
      </ul>
    </nav>
    <div class="sfir-header-center-title-container">
      <img class="sfir-header-title-logo" alt="">
      <span class="sfir-header-title-text">Salesforce Comet </span>
    </div>
  </header>
</div>
<!-- Limits control bar (inline margin like the real page) -->
<div class="sfir-limits-toolbar" style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;margin-top:calc(48px + 5px);">
  <input type="text" id="limits-search" placeholder="Search Org Limits..." style="width:300px;height:24px;">
  <span id="limits-total-count">Total Limits: —</span>
</div>
<pre id="probe"></pre>
<script>
function probe() {
  const header = document.querySelector('.slds-builder-header');
  const toolbar = document.querySelector('.sfir-limits-toolbar');
  return JSON.stringify({
    url: window.location.href,
    htmlHasEmbed: document.documentElement.classList.contains('sfir-embedded'),
    bodyHasEmbed: document.body.classList.contains('sfir-embedded'),
    headerDisplay: header ? getComputedStyle(header).display : 'missing',
    headerContainerDisplay: getComputedStyle(document.querySelector('.slds-builder-header_container')).display,
    toolbarMarginTop: toolbar ? getComputedStyle(toolbar).marginTop : 'missing'
  }, null, 1);
}
window.__embedProbe = probe;
setTimeout(() => { document.getElementById('probe').textContent = probe(); }, 300);
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'embed-class-preview.html'), html);
console.log('Wrote scratch-harness/embed-class-preview.html');
