const fs = require("fs");
const path = require("path");

const cssFiles = [
  "src/styles/slds/slds.css",
  "src/button.css",
  "src/styles/sfir.css",
  "src/data-load.css",
  "src/data-import.css",
  "src/glass-toast.css",
  "src/custom-dropdown.css",
  "src/controls.css"
];

const css = cssFiles
  .map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(__dirname, "..", f), "utf8"))
  .join("\n");

const stripExports = src => src.replace(/^export\s+/gm, "");

let js = "// --- stubs ---\n";
for (const stub of ["inspector.js", "utils.js", "data-load.js", "caret.js"]) {
  js += "\n" + stripExports(fs.readFileSync(path.join(__dirname, stub), "utf8"));
}

js += `\n// --- extra data-import stubs ---\n`;
js += `
function csvSerialize(rows, sep) { return (rows || []).map(r => (r || []).join(sep || ",")).join("\\n"); }
function getSobjectsList() { return Promise.resolve({ sobjects: [] }); }
function applyProductionStyling() {}
`;
js += "\n// --- PageHeader ---\n";
let phSrc = fs.readFileSync(path.join(__dirname, "..", "src/components/PageHeader.js"), "utf8");
phSrc = stripExports(phSrc).replace("let h = React.createElement;", "let ph = React.createElement;");
phSrc = phSrc.replace(/\bh\(/g, "ph(");
js += phSrc + "\n";

// data-import.js minus import lines
let di = fs.readFileSync(path.join(__dirname, "..", "src/data-import.js"), "utf8");
di = di.replace(/^import\s+.*$/gm, "");
di = di.replace(
  "let model = new Model(sfHost, args);",
  "let model = new Model(sfHost, args);\n    window.__importModel = model;"
);
js += "\n// --- data-import.js ---\n" + di;

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Salesforce Arc — Data Import (Live Preview)</title>
<script>
window.chrome = {
  storage: {
    sync: {
      get: (keys, cb) => { const theme = new URLSearchParams(location.search).get('theme') || 'dark'; const r = { sfiSettings: { theme } }; if (typeof keys === 'string') { r[keys] = r.sfiSettings; } cb && cb(r); },
      set: (o, cb) => cb && cb(),
    },
    local: { get: (k, cb) => cb && cb({}), set: () => {} },
    onChanged: { addListener: () => {} }
  },
  runtime: { sendMessage: (m, cb) => cb && cb(null), getURL: (p) => p, id: 'stub' },
  tabs: { query: () => {} }
};
window.browser = window.chrome;
</script>
<style>
${css}
#arc-preview-theme-btn {
  position: fixed;
  top: 6px;
  right: 12px;
  z-index: 2147483647;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid rgba(100, 116, 139, 0.35);
  background: rgba(255, 255, 255, 0.85);
  color: #1e293b;
  font: 500 12px/1.4 "Inter", -apple-system, sans-serif;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(8px);
}
body.sfarc-dark-theme #arc-preview-theme-btn {
  background: rgba(30, 41, 59, 0.85);
  color: #e2e8f0;
  border-color: rgba(148, 163, 184, 0.4);
}
</style>
</head>
<body>
<div id="root"></div>
<button id="arc-preview-theme-btn" type="button" title="Toggle dark / light theme (preview only)">🌗 Theme</button>
<script>/* react.js */\n${fs.readFileSync(path.join(__dirname, "..", "src/react.js"), "utf8")}</script>
<script>/* react-dom.js */\n${fs.readFileSync(path.join(__dirname, "..", "src/react-dom.js"), "utf8")}</script>
<script>/* button.js */\n${fs.readFileSync(path.join(__dirname, "..", "src/button.js"), "utf8")}</script>
<script>/* custom-tooltip.js */\n${fs.readFileSync(path.join(__dirname, "..", "src/custom-tooltip.js"), "utf8")}</script>
<script>/* colored-favicon.js */\n${fs.readFileSync(path.join(__dirname, "..", "src/colored-favicon.js"), "utf8")}</script>
<script>/* glass-toast.js */\n${fs.readFileSync(path.join(__dirname, "..", "src/glass-toast.js"), "utf8")}</script>
<script>/* custom-dropdown.js */\n${fs.readFileSync(path.join(__dirname, "..", "src/custom-dropdown.js"), "utf8")}</script>
<script type="module">
  const theme = new URLSearchParams(location.search).get('theme') || 'dark';
  document.body.classList.add(theme === 'dark' ? 'sfarc-dark-theme' : 'light-theme');
  window.__toggleTheme = () => {
    const dark = document.body.classList.toggle('sfarc-dark-theme');
    document.body.classList.toggle('light-theme', !dark);
    return dark ? 'dark' : 'light';
  };
  document.getElementById('arc-preview-theme-btn').addEventListener('click', () => window.__toggleTheme());
  ${js}
  window.__ready = true;
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, "preview-data-import.html"), html);
console.log("import preview written:", (html.length / 1024 / 1024).toFixed(2), "MB");
