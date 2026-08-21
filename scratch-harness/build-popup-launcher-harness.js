// Builds popup-launcher-preview.html — the new Chrome-style quick-launch
// menu (Data Export / Comet Launcher / Code Editor) with real popup.css.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'src', 'popup.css'), 'utf8');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Popup Launcher Preview</title>
<style>
${css}
html, body { width: 440px; height: auto; min-height: 0; max-height: none; }
body { animation: none; }
</style>
</head>
<body>
    <header class="app-header">
        <div class="header-left" style="display: flex; align-items: center; gap: 8px;">
            <img src="/Users/vishugrade/Salesforce Arc copy/icons/icon-48.png" alt="Logo" style="width: 24px; height: 24px; object-fit: contain;">
            <h1 style="margin: 0; font-size: 15px;">Salesforce Comet</h1>
        </div>
    </header>

    <div class="comet-launcher" role="menu">
      <button class="launcher-item" id="launch-data-export" role="menuitem" title="Open the Data Export tool">
        <span class="launcher-icon launcher-icon-export"><i class="fa-solid fa-file-export"></i></span>
        <span class="launcher-label">Data Export</span>
        <span class="launcher-hint">SOQL</span>
      </button>
      <button class="launcher-item" id="launch-comet" role="menuitem" title="Open the Comet panel on the current Salesforce org">
        <span class="launcher-icon launcher-icon-comet"><i class="fa-solid fa-rocket"></i></span>
        <span class="launcher-label">Comet Launcher</span>
        <span class="launcher-hint">Ctrl+Shift+C</span>
      </button>
      <button class="launcher-item" id="launch-code-editor" role="menuitem" title="Open the Code Editor">
        <span class="launcher-icon launcher-icon-editor"><i class="fa-solid fa-code"></i></span>
        <span class="launcher-label">Code Editor</span>
        <span class="launcher-hint">Apex</span>
      </button>
    </div>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'popup-launcher-preview.html'), html);
console.log('Wrote scratch-harness/popup-launcher-preview.html');
