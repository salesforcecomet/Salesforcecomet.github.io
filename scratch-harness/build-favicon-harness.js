// Regenerates scratch-harness/favicon-preview.html with the REAL
// src/colored-favicon.js inlined, plus a canvas shape-verifier panel that
// renders the applied favicon and prints an ASCII art of its alpha so the
// sparkle placement can be checked programmatically (screenshots lag in this
// webview, but canvas pixel reads do not).
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'src/colored-favicon.js'), 'utf8');

const COLORS = ['#0176d3', '#dc2626', '#059669', '#d97706', '#7c3aed', '#db2777'];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Favicon — Salesforce Comet logo, org colors</title>
<style>
  body { margin: 0; background: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; }
  h2 { font-size: 15px; margin: 0 0 10px; }
  .panel { border: 1.5px dashed #cbd5e1; background: #f8fafc; border-radius: 12px; padding: 14px; margin-bottom: 18px; }
  .grid { display: flex; gap: 12px; flex-wrap: wrap; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center; min-width: 110px; }
  .card img { display: block; margin: 0 auto 6px; width: 32px; height: 32px; }
  .hex { font-size: 11px; color: #64748b; font-family: ui-monospace, Menlo, monospace; }
  .dark-panel { background: #12161c; border-color: #1e2530; }
  .dark-panel .card { background: #181d26; border-color: #2a3340; }
  .dark-panel .hex { color: #94a3b8; }
  pre { font-size: 9px; line-height: 1; font-family: ui-monospace, Menlo, monospace; margin: 4px 0 0; white-space: pre; }
  .verify { margin-top: 12px; }
  button { padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-size: 12px; }
</style>
</head>
<body>
<script>${script}<\/script>

<div class="panel">
  <h2>Applied on this page (org color from host)</h2>
  <div class="grid">
    <div class="card">
      <img id="current-fav" alt="current favicon">
      <div class="hex">current</div>
    </div>
  </div>
  <div class="verify">
    <button id="toggle-dot">Toggle green dot</button>
    <button id="toggle-dark">Toggle dark scheme</button>
  </div>
</div>

<div class="panel">
  <h2>Same real logo in other org colors (no background)</h2>
  <div class="grid" id="light-grid"></div>
</div>

<div class="panel dark-panel">
  <h2 style="color:#fff">Same colors on a dark tab background</h2>
  <div class="grid" id="dark-grid"></div>
</div>

<div class="panel">
  <h2>Shape check (applied favicon, alpha channel)</h2>
  <button id="shape-apply">Re-apply favicon & draw shape</button>
  <pre id="shape">(click the button)</pre>
</div>

<script>
  const colors = ${JSON.stringify(COLORS)};
  const b64 = s => 'data:image/svg+xml;base64,' + btoa(s);
  const mkSvg = color => {
    // mirror of createColoredFaviconDataUrl (official cloud mark + sparkle)
    const cloud = 'M416.224 76.763c32.219-33.57 77.074-54.391 126.682-54.391 65.946 0 123.48 36.772 154.12 91.361 26.626-11.896 56.098-18.514 87.106-18.514 118.94 0 215.368 97.268 215.368 217.247 0 119.993-96.428 217.261-215.368 217.261a213.735 213.735 0 0 1-42.422-4.227c-26.981 48.128-78.397 80.646-137.412 80.646-24.705 0-48.072-5.706-68.877-15.853-27.352 64.337-91.077 109.448-165.348 109.448-77.344 0-143.261-48.939-168.563-117.574-11.057 2.348-22.513 3.572-34.268 3.572C75.155 585.74.5 510.317.5 417.262c0-62.359 33.542-116.807 83.378-145.937-10.26-23.608-15.967-49.665-15.967-77.06C67.911 87.25 154.79.5 261.948.5c62.914 0 118.827 29.913 154.276 76.263';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 999.5 699.74" width="32" height="32">' +
      '<path d="' + cloud + '" fill="' + color + '"/>' +
      '</svg>';
  };
  const grids = {
    light: document.getElementById('light-grid'),
    dark: document.getElementById('dark-grid')
  };
  colors.forEach(c => {
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = '<img src="' + b64(mkSvg(c)) + '"><div class="hex">' + c + '</div>';
    grids.light.appendChild(card);
    const card2 = document.createElement('div'); card2.className = 'card';
    card2.innerHTML = '<img src="' + b64(mkSvg(c)) + '"><div class="hex">' + c + '</div>';
    grids.dark.appendChild(card2);
  });

  function refreshCurrent() {
    const links = document.querySelectorAll("link[rel*='icon']");
    const target = document.getElementById('sfarc-colored-favicon');
    if (target) document.getElementById('current-fav').src = target.href;
  }
  refreshCurrent();
  setInterval(refreshCurrent, 300);

  document.getElementById('toggle-dot').addEventListener('click', () => {
    const on = !!document.getElementById('sfarc-green-dot-flag');
    if (on) { document.getElementById('sfarc-green-dot-flag').remove(); }
    else { const f = document.createElement('span'); f.id = 'sfarc-green-dot-flag'; document.body.appendChild(f); }
    window.__sfarcSetPanelIndicator(!on);
    setTimeout(refreshCurrent, 100);
  });
  document.getElementById('toggle-dark').addEventListener('click', () => {
    const dark = !document.getElementById('sfarc-dark-flag');
    if (dark) { const f = document.createElement('span'); f.id = 'sfarc-dark-flag'; document.body.appendChild(f); }
    else { const f = document.getElementById('sfarc-dark-flag'); if (f) f.remove(); }
    // pretend the media query changed
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    if (mql.__sfarcDark === undefined) mql.__sfarcDark = false;
    mql.__sfarcDark = dark;
    window.matchMedia = function () { return { matches: dark, addEventListener: function () {}, addListener: function () {} }; };
    if (window.__sfarcSetPanelIndicator) window.__sfarcSetPanelIndicator(!!document.getElementById('sfarc-green-dot-flag'));
    // force re-apply by removing the link
    const link = document.getElementById('sfarc-colored-favicon');
    if (link) link.remove();
    document.getElementById('sfarc-colored-favicon') && 0;
    setTimeout(refreshCurrent, 100);
  });

  document.getElementById('shape-apply').addEventListener('click', () => {
    const link = document.getElementById('sfarc-colored-favicon');
    if (!link) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = 96; c.height = 96;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 96, 96);
      const d = ctx.getImageData(0, 0, 96, 96).data;
      let out = '';
      for (let y = 0; y < 96; y++) {
        let line = '';
        for (let x = 0; x < 96; x++) {
          const a = d[(y * 96 + x) * 4 + 3];
          const r = d[(y * 96 + x) * 4], g = d[(y * 96 + x) * 4 + 1], b = d[(y * 96 + x) * 4 + 2];
          if (a < 20) line += ' ';
          else if (r > 240 && g > 240 && b > 240) line += '.'; // white sparkle / highlights
          else if (a > 200) line += '#';                        // colored cloud
          else line += '+';
        }
        out += line + '\\n';
      }
      document.getElementById('shape').textContent = out;
    };
    img.src = link.href;
  });
<\/script>
</body>
</html>
`;

// The harness no longer extracts SF_FAVICON_PATHS (removed from the real
// script) — the mkSvg mirror above uses the new COMET_CLOUD_PATH directly.
const finalHtml = html.replace('${JSON.stringify(SF_FAVICON_PATHS_PLACEHOLDER)}', '[]');

fs.writeFileSync(path.join(root, 'scratch-harness/favicon-preview.html'), finalHtml);
console.log('Wrote scratch-harness/favicon-preview.html (' + finalHtml.length + ' bytes)');
