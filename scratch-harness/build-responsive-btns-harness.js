// Build a harness proving the icon-label buttons collapse via container queries.
const fs = require("fs");
const importCss = fs.readFileSync("src/data-import.css", "utf8");
const exportCss = fs.readFileSync("src/data-export.css", "utf8");
const sfirCss = fs.readFileSync("src/styles/sfir.css", "utf8");

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body { font-family: -apple-system, sans-serif; margin: 16px; background: #f2f2f7; }
h3 { font-size: 13px; margin: 18px 0 6px; color: #333; }
.row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.note { font-size: 11px; color: #888; margin: 0 0 4px; }
/* import action bar (simplified) */
.sfarc-import-actions { display:flex; align-items:center; gap:8px; padding:8px 10px; background:#fff; border:1px solid #d8dde6; border-radius:10px; container-type: inline-size; container-name: sfarc-import-actions; }
.sfarc-action-group { display:flex; align-items:center; gap:6px; }
.sfarc-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; height:24px; padding:0 12px; border-radius:6px; font-size:12px; font-weight:600; border:1px solid #d8dde6; cursor:pointer; white-space:nowrap; }
.sfarc-btn-icon { width:30px; min-width:30px; padding:0; background:#f6f8fa; color:#666; border-color:#d8dde6; }
.sfarc-btn-icon-label { width:auto; min-width:30px; padding:0 10px; color:#333; background:#f6f8fa; border-color:#d8dde6; }
.sfarc-btn-icon-label .sfarc-btn-label { font-size:11.5px; font-weight:600; white-space:nowrap; }
@container sfarc-import-actions (max-width: 620px) {
  .sfarc-btn-icon-label { width:30px; min-width:30px; padding:0; }
  .sfarc-btn-icon-label .sfarc-btn-label { display:none; }
}
.result-bar-column { display:flex; flex-direction:column; gap:10px; padding:8px 0; }
.result-bar-row-1 { display:flex; flex-wrap:wrap; align-items:center; width:100%; gap:8px; }
.result-bar-left-controls { display:flex; align-items:center; gap:8px; }
.result-bar-row-1 .slds-button { height:24px; min-height:24px; padding:0 10px; font-size:11.5px; font-weight:600; border-radius:20px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #cbd5e1; background:#e9ecef; color:#1e293b; cursor:pointer; }
.result-bar-row-1 .sfir-btn-label { font-size:11.5px; font-weight:600; white-space:nowrap; margin-left:4px; }
.result-bar-column { container-type: inline-size; container-name: sfir-result-bar; }
@container sfir-result-bar (max-width: 900px) {
  .result-bar-row-1 .sfir-btn-label { display:none !important; margin-left:0 !important; }
}
.pill { display:inline-flex; align-items:center; gap:4px; padding:2px 10px; border-radius:20px; font-size:11px; font-weight:600; border:1px solid #cbd5e1; background:#f8fafc; color:#475569; }
.pill.blue { background:#0176d3; color:#fff; border-color:#0176d3; }
.pill.red { background:#ef4444; color:#fff; border-color:#ef4444; }
</style></head><body>
<h3>Import action bar — wide (labels visible)</h3>
<div class="note">Container 900px: Resume / Retry failed / Hide config labels shown</div>
<div class="sfarc-import-actions" id="impWide" style="max-width:900px">
  <div class="sfarc-action-group">
    <button class="sfarc-btn sfarc-btn-primary">Run update</button>
    <button class="sfarc-btn sfarc-btn-icon sfarc-btn-icon-label"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span class="sfarc-btn-label">Resume</span></button>
    <button class="sfarc-btn sfarc-btn-icon sfarc-btn-icon-label"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg><span class="sfarc-btn-label">Retry failed</span></button>
    <button class="sfarc-btn sfarc-btn-icon sfarc-btn-icon-label"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg><span class="sfarc-btn-label">Hide config</span></button>
  </div>
  <div class="sfarc-action-group">
    <span class="pill blue">144 Queued</span><span class="pill">0 Processing</span><span class="pill">0 Succeeded</span><span class="pill red">0 Failed</span>
  </div>
</div>
<div class="note">Container 480px: labels hidden, icon-only</div>
<div class="sfarc-import-actions" id="impNarrow" style="max-width:480px">
  <div class="sfarc-action-group">
    <button class="sfarc-btn sfarc-btn-primary">Run update</button>
    <button class="sfarc-btn sfarc-btn-icon sfarc-btn-icon-label"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span class="sfarc-btn-label">Resume</span></button>
    <button class="sfarc-btn sfarc-btn-icon sfarc-btn-icon-label"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg><span class="sfarc-btn-label">Retry failed</span></button>
    <button class="sfarc-btn sfarc-btn-icon sfarc-btn-icon-label"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg><span class="sfarc-btn-label">Hide config</span></button>
  </div>
</div>
<h3>Export result bar — wide (labels visible)</h3>
<div class="note">Container 1200px: Show query / CSV / Hide columns labels shown</div>
<div class="result-bar-column" id="expWide" style="max-width:1200px">
  <div class="result-bar-row-1"><div class="result-bar-left-controls">
    <button class="slds-button slds-button_neutral"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><span class="sfir-btn-label">Show query</span></button>
    <button class="slds-button slds-button_neutral"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span class="sfir-btn-label">CSV</span></button>
    <button class="slds-button slds-button_neutral"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg><span class="sfir-btn-label">Hide columns</span></button>
  </div></div>
</div>
<div class="note">Container 640px: labels hidden, icon-only</div>
<div class="result-bar-column" id="expNarrow" style="max-width:640px">
  <div class="result-bar-row-1"><div class="result-bar-left-controls">
    <button class="slds-button slds-button_neutral"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><span class="sfir-btn-label">Show query</span></button>
    <button class="slds-button slds-button_neutral"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span class="sfir-btn-label">CSV</span></button>
    <button class="slds-button slds-button_neutral"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg><span class="sfir-btn-label">Hide columns</span></button>
  </div></div>
</div>
</body></html>`;
fs.writeFileSync("scratch-harness/responsive-btns.html", html);
console.log("harness written: scratch-harness/responsive-btns.html");
