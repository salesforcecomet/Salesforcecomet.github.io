#!/usr/bin/env node
// Builds scratch-harness/import-scroll-preview.html from the REAL data-import.css
// + styles/sfir.css + slds.css (the exact stack data-import.html loads), with the
// real workspace markup (config card + mapping card) and 40 mapping rows, plus a
// preview-table placeholder below. Verifies the workspace never grows beyond its
// 56% cap and the mapping table scrolls inside its card.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const load = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');

const cssFiles = [
  'button.css',
  'styles/slds/slds.css',
  'styles/sfir.css',
  'data-load.css',
  'data-import.css',
  'glass-toast.css',
  'custom-dropdown.css',
  'controls.css',
];
const cssBundle = cssFiles.map(f => `/* ===== ${f} ===== */\n${load(f)}`).join('\n\n');

const ROWS = 40;
let rows = '';
for (let i = 0; i < ROWS; i++) {
  const name = 'Field_' + i + '_LongName__c';
  rows += `
        <tr class="sfarc-mapping-tr ${i === 3 ? 'is-error' : ''}">
          <td class="sfarc-mapping-label-text">${name}</td>
          <td><input class="sfarc-mapping-input sfarc-input" value="${name}"></td>
          <td><span class="sfarc-mapping-action">Mapped</span></td>
        </tr>`;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Data Import — workspace scroll check</title>
<style>
${cssBundle}
body { margin: 0; background: #f3f4f6; height: 100vh; overflow: hidden; }
body.sfarc-dark-theme { background: #09090b; }
</style>
</head>
<body class="sfarc-dark-theme">
<div class="sfarc-import-root">
  <div class="slds-m-top_xx-large sfir-page-container">
    <div class="sfarc-import-workspace">
      <section class="sfarc-import-card sfarc-config-card">
        <header class="sfarc-card-header">
          <div class="sfarc-card-heading"><span class="sfarc-card-kicker">Import Configuration</span></div>
        </header>
        <div class="sfarc-card-body sfarc-config-form">
          <div style="padding: 12px; color:#cbd5e1; font-size:12px;">API Type / Action / Object / Batch size / Threads / Data box / Import file / Custom headers</div>
        </div>
      </section>
      <section class="sfarc-import-card sfarc-mapping-card">
        <header class="sfarc-card-header">
          <div class="sfarc-card-heading"><span class="sfarc-card-kicker">Column Mapping</span></div>
          <span class="sfarc-card-chip">${ROWS} columns</span>
        </header>
        <div class="sfarc-card-body">
          <table class="sfarc-mapping-table">
            <thead>
              <tr>
                <th>CSV Header Column</th>
                <th>Mapped Salesforce Field</th>
                <th style="text-align:right">Action</th>
              </tr>
            </thead>
            <tbody>${rows}
            </tbody>
          </table>
        </div>
      </section>
    </div>
    <div class="sfarc-import-results" style="padding:0; flex:1 1 0; min-height:0; display:flex; flex-direction:column;">
      <div style="flex:1 1 0; min-height:0; overflow-y:auto; background:#14181d; border-radius:8px; margin-top:5px; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:12px;">Data preview table (fixed height, always visible)</div>
    </div>
  </div>
</div>
<script>
  // report layout facts into a global for the agent
  window.__layout = function () {
    var ws = document.querySelector('.sfarc-import-workspace');
    var pc = document.querySelector('.sfir-page-container');
    var body = document.querySelector('.sfarc-mapping-card .sfarc-card-body');
    var table = document.querySelector('.sfarc-mapping-table');
    var r = ws.getBoundingClientRect();
    var pr = pc.getBoundingClientRect();
    var br = body.getBoundingClientRect();
    var tr = table.getBoundingClientRect();
    return {
      viewportH: window.innerHeight,
      pageContainerH: Math.round(pr.height),
      workspaceH: Math.round(r.height),
      workspacePctOfViewport: (r.height / window.innerHeight * 100).toFixed(1),
      mappingBodyH: Math.round(br.height),
      tableH: Math.round(tr.height),
      bodyScrolls: body.scrollHeight > body.clientHeight,
      bodyClientH: body.clientHeight,
      bodyScrollH: body.scrollHeight,
      resultsVisible: (function () { var el = document.querySelector('.sfarc-import-results'); var er = el.getBoundingClientRect(); return { top: Math.round(er.top), height: Math.round(er.height) }; })()
    };
  };
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'import-scroll-preview.html'), html);
console.log('Wrote scratch-harness/import-scroll-preview.html (' + html.length + ' bytes)');
