#!/usr/bin/env node
// Builds scratch-harness/dropdown-glass-preview.html — the data-export
// Templates custom dropdown with REAL custom-dropdown.css, verifying the
// menu/trigger are neutral charcoal frosted glass (no slate/navy blue cast)
// in dark mode and white glass in light mode.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src', 'custom-dropdown.css'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Templates dropdown — frosted glass</title>
<style>
${css}
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; height: 100vh; overflow: hidden; }
/* Colorful backdrop so the blur is visible through the glass */
.backdrop { position: fixed; inset: 0; z-index: 0;
  background:
    radial-gradient(circle at 20% 30%, #7c3aed 0%, transparent 45%),
    radial-gradient(circle at 80% 20%, #0ea5e9 0%, transparent 45%),
    radial-gradient(circle at 70% 80%, #f59e0b 0%, transparent 40%),
    radial-gradient(circle at 25% 75%, #10b981 0%, transparent 45%),
    linear-gradient(135deg, #0b0d12 0%, #171b24 100%);
}
.demo { position: relative; z-index: 1; display: flex; gap: 24px; padding: 40px; align-items: flex-start; }
/* Trigger (dark) */
.sfarc-custom-dropdown-trigger {
  display: inline-flex; align-items: center; justify-content: space-between; gap: 8px;
  min-width: 180px; height: 30px; padding: 0 10px; border-radius: 8px; font-size: 12.5px; font-weight: 500; cursor: pointer;
}
/* Light trigger for the light demo */
.sfarc-custom-dropdown-trigger.light {
  background: rgba(255, 255, 255, 0.6) !important;
  backdrop-filter: blur(14px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(14px) saturate(160%) !important;
  border: 1px solid rgba(0, 0, 0, 0.12) !important;
  color: #0f172a !important;
}
#report { position: fixed; bottom: 8px; left: 8px; color: #e2e8f0; font: 11px monospace; white-space: pre-wrap; background: rgba(0,0,0,0.7); padding: 6px 10px; border-radius: 6px; z-index: 5; }
</style>
</head>
<body class="sfarc-dark-theme">
<div class="backdrop"></div>
<div class="demo">
  <div>
    <div class="sfarc-custom-dropdown-trigger" data-theme-demo="dark">Templates ⌄</div>
    <div class="sfarc-custom-dropdown-menu sfarc-dark-theme sfarc-custom-dropdown-menu-wide sfarc-menu-open" id="menu-dark" style="position: static; margin-top: 8px; opacity: 1; visibility: visible; pointer-events: all; transform: none;">
      <div class="sfarc-custom-dropdown-option sfarc-selected"><span class="sfarc-custom-dropdown-checkmark">✓</span><span>Templates</span></div>
      <div class="sfarc-custom-dropdown-option"><span>SELECT Id FROM</span></div>
      <div class="sfarc-custom-dropdown-option"><span>FIND {&quot;&quot;} IN Name Fields RETURNING Contact(Name, Phone)</span></div>
      <div class="sfarc-custom-dropdown-option"><span>{ uiapi { query { Contact { edges { node { Id Name { value } } } } } } }</span></div>
      <div class="sfarc-custom-dropdown-option"><span>SELECT Id FROM WHERE</span></div>
    </div>
  </div>
  <div style="padding-top: 4px">
    <div class="sfarc-custom-dropdown-trigger light">Light trigger ⌄</div>
    <div class="sfarc-custom-dropdown-menu sfarc-custom-dropdown-menu-wide sfarc-menu-open" id="menu-light" style="position: static; margin-top: 8px; opacity: 1; visibility: visible; pointer-events: all; transform: none;">
      <div class="sfarc-custom-dropdown-option"><span>SELECT Id FROM</span></div>
      <div class="sfarc-custom-dropdown-option sfarc-selected"><span class="sfarc-custom-dropdown-checkmark">✓</span><span>FIND {&quot;&quot;} IN NAME FIELDS</span></div>
    </div>
  </div>
</div>
<pre id="report"></pre>
<script>
  function rgba(s) { return s; }
  function measure(id) {
    const el = document.getElementById(id);
    const cs = getComputedStyle(el);
    return {
      bg: cs.backgroundColor,
      blur: cs.backdropFilter || cs.webkitBackdropFilter || 'none',
      border: cs.borderColor,
      radius: cs.borderRadius
    };
  }
  window.__glass = () => JSON.stringify({ dark: measure('menu-dark'), light: measure('menu-light') }, null, 1);
  document.getElementById('report').textContent = window.__glass();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'dropdown-glass-preview.html'), html);
console.log('Wrote scratch-harness/dropdown-glass-preview.html (' + html.length + ' bytes)');
