// Builds scratch-harness/palette-gradient-preview.html — renders the Comet
// palette container with the REAL inspector.css popup-container gradient
// (base + animated override) under a GREEN accent, proving the palette
// background tints follow the asset color.
const fs = require('fs');
const path = require('path');
const inspector = fs.readFileSync(path.join(__dirname, '..', 'src', 'inspector.css'), 'utf8');

// Pull only popup-container + keyframe rules
function sliceRules(css, selectors) {
  const out = [];
  let depth = 0, capturing = false, buf = [];
  for (const line of css.split('\n')) {
    if (!capturing && selectors.some(s => line.includes(s))) { capturing = true; buf = []; }
    if (capturing) {
      buf.push(line);
      depth += (line.split('{').length - 1) - (line.split('}').length - 1);
      if (depth <= 0) { out.push(buf.join('\n')); capturing = false; }
    }
  }
  return out.join('\n');
}

const rules = sliceRules(inspector, ['.sfarc-popup-container', 'sfarcLightBlueCyanGradient']);

function hexToRgbArr(hex) {
  let h = (hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  if (isNaN(n)) return [33, 150, 243];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(hex, other, weight) {
  const a = hexToRgbArr(hex), b = hexToRgbArr(other);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * weight));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
const ACCENT = '#10b981';
const rgb = hexToRgbArr(ACCENT).join(', ');
const light = mixHex(ACCENT, '#ffffff', 0.45);
const dark = mixHex(ACCENT, '#000000', 0.35);
const glow = mixHex(ACCENT, '#ffffff', 0.22);
const vars = `
:root {
  --primary: ${ACCENT}; --primary-color: ${ACCENT}; --primary-color-rgb: ${rgb};
  --sfarc-accent: ${ACCENT}; --sfarc-accent-rgb: ${rgb};
  --sfarc-accent-light: ${light}; --sfarc-accent-dark: ${dark};
  --sfarc-accent-glow: ${glow}; --sfarc-accent-glow-rgb: ${hexToRgbArr(glow).join(', ')};
  --sfarc-accent-light-rgb: ${hexToRgbArr(light).join(', ')};
  --sfarc-accent-soft: ${mixHex(ACCENT, '#ffffff', 0.9)};
}
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Comet Palette — Accent Gradient</title>
<style>
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .wrap { width: 100%; max-width: 720px; padding: 40px 20px; }
  .note { color: #94a3b8; font-size: 12px; margin-bottom: 14px; }
  .palette { height: 380px; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; }
  .p-header { display: flex; align-items: center; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.08); }
  .p-title { font-size: 15px; font-weight: 700; color: #0f172a; }
  .p-search { margin: 12px 0; height: 36px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.12); background: rgba(255,255,255,0.6); padding: 0 12px; font-size: 13px; color: #475569; display: flex; align-items: center; }
  .p-item { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 8px; font-size: 13px; color: #0f172a; }
  .p-item .ic { width: 26px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center; background: rgba(var(--primary-color-rgb), 0.12); color: var(--primary-color); font-weight: 700; font-size: 12px; }
</style>
<style>${vars}</style>
<style>${rules}</style>
</head>
<body>
<div class="wrap">
  <div class="note">Palette container uses the real <b>inspector.css</b> gradient rules. Accent set to <b style="color:#10b981">green #10b981</b> — the light background must show a <b>green</b> tint (not the old hardcoded blue #e0f2fe).</div>
  <div class="palette sfarc-popup-container" id="sfarc-panel">
    <div class="p-header">
      <div class="p-title">Salesforce Comet</div>
    </div>
    <div class="p-search">🔍 Search for commands, objects, users, metadata...</div>
    <div style="flex:1; overflow:hidden; padding-top:4px;">
      <div class="p-item"><div class="ic">DEV</div> Developer Tools <span style="margin-left:auto; font-size:11px; color:#64748b;">REST, GraphQL, SOQL</span></div>
      <div class="p-item"><div class="ic">EV</div> Event Monitor <span style="margin-left:auto; font-size:11px; color:#64748b;">Platform Events, CDC</span></div>
      <div class="p-item"><div class="ic">AA</div> Execute Anonymous Apex <span style="margin-left:auto; font-size:11px; color:#64748b;">Run Apex, Scripts</span></div>
      <div class="p-item"><div class="ic">OR</div> Org Details <span style="margin-left:auto; font-size:11px; color:#64748b;">Limits, Version</span></div>
    </div>
  </div>
  <div style="margin-top:14px; display:flex; gap:10px; align-items:center;">
    <button id="theme-toggle" style="padding:6px 14px; border-radius:8px; border:1px solid #334155; background:#1e293b; color:#e2e8f0; font-size:12px; cursor:pointer;">Toggle Dark</button>
    <span class="note" id="computed" style="margin:0;"></span>
  </div>
</div>
<script>
  const panel = document.querySelector('.sfarc-popup-container');
  const computed = document.getElementById('computed');
  const show = () => {
    const cs = getComputedStyle(panel);
    computed.textContent = 'background: ' + cs.backgroundImage.slice(0, 90) + '…';
  };
  document.getElementById('theme-toggle').addEventListener('click', () => {
    panel.classList.toggle('sfarc-dark-theme');
    document.body.classList.toggle('sfarc-dark-theme');
    show();
  });
  show();
</script>
</body>
</html>
`;

const out = path.join(__dirname, 'palette-gradient-preview.html');
fs.writeFileSync(out, html);
console.log('Wrote ' + out);
