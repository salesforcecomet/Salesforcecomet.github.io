// scratch-harness/build-accent-btns-harness.js
// Throwaway harness: real inspector.css + the two primary buttons the user
// flagged (Add Current User, Save Log Level), with a simulated LIME accent
// to prove they follow the org accent + dynamic contrast.
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'inspector.css'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Primary buttons follow accent</title>
<style>${css}</style>
<style>
  body { margin: 0; background: #eef0f3; font-family: -apple-system, sans-serif; }
  .bar { display: flex; align-items: center; gap: 8px; padding: 14px; background: #fff; }
  .modal { width: 420px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; }
  .modal .head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #e5e8ee; }
</style>
</head>
<body>
<div id="sfarc-panel" style="--sfarc-accent:#d4f856;--sfarc-accent-rgb:212,248,86;--sfarc-accent-contrast:#20240a;--sfarc-accent-dark:#9fbf2e;">
  <!-- Trace Flags toolbar -->
  <div class="bar">
    <button class="sfarc-debug-btn primary" id="sfarc-add-current-user">Add Current User</button>
  </div>
  <!-- Create Log Level modal header -->
  <div class="modal">
    <div class="head">
      <h3 style="margin:0;font-size:15px;">Create Log Level</h3>
      <div class="sfarc-modal-header-actions" style="display:flex;gap:6px;">
        <button class="sfarc-btn-primary" id="sfarc-save-level-btn" style="display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; padding: 5px 13px; border-radius: 8px; font-size: 12px; font-weight: 600;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          Save Log Level
        </button>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'accent-btns-preview.html'), html);
console.log('wrote scratch-harness/accent-btns-preview.html');
