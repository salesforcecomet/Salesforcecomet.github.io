// Reproduces the code-editor Create-modal Asset Type custom dropdown with the
// REAL custom-dropdown.css + the editor's trigger overrides, to verify the
// resting drop shadow is gone in light and dark themes.
const fs = require('fs');
const cd = fs.readFileSync('src/custom-dropdown.css', 'utf8');
const edHtml = fs.readFileSync('src/code-editor.html', 'utf8');

// Extract the three trigger override blocks from code-editor.html
function grab(from, to) {
  const s = edHtml.indexOf(from);
  const e = edHtml.indexOf(to);
  if (s < 0 || e < 0 || e <= s) return '';
  return edHtml.slice(s, e);
}
const triggerOverrides = grab(
  '.sfarc-custom-dropdown-container.form-control .sfarc-custom-dropdown-trigger {',
  '.form-control option {'
) + grab(
  'body[data-theme="sfarc-light"] .sfarc-custom-dropdown-container.form-control .sfarc-custom-dropdown-trigger {',
  '/* ── Bulk Permission Wizard — light theme'
) + grab(
  'body[data-theme="sfarc-dark"] .sfarc-custom-dropdown-trigger,',
  'body[data-theme="sfarc-dark"] .sfarc-custom-dropdown-menu,'
);

const harness = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Asset Type Dropdown — No Drop Shadow</title>
<style>
  /* Real custom-dropdown.css */
${cd}
  /* Real code-editor trigger overrides */
${triggerOverrides}
  /* Harness scaffolding */
  body { margin: 0; padding: 28px; font-family: 'Inter', sans-serif; background: #f1f5f9; }
  .card {
    width: 420px; background: #ffffff; border: 1px solid #e2e4e8; border-radius: 12px;
    padding: 18px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
  }
  .card.dark { background: #1e1e1e; border-color: #3f3f46; }
  .create-field-label {
    display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.4px;
    color: #3f3f46; margin-bottom: 6px; text-transform: uppercase;
  }
  .card.dark .create-field-label { color: #c9c9c9; }
  .row { display: flex; gap: 12px; margin-bottom: 22px; }
  .row .form-group { flex: 1; }
  .measure {
    position: fixed; bottom: 8px; left: 8px; z-index: 999;
    background: rgba(0,0,0,0.8); color: #7ee787; font: 11px/1.6 ui-monospace, monospace;
    padding: 8px 10px; border-radius: 8px; white-space: pre;
  }
  #toggle-dark { margin-bottom: 12px; cursor: pointer; }
</style>
</head>
<body>
  <button id="toggle-dark">Toggle dark theme (data-theme)</button>
  <div class="card" id="card">
    <div class="row">
      <div class="form-group">
        <label class="create-field-label" for="aa">Asset Type</label>
        <div class="sfarc-custom-dropdown-container form-control" id="wrap">
          <div class="sfarc-custom-dropdown-trigger" tabindex="0" role="listbox">
            <span class="sfarc-custom-dropdown-value">Lightning Web Component (LWC)</span>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="create-field-label" for="an">Asset Name</label>
        <input type="text" class="form-control" id="an" placeholder="e.g. myAccountViewer" style="height:32px;box-sizing:border-box;border-radius:6px;">
      </div>
    </div>
  </div>
  <div class="measure" id="measure"></div>
<script>
  function measure() {
    const t = document.querySelector('.sfarc-custom-dropdown-trigger');
    const cs = getComputedStyle(t);
    const el = document.getElementById('measure');
    const dark = document.body.getAttribute('data-theme') === 'sfarc-dark';
    el.textContent =
      'trigger box-shadow: ' + cs.boxShadow + '\\n' +
      'theme: ' + (dark ? 'DARK' : 'LIGHT') +
      '   background: ' + cs.backgroundColor;
  }
  document.getElementById('toggle-dark').addEventListener('click', () => {
    document.body.setAttribute('data-theme',
      document.body.getAttribute('data-theme') === 'sfarc-dark' ? 'sfarc-light' : 'sfarc-dark');
    measure();
  });
  document.body.setAttribute('data-theme', 'sfarc-light');
  measure();
</script>
</body>
</html>
`;

fs.writeFileSync('scratch-harness/dropdown-shadow-preview.html', harness);
console.log('written', harness.length, 'bytes');
