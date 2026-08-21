const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const html = fs.readFileSync(path.join(ROOT, "src", "code-editor.html"), "utf8");

// 1. Extract all <style> blocks
const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");

// 2. Extract body inner HTML
const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/);
const bodyInner = bodyMatch[1];

// 3. Strip all script tags from the body
const bodyNoScripts = bodyInner.replace(/<script[\s\S]*?<\/script>/g, "");

const stub = `
  const root = document.documentElement;
  const THEME_VARS = {
    'sfarc-dark': {
      '--bg-main': '#1e1e1e', '--bg-sidebar': '#181818', '--bg-activity': '#181818', '--bg-header': '#181818',
      '--bg-tab': '#2d2d2d', '--bg-tab-active': '#1e1e1e', '--bg-terminal': '#181818', '--bg-terminal-header': '#252526',
      '--bg-input': '#2d2d2d', '--border-color': '#252526', '--text-main': '#cccccc', '--text-muted': '#858585',
      '--text-active': '#ffffff', '--item-hover': '#2a2d2e', '--item-active': '#37373d', '--icon-color': '#858585',
      '--log-info-color': '#38bdf8', '--log-success-color': '#4ade80', '--log-warn-color': '#fbbf24', '--log-error-color': '#f87171'
    },
    'sfarc-light': {
      '--bg-main': '#ffffff', '--bg-sidebar': '#f3f3f3', '--bg-activity': '#f3f3f3', '--bg-header': '#f3f3f3',
      '--bg-tab': '#ececec', '--bg-tab-active': '#ffffff', '--bg-terminal': '#ffffff', '--bg-terminal-header': '#f3f3f3',
      '--bg-input': '#ffffff', '--border-color': '#e5e5e5', '--text-main': '#333333', '--text-muted': '#616161',
      '--text-active': '#000000', '--item-hover': '#e8e8e8', '--item-active': '#e4e6f1', '--icon-color': '#424242',
      '--log-info-color': '#0284c7', '--log-success-color': '#15803d', '--log-warn-color': '#b45309', '--log-error-color': '#b91c1c'
    },
    'sfarc-amoled': {
      '--bg-main': '#000000', '--bg-sidebar': '#000000', '--bg-activity': '#000000', '--bg-header': '#000000',
      '--bg-tab': '#0a0a0a', '--bg-tab-active': '#000000', '--bg-terminal': '#000000', '--bg-terminal-header': '#0a0a0a',
      '--bg-input': '#0a0a0a', '--border-color': '#1a1a1a', '--text-main': '#e2e8f0', '--text-muted': '#64748b',
      '--text-active': '#ffffff', '--item-hover': '#121212', '--item-active': '#1e1e1e', '--icon-color': '#94a3b8',
      '--log-info-color': '#38bdf8', '--log-success-color': '#4ade80', '--log-warn-color': '#facc15', '--log-error-color': '#f87171'
    }
  };
  function applyTheme(name) {
    document.body.setAttribute('data-theme', name);
    const vars = THEME_VARS[name] || THEME_VARS['sfarc-dark'];
    for (const k in vars) root.style.setProperty(k, vars[k]);
  }

  // hide loader
  const loader = document.getElementById('sfarc-editor-loader');
  if (loader) loader.style.display = 'none';

  // status bar
  const dom = document.getElementById('status-org-domain'); if (dom) dom.textContent = 'vishugrade-dev-ed.lightning.force.com';
  const msg = document.getElementById('status-message'); if (msg) msg.textContent = 'Editing AnimalsCallouts.cls';
  const info = document.getElementById('status-info'); if (info) info.textContent = 'Salesforce Tooling API v60.0';
  const lbl = document.getElementById('deploy-mode-label'); if (lbl) lbl.textContent = 'Auto Deploy: ON';

  // header buttons visible
  ['hdr-btn-run-tests','hdr-btn-security','hdr-btn-exec-apex'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });

  // tabs bar
  const tabsBar = document.getElementById('tabs-bar');
  if (tabsBar) {
    const tabs = [
      { name: 'AnimalsCallouts.cls', active: true },
      { name: 'AnimalService.cls', active: false },
      { name: 'animalServiceController.js', active: false }
    ];
    tabs.forEach(t => {
      const d = document.createElement('div');
      d.className = 'tab' + (t.active ? ' active' : '');
      d.innerHTML = '<span class="material-symbols-rounded" style="font-size:13px;">description</span>' + t.name +
        '<span class="tab-close-btn">✕</span>';
      tabsBar.appendChild(d);
    });
  }

  // file tree
  const tree = document.getElementById('file-tree');
  if (tree) {
    const items = [
      ['classes', 'folder', true],
      ['classes/AnimalService.cls', 'file', false],
      ['classes/AnimalsCallouts.cls', 'file', true],
      ['classes/AnimalSightingService.cls', 'file', false],
      ['lwc', 'folder', true],
      ['lwc/animalServiceController/animalServiceController.js', 'file', false],
      ['lwc/animalServiceController/animalServiceController.html', 'file', false],
      ['triggers', 'folder', false],
      ['triggers/AnimalTrigger.trigger', 'file', false]
    ];
    tree.innerHTML = items.map(it => {
      const isFolder = it[1] === 'folder';
      const cls = isFolder ? 'file-tree-item file-tree-folder' : 'file-tree-item' + (it[2] ? ' file-selected' : '');
      const icon = isFolder ? 'folder' : 'description';
      const pad = (it[0].split('/').length - 1) * 12;
      return '<div class="' + cls + '" style="padding-left:' + (8 + pad) + 'px;"><span class="material-symbols-rounded" style="font-size:13px;">' + icon + '</span> ' + it[0].split('/').pop() + '</div>';
    }).join('');
  }

  // mock monaco editor
  const editor = document.getElementById('monaco-container-left');
  if (editor) {
    const code = [
      'public with sharing class AnimalsCallouts {',
      '    public static HttpResponse getAnimals() {',
      '        Http http = new Http();',
      '        HttpRequest req = new HttpRequest();',
      '        req.setEndpoint(\\'callout:Animals\\');',
      '        req.setMethod(\\'GET\\');',
      '        HttpResponse res = http.send(req);',
      '        if (res.getStatusCode() != 200) {',
      '            throw new CalloutException(\\'Request failed: \\' + res.getStatusCode());',
      '        }',
      '        return res;',
      '    }',
      '}'
    ];
    const lines = code.map((l, i) => '<div class="ce-line"><span class="ce-ln">' + (i + 1) + '</span><span class="ce-code">' + l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span></div>').join('');
    editor.innerHTML = '<div class="ce-topbar"><span class="ce-breadcrumb">classes › AnimalsCallouts.cls</span><span class="ce-actions"><span class="ce-minimap-toggle" title="Minimap">⊞</span><span class="ce-wordwrap" title="Word Wrap">↩</span></span></div>' + lines + '<div class="ce-lastline"></div>';
  }

  // terminal output
  const term = document.getElementById('terminal-body-output');
  if (term) {
    term.innerHTML =
      '<div class="term-line"><span class="term-ts">[10:24:01]</span> <span class="term-info">ℹ</span> Opened AnimalsCallouts.cls</div>' +
      '<div class="term-line"><span class="term-ts">[10:24:12]</span> <span class="term-info">ℹ</span> Auto Deploy enabled — Cmd+S will deploy to org</div>' +
      '<div class="term-line"><span class="term-ts">[10:25:03]</span> <span class="term-ok">✔</span> Saved & deployed AnimalsCallouts.cls to vishugrade-dev-ed (200 OK)</div>' +
      '<div class="term-line"><span class="term-ts">[10:26:44]</span> <span class="term-warn">⚠</span> AnimalService.cls has 2 unused private methods</div>' +
      '<div class="term-line"><span class="term-ts">[10:27:10]</span> <span class="term-err">✖</span> Compilation failed: Invalid type: BadCalloutHelper (line 12)</div>';
    term.style.display = '';
  }

  // harness toolbar
  const tb = document.createElement('div');
  tb.id = 'ce-harness-bar';
  tb.innerHTML = '<button data-t="sfarc-dark" class="active">Dark</button><button data-t="sfarc-light">Light</button><button data-t="sfarc-amoled">AMOLED</button>';
  tb.addEventListener('click', (e) => {
    if (!e.target.dataset.t) return;
    applyTheme(e.target.dataset.t);
    document.querySelectorAll('#ce-harness-bar button').forEach(b => b.classList.toggle('active', b === e.target));
  });
  document.body.appendChild(tb);

  applyTheme('sfarc-dark');
`;

const harnessCss = `
  /* harness */
  #ce-harness-bar {
    position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); z-index: 2147483647;
    display: inline-flex; gap: 6px; padding: 6px 10px; border-radius: 999px;
    background: rgba(20,22,26,0.92); border: 1px solid rgba(100,116,139,0.4); box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  }
  #ce-harness-bar button {
    border: 1px solid rgba(100,116,139,0.4); background: rgba(255,255,255,0.08); color: #e2e8f0;
    font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 999px; cursor: pointer;
  }
  #ce-harness-bar button.active { background: #0284c7; border-color: #38bdf8; color: #fff; }
  /* mock monaco pane */
  #monaco-container-left { background: var(--bg-main); color: var(--text-main); overflow: auto; font-family: 'Fira Code', Consolas, monospace; font-size: 13px; }
  .ce-topbar { position: sticky; top: 0; display: flex; justify-content: space-between; align-items: center; padding: 4px 12px; background: var(--bg-sidebar); border-bottom: 1px solid var(--border-color); font-family: 'Inter', sans-serif; z-index: 5; }
  .ce-breadcrumb { font-size: 11px; color: var(--text-muted); }
  .ce-actions { display: flex; gap: 10px; color: var(--text-muted); font-size: 12px; }
  .ce-line { display: flex; white-space: pre; }
  .ce-ln { width: 46px; flex-shrink: 0; text-align: right; padding-right: 14px; color: var(--text-muted); opacity: 0.7; user-select: none; }
  .ce-code { color: var(--text-main); }
  .ce-lastline { height: 400px; }
  /* terminal lines */
  #terminal-body-output .term-line { font-family: 'Fira Code', Consolas, monospace; font-size: 12px; padding: 1px 0; color: var(--text-main); }
  .term-ts { color: var(--text-muted); }
  .term-info { color: var(--log-info-color); }
  .term-ok { color: var(--log-success-color); }
  .term-warn { color: var(--log-warn-color); }
  .term-err { color: var(--log-error-color); }
  .file-tree-item { display: flex; align-items: center; gap: 6px; padding: 3px 8px; font-size: 12px; color: var(--text-muted); cursor: pointer; }
  .file-tree-item:hover { background: var(--item-hover); }
  .file-selected { background: var(--item-active); color: var(--text-active); }
  .file-tree-folder { color: var(--text-active); font-weight: 500; }
`;

const finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Comet Code Editor — Live Preview</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300,0..1,-50..200" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
<style>${styles}</style>
<style>${harnessCss}</style>
</head>
<body>
${bodyNoScripts}
<script>${stub}</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, "preview-code-editor.html"), finalHtml);
console.log("Wrote scratch-harness/preview-code-editor.html (" + finalHtml.length + " bytes)");
