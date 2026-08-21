/* Build scratch-harness/preview-usercard.html — static replica of the
   redesigned User Detail card (avatar head, status badge, meta list,
   action grid), mirroring the NEW main.js markup, for dark/light auditing. */
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;

const css = [
  "src/inspector.css",
  "src/controls.css"
].map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");

const faJs = fs.readFileSync(path.join(ROOT, "src/lib/font-awesome.min.js"), "utf8");

const arrowIcon = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>`;

const metaRow = (label, value) => `
            <div class="sfarc-user-meta-row">
                <span class="sfarc-user-meta-label">${label}</span>
                <span class="sfarc-user-meta-value">${value || '-'}</span>
            </div>`;

const html = `<!DOCTYPE html>
<html lang="en" class="sfarc-dark-theme">
<head>
<meta charset="UTF-8">
<title>User Detail Card — Redesign Audit</title>
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
  body { margin: 0; padding: 32px; background: #0d0f13; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  #sfarc-panel {
    width: 100%; max-width: 560px; margin: 0 auto;
    background: #0d0f13; border-radius: 14px; padding: 12px 16px 5px 16px;
  }
</style>
</head>
<body class="sfarc-dark-theme">
<div id="harness-toolbar">
  <button id="t-dark" class="active" data-theme="dark">Dark</button>
  <button id="t-light" data-theme="light">Light</button>
</div>

<div id="sfarc-panel" class="sfarc-dark-theme">
  <div class="sfarc-user-card-header">
    <div class="sfarc-user-card-head">
      <div class="sfarc-user-avatar" aria-hidden="true">VU</div>
      <div class="sfarc-user-head-main">
        <div class="sfarc-user-card-title">Vishu user2</div>
        <div class="sfarc-user-card-sub">User Details
          <span class="sfarc-user-status-badge is-active">Active</span>
        </div>
      </div>
      <button class="sfarc-user-arrow-btn" title="Open User Record">
        ${arrowIcon}
      </button>
    </div>

    <div class="sfarc-user-meta-list">
      ${metaRow('Username', 'vishugrade@outlook.com.user2')}
      ${metaRow('Email', 'vishugrade@outlook.com')}
      ${metaRow('Profile', 'Customer Community User')}
      ${metaRow('Role', '-')}
      ${metaRow('License', 'Customer Community')}
    </div>

    <div class="sfarc-user-action-grid">
      <button class="sfarc-user-action-btn"><i class="fa-solid fa-bug"></i> ENABLE DEBUG LOGS</button>
      <button class="sfarc-user-action-btn"><i class="fa-solid fa-chart-column"></i> VIEW SUMMARY</button>
      <button class="sfarc-user-action-btn"><i class="fa-solid fa-user-check"></i> LOGIN AS USER</button>
      <button class="sfarc-user-action-btn"><i class="fa-solid fa-user-secret"></i> LOGIN IN INCOGNITO</button>
      <button class="sfarc-user-action-btn"><i class="fa-solid fa-key"></i> RESET PASSWORD</button>
      <button class="sfarc-user-action-btn"><i class="fa-solid fa-shield-halved"></i> PS ASSIGN</button>
      <button class="sfarc-user-action-btn"><i class="fa-solid fa-users-gear"></i> PSG ASSIGN</button>
      <button class="sfarc-user-action-btn"><i class="fa-solid fa-share-nodes"></i> SHARING</button>
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

fs.writeFileSync(path.join(__dirname, "scratch-harness/preview-usercard.html"), html);
console.log("Wrote scratch-harness/preview-usercard.html (" + html.length + " bytes)");
