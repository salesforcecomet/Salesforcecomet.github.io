// Builds scratch-harness/accent-inject-preview.html — simulates the content-script
// accent injection (content.js sfarcApplyAccentToPage) against the REAL injected
// CSS files (flow-scanner overlay-ui.css, custom-dropdown.css, glass-toast.js styles)
// to prove the user's accent switching reaches every injected UI surface.
const fs = require('fs');
const path = require('path');

const overlayCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'flow-scanner-content', 'overlay-ui.css'), 'utf8');
const dropdownCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'custom-dropdown.css'), 'utf8');
const glassCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'glass-toast.css'), 'utf8');

// The exact shade derivation from theme-manager.js deriveAccentShades
function hexToRgbArr(hex) {
    let h = (hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    if (isNaN(n)) return [33, 150, 243];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(hex, other, weight) {
    const a = hexToRgbArr(hex);
    const b = hexToRgbArr(other);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * weight));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

// User picks GREEN accent #10b981
const ACCENT = '#10b981';
const rgb = hexToRgbArr(ACCENT).join(', ');
const light = mixHex(ACCENT, '#ffffff', 0.45);
const dark = mixHex(ACCENT, '#000000', 0.35);
const glow = mixHex(ACCENT, '#ffffff', 0.22);
const soft = mixHex(ACCENT, '#ffffff', 0.9);

const accentVars = `
:root {
  --primary: ${ACCENT};
  --primary-color: ${ACCENT};
  --primary-dark: ${ACCENT};
  --primary-light: rgba(${rgb}, 0.15);
  --primary-color-rgb: ${rgb};
  --primary-light-bg: rgba(${rgb}, 0.12);
  --sfarc-primary: ${ACCENT};
  --sfarc-accent: ${ACCENT};
  --sfarc-accent-rgb: ${rgb};
  --sfarc-accent-light: ${light};
  --sfarc-accent-dark: ${dark};
  --sfarc-accent-glow: ${glow};
  --sfarc-accent-glow-rgb: ${hexToRgbArr(glow).join(', ')};
  --sfarc-accent-soft: ${soft};
  --mac-active-blue: ${ACCENT};
  --clone-brand: ${ACCENT};
  --sfir-btn-border-active: ${ACCENT};
  --sfarc-input-focus-border: ${ACCENT};
}
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Injected UI Accent Sync</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 24px; background: #f4f6f9; }
  .wrap { max-width: 760px; margin: 0 auto; }
  h2 { font-size: 15px; color: #0f172a; margin: 26px 0 6px; }
  .note { font-size: 12px; color: #64748b; margin-bottom: 12px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; }
</style>
<style>${accentVars}</style>
<style>${overlayCss}</style>
<style>${dropdownCss}</style>
<style>${glassCss}</style>
<style>
  .sfarc-glass-modal-input:focus{border-color:var(--sfarc-accent, #2196f3);box-shadow:0 0 0 3px rgba(var(--sfarc-accent-rgb, 33, 150, 243), .14)}
  .sfarc-glass-modal-ok{background:var(--sfarc-accent, #2196f3);color:#fff}
  .sfarc-glass-modal-ok:hover{background:var(--sfarc-accent-dark, #1976d2)}
</style>
</head>
<body>
<div class="wrap">
  <h2>Flow Scanner Overlay (real overlay-ui.css)</h2>
  <div class="note">Accent set to <b style="color:#10b981">green #10b981</b> via content.js-style injection — buttons, tabs, borders, progress fill must all be green.</div>
  <div class="card" style="position:relative; height:230px;">
    <div class="fs-panel" style="position:absolute; inset:0; border-radius:12px; overflow:hidden;">
      <div class="fs-panel-header">
        <span class="fs-panel-title">Flow Scanner</span>
        <div class="fs-drag-grip" style="display:inline-block;">⋮⋮</div>
      </div>
      <div class="fs-nav-tabs">
        <div class="fs-nav-tab active">Flows</div>
        <div class="fs-nav-tab">Elements</div>
      </div>
      <div style="padding:12px;">
        <div class="fs-search-wrapper">
          <svg class="fs-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="fs-search-input" placeholder="Search flows..." style="padding-left:26px; height:26px;">
        </div>
        <button id="fs-scan-btn" style="margin-top:10px; padding:5px 14px; border-radius:6px; border:none; font-weight:600; font-size:12px; cursor:pointer;">Run Scanner</button>
      </div>
    </div>
  </div>

  <h2>Custom Dropdown (real custom-dropdown.css)</h2>
  <div class="note">Selected item highlight + focus ring follow the accent.</div>
  <div class="card">
    <div class="sfarc-custom-dropdown" style="position:relative; display:inline-block; min-width:220px;">
      <button class="sfarc-custom-dropdown-trigger" style="width:100%; text-align:left;">Select object ▾</button>
      <div class="sfarc-custom-dropdown-menu" style="display:block; position:absolute; top:calc(100% + 4px); left:0; width:100%;">
        <div class="sfarc-custom-dropdown-option" style="background: rgba(var(--sfarc-accent-rgb, 33, 150, 243), 0.08); color: var(--sfarc-accent, #2196f3);">Account</div>
        <div class="sfarc-custom-dropdown-option">Contact</div>
        <div class="sfarc-custom-dropdown-option">Opportunity</div>
      </div>
    </div>
  </div>

  <h2>Glass Toast Modal (real glass-toast.css + inline styles)</h2>
  <div class="note">Modal OK button + input focus ring use the accent.</div>
  <div class="card">
    <div class="sfarc-glass-modal-card" style="width:100%; max-width:none;">
      <div class="sfarc-glass-modal-title">Confirm action</div>
      <div class="sfarc-glass-modal-msg">This is a glass-toast confirmation modal injected into the page.</div>
      <input class="sfarc-glass-modal-input" placeholder="Type something...">
      <div class="sfarc-glass-modal-actions">
        <button class="sfarc-glass-modal-btn sfarc-glass-modal-cancel">Cancel</button>
        <button class="sfarc-glass-modal-btn sfarc-glass-modal-ok">OK</button>
      </div>
    </div>
  </div>
</div>
</body>
</html>
`;

const out = path.join(__dirname, 'accent-inject-preview.html');
fs.writeFileSync(out, html);
console.log('Wrote ' + out);
