// Prove the tab favicon now renders the EXACT Font Awesome icon the popup row
// shows. Loads the real colored-favicon.js with __sfarcFaviconFill set, plus
// the real FA library to render the same icon via <i class="fa-solid ...">.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const faviconJs = fs.readFileSync(path.join(root, 'src/colored-favicon.js'), 'utf8');
const faLib = fs.readFileSync(path.join(root, 'src/lib/font-awesome.min.js'), 'utf8');

// Sample: event-monitor -> fa-satellite-dish (org color)
const fillPath = 'M192 32c0-17.7 14.3-32 32-32C383.1 0 512 128.9 512 288c0 17.7-14.3 32-32 32s-32-14.3-32-32C448 164.3 347.7 64 224 64c-17.7 0-32-14.3-32-32zM60.6 220.6L164.7 324.7l28.4-28.4c-.7-2.6-1.1-5.4-1.1-8.3c0-17.7 14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32c-2.9 0-5.6-.4-8.3-1.1l-28.4 28.4L291.4 451.4c14.5 14.5 11.8 38.8-7.3 46.3C260.5 506.9 234.9 512 208 512C93.1 512 0 418.9 0 304c0-26.9 5.1-52.5 14.4-76.1c7.5-19 31.8-21.8 46.3-7.3zM224 96c106 0 192 86 192 192c0 17.7-14.3 32-32 32s-32-14.3-32-32c0-70.7-57.3-128-128-128c-17.7 0-32-14.3-32-32s14.3-32 32-32z';

const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Favicon == Popup Icon Match</title>
<style>
  body { background: #111418; color: #e2e8f0; font-family: Inter, sans-serif; padding: 24px; }
  .row { display: flex; align-items: center; gap: 28px; margin-bottom: 28px; }
  .cell { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .cell .label { font-size: 11px; color: #94a3b8; }
  .fav { width: 32px; height: 32px; border-radius: 6px; background: #26272b; display: flex; align-items: center; justify-content: center; padding: 4px; }
  .fav img { width: 22px; height: 22px; }
  .pop { width: 32px; height: 32px; border-radius: 8px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 15px; }
  .eq { font-size: 20px; color: #4ade80; }
</style>
</head>
<body>
<h3 style="margin-top:0">Event Monitor — Chrome-tab favicon vs launcher popup row</h3>
<div class="row">
  <div class="cell"><div class="fav"><img id="favimg" alt="favicon"></div><span class="label">Chrome tab favicon<br>(org color, real colored-favicon.js)</span></div>
  <div class="eq">=</div>
  <div class="cell"><div class="pop"><i class="fa-solid fa-satellite-dish"></i></div><span class="label">Launcher popup row<br>(real Font Awesome)</span></div>
</div>
<div id="check"></div>
<script>
${faLib}
</script>
<script>
window.__sfarcFaviconFill = ["${fillPath}"];
</script>
<script>
${faviconJs}
</script>
<script>
  // colored-favicon.js applies on DOMContentLoaded? force it after we set host param
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      const link = document.getElementById('sfarc-colored-favicon');
      const img = document.getElementById('favimg');
      if (link) img.src = link.href;
      // compare the favicon SVG's path to the FA-rendered SVG's path
      const faSvg = document.querySelector('.pop svg path');
      const favSvg = img.src ? decodeURIComponent(img.src.split('base64,')[1]) : '';
      const favPath = favSvg ? favSvg.match(/d="([^"]+)"/) : null;
      const faPath = faSvg ? faSvg.getAttribute('d') : null;
      document.getElementById('check').textContent =
        'FA popup path length: ' + (faPath ? faPath.length : 'N/A') +
        ' | favicon path length: ' + (favPath ? favPath[1].length : 'N/A') +
        (faPath && favPath && faPath === favPath[1] ? ' | IDENTICAL PATH ✓' : ' | paths differ');
    }, 300);
  });
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'favicon-fa-match.html'), out);
console.log('wrote scratch-harness/favicon-fa-match.html (' + out.length + ' bytes)');
