const fs = require("fs");
const path = require("path");

const css = [
  "src/styles/sfir.css",
  "src/data-load.css",
  "src/data-export.css"
].map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(__dirname, f), "utf8")).join("\n");

const stripExports = src => src.replace(/^export\s+/gm, "");

let js = "// --- stubs ---\n";
js += `const sfConn = { getSession: () => Promise.resolve({}), instanceHostname: 'test.my.salesforce.com', rest: () => Promise.resolve({ records: [] }) };\n`;
js += `const apiVersion = '60.0';\n`;
js += `const isRecordId = () => false;\n`;
js += stripExports(fs.readFileSync(path.join(__dirname, "src/data-load.js"), "utf8").replace(/^import\s+.*$/gm, ""));
js += `\n// --- init ---\n`;
js += `
  const scroller = document.getElementById('result-table');
  const rt = initScrollTable(scroller);
  const header = ['#', 'OBJECT', 'ID', 'NAME', 'AMOUNT', 'CLOSEDATE'];
  const rows = [];
  rows.push(header);
  for (let i = 1; i <= 200; i++) {
    rows.push([i, 'Opportunity', '006J1000003NvrV' + i + 'IAS', 'Acme Deal ' + i, (i * 1000) + '.00', '2026-0' + (i % 9 + 1) + '-15']);
  }
  rt.dataChange({
    table: rows,
    rowVisibilities: new Array(rows.length).fill(true),
    colVisibilities: new Array(header.length).fill(true),
    preventLineWrap: true
  });
  // expose for evaluation
  window.__rt = rt;
  window.__scroller = scroller;
`;

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Scroll Table Test</title>
<style>
  html, body { margin: 0; height: 100%; font-family: -apple-system, sans-serif; background: #f1f5f9; }
  body.sfarc-dark-theme { background: #0b1220; }
  #result-table {
    position: absolute;
    left: 20px; right: 20px; top: 20px; bottom: 20px;
    overflow: auto;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
  }
</style>
<link rel="stylesheet" href="about:blank">
</head>
<body>
<div id="result-table"></div>
<button id="theme-btn" style="position:fixed; top:6px; right:12px; z-index:99999; padding:4px 10px; border-radius:999px; border:1px solid #94a3b8; cursor:pointer;">🌗 Theme</button>
<script>
window.chrome = {
  storage: { sync: { get: (k, cb) => cb && cb({ sfiSettings: { theme: 'dark' } }), set: () => {} }, local: { get: (k, cb) => cb && cb({}), set: () => {} }, onChanged: { addListener: () => {} } },
  runtime: { sendMessage: (m, cb) => cb && cb(null), getURL: p => p, id: 'stub' },
  tabs: { query: () => {} }
};
window.browser = window.chrome;
</script>
<style>${css}</style>
<script>
${js}
document.getElementById('theme-btn').addEventListener('click', () => {
  const dark = document.body.classList.toggle('sfarc-dark-theme');
  window.__toggleTheme = dark ? 'dark' : 'light';
});
window.__ready = true;
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, "scratch-harness/preview-scrolltable.html"), html);
console.log("table harness written:", (html.length / 1024).toFixed(0), "KB");
