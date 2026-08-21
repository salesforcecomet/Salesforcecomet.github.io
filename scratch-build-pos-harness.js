/* Build scratch-harness/preview-pos.html — isolates the Create Asset modal's
   API Version custom dropdown to measure menu anchoring. */
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;

const dropdownCss = fs.readFileSync(path.join(ROOT, "src/custom-dropdown.css"), "utf8");
const dropdownJs = fs.readFileSync(path.join(ROOT, "src/custom-dropdown.js"), "utf8");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Dropdown Position Audit</title>
<style>
  :root {
    --text-muted: #9ca3af;
    --border-color: #3f3f46;
    --primary: #3b82f6;
  }
  body {
    margin: 0; padding: 0; background: #161616; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .modal-overlay {
    position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
    background: rgba(0, 0, 0, 0.55); z-index: 9000; overflow: auto; padding: 20px;
  }
  .modal-card {
    width: 560px; max-height: 86vh; overflow: auto; box-sizing: border-box;
    background: #1e1e1e; border: 1px solid #3f3f46; border-radius: 12px; padding: 18px;
    animation: ce-modal-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes ce-modal-in {
    from { opacity: 0; transform: translateY(12px) scale(0.94); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .form-group { margin-bottom: 10px; }
  .create-api-version { max-width: 170px; }
  .create-field-label {
    font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--text-muted); margin-bottom: 4px; display: block;
  }
  div.sfarc-custom-dropdown-container.form-control {
    padding: 0 !important; border: none !important; background: transparent !important;
  }
  .sfarc-custom-dropdown-container.form-control .sfarc-custom-dropdown-trigger {
    background: #27272a !important; border: 1px solid #3f3f46 !important; color: #f4f4f5 !important;
    padding: 5px 8px !important; border-radius: 5px !important; font-size: 12px !important; height: 30px !important;
  }
  .spacer { height: 70vh; }
  .bottom-note { color: #71717a; font-size: 11px; margin-top: 6px; }
  #probe {
    position: fixed; top: 8px; left: 8px; z-index: 2147483647; font: 11px/1.5 monospace;
    background: #0f0f0f; border: 1px solid #444; color: #e4e4e7; padding: 8px 10px; border-radius: 8px;
    white-space: pre; max-width: 90vw;
  }
</style>
<style>${dropdownCss}</style>
</head>
<body>
<div id="probe">waiting…</div>
<div id="harness-toolbar" style="position:fixed;top:8px;right:10px;z-index:2147483647;display:flex;gap:6px">
  <button id="b-open">Open API Version</button>
  <button id="b-close">Close</button>
</div>

<div class="modal-overlay" id="overlay">
  <div class="modal-card" id="card">
    <div style="font-weight:600;color:#e4e4e7;margin-bottom:14px;font-size:14px">Create New Salesforce Asset</div>

    <!-- tall filler to push API Version near the bottom of the card -->
    <div class="spacer"></div>

    <div class="form-group create-api-version">
      <label class="create-field-label" for="lwc-api-version">API Version</label>
      <select id="lwc-api-version" class="form-control">
        <option value="62.0">62.0</option>
        <option value="61.0">61.0</option>
        <option value="60.0" selected>60.0</option>
        <option value="59.0">59.0</option>
        <option value="58.0">58.0</option>
        <option value="__custom__">Custom…</option>
      </select>
      <div class="bottom-note">Pick <b>Custom…</b> to enter a version not listed.</div>
    </div>
  </div>
</div>

<script>${dropdownJs}</script>
<script>
  const probe = document.getElementById('probe');
  function measure(label) {
    const trigger = document.querySelector('.sfarc-custom-dropdown-container .sfarc-custom-dropdown-trigger');
    const menu = document.querySelector('.sfarc-custom-dropdown-menu');
    if (!trigger) { probe.textContent = label + ': trigger not found'; return; }
    const tr = trigger.getBoundingClientRect();
    const card = document.getElementById('card').getBoundingClientRect();
    let menuRect = menu ? menu.getBoundingClientRect() : null;
    const menuStyle = menu ? {top: menu.style.top, left: menu.style.left, width: menu.style.width, display: menu.style.display} : null;
    probe.textContent = label + '\\n' +
      'card: top=' + card.top.toFixed(0) + ' bottom=' + card.bottom.toFixed(0) + ' h=' + card.height.toFixed(0) + '\\n' +
      'trigger: top=' + tr.top.toFixed(0) + ' bottom=' + tr.bottom.toFixed(0) + ' left=' + tr.left.toFixed(0) + ' w=' + tr.width.toFixed(0) + '\\n' +
      'menu: ' + (menuRect ? ('top=' + menuRect.top.toFixed(0) + ' bottom=' + menuRect.bottom.toFixed(0) + ' left=' + menuRect.left.toFixed(0) + ' w=' + menuRect.width.toFixed(0)) : 'N/A') + '\\n' +
      'menuStyle: ' + JSON.stringify(menuStyle);
  }
  document.getElementById('b-open').addEventListener('click', () => {
    const trigger = document.querySelector('.sfarc-custom-dropdown-container .sfarc-custom-dropdown-trigger');
    if (trigger) trigger.click();
    setTimeout(() => measure('AFTER OPEN'), 350); // let animation settle
  });
  document.getElementById('b-close').addEventListener('click', () => {
    document.querySelectorAll('.sfarc-custom-dropdown-container.sfarc-open').forEach(el => el.classList.remove('sfarc-open'));
    probe.textContent = 'closed';
  });
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, "scratch-harness/preview-pos.html"), html);
console.log("Wrote scratch-harness/preview-pos.html (" + html.length + " bytes)");
