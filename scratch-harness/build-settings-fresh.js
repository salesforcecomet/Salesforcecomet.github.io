// Build a fresh standalone settings preview from the CURRENT settings.html/css/js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/settings.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/settings.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/settings.js'), 'utf8');

// Extract the <body> content of settings.html
const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
if (!bodyMatch) { console.error('no body'); process.exit(1); }
let body = bodyMatch[1];

// Remove the real script/link tags (we inline below)
body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
body = body.replace(/<link\b[^>]*>/gi, '');

// Font Awesome from CDN (matches settings.html's own include style)
const fa = '<script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/js/all.min.js"></script>';

// settings.js expects chrome.storage — stub it so the page renders default state
const jsStub = `
  window.chrome = window.chrome || {};
  if (!window.chrome.storage) {
    window.chrome.storage = {
      sync: {
        get: (keys, cb) => { const o = {}; if (Array.isArray(keys)) keys.forEach(k => o[k] = undefined); else if (typeof keys === 'string') o[keys] = undefined; else Object.assign(o, keys); cb && cb(o); },
        set: (obj, cb) => { cb && cb(); },
        onChanged: { addListener: () => {}, removeListener: () => {} }
      },
      local: {
        get: (keys, cb) => { const o = {}; if (Array.isArray(keys)) keys.forEach(k => o[k] = undefined); else if (typeof keys === 'string') o[keys] = undefined; else Object.assign(o, keys); cb && cb(o); },
        set: (obj, cb) => { cb && cb(); },
        onChanged: { addListener: () => {}, removeListener: () => {} }
      }
    };
  }
  window.chrome.runtime = window.chrome.runtime || {};
  window.chrome.runtime.getManifest = () => ({ version: '3.1.1' });
  window.chrome.runtime.getURL = (p) => p;
  window.chrome.runtime.id = 'test-extension-id';
  window.chrome.extension = window.chrome.extension || { getURL: (p) => p };
  if (!window.chrome.tabs) window.chrome.tabs = { create: () => {}, query: (q, cb) => cb && cb([]) };
  if (!window.chrome.contextMenus) window.chrome.contextMenus = { create: () => {}, removeAll: (cb) => cb && cb() };
  if (!window.chrome.permissions) window.chrome.permissions = { contains: (p, cb) => cb && cb(false), request: (p, cb) => cb && cb(false) };
`;

const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Settings — Fresh Preview</title>
${fa}
<style>
body { margin: 0; }
${css}
</style>
</head>
<body>
${body}
<script>
${jsStub}
</script>
<script>
${js}
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'settings-fresh.html'), out);
console.log('wrote scratch-harness/settings-fresh.html (' + out.length + ' bytes)');
