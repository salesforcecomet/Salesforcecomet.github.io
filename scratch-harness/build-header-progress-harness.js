// Renders the real shared header (PageHeader-style markup) + the global
// top-progress pill mounted into the header utility slot, with real CSS.
const fs = require('fs');
const path = require('path');

const sfir = fs.readFileSync('src/styles/sfir.css', 'utf8');
const controls = fs.readFileSync('src/controls.css', 'utf8');

const header = `
  <div class="slds-builder-header_container">
    <header class="slds-builder-header sfir-header-override">
      <nav class="slds-builder-header__item slds-builder-header__nav sfir-border-none">
        <ul class="slds-builder-header__nav-list">
          <li class="slds-builder-header__nav-item">
            <a class="slds-builder-header__item-action sfir-nav-active">
              <svg class="sfir-nav-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 8l5-5 5 5"/><path d="M12 3v12"/></svg>
              <span class="sfir-nav-label">Import</span>
            </a>
          </li>
        </ul>
      </nav>
      <div id="sfir-header-utility-slot" class="slds-builder-header__item" style="display: flex; align-items: center; gap: 6px;"></div>
      <div class="sfir-header-center-title-container">
        <img class="sfir-header-title-logo" alt="Comet Logo">
        <span class="sfir-header-title-text">Salesforce Comet </span>
      </div>
      <div class="slds-builder-header__item slds-builder-header__utilities sfir-border-none">
        <div class="slds-builder-header__utilities-item sfir-border-none">
          <a href="#" title="Home"><span class="slds-badge slds-badge_lightest"><span class="sfir-org-badge-text">RESILIENT-IMPALA-1X1ADB-DEV-ED</span></span></a>
        </div>
      </div>
    </header>
  </div>
`;

const barMarkup =
  '<div class="sfir-top-progress in-header active" id="sfir-top-progress">' +
  '<div class="sfir-top-progress-fill"></div>' +
  '<div class="sfir-top-progress-pill show" role="button" aria-label="Import progress">' +
  '<div class="sfir-island-rest"><span class="sfir-top-progress-dot"></span><span class="sfir-top-progress-percent">100%</span></div>' +
  '<div class="sfir-island-body">' +
  '<div class="sfir-island-hero"><span class="sfir-island-thumb"></span><span class="sfir-island-titles"><span class="sfir-top-progress-label">Import finished</span><span class="sfir-island-subtitle">100% · 0 ok · 144 failed</span></span><span class="sfir-island-wave"><i></i><i></i><i></i><i></i><i></i></span></div>' +
  '<div class="sfir-island-track"><span class="sfir-island-time-l">0 / 144</span><span class="sfir-island-bar"><span class="sfir-island-bar-fill"></span></span><span class="sfir-island-time-r">100%</span></div>' +
  '<div class="sfir-island-controls"><span class="sfir-top-progress-counts"></span></div>' +
  '</div></div>' +
  '<div class="sfir-top-progress-ring" style="--sfir-ring-pct: 100;"></div>' +
  '</div>';

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; background: #141418; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  body.sfarc-dark-theme .slds-builder-header_container,
  body.sfarc-dark-theme .slds-builder-header.sfir-header-override { background: transparent !important; }
</style>
<style>${controls}</style>
<style>${sfir}</style>
</head>
<body class="sfarc-dark-theme">
${header}
${barMarkup}
<script>
  // Simulate theme-manager mount: move the pill into the slot
  (function () {
    const slot = document.getElementById('sfir-header-utility-slot');
    const bar = document.getElementById('sfir-top-progress');
    slot.appendChild(bar);
  })();
</script>
</body>
</html>`;

const out = path.join(__dirname, 'header-progress-preview.html');
fs.writeFileSync(out, html);
console.log('Wrote', out, html.length, 'bytes');
