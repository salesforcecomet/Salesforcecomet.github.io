// Harness: run the REAL colored-favicon.js with the code editor's custom
// stroke path so we can inspect the generated favicon data URL.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const coloredFavicon = fs.readFileSync(path.join(root, 'src/colored-favicon.js'), 'utf8');
const codeEditorHtml = fs.readFileSync(path.join(root, 'src/code-editor.html'), 'utf8');
const customPath = codeEditorHtml.match(/window\.__sfarcFaviconStrokePath = '([^']+)'/)[1];

const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Code Editor Favicon — Live Check</title>
<script>
  // stub chrome.storage so colored-favicon.js runs to completion
  window.chrome = { storage: { local: { get: (k, cb) => cb && cb({}) } } };
</script>
<style>
  body { background: #14161a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; padding: 24px; }
  h3 { color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; font-size: 12px; }
  .card { background: #1e2024; border: 1px solid #2c2f36; border-radius: 10px; padding: 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 16px; }
  img { width: 32px; height: 32px; }
  code { background: #0f1115; padding: 8px 10px; border-radius: 6px; font-size: 11px; color: #7dd3fc; word-break: break-all; max-width: 520px; display: inline-block; }
</style>
</head>
<body>
<h3>Code Editor page favicon (real colored-favicon.js + ?host=org)</h3>
<div class="card">
  <div><img id="fav" alt="favicon" width="32" height="32"></div>
  <code id="decoded"></code>
</div>
<h3>Control — normal Salesforce page favicon (cloud, org color)</h3>
<div class="card">
  <div><img id="fav-cloud" alt="cloud favicon" width="32" height="32"></div>
  <code id="decoded-cloud"></code>
</div>
<script>
  window.__sfarcFaviconStrokePath = '${customPath}';
</script>
<script>
${coloredFavicon}
</script>
<script>
  // Show the favicon colored-favicon.js just generated (custom brackets path).
  const inspect = () => {
    const link = document.getElementById('sfarc-colored-favicon');
    const href = link ? link.href : '';
    document.getElementById('fav').src = href;
    document.getElementById('decoded').textContent = href ? decodeURIComponent(escape(atob(href.split(',')[1]))) : '(none)';
  };
  setTimeout(inspect, 100);
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, 'code-editor-favicon.html'), out);
console.log('wrote scratch-harness/code-editor-favicon.html');
