// Visual harness for the Flow Scanner genie launch/minimize animation.
// Inlines the REAL overlay-ui.css (with the genie keyframes) plus a minimal
// panel replicating #fs-panel, and simulates togglePanel's class logic.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/flow-scanner-content/overlay-ui.css'), 'utf8');

const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Flow Scanner — Genie Launch / Minimize</title>
<style>
  body { margin: 0; height: 100vh; overflow: hidden; background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 60%, #4c1d95 100%); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
  .fake-page { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.5); font-size: 13px; letter-spacing: .5px; }
  /* Real Flow Scanner styles for the panel */
  ${css}
  /* Minimal trigger replica (real one is fixed bottom:20px right:20px) */
  #demo-trigger { position: fixed; bottom: 20px; right: 20px; z-index: 2147483646; display: inline-flex; align-items: center; gap: 8px; padding: 7px 16px 7px 11px; background: rgba(20,22,27,0.9); color: #fff; border: 1px solid rgba(255,255,255,0.18); border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 600; box-shadow: 0 12px 32px rgba(0,0,0,0.35); }
  #demo-controls { position: fixed; top: 16px; left: 16px; z-index: 2147483647; display: flex; gap: 8px; }
  #demo-controls button { padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: #fff; cursor: pointer; font-size: 12px; font-weight: 600; }
</style>
</head>
<body>
<div class="fake-page">Fake Salesforce page behind the panel</div>
<div id="demo-controls"><button id="btn-toggle">Toggle (launch / minimize)</button></div>

<!-- Real #fs-panel structure -->
<div id="fs-panel" style="display: none;">
  <div class="fs-panel-header">
    <div class="fs-panel-title">
      <span>Flow Scanner</span>
    </div>
    <div class="fs-panel-actions">
      <button class="fs-icon-btn" id="demo-scan">Scan Flow</button>
    </div>
  </div>
  <div class="fs-panel-body" style="padding: 14px;">
    <div class="fs-issue-row" style="border-left: 3px solid #3b82f6; padding: 8px 10px; margin-bottom: 8px; background: var(--fs-card-bg, #fff); border-radius: 8px;">Missing Auto Layout — FREE_FORM_CANVAS</div>
    <div class="fs-issue-row" style="border-left: 3px solid #ef4444; padding: 8px 10px; margin-bottom: 8px; background: var(--fs-card-bg, #fff); border-radius: 8px;">Flow Naming Convention — test5-1</div>
    <div class="fs-issue-row" style="border-left: 3px solid #ef4444; padding: 8px 10px; margin-bottom: 8px; background: var(--fs-card-bg, #fff); border-radius: 8px;">Missing Null Handler — Case_Lookup</div>
    <div class="fs-issue-row" style="border-left: 3px solid #ef4444; padding: 8px 10px; margin-bottom: 8px; background: var(--fs-card-bg, #fff); border-radius: 8px;">Missing Null Handler — Contact_Lookup</div>
  </div>
</div>

<button id="fs-trigger-btn" style="position: fixed; bottom: 20px; right: 20px; z-index: 2147483646; display: inline-flex; align-items: center; gap: 8px; padding: 7px 16px 7px 11px; background: rgba(20,22,27,0.9); color: #fff; border: 1px solid rgba(255,255,255,0.18); border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 600; box-shadow: 0 12px 32px rgba(0,0,0,0.35);">⚡ Flow Scanner <span id="demo-badge" class="fs-badge">5</span></button>

<script>
  const panel = document.getElementById('fs-panel');
  const btn = document.getElementById('btn-toggle');
  const triggerBtn = document.getElementById('fs-trigger-btn');
  let visible = false;
  // Mirrors togglePanel() in content-script.js exactly (fly-to-button genie)
  function getFlyDeltas(p, b) {
    let dx = 14, dy = 22;
    if (b && b.getBoundingClientRect) {
      try {
        const t = b.getBoundingClientRect();
        const pr = p.getBoundingClientRect();
        if (t.width > 0 && pr.width > 0) {
          dx = (t.left + t.width / 2) - pr.right;
          dy = (t.top + t.height / 2) - pr.bottom;
        }
      } catch (e) {}
    }
    return { dx: Math.round(dx), dy: Math.round(dy) };
  }
  function squashButton(btn) {
    if (!btn) return;
    btn.classList.remove('fs-genie-squash');
    void btn.offsetWidth;
    btn.classList.add('fs-genie-squash');
    clearTimeout(btn.__fsSquashTimer);
    btn.__fsSquashTimer = setTimeout(() => btn.classList.remove('fs-genie-squash'), 480);
  }
  function togglePanel(force) {
    const shouldShow = force !== undefined ? force : !visible;
    visible = shouldShow;
    const flyBtn = triggerBtn.style.display !== 'none' ? triggerBtn : null;
    if (shouldShow) {
      panel.classList.remove('fs-genie-closing', 'fs-genie-opening');
      panel.style.display = 'flex';
      const { dx, dy } = getFlyDeltas(panel, flyBtn);
      panel.style.setProperty('--fs-genie-dx', dx + 'px');
      panel.style.setProperty('--fs-genie-dy', dy + 'px');
      void panel.offsetWidth;
      panel.classList.add('fs-genie-opening');
      squashButton(flyBtn);
    } else {
      panel.classList.remove('fs-genie-opening');
      const { dx, dy } = getFlyDeltas(panel, flyBtn);
      panel.style.setProperty('--fs-genie-dx', dx + 'px');
      panel.style.setProperty('--fs-genie-dy', dy + 'px');
      panel.classList.add('fs-genie-closing');
      squashButton(flyBtn);
      const hideAfterClose = (e) => {
        if (e && e.target !== panel) return;
        panel.removeEventListener('animationend', hideAfterClose);
        if (!visible && panel.classList.contains('fs-genie-closing')) {
          panel.style.display = 'none';
          panel.classList.remove('fs-genie-closing');
        }
      };
      panel.addEventListener('animationend', hideAfterClose);
      setTimeout(hideAfterClose, 460);
    }
  }
  btn.onclick = () => togglePanel();
  triggerBtn.onclick = () => togglePanel();
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, 'genie-preview.html'), out);
console.log('wrote scratch-harness/genie-preview.html');
