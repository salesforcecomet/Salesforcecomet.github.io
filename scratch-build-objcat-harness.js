/* Build scratch-harness/preview-objcat.html — static replica of the Object
   Manager category screen (breadcrumb + search + Fields grid), mirroring the
   NEW themed inline styles from main.js, for dark/light auditing. */
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;

const css = [
  "src/inspector.css",
  "src/controls.css"
].map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");

const faJs = fs.readFileSync(path.join(ROOT, "src/lib/font-awesome.min.js"), "utf8");

const rows = [
  ["Account ID", "Id", "Lookup()", "-", "-"],
  ["Deleted", "IsDeleted", "Checkbox", "-", "-"],
  ["Account", "MasterRecordId", "Lookup(Account)", "-", "-"],
  ["Account Name", "Name", "Name", "-", "-"],
  ["Type", "Type", "Picklist", "-", "-"],
  ["Account Record Type", "RecordTypeId", "Record Type", "-", "-"],
  ["Parent Account", "ParentId", "Hierarchy", "-", "-"],
  ["Billing Address", "BillingAddress", "Address", "-", "-"],
  ["Shipping Address", "ShippingAddress", "Address", "-", "-"],
  ["Phone", "Phone", "Phone", "-", "-"],
  ["Fax", "Fax", "Phone", "-", "-"],
  ["Account Number", "AccountNumber", "Text(40)", "-", "-"],
  ["Website", "Website", "URL(255)", "-", "-"]
].map((r, i) => `
                    <div class="sfarc-obj-grid-row${i === 7 ? ' selected' : ''}" data-id="${r[1]}" style="display: grid; grid-template-columns: 2fr 2fr 1.5fr 1fr 1fr; align-items: stretch;">
                        <div style="font-weight: 500; color: var(--sfarc-text, #0f172a); font-size: clamp(11px, 1.2vw + 4px, 14px);">${r[0]}</div>
                        <div style="color: var(--sfarc-secondary-text, #64748b); font-size: clamp(10px, 1vw + 4px, 13px); font-family: monospace; word-break: break-all;">${r[1]}</div>
                        <div style="color: var(--sfarc-muted-text, #94a3b8); font-size: clamp(10px, 1vw + 4px, 12px); word-break: break-word;">${r[2]}</div>
                        <div style="color: var(--sfarc-muted-text, #94a3b8); font-size: clamp(10px, 1vw + 4px, 12px);">${r[3]}</div>
                        <div style="color: var(--sfarc-muted-text, #94a3b8); font-size: clamp(10px, 1vw + 4px, 12px);">${r[4]}</div>
                    </div>`).join("\n");

const html = `<!DOCTYPE html>
<html lang="en" class="sfarc-dark-theme">
<head>
<meta charset="UTF-8">
<title>Object Manager Category — Theme Audit</title>
<script>${faJs}</script>
<style>
  ${css}
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
  body { margin: 0; padding: 32px; background: #0d0f13; }
  #sfarc-panel {
    width: 100%; max-width: 860px; margin: 0 auto;
    background: var(--sfarc-bg, #fff);
    border: 1px solid var(--sfarc-border, rgba(0,0,0,0.08));
    border-radius: 12px; overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
</style>
</head>
<body class="sfarc-dark-theme">
<div id="harness-toolbar">
  <button id="t-dark" class="active" data-theme="dark">Dark</button>
  <button id="t-light" data-theme="light">Light</button>
</div>

<div id="sfarc-panel" class="sfarc-dark-theme">
  <div class="sfarc-stack-header" style="justify-content: space-between; gap: 12px; margin-bottom: 6px; padding: 12px 16px;">
    <div style="display: flex; align-items: center; gap: 6px;">
      <button class="sfarc-stack-back-btn" title="Back">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
      </button>
      <div class="sfarc-breadcrumb-bar">
        <span class="sfarc-breadcrumb-pill" title="Go back to Account">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          Account
        </span>
        <span class="sfarc-breadcrumb-sep">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </span>
        <span class="sfarc-breadcrumb-pill active">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
          Fields
        </span>
      </div>
    </div>
    <div style="width: 220px; flex-shrink: 0;">
      <input type="text" class="sfarc-search-input" placeholder="Search Fields..." autocomplete="off">
    </div>
  </div>

  <div class="sfarc-stack-content" style="padding: 0;">
    <div id="sfarc-cat-results" style="padding: 12px 16px;">
      <div class="sfarc-obj-grid-header" style="display: grid; grid-template-columns: 2fr 2fr 1.5fr 1fr 1fr; align-items: stretch;">
        <div>Name</div><div>API Name</div><div>Type</div><div>Last Modified</div><div>Modified By</div>
      </div>
${rows}
    </div>
  </div>
</div>

<script>
function applyTheme(light) {
  var h = document.documentElement;
  var b = document.body;
  var p = document.getElementById('sfarc-panel');
  if (light) {
    h.classList.remove('sfarc-dark-theme');
    b.classList.remove('sfarc-dark-theme');
    p.classList.remove('sfarc-dark-theme');
    b.classList.add('light-theme');
  } else {
    h.classList.add('sfarc-dark-theme');
    b.classList.add('sfarc-dark-theme');
    p.classList.add('sfarc-dark-theme');
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

fs.writeFileSync(path.join(__dirname, "scratch-harness/preview-objcat.html"), html);
console.log("Wrote scratch-harness/preview-objcat.html (" + html.length + " bytes)");
