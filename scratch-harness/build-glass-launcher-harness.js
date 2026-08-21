// Builds a harness page that renders the REAL .sfarc-popup-container styles
// (from src/inspector.css) over a colorful "Salesforce page" background, so we
// can verify the frosted-glass backdrop blur in light and dark themes.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const inspector = fs.readFileSync(path.join(ROOT, 'src', 'inspector.css'), 'utf8');

// Pull just the rules we need for the launcher shell so the harness stays fast.
const wanted = [
  '#sfarc-panel,\n#sfarc-panel.sfarc-dark-theme {',
  '.sfarc-popup-container {',
  '.sfarc-dark-theme .sfarc-popup-container {',
  '#sfarc-panel .sfarc-popup-container {',
  '#sfarc-panel:not(.sfarc-dark-theme) .sfarc-popup-container {',
  '#sfarc-panel.sfarc-dark-theme .sfarc-popup-container {',
  '#sfarc-panel .sfarc-popup-container::before {',
  '#sfarc-panel .sfarc-header {',
  '#sfarc-panel:not(.sfarc-dark-theme) .sfarc-header {',
  '#sfarc-panel.sfarc-dark-theme .sfarc-header {',
  '#sfarc-panel .sfarc-title {',
  '#sfarc-panel .sfarc-header-btn {',
  '#sfarc-panel .sfarc-global-search-container {',
  '#sfarc-panel input.sfarc-raycast-search',
  '#sfarc-panel .sfarc-command-list {',
  '.sfarc-command-item {',
  '.sfarc-command-item.selected {',
  '.sfarc-command-item:not(.selected):hover {',
  '.sfarc-dark-theme .sfarc-command-item:not(.selected):hover {',
  '#sfarc-panel .sfarc-footer {',
  '#sfarc-panel:not(.sfarc-dark-theme) .sfarc-footer {',
  '#sfarc-panel.sfarc-dark-theme .sfarc-footer {',
  '#sfarc-panel-close-btn {',
];

let css = '';
for (const marker of wanted) {
  // Collect the LAST occurrence of each marker — that's the one that wins.
  const idx = inspector.lastIndexOf(marker);
  if (idx === -1) { console.error('MISSING marker:', marker); continue; }
  // capture up to the next top-level '}' — simple brace counter from idx
  let depth = 0, end = idx;
  for (let i = idx; i < inspector.length; i++) {
    const ch = inspector[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  css += inspector.slice(idx, end) + '\n';
}

// Minimal extras the rules reference
css += `
:root {
  --sfarc-accent: #2196f3;
  --sfarc-accent-rgb: 33, 150, 243;
  --sfarc-accent-glow: #38bdf8;
  --sfarc-accent-glow-rgb: 56, 189, 248;
  --sfarc-accent-dark: #1976d2;
  --sfarc-text: #1c1c1e;
}
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Comet Launcher Glassmorphism Harness</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
  /* Colorful fake Salesforce page behind the launcher */
  .sf-page {
    position: fixed; inset: 0; overflow: hidden;
    background:
      radial-gradient(circle at 18% 22%, #ff8a5c 0%, transparent 34%),
      radial-gradient(circle at 78% 30%, #7d5cff 0%, transparent 38%),
      radial-gradient(circle at 60% 80%, #2ec4b6 0%, transparent 40%),
      radial-gradient(circle at 30% 70%, #ff5c8a 0%, transparent 32%),
      linear-gradient(160deg, #f4f6fb 0%, #dfe7f3 100%);
  }
  .sf-page .fake-nav {
    position: absolute; top: 0; left: 0; right: 0; height: 64px;
    background: rgba(255,255,255,0.55); border-bottom: 1px solid rgba(0,0,0,0.08);
    display: flex; align-items: center; padding: 0 20px; gap: 18px;
    font-size: 13px; font-weight: 600; color: #1f2933;
  }
  .sf-page .fake-grid {
    position: absolute; top: 90px; left: 20px; right: 20px; bottom: 20px;
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;
  }
  .sf-page .fake-card {
    border-radius: 12px; background: rgba(255,255,255,0.6);
    border: 1px solid rgba(255,255,255,0.7); height: 120px;
  }
  /* Real #sfarc-panel overlay — background/blur come from the extracted real rules */
  #sfarc-panel {
    position: fixed; inset: 0; z-index: 1000000;
    display: flex; align-items: center; justify-content: center;
  }
  .sfarc-popup-container {
    width: clamp(700px, 58vw, 940px) !important;
    height: clamp(540px, 64vh, 760px) !important;
    border-radius: 16px !important;
    overflow: hidden;
    display: flex; flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  }
  /* header / search / list / footer markup */
  .sfarc-header { display: flex; align-items: center; justify-content: space-between; padding: 6px 18px; }
  .sfarc-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .sfarc-title img { width: 20px; height: 20px; border-radius: 6px; }
  .sfarc-header-controls { display: flex; align-items: center; gap: 8px; }
  .sfarc-header-btn { border: none; background: transparent; font-size: 12px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; border-radius: 6px; padding: 4px 8px; }
  .sfarc-global-search-container { padding: 10px 18px; display: flex; align-items: center; gap: 12px; }
  input.sfarc-raycast-search { flex: 1; border: none; outline: none; background: transparent; font-size: 16px; padding: 6px 4px; }
  .sfarc-command-list { flex: 1; overflow-y: auto; padding: 8px; }
  .sfarc-command-item { display: flex; align-items: center; gap: 10px; padding: 10px 8px; border-radius: 8px; font-size: 13.5px; margin: 2px 4px; color: #1c1c1e; }
  .sfarc-command-item .icon { width: 28px; height: 28px; border-radius: 7px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.06); }
  .sfarc-command-item.selected { color: #fff; }
  .sfarc-command-item.selected .icon { background: rgba(255,255,255,0.22); }
  .sfarc-command-item .desc { margin-left: auto; font-size: 11.5px; opacity: 0.65; }
  .sfarc-footer { display: flex; align-items: center; justify-content: space-between; height: 38px; padding: 0 18px; font-size: 12px; }
  .sfarc-footer-btn { border: none; background: transparent; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
  .controls { position: fixed; bottom: 14px; right: 14px; z-index: 2000000; display: flex; gap: 8px; }
  .controls button { border: 1px solid rgba(0,0,0,0.2); background: #fff; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.15); }
  .tag { position: fixed; top: 12px; right: 12px; z-index: 2000000; background: rgba(0,0,0,0.7); color: #fff; font-size: 12px; padding: 6px 10px; border-radius: 8px; font-family: ui-monospace, monospace; }
</style>
</head>
<body>
  <div class="sf-page">
    <div class="fake-nav"><span>Accounts</span><span>Contacts</span><span>Cases</span><span>Dashboards</span></div>
    <div class="fake-grid"><div class="fake-card"></div><div class="fake-card"></div><div class="fake-card"></div><div class="fake-card"></div></div>
  </div>

  <div id="sfarc-panel">
    <div class="sfarc-popup-container">
      <div class="sfarc-header">
        <div class="sfarc-title"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%232196f3'/%3E%3Cpath d='M12 4l2 6 6 2-6 2-2 6-2-6-6-2 6-2z' fill='white'/%3E%3C/svg%3E">Salesforce Comet</div>
        <div class="sfarc-header-controls">
          <button class="sfarc-header-btn">↓ Import</button>
          <button class="sfarc-header-btn">↑ Export</button>
          <button class="sfarc-header-btn">⤓ Metadata</button>
          <button class="sfarc-header-btn">&#60;&#62; Code Editor</button>
          <button id="sfarc-panel-close-btn" title="Close">✕</button>
        </div>
      </div>
      <div class="sfarc-global-search-container">
        <span style="font-size:12px;border:1px solid rgba(0,0,0,0.18);padding:3px 8px;border-radius:6px;color:#444;">All Modes ▾</span>
        <input class="sfarc-raycast-search" placeholder="Search for commands, objects, users, metadata...">
        <span style="font-size:11px;color:#8e8e93;white-space:nowrap;">As of Today 3:52 pm</span>
      </div>
      <div class="sfarc-command-list">
        <div class="sfarc-command-item selected"><span class="icon">🛡</span> Access &amp; Security Analyzer <span class="desc">FLS, CRUD, Profiles</span></div>
        <div class="sfarc-command-item"><span class="icon">&lt;/&gt;</span> Apex Classes <span class="desc">Inspect Apex</span></div>
        <div class="sfarc-command-item"><span class="icon">☰</span> Apex Flex Queue <span class="desc">Manage queue</span></div>
        <div class="sfarc-command-item"><span class="icon">⚙</span> Apex Jobs <span class="desc">Background jobs</span></div>
        <div class="sfarc-command-item"><span class="icon">⚡</span> Apex Triggers <span class="desc">Trigger inspect</span></div>
      </div>
      <div class="sfarc-footer">
        <span>🗄️ Comet Org</span>
        <div style="display:flex;gap:12px;"><button class="sfarc-footer-btn">Accessibility</button><button class="sfarc-footer-btn">⚙ Settings</button></div>
      </div>
    </div>
  </div>

  <div class="controls">
    <button onclick="document.getElementById('sfarc-panel').classList.remove('sfarc-dark-theme');document.querySelector('.tag').textContent='LIGHT — check glass blur'">Light</button>
    <button onclick="document.getElementById('sfarc-panel').classList.add('sfarc-dark-theme');document.querySelector('.tag').textContent='DARK — check glass blur'">Dark</button>
  </div>
  <div class="tag">LIGHT — check glass blur</div>

<style>${css}</style>
</body>
</html>`;

const out = path.join(__dirname, 'glass-launcher-preview.html');
fs.writeFileSync(out, html);
console.log('Wrote', out, (html.length / 1024).toFixed(1) + 'KB');
