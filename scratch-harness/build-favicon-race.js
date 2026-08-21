// Reproduce the real Event Monitor page favicon sequence:
// 1. theme-manager.js (blocking, runs initThemeSync immediately + on DOMContentLoaded)
// 2. inline script sets __sfarcFaviconFill (FA satellite-dish path)
// 3. colored-favicon.js (defer) applies the org-colored fill favicon
// Before the fix, theme-manager's updateIconsAndFavicon clobbered it with icon-48.png.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const themeJs = fs.readFileSync(path.join(root, 'src/theme-manager.js'), 'utf8');
const faviconJs = fs.readFileSync(path.join(root, 'src/colored-favicon.js'), 'utf8');

const fillPath = 'M192 32c0-17.7 14.3-32 32-32C383.1 0 512 128.9 512 288c0 17.7-14.3 32-32 32s-32-14.3-32-32C448 164.3 347.7 64 224 64c-17.7 0-32-14.3-32-32zM60.6 220.6L164.7 324.7l28.4-28.4c-.7-2.6-1.1-5.4-1.1-8.3c0-17.7 14.3-32 32-32s32 14.3 32 32s-14.3 32-32 32c-2.9 0-5.6-.4-8.3-1.1l-28.4 28.4L291.4 451.4c14.5 14.5 11.8 38.8-7.3 46.3C260.5 506.9 234.9 512 208 512C93.1 512 0 418.9 0 304c0-26.9 5.1-52.5 14.4-76.1c7.5-19 31.8-21.8 46.3-7.3zM224 96c106 0 192 86 192 192c0 17.7-14.3 32-32 32s-32-14.3-32-32c0-70.7-57.3-128-128-128c-17.7 0-32-14.3-32-32s14.3-32 32-32z';

const stub = `
  window.chrome = window.chrome || {};
  window.chrome.storage = window.chrome.storage || {};
  window.chrome.storage.sync = {
    get: (keys, cb) => { cb({ sfiSettings: { theme: 'dark', accentColor: null } }); },
    onChanged: { addListener: () => {} }
  };
`;

const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Favicon race — theme-manager vs colored-favicon</title>
<style>
  body { background: #1e1e1e; color: #ccc; font-family: monospace; padding: 20px; }
  #fav { width: 64px; height: 64px; background: #26262b; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin: 12px 0; }
  #fav img { width: 44px; height: 44px; }
  #log { white-space: pre-wrap; font-size: 12px; line-height: 1.5; color: #9ade80; }
</style>
</head>
<body>
<h3>Event Monitor favicon — final state after theme-manager + colored-favicon race</h3>
<div id="fav"></div>
<div id="log"></div>
<script>
${stub}
</script>
<script>
${themeJs}
</script>
<script>
window.__sfarcFaviconFill = ["${fillPath}"];
</script>
<script defer>
${faviconJs}
</script>
<script>
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const link = document.getElementById('sfarc-colored-favicon');
      const fav = document.getElementById('fav');
      const log = document.getElementById('log');
      if (link) {
        fav.innerHTML = '<img src="' + link.href + '">';
        const svg = atob(link.href.split('base64,')[1]);
        log.textContent =
          'link id: sfarc-colored-favicon (' + (!!link) + ')\\n' +
          'href starts: ' + link.href.slice(0, 40) + '...\\n' +
          'viewBox: ' + (svg.match(/viewBox="([^"]+)"/) || [])[1] + '\\n' +
          'has org-color fill: ' + /fill="hsl\(/.test(svg) + '\\n' +
          'satellite-dish path present: ' + svg.includes('M192 32c0-17.7') + '\\n' +
          'REMAINING favicon links: ' + document.querySelectorAll("link[rel*='icon']").length;
      } else {
        log.textContent = 'FAIL: sfarc-colored-favicon link missing — theme-manager clobbered it';
      }
    }, 400);
  });
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'favicon-race.html'), out);
console.log('wrote scratch-harness/favicon-race.html (' + out.length + ' bytes)');
