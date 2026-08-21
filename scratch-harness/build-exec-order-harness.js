// scratch-harness/build-exec-order-harness.js
// Static reproduction of the Debug Log "Execution Order" view using the
// EXACT class names the renderer emits, so CSS changes can be verified live.
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'log-viewer.css'), 'utf8');
const cssExtra = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'sfir.css'), 'utf8');

function node({ cls, icon, label, ts, out, inputs }) {
  const outHtml = out ? `<span class="node-output" title="Output"><i class="fa-solid fa-arrow-turn-down"></i> ${out}</span>` : '';
  const inp = inputs ? `<span class="node-inputs" title="Inputs">(${inputs})</span>` : '';
  return `<div class="tree-node-wrapper" data-depth="0">
    <div class="tree-node ${cls}">
      <i class="fa-solid ${icon} node-icon"></i>
      <span class="node-label">${label}</span>
      ${inp}${outHtml}
      <span class="node-timestamp">${ts}</span>
    </div>`;
}
const close = () => `</div>`;

const tree = `
<div class="exec-tree-diagram">
  ${node({ cls: 'node-soql', icon: 'fa-database', label: 'SELECT Auto_Increment_Test_Execution_Index__c, (SELECT ...', ts: '07:15:18.0', out: 'Rows: 1 rows' })}
  ${node({ cls: 'node-dml', icon: 'fa-pen-to-square', label: 'Insert Account', ts: '07:15:18.0' })}
  <div class="tree-children">
    ${node({ cls: 'node-codeunit', icon: 'fa-play', label: 'IndustrytoRating', ts: '07:15:18.40 (40869950)' })}
    ${node({ cls: 'node-codeunit', icon: 'fa-play', label: 'AccounttoContact', ts: '07:15:18.46' })}
    ${node({ cls: 'node-codeunit', icon: 'fa-play', label: 'AccountEmail', ts: '07:15:18.49' })}
    ${node({ cls: 'node-codeunit', icon: 'fa-play', label: 'accountContactPhone', ts: '07:15:18.110 (110866948)' })}
    <div class="tree-children">
      ${node({ cls: 'node-soql', icon: 'fa-database', label: 'SELECT id, phone, accountID FROM Contact WHERE accountId ...', ts: '07:15:18.110 (112604870)', out: 'Rows: 0 rows' })}
    </div>
    ${close()}
    ${node({ cls: 'node-codeunit', icon: 'fa-play', label: 'contactOpportunityonAccount', ts: '07:15:18.115 (115325709)' })}
    ${node({ cls: 'node-method', icon: 'fa-flask', label: 'test2', ts: '07:15:18.126 (126229174)' })}
    ${node({ cls: 'node-flow', icon: 'fa-sitemap', label: 'Contact address change', ts: '07:15:18.136 (136537554)' })}
  </div>
  ${close()}
  ${node({ cls: 'node-dml', icon: 'fa-pen-to-square', label: 'Insert Contact', ts: '07:15:18.0' })}
  <div class="tree-children">
    ${node({ cls: 'node-codeunit', icon: 'fa-play', label: 'AccountTotalAmtfromConAmt', ts: '07:15:18.326 (326467423)' })}
    ${node({ cls: 'node-soql', icon: 'fa-database', label: 'SELECT AccountId, SUM(Amount__c) amountcon FROM Conta...', ts: '07:15:18.326 (332258622)', out: 'Rows: 2 rows' })}
    ${node({ cls: 'node-dml', icon: 'fa-pen-to-square', label: 'Update Account', ts: '07:15:18.326' })}
  </div>
  ${close()}
</div>`;

const summary = `
<div class="summary-list">
  <div class="summary-card card-method">
    <div class="comp-name-row"><span class="comp-name" title="test2">test2</span></div>
    <div class="comp-meta-row">
      <span class="comp-mini-badge type-method">Method</span>
      <span class="comp-meta-item">&bull; 3 runs</span>
      <span class="comp-meta-item">&bull; 12.4 ms</span>
    </div>
  </div>
  <div class="summary-card card-trigger">
    <div class="comp-name-row"><span class="comp-name" title="AccounttoContact">AccounttoContact</span></div>
    <div class="comp-meta-row">
      <span class="comp-mini-badge type-trigger">Trigger</span>
      <span class="comp-meta-item">&bull; 2 runs</span>
      <span class="comp-meta-item">&bull; 1.1 ms</span>
    </div>
  </div>
  <div class="summary-card card-flow">
    <div class="comp-name-row"><span class="comp-name" title="Contact address change">Contact address change</span></div>
    <div class="comp-meta-row">
      <span class="comp-mini-badge type-flow">Flow</span>
      <span class="comp-meta-item">&bull; 1 run</span>
      <span class="comp-meta-item">&bull; 0.8 ms</span>
    </div>
  </div>
</div>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Execution Order — redesign target</title>
<style>${cssExtra}</style>
<style>${css}</style>
<style>
  body { margin: 0; background: #f1f3f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  #log-summary { display: flex; gap: 8px; padding: 10px 16px; background: #fff; border-top: 1px solid #e5e8ee; align-items: center; }
  .fa-solid { font-family: 'Font Awesome 6 Free'; font-weight: 900; }
  i.fa-rotate-left::before { content: '↺'; }
  i.fa-arrow-right-to-bracket::before { content: '→'; }
  i.fa-play::before { content: '▶'; }
  i.fa-database::before { content: '◈'; }
  i.fa-pen-to-square::before { content: '✎'; }
  i.fa-sitemap::before { content: '≋'; }
  i.fa-flask::before { content: '⚗'; }
  i.fa-diagram-project::before { content: '◫'; }
  i.fa-arrow-turn-down::before { content: '↳'; }
</style>
</head>
<body class="sfarc-dark-theme">
<div id="content-execution" style="display:flex; flex-direction: column; height: 100vh;">
  <div class="viewer-subtabs" style="display:flex; gap:4px; padding:8px 12px; background:rgba(255,255,255,0.02);">
    <button type="button" class="viewer-subtab sfarc-active" data-subtarget="order"><i class="fa-solid fa-diagram-project"></i> Execution Order</button>
    <button type="button" class="viewer-subtab" data-subtarget="flow"><i class="fa-solid fa-sitemap"></i> Flow Analysis</button>
  </div>
  <div id="content-order" class="sub-tab-content" style="display:flex; flex:1; min-height:0;">
    <div class="order-layout-wrapper" style="height:auto; flex:1;">
      <div style="flex:1; display:flex; flex-direction:column; min-width:0; overflow:hidden;">
        <div class="order-toolbar">
          <span class="order-toolbar-title"><i class="fa-solid fa-diagram-project"></i> Execution Order</span>
          <div class="step-controls">
            <button id="reset-order-btn" class="viewer-btn" title="Reset"><i class="fa-solid fa-rotate-left"></i></button>
            <button id="step-order-btn" class="viewer-btn" title="Step through execution"><i class="fa-solid fa-arrow-right-to-bracket"></i> Step</button>
            <button id="animate-order-btn" class="viewer-btn primary-btn" title="Animate execution order"><i class="fa-solid fa-play"></i> Animate</button>
          </div>
        </div>
        <div id="order-container" style="flex:1; overflow-y:auto; padding:30px;">${tree}</div>
      </div>
      <div class="order-sidebar">
        <div class="sidebar-header">
          <h3>Component Summary</h3>
          <div class="sidebar-subtitle">Classes, triggers, flows &amp; validations executed</div>
        </div>
        <div class="sidebar-content" id="order-summary-table">${summary}</div>
      </div>
    </div>
  </div>
</div>
<div id="log-summary">
  <div class="summary-item" title="Log Size">2.34 MB</div>
  <div class="summary-item" title="Duration">12.107 s</div>
  <div class="summary-item error" id="issues-badge" title="Click to view first issue">48 issues</div>
</div>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'exec-order-preview.html'), html);
console.log('wrote scratch-harness/exec-order-preview.html');
