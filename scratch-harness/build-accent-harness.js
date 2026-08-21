const fs = require('fs');

// Minimal chrome shim for theme-manager
const chromeShim = `
window.chrome = {
  storage: {
    sync: {
      get: (keys, cb) => cb({ sfiSettings: { theme: 'dark', accentColor: '#10b981' } }),
      set: (obj, cb) => { if (cb) cb(); }
    },
    onChanged: { addListener: () => {} }
  },
  runtime: { getURL: (p) => p, id: 'test' }
};
`;

const css = fs.readFileSync('src/inspector.css', 'utf8');
const tm = fs.readFileSync('src/theme-manager.js', 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Accent Harness</title>
<style>${css}</style>
</head>
<body class="sfarc-dark-theme" style="background:#1e1e1e; padding:24px; font-family:system-ui;">
  <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:center;">
    <button class="sfarc-btn sfarc-btn-primary" style="padding:8px 16px; border-radius:8px; border:none; color:#fff; font-weight:600;">Primary Button</button>
    <button class="sfarc-btn sfarc-btn-secondary" style="padding:8px 16px; border-radius:8px;">Secondary</button>
    <span class="sfarc-badge custom" style="padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700;">Custom Badge</span>
    <span class="sfarc-obj-prefix" style="padding:2px 6px; border-radius:4px;">OBJ</span>
    <div class="sfarc-tab active" style="padding:8px 16px; border-bottom:2px solid; cursor:pointer;">Active Tab</div>
    <input class="sfarc-search-input" placeholder="Search…" style="padding:6px 12px; border-radius:16px;">
    <div class="sfarc-trace-active" style="padding:8px 12px; border-left:3px solid; background-color: rgba(var(--primary-color-rgb), 0.1);">Trace Active Row</div>
    <div class="sfarc-confirm-ok" style="padding:8px 16px; border-radius:6px; color:white; font-weight:600;">OK Button</div>
  </div>
  <div id="result" style="margin-top:24px; font-size:12px; color:#ccc; white-space:pre; font-family:monospace;"></div>
<script>
${chromeShim}
${tm}
</script>
<script>
(function(){
  const out = [];
  const cs = getComputedStyle(document.documentElement);
  out.push('--sfarc-accent       : ' + cs.getPropertyValue('--sfarc-accent').trim());
  out.push('--sfarc-accent-rgb   : ' + cs.getPropertyValue('--sfarc-accent-rgb').trim());
  out.push('--sfarc-accent-light : ' + cs.getPropertyValue('--sfarc-accent-light').trim());
  out.push('--sfarc-accent-dark  : ' + cs.getPropertyValue('--sfarc-accent-dark').trim());
  out.push('--sfarc-accent-glow  : ' + cs.getPropertyValue('--sfarc-accent-glow').trim());
  out.push('primary btn bg       : ' + getComputedStyle(document.querySelector('.sfarc-btn-primary')).backgroundColor);
  out.push('custom badge color   : ' + getComputedStyle(document.querySelector('.sfarc-badge.custom')).color);
  out.push('trace-active border  : ' + getComputedStyle(document.querySelector('.sfarc-trace-active')).borderLeftColor);
  out.push('confirm-ok bg        : ' + getComputedStyle(document.querySelector('.sfarc-confirm-ok')).backgroundColor);
  document.getElementById('result').textContent = out.join('\\n');
})();
</script>
</body>
</html>`;

fs.writeFileSync('scratch-harness/accent-preview.html', html);
console.log('Wrote scratch-harness/accent-preview.html');
