/* Build scratch-harness/preview-clone.html — static replica of the redesigned
   Record Clone Between Orgs page (header + stepper + step-1 + footer +
   auth modal), mirroring the NEW record-clone.js inline styles, for auditing
   the new record-clone.css in both themes. */
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;

const css = [
  "src/styles/record-clone.css",
  "src/controls.css"
].map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");

const faJs = fs.readFileSync(path.join(ROOT, "src/lib/font-awesome.min.js"), "utf8");

const rows = [
  ["001NS0000354U8mYAE", "Casey-Williams"],
  ["001NS0000354U8pYAE", "Chan Group"],
  ["001NS0000354U8jYAE", "Austin-Perez"],
  ["001NS0000354U81YAE", "Sullivan-Baker"],
  ["001NS0000354U8nYAE", "Ryan, Evans and Evans"],
  ["001NS0000354U8oYAE", "Reed-Jackson"],
  ["001NS0000354U8hYAE", "Gilmore, Carney and Fletcher"],
  ["001NS0000354U8iYAE", "Spencer, Armstrong and Howard"],
  ["001NS0000354U8kYAE", "Gonzalez, Fischer and Wilson"]
].map(r => `<tr><td style="text-align:center;"><input type="checkbox" checked></td><td>${r[0]}</td><td>${r[1]}</td><td><button type="button" class="sfarc-open-record-btn">Select</button></td></tr>`).join("\n    ");

const html = `<!DOCTYPE html>
<html lang="en" class="sfarc-dark-theme">
<head>
<meta charset="UTF-8">
<title>Record Clone — Redesign Audit</title>
<script>${faJs}</script>
<style>
  ${css}
  /* harness chrome */
  #harness-toolbar {
    position: fixed; top: 10px; right: 14px; z-index: 2147483647;
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 10px; border-radius: 999px;
    background: rgba(30, 30, 30, 0.92); border: 1px solid rgba(100, 116, 139, 0.4);
    font-family: 'Segoe UI', system-ui, sans-serif;
  }
  #harness-toolbar button {
    border: 1px solid rgba(100,116,139,0.4); background: rgba(255,255,255,0.08);
    color: #e2e8f0; font-size: 12px; font-weight: 600; padding: 5px 12px;
    border-radius: 999px; cursor: pointer;
  }
  #harness-toolbar button.active { background: #0284c7; border-color: #38bdf8; color: #fff; }
  body { padding: 0 !important; }
  .sfarc-modal-overlay { position: absolute !important; }
</style>
</head>
<body class="sfarc-dark-theme">
<div id="harness-toolbar">
  <button id="t-dark" class="active" data-theme="dark">Dark</button>
  <button id="t-light" data-theme="light">Light</button>
</div>

<div class="sfarc-clone-wrapper">
  <!-- Header -->
  <div class="sfarc-clone-header">
    <div class="sfarc-clone-logo-group">
      <img class="sfarc-clone-logo-img" src="icons/icon-48.png" alt="salesforce comet">
      <div>
        <h1 class="sfarc-clone-title">Record Clone Between Orgs</h1>
        <div class="sfarc-clone-subtitle">Zero-setup high-speed cross-org record &amp; relationship cloner</div>
      </div>
    </div>
    <div class="sfarc-clone-header-orgs">
      <div class="sfarc-header-org-selector source">
        <div class="sfarc-org-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.25"/><line x1="12" y1="12" x2="12" y2="20"/><polyline points="9 17 12 20 15 17"/></svg>
          <span>Source</span>
        </div>
        <select class="sfarc-org-select-concise"><option>vishugrade-dev-ed.my.salesforce.com</option></select>
        <div class="sfarc-org-actions">
          <a class="sfarc-org-action-btn open" title="Open org"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>
          <div class="sfarc-org-action-btn auth" title="Authorize"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-1.5 1.5L14 9.5a5 5 0 1 0 3 3l3.5-3.5m-3.5-3.5l1.5-1.5"/><circle cx="7.5" cy="16.5" r="1.5"/></svg></div>
          <span class="sfarc-org-status-dot connected"></span>
        </div>
      </div>
      <div class="sfarc-org-arrow-connector"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
      <div class="sfarc-header-org-selector destination">
        <div class="sfarc-org-pill destination">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.25"/><line x1="12" y1="20" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>
          <span>Dest</span>
        </div>
        <select class="sfarc-org-select-concise"><option>vishugrade-dev-ed.my.salesforce.com</option></select>
        <div class="sfarc-org-actions">
          <a class="sfarc-org-action-btn open" title="Open org"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>
          <div class="sfarc-org-action-btn auth" title="Authorize"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-1.5 1.5L14 9.5a5 5 0 1 0 3 3l3.5-3.5m-3.5-3.5l1.5-1.5"/><circle cx="7.5" cy="16.5" r="1.5"/></svg></div>
          <span class="sfarc-org-status-dot connected"></span>
        </div>
      </div>
    </div>
  </div>

  <!-- Container -->
  <div class="sfarc-clone-container">
    <!-- Stepper -->
    <div class="sfarc-wizard-stepper">
      <div class="sfarc-stepper-progress-track"><div class="sfarc-stepper-progress-fill" style="width:0%;"></div></div>
      <div class="sfarc-step-item active"><div class="sfarc-step-circle">1</div><div class="sfarc-step-title">Setup &amp; Record</div></div>
      <div class="sfarc-step-item"><div class="sfarc-step-circle">2</div><div class="sfarc-step-title">Depth &amp; Children</div></div>
      <div class="sfarc-step-item"><div class="sfarc-step-circle">3</div><div class="sfarc-step-title">Files &amp; Settings</div></div>
      <div class="sfarc-step-item"><div class="sfarc-step-circle">4</div><div class="sfarc-step-title">Review &amp; Launch</div></div>
    </div>

    <!-- Step 1 -->
    <div class="sfarc-step-content-pane">
      <div class="sfarc-clone-section">
        <h3 class="sfarc-section-title">1. Select Object &amp; Record</h3>
        <div class="sfarc-form-group" style="margin-bottom:16px;">
          <label class="sfarc-form-label">Salesforce Object (657 objects available)</label>
          <select class="sfarc-input"><option>Account</option><option>Opportunity</option><option>Contact</option></select>
        </div>
        <div class="sfarc-mode-tabs">
          <button type="button" class="sfarc-mode-tab-btn"><i class="fa-solid fa-magnifying-glass" style="margin-right:6px;"></i>Live Search / ID</button>
          <button type="button" class="sfarc-mode-tab-btn"><i class="fa-solid fa-list-check" style="margin-right:6px;"></i>Bulk Record IDs</button>
          <button type="button" class="sfarc-mode-tab-btn active"><i class="fa-solid fa-bolt" style="margin-right:6px;"></i>SOQL Query</button>
          <button type="button" class="sfarc-mode-tab-btn"><i class="fa-solid fa-clock-rotate-left" style="margin-right:6px;"></i>Recent Records</button>
        </div>
        <div class="sfarc-soql-box">
          <div style="display:flex; gap:10px; align-items:stretch;">
            <textarea class="sfarc-soql-input">SELECT Id, Name FROM Account ORDER BY LastModifiedDate DESC LIMIT 10</textarea>
            <button type="button" class="sfarc-btn-primary" style="white-space:nowrap; height:42px;">▶ Run SOQL Query</button>
          </div>
          <div class="sfarc-results-table-container">
            <table class="sfarc-results-table">
              <thead><tr><th style="width:40px;"><input type="checkbox" checked></th><th>Record ID</th><th>Name / Subject</th><th>Action</th></tr></thead>
              <tbody>
    ${rows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Wizard footer -->
    <div class="sfarc-wizard-footer">
      <button type="button" class="sfarc-btn-secondary" disabled>← Back</button>
      <div style="font-size:13px; font-weight:700; color:var(--clone-text-secondary, #94a3b8);">Step 1 of 4</div>
      <button type="button" class="sfarc-btn-primary">Next: Relationships →</button>
    </div>
  </div>
</div>

<!-- Auth modal (visible for audit) -->
<div class="sfarc-modal-overlay">
  <div class="sfarc-modal-card" style="max-width:500px; border-radius:18px; overflow:hidden;">
    <div class="sfarc-modal-header" style="background:var(--clone-card-2, #f8fafc); padding:18px 24px; border-bottom:1px solid var(--clone-card-border, rgba(15,23,42,0.1));">
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="width:32px; height:32px; border-radius:10px; background-color:var(--clone-accent-soft, rgba(1,118,211,0.12)); color:var(--clone-warning, #f59e0b); display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:bold;">🔑</div>
        <h3 class="sfarc-modal-title" style="font-size:16px; font-weight:800; color:var(--clone-text-primary, #0f172a);">Authorize Source Org</h3>
      </div>
      <button class="sfarc-modal-close-btn">✕</button>
    </div>
    <div class="sfarc-modal-body" style="padding:20px 24px;">
      <div style="font-size:12px; color:var(--clone-text-secondary, #64748b); margin-bottom:16px; line-height:1.5;">Login to open an active session in your browser, or connect an org directly using a Session ID / Access Token.</div>
      <div class="sfarc-auth-tiles-grid">
        <div class="sfarc-auth-tile production">
          <div class="sfarc-auth-tile-left"><div class="sfarc-auth-tile-icon prod">🟢</div><div><div class="sfarc-auth-tile-title">Production / Developer Org</div><div class="sfarc-auth-tile-sub">https://login.salesforce.com</div></div></div>
          <div class="sfarc-auth-tile-arrow">➔</div>
        </div>
        <div class="sfarc-auth-tile sandbox">
          <div class="sfarc-auth-tile-left"><div class="sfarc-auth-tile-icon sandbox">🟡</div><div><div class="sfarc-auth-tile-title">Sandbox Org</div><div class="sfarc-auth-tile-sub">https://test.salesforce.com</div></div></div>
          <div class="sfarc-auth-tile-arrow">➔</div>
        </div>
      </div>
      <div class="sfarc-divider-badge"><span class="sfarc-divider-text">OR CONNECT VIA ACCESS TOKEN / SESSION ID</span></div>
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div class="sfarc-form-group">
          <label class="sfarc-form-label">Org Hostname / Domain</label>
          <div class="sfarc-input-with-icon"><span class="sfarc-input-icon">🌐</span><input type="text" class="sfarc-input" placeholder="e.g. my-company.my.salesforce.com"></div>
        </div>
        <div class="sfarc-form-group">
          <label class="sfarc-form-label">Session ID / Access Token (sid)</label>
          <div class="sfarc-input-with-icon"><span class="sfarc-input-icon">🔑</span><input type="password" class="sfarc-input" placeholder="e.g. 00D50000000..."></div>
        </div>
      </div>
    </div>
    <div class="sfarc-modal-footer" style="padding:14px 24px; background-color:var(--clone-card-2, #f8fafc); border-top:1px solid var(--clone-card-border, rgba(15,23,42,0.1));">
      <button class="sfarc-btn-secondary">Close</button>
      <button class="sfarc-btn-primary">⚡ Connect Org Session</button>
    </div>
  </div>
</div>

<script>
function applyTheme(light) {
  var h = document.documentElement;
  var b = document.body;
  if (light) {
    h.classList.remove('sfarc-dark-theme');
    b.classList.remove('sfarc-dark-theme');
    b.classList.add('light-theme');
  } else {
    h.classList.add('sfarc-dark-theme');
    b.classList.add('sfarc-dark-theme');
    b.classList.remove('light-theme');
  }
  document.querySelectorAll('#harness-toolbar button').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.theme === (light ? 'light' : 'dark'));
  });
}
document.getElementById('harness-toolbar').addEventListener('click', function (e) {
  if (e.target.dataset.theme === 'light') applyTheme(true);
  else if (e.target.dataset.theme === 'dark') applyTheme(false);
});
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, "scratch-harness/preview-clone.html"), html);
console.log("Wrote scratch-harness/preview-clone.html (" + html.length + " bytes)");
