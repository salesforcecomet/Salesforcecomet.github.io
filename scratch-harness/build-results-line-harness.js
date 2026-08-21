#!/usr/bin/env node
// Builds scratch-harness/results-line-preview.html — the data-import results
// table rendered with the REAL data-import.css + sfir.css + slds.css + controls.css
// in dark mode, with 3 sample rows, to locate the white line at the table end.
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

const rows = `
        <tr class="sfir-table-row">
          <td class="sfir-row-number">1</td>
          <td><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></td>
          <td><a href="#">Account</a></td>
          <td><a href="#">001d200001v5EqVAAU</a></td>
          <td>Sample Account for Entitlements</td>
          <td>2026-08-15T01:35:32.000+0000</td>
          <td>2026-08-16T05:32:29.000+0000</td>
          <td>005d2000001x</td><td>005d2000001x</td><td>005d2000001x</td><td>San Francisco</td><td>CA</td><td>(415) 555-0100</td>
        </tr>
        <tr class="sfir-table-row">
          <td class="sfir-row-number">2</td>
          <td><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></td>
          <td><a href="#">Account</a></td>
          <td><a href="#">001d200001v5EqVAAU</a></td>
          <td>Second Account</td>
          <td>2026-08-15T01:35:32.000+0000</td>
          <td>2026-08-16T05:32:29.000+0000</td>
          <td>005d2000001x</td><td>005d2000001x</td><td>005d2000001x</td><td>San Francisco</td><td>CA</td><td>(415) 555-0100</td>
        </tr>
        <tr class="sfir-table-row">
          <td class="sfir-row-number">3</td>
          <td><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></td>
          <td><a href="#">Account</a></td>
          <td><a href="#">001d200001v5EqVAAU</a></td>
          <td>Third Account</td>
          <td>2026-08-15T01:35:32.000+0000</td>
          <td>2026-08-16T05:32:29.000+0000</td>
          <td>005d2000001x</td><td>005d2000001x</td><td>005d2000001x</td><td>San Francisco</td><td>CA</td><td>(415) 555-0100</td>
        </tr>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Import results table — white line check</title>
<style>
${cssBundle}
body { margin: 0; background: #0b0c0e; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.wrap { width: 860px; }
</style>
</head>
<body class="sfarc-dark-theme">
<div class="wrap">
  <div class="sfarc-import-results">
    <div class="sfarc-results-scroller" style="max-height: 300px;">
      <table class="sfir-inspector-table" id="result-table">
        <thead>
          <tr class="sfir-table-header-row">
            <th class="sfir-row-number"></th>
            <th></th>
            <th>Object</th>
            <th>Id</th>
            <th>Name</th>
            <th>CreatedDate</th>
            <th>LastModifiedDate</th>
            <th>OwnerId</th>
            <th>CreatedById</th>
            <th>LastModifiedById</th>
            <th>BillingCity</th>
            <th>BillingState</th>
            <th>Phone</th>
          </tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>
    </div>
  </div>
  <pre id="report" style="color:#e2e8f0; font: 11px monospace; margin-top: 12px; white-space: pre-wrap;"></pre>
</div>
<script>
  function hex(v) {
    const m = v.match(/\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)/);
    if (!m) return v;
    return '#' + [m[1], m[2], m[3]].map(n => ('0' + (+n).toString(16)).slice(-2)).join('');
  }
  const rep = [];
  const table = document.querySelector('.sfir-inspector-table');
  const scroller = document.querySelector('.sfarc-results-scroller');
  const results = document.querySelector('.sfarc-import-results');
  rep.push('table border: ' + hex(getComputedStyle(table).borderColor) + ' w=' + getComputedStyle(table).borderBottomWidth);
  rep.push('scroller border: ' + hex(getComputedStyle(scroller).borderColor) + ' bg=' + hex(getComputedStyle(scroller).backgroundColor));
  rep.push('results border: ' + hex(getComputedStyle(results).borderColor) + ' bg=' + hex(getComputedStyle(results).backgroundColor));
  const lastTd = table.querySelector('tbody tr:last-child td');
  rep.push('last td border-bottom: ' + hex(getComputedStyle(lastTd).borderBottomColor) + ' bg=' + hex(getComputedStyle(lastTd).backgroundColor));
  const th = table.querySelector('thead th');
  rep.push('header th border-bottom: ' + hex(getComputedStyle(th).borderBottomColor));
  // horizontal scrollbar?
  rep.push('scroller scrollH: ' + scroller.scrollWidth + ' clientW: ' + scroller.clientWidth + ' scrollV: ' + scroller.scrollHeight + ' clientH: ' + scroller.clientHeight);
  // any ::after / box-shadow on results
  rep.push('results shadow: ' + getComputedStyle(results).boxShadow);
  rep.push('table boxShadow: ' + getComputedStyle(table).boxShadow);
  document.getElementById('report').textContent = rep.join('\\n');
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'results-line-preview.html'), html);
console.log('Wrote scratch-harness/results-line-preview.html (' + html.length + ' bytes)');
