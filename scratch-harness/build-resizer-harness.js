// Builds resizer-preview.html — replicates the Data Export results table
// (#result-area > .sfir-table-scroller with scrolltable cells + row resizers)
// using the real CSS stack in data-export.html's exact load order.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
function css(...names) {
  return names
    .map((n) => {
      const p = path.join(ROOT, 'src', n);
      if (!fs.existsSync(p)) return `/* MISSING ${n} */`;
      return fs.readFileSync(p, 'utf8');
    })
    .join('\n');
}

const rows = Array.from({ length: 60 }, (_, i) => i + 1);

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Export Results Dark-Mode Check</title>
<style>
${css('styles/sfir.css', 'data-load.css', 'data-export.css')}
body { font-family: Inter, system-ui, sans-serif; background: #fff; }
#result-area {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 600px;
  width: 720px;
  margin: 20px;
}
#result-area .sfir-table-scroller {
  flex: 1 1 0 !important;
  min-height: 0 !important;
  height: 100% !important;
  margin: 5px !important;
}
</style>
<script>
function init() {
  const apply = (dark) => {
    document.body.classList.toggle('sfarc-dark-theme', dark);
    const scroller = document.querySelector('.sfir-table-scroller');
    const thumb = document.querySelector('.sfir-table-scroller::-webkit-scrollbar-thumb');
    const el = (id) => document.getElementById(id);
    el('body-cls').textContent = document.body.className;
    el('sc-overflow').textContent = getComputedStyle(scroller).overflow;
    // We can't query a pseudo-element via querySelector; use the stylesheet rule text
    let thumbRule = 'n/a';
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText && rule.selectorText.includes('sfir-table-scroller') && rule.selectorText.includes('thumb')) {
            thumbRule = rule.selectorText + ' { ' + rule.style.backgroundColor + ' }';
          }
        }
      } catch (e) {}
    }
    el('thumb-rule').textContent = thumbRule;
    // Last row + resizer computed colors
    const resizer = document.querySelector('.sfir-row-resizer');
    const cell = resizer ? resizer.closest('.scrolltable-cell') : null;
    el('r-bg').textContent = resizer ? getComputedStyle(resizer).backgroundColor : 'none';
    el('c-bg').textContent = cell ? getComputedStyle(cell).backgroundColor : 'none';
  };
  document.getElementById('dark-toggle').addEventListener('click', () => {
    apply(!document.body.classList.contains('sfarc-dark-theme'));
  });
  apply(true);
}
</script>
</head>
<body class="sfarc-dark-theme">
<div id="result-area">
  <div class="sfir-table-scroller">
    <table>
      <thead>
        <tr>
          <th class="scrolltable-cell header" style="width:40px">#</th>
          <th class="scrolltable-cell header">Id</th>
          <th class="scrolltable-cell header">Name</th>
          <th class="scrolltable-cell header">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr class="sfir-table-row" data-row="${r}">
              <td class="scrolltable-cell sfir-row-number" style="width:40px">${r}<div class="sfir-row-resizer" title="Drag to resize row height (Double-click to reset)"></div></td>
              <td class="scrolltable-cell">001${String(r).padStart(15, '0')}</td>
              <td class="scrolltable-cell">Record ${r}</td>
              <td class="scrolltable-cell">${(r * 137.5).toFixed(2)}</td>
            </tr>`
          )
          .join('\n')}
      </tbody>
    </table>
  </div>
</div>
<div style="position:fixed; bottom:8px; left:8px; z-index:99; background:rgba(0,0,0,.85); color:#fff; font:11px monospace; padding:8px; border-radius:6px">
  <button id="dark-toggle" style="margin-bottom:6px; cursor:pointer">Toggle theme</button><br>
  body class: <b id="body-cls"></b><br>
  scroller overflow: <b id="sc-overflow"></b><br>
  thumb rule: <b id="thumb-rule"></b><br>
  resizer bg: <b id="r-bg"></b><br>
  cell bg: <b id="c-bg"></b>
</div>
<script>init();</script>
</body>
</html>`;

const out = path.join(__dirname, 'resizer-preview.html');
fs.writeFileSync(out, html);
console.log('Wrote', out);
