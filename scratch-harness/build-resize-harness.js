// Harness: embed the REAL initScrollTable implementation (from data-load.js)
// + the real table CSS so we can simulate a row drag-resize and diagnose why
// dragging doesn't resize rows in import/export.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let dl = fs.readFileSync(path.join(ROOT, 'src', 'data-load.js'), 'utf8');
// strip the ES import lines (they need inspector.js which needs chrome)
dl = dl.replace(/^import .*$/gm, '');
// make exported functions global in the plain-script harness
dl = dl.replace(/^export function /gm, 'function ');
dl = dl.replace(/^export const /gm, 'const ');
dl = dl.replace(/^export class /gm, 'class ');

// extract just initScrollTable + helpers it references (cellToString, renderCell,
// renderHeaderCell, etc. are all inside the file; since the file is one big
// module we can't isolate — instead embed the WHOLE file minus imports and
// provide stubs for anything missing at runtime).
// initScrollTable references: s (helper?), Enumerable, DescribeInfo — grep them.
const uses = [...new Set([
  ...dl.match(/\b(cellToString|renderCell|renderHeaderCell|s|Enumerable|DescribeInfo|sfirConfirm|isRecordId|sfConn|apiVersion)\b/g) || []
])];

const cssParts = [];
function grabCss(file, markers) {
  let css = fs.readFileSync(file, 'utf8');
  let out = '';
  for (const m of markers) {
    const i = css.indexOf(m);
    if (i === -1) continue;
    let depth = 0, end = i;
    for (let k = i; k < css.length; k++) {
      const ch = css[k];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = k + 1; break; } }
    }
    out += css.slice(i, end) + '\n';
  }
  return out;
}

// grab the table + scrolltable + resizer CSS from data-export.css
cssParts.push(grabCss(path.join(ROOT, 'src', 'data-export.css'), [
  '.sfir-inspector-table', 'table.sfir-inspector-table th', 'table.sfir-inspector-table td',
  '.sfir-inspector-table .sfir-row-number', 'table.sfir-inspector-table th.sfir-row-number',
  '.scrolltable-scrolled', '.sfir-table-row', 'body.sfarc-dark-theme .sfir-inspector-table'
]));

// grab resizer css from sfir.css
cssParts.push(grabCss(path.join(ROOT, 'src', 'styles', 'sfir.css'), [
  '.sfir-row-resizer', 'tr.sfir-row-resizing', '.scrolltable-scrolled tr:hover'
]));

const stubs = `
// stubs for things data-load.js references
function cellToString(v){ if(v==null) return ''; return String(v); }
function renderCell(data, cell, td, r, c, onChange){ td.textContent = cell == null ? '' : String(cell); }
function renderHeaderCell(data, cell, td, c){ td.textContent = cell == null ? '' : String(cell); }
window.sfirConfirm = window.sfirConfirm || (() => {});
window.isRecordId = window.isRecordId || (() => false);
`;

const harness = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Row Resize Harness — real data-load.js</title>
<style>
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  #scroller {
    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
    overflow: auto; background: #fff;
  }
  .controls { position: fixed; bottom: 12px; right: 12px; z-index: 9999; display: flex; gap: 8px; }
  .controls button { border: 1px solid rgba(0,0,0,0.2); background: #fff; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.15); }
  .status { position: fixed; top: 10px; left: 10px; z-index: 9999; background: rgba(0,0,0,0.75); color: #fff; font-size: 12px; padding: 6px 10px; border-radius: 8px; font-family: ui-monospace, monospace; white-space: pre; }
</style>
<style>${cssParts.join('\n')}</style>
</head>
<body>
  <div id="scroller"></div>
  <div class="status" id="status">loading...</div>
  <div class="controls">
    <button onclick="simulateDrag()">Simulate Row Drag +120px</button>
    <button onclick="location.reload()">Reload</button>
  </div>
<script>
${stubs}
${dl}
</script>
<script>
// initScrollTable is now a global function declaration from the embedded
// data-load.js (imports stripped, export keywords removed).
const scroller = document.getElementById('scroller');
const st = initScrollTable(scroller);

// build fake data: 30 rows, 3 cols
const table = [['OBJECT', 'ID', 'NAME']];
for (let i = 1; i <= 30; i++) table.push(['Account', '0012000001REQVAA' + (i % 10), 'Row ' + i]);
st.dataChange({
  table,
  header: table[0],
  data: table.slice(1),
  rowVisibilities: new Array(table.length).fill(true),
  colVisibilities: new Array(3).fill(true),
  preventLineWrap: true
});

const status = document.getElementById('status');
function refreshStatus() {
  const r = st.getRowHeights ? st.getRowHeights() : null;
  status.textContent = 'rows: ' + table.length + '\\nresizers: ' + document.querySelectorAll('.sfir-row-resizer').length;
}
refreshStatus();

// Simulate: mousedown on first data row's resizer, move +120px, mouseup.
function simulateDrag() {
  const resizer = document.querySelector('.sfir-row-resizer');
  if (!resizer) { status.textContent = 'NO RESIZER FOUND'; return; }
  const tr = resizer.closest('tr');
  const before = tr ? tr.getBoundingClientRect().height : 0;
  const rect = resizer.getBoundingClientRect();
  const startY = rect.top + 3;

  const md = new MouseEvent('mousedown', { bubbles: true, cancelable: true, pageY: startY, clientY: startY });
  resizer.dispatchEvent(md);

  // fire several mousemoves on document
  let lastH = -1;
  for (let i = 1; i <= 12; i++) {
    const y = startY + i * 10;
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, pageY: y, clientY: y }));
    const h = tr ? tr.style.height : null;
    if (h) lastH = parseFloat(h);
  }
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, pageY: startY + 120, clientY: startY + 120 }));

  setTimeout(() => {
    const after = tr ? tr.getBoundingClientRect().height : 0;
    status.textContent = 'before: ' + before.toFixed(1) + 'px\\nmid-drag style.height: ' + lastH + 'px\\nafter mouseup: ' + after.toFixed(1) + 'px';
  }, 50);
}
</script>
</body>
</html>`;

const out = path.join(__dirname, 'row-resize-preview.html');
fs.writeFileSync(out, harness);
console.log('Wrote', out, (harness.length / 1024).toFixed(1) + 'KB');
console.log('data-load uses:', uses.join(', '));
