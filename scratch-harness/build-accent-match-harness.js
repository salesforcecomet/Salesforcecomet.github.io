// Builds scratch-harness/accent-match-preview.html — renders the REAL accent
// surfaces (sfir nav slider pill, metadata-exporter primary/selected,
// anonymous-apex run button, code-coverage refresh) with a GREEN accent
// applied via the theme-manager derivation, proving the asset color now
// reaches every surface shown in the user's screenshots.
const fs = require('fs');
const path = require('path');

function read(p) { return fs.readFileSync(path.join(__dirname, '..', p), 'utf8'); }

// Pull only the accent-related rules from the real stylesheets
function sliceRules(css, selectors) {
  const out = [];
  let depth = 0;
  const lines = css.split('\n');
  let buf = [];
  let capturing = false;
  for (const line of lines) {
    if (!capturing && selectors.some(s => line.includes(s))) {
      capturing = true;
      buf = [];
    }
    if (capturing) {
      buf.push(line);
      depth += (line.split('{').length - 1) - (line.split('}').length - 1);
      if (depth <= 0) {
        out.push(buf.join('\n'));
        capturing = false;
      }
    }
  }
  return out.join('\n');
}

const sfir = read('src/styles/sfir.css');
const metaCss = read('src/metadata-exporter.css');
const anonCss = read('src/anonymous-apex.css');

const sfirRules = sliceRules(sfir, ['.sfir-nav-slider']);
const metaRules = sliceRules(metaCss, ['.primary-btn', '.list-item.selected', '.me-list-item.selected', '.search-input:focus']);
const anonRules = sliceRules(anonCss, ['.run-btn', '.app-title', '.drawer-title']);

// theme-manager derivation with GREEN accent
function hexToRgbArr(hex) {
  let h = (hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  if (isNaN(n)) return [33, 150, 243];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(hex, other, weight) {
  const a = hexToRgbArr(hex);
  const b = hexToRgbArr(other);
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
  --primary: ${ACCENT}; --primary-color: ${ACCENT}; --primary-dark: ${ACCENT};
  --primary-color-rgb: ${rgb}; --primary-light-bg: rgba(${rgb}, 0.12);
  --sfarc-primary: ${ACCENT}; --sfarc-accent: ${ACCENT}; --sfarc-accent-rgb: ${rgb};
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
<title>Accent Match — Green</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 28px; background: #f1f5f9; }
  .wrap { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 26px; }
  h2 { font-size: 13px; color: #334155; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; }
  .navrow { display: flex; gap: 4px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 4px; width: fit-content; position: relative; }
  .navitem { position: relative; padding: 7px 16px; font-size: 12.5px; font-weight: 600; color: #475569; border-radius: 7px; z-index: 1; }
  .navitem.active { color: #fff; }
</style>
<style>${vars}</style>
<style>${sfirRules}</style>
<style>${metaRules}</style>
<style>${anonRules}</style>
</head>
<body>
<div class="wrap">
  <div>
    <h2>Header nav — active pill (sfir-nav-slider)</h2>
    <div class="card">
      <ul class="slds-builder-header__nav-list" style="list-style:none;margin:0;padding:0;position:relative;">
        <div class="sfir-nav-slider" style="width: 60px;"></div>
        <li class="slds-builder-header__nav-item" style="padding:0;"><div class="navitem active" style="width: 60px;">Export</div></li>
        <li class="slds-builder-header__nav-item" style="padding:0;"><div class="navitem" style="width: 58px;">Import</div></li>
        <li class="slds-builder-header__nav-item" style="padding:0;"><div class="navitem" style="width: 56px;">Limits</div></li>
        <li class="slds-builder-header__nav-item" style="padding:0;"><div class="navitem" style="width: 74px;">Metadata</div></li>
      </ul>
      <p style="font-size:11.5px;color:#64748b;margin:12px 0 0;">Active pill must be <b style="color:${ACCENT}">green</b> (matches asset color), white text on top.</p>
    </div>
  </div>

  <div>
    <h2>Metadata Exporter — primary button + selected row</h2>
    <div class="card">
      <button class="primary-btn" style="padding:8px 16px;border-radius:6px;border:none;color:white;font-weight:600;cursor:pointer;">Next →</button>
      <div class="list-item selected" style="margin-top:14px;padding:10px 12px;border-radius:8px;font-weight:600;">ApexClass</div>
      <div class="list-item" style="margin-top:6px;padding:10px 12px;border-radius:8px;border:1px solid #e2e8f0;">ApexComponent</div>
    </div>
  </div>

  <div>
    <h2>Anonymous Apex — Run Code + header icon</h2>
    <div class="card" style="background:#0f172a;">
      <span style="color:#e2e8f0;font-size:13px;font-weight:700;">⚡ Anonymous Apex</span>
      <button class="run-btn" style="margin:14px 0 0;height:34px;border:none;border-radius:6px;color:white;font-weight:600;cursor:pointer;">⚡ Run Code</button>
    </div>
  </div>

  <div>
    <h2>Code Coverage — Refresh (real code-coverage.html rule)</h2>
    <div class="card">
      <style>
        .cc-btn-primary { background: var(--sfarc-accent, #2196f3); color: white; box-shadow: 0 2px 8px rgba(var(--sfarc-accent-rgb, 33,150,243), 0.3); }
        .cc-btn-primary:hover { background: var(--sfarc-accent-dark, #1976d2); }
      </style>
      <button class="cc-btn-primary" style="padding:8px 16px;border:none;border-radius:9999px;font-weight:600;cursor:pointer;">↻ Refresh</button>
    </div>
  </div>
</div>
</body>
</html>
`;

const out = path.join(__dirname, 'accent-match-preview.html');
fs.writeFileSync(out, html);
console.log('Wrote ' + out);
