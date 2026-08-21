#!/usr/bin/env node
// Builds scratch-harness/help-tooltip-preview.html — reproduces the REAL
// extension scenario from the user's screenshot: a dark top bar with the
// circular "Data Import Help" button (real .sfir-header-icon-btn CSS) near the
// top of the viewport, with the REAL custom-tooltip.js, so hovering shows the
// tooltip exactly as the extension does (flipped below the button because the
// header is flush at the top).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const tooltipJs = read('src/custom-tooltip.js');
const sfirCss = read('src/styles/sfir.css');

// Extract just the header-icon-btn rules + dark theme bits we need.
const iconBtn = sfirCss.match(/\.sfir-header-icon-btn\s*\{[^}]*\}/s) || [''];
const iconBtnHover = sfirCss.match(/\.sfir-header-icon-btn:hover\s*\{[^}]*\}/s) || [''];
const iconBtnIcon = sfirCss.match(/\.sfir-header-icon-btn \.slds-button__icon\s*\{[^}]*\}/s) || [''];
const iconBtnDark = sfirCss.match(/body\.sfarc-dark-theme \.sfir-header-icon-btn\s*\{[^}]*\}/s) || [''];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Help tooltip — real extension repro</title>
<style>
body {
    margin: 0;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0c0f14;
}
body.sfarc-dark-theme { background: #0c0f14; color: #e2e8f0; }
.topbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    height: 48px;
    padding: 0 16px;
    background: #12141a;
    border-bottom: 1px solid #262b36;
}
.org-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 12px;
    border-radius: 9999px;
    font-size: 11.5px;
    font-weight: 600;
    color: #e2e8f0;
    background: #1a1d26;
    border: 1px solid #333947;
}
.avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    background: #2a2f3a;
    border: 1px solid #3a4150;
}
/* The real extension page also carries these tooltip base styles */
#sfarc-instant-tooltip { font-family: inherit; }
${iconBtn[0]}
${iconBtnHover[0]}
${iconBtnIcon[0]}
${iconBtnDark[0]}
body.sfarc-dark-theme .sfir-header-icon-btn {
    background-color: #1e2230 !important;
    border: 1px solid #333947 !important;
    color: #aeb9cc !important;
}
body.sfarc-dark-theme .sfir-header-icon-btn:hover {
    background-color: #262c3d !important;
    color: var(--sfarc-accent-glow, #38bdf8) !important;
    border-color: var(--sfarc-accent-glow, #38bdf8) !important;
}
</style>
</head>
<body class="sfarc-dark-theme">
<div class="topbar">
    <button type="button" id="sfir-tip-top" class="slds-button slds-button_icon slds-button_icon-border-filled sfir-header-icon-btn" title="Data Import Help">
        <svg class="slds-button__icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    </button>
    <span class="org-badge"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> VISHU</span>
    <span class="avatar">VG</span>
</div>
<div style="padding: 20px; color: #5b6575; font-size: 12px;">Tab content (data import page) renders below the bar — the tooltip must not look broken here.</div>
<!-- Mid-page targets for the browser test: a FRESH (no-cache) button that
     auto-picks 'top' because there is room above, and a PINNED button whose
     data-tooltip-side="bottom" must always win even with room above. -->
<button type="button" class="sfir-tip-fresh" title="Fresh button" style="position:absolute; top:340px; left:16px; padding:7px 16px; font-size:13px; border-radius:8px; border:1px solid #333947; background:#1a1d26; color:#e2e8f0;">Fresh (no cache)</button>
<button type="button" class="sfir-tip-pinned" title="Pinned button" data-tooltip-side="bottom" style="position:absolute; top:340px; left:230px; padding:7px 16px; font-size:13px; border-radius:8px; border:1px solid #333947; background:#1a1d26; color:#e2e8f0;">Pinned bottom</button>
<script>${tooltipJs}</script>
<script>
// Probe helpers for the browser test (real custom-tooltip.js already loaded).
window.__tipSide = function (sel) {
  const tip = document.getElementById('sfarc-instant-tooltip');
  const target = document.querySelector(sel);
  if (!tip) return 'no-tip';
  if (!target) return 'no-target';
  if (tip.style.display === 'none' || getComputedStyle(tip).opacity === '0' || getComputedStyle(tip).visibility === 'hidden') return 'hidden';
  const tr = target.getBoundingClientRect();
  const pr = tip.getBoundingClientRect();
  if (pr.bottom <= tr.top + 2) return 'top';
  if (pr.top >= tr.bottom - 2) return 'bottom';
  if (pr.right <= tr.left + 2) return 'left';
  if (pr.left >= tr.right - 2) return 'right';
  return 'overlap';
};
// Move the top bar button down the viewport (the side-cache test relocates it
// to prove the cached side is kept even when auto-direction would flip).
window.__placeButton = function (y) {
  const btn = document.getElementById('sfir-tip-top');
  btn.style.position = 'fixed';
  btn.style.top = y + 'px';
  btn.style.left = '16px';
};
window.__buttonRect = function (sel) {
  const r = document.querySelector(sel).getBoundingClientRect();
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
};
</script>
</body>
</html>
`;
const out = path.join(root, 'scratch-harness', 'help-tooltip-preview.html');
fs.writeFileSync(out, html);
console.log('Wrote ' + out + ' (' + html.length + ' bytes)');
