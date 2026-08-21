const fs = require("fs");
const path = require("path");

const cssFiles = [
  "src/styles/slds/slds.css",
  "src/button.css",
  "src/styles/sfir.css",
  "src/data-load.css",
  "src/data-export.css",
  "src/glass-toast.css",
  "src/custom-dropdown.css",
  "src/controls.css"
];

const css = cssFiles
  .map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(__dirname, f), "utf8"))
  .join("\n");

const stripExports = src => src.replace(/^export\s+/gm, "");

let js = "// --- stubs ---\n";
js += stripExports(fs.readFileSync(path.join(__dirname, "scratch-harness/inspector.js"), "utf8"));
js += "\n" + stripExports(fs.readFileSync(path.join(__dirname, "scratch-harness/utils.js"), "utf8"));
js += "\n" + stripExports(fs.readFileSync(path.join(__dirname, "scratch-harness/data-load.js"), "utf8"));
js += "\n" + stripExports(fs.readFileSync(path.join(__dirname, "scratch-harness/caret.js"), "utf8"));
js += "\n// --- PageHeader ---\n";
let phSrc = fs.readFileSync(path.join(__dirname, "src/components/PageHeader.js"), "utf8");
phSrc = stripExports(phSrc).replace("let h = React.createElement;", "let ph = React.createElement;");
phSrc = phSrc.replace(/\bh\(/g, "ph(");
js += phSrc + "\n";

// data-export.js minus import lines
let de = fs.readFileSync(path.join(__dirname, "src/data-export.js"), "utf8");
de = de.replace(/^import\s+.*$/gm, "");
de = de.replace(
  "let model = new Model({ sfHost, args });",
  `let model = new Model({ sfHost, args });
    window.__model = model;
    window.__seedSuggestions = () => {
      model.expandAutocomplete = true;
      model.autocompleteResults = {
        sobjectName: "Opportunity",
        title: "OPPORTUNITY FIELDS SUGGESTIONS:",
        results: [
          { value: "Description", title: "Description", autocompleteType: "field", dataType: "textarea" },
          { value: "Data_Quality_Description__c", title: "Data_Quality_Description__c", autocompleteType: "field", dataType: "string" },
          { value: "Name", title: "Name", autocompleteType: "field", dataType: "string" },
          { value: "StageName", title: "StageName", autocompleteType: "field", dataType: "picklist" },
          { value: "Amount", title: "Amount", autocompleteType: "field", dataType: "currency" },
          { value: "CloseDate", title: "CloseDate", autocompleteType: "field", dataType: "date" },
          { value: "OwnerId", title: "OwnerId", autocompleteType: "field", dataType: "reference" }
        ]
      };
      model.didUpdate();
    };`
);
js += "\n// --- data-export.js ---\n" + de;

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Salesforce Arc — Data Export (Live Preview)</title>
<script>
// Stateful theme so theme-manager.js's storage re-sync honors the live toggle
// instead of re-reading the (static) ?theme= query on every DOM mutation.
let __previewTheme = new URLSearchParams(location.search).get('theme') || 'dark';
// Back the storage stub with localStorage so the progress bar survives
// reloads — mirrors real chrome.storage.local persisting across pages.
let __previewLocal = {};
try { __previewLocal = JSON.parse(localStorage.getItem('__previewLocal') || '{}') || {}; } catch (e) { __previewLocal = {}; }
let __previewOnChangedFns = [];
function __previewFireChanged(changes, area) { __previewOnChangedFns.forEach(fn => { try { fn(changes, area); } catch (e) {} }); }
window.chrome = {
  storage: {
    sync: {
      get: (keys, cb) => { const r = { sfiSettings: { theme: __previewTheme } }; if (typeof keys === 'string') { r[keys] = r.sfiSettings; } cb && cb(r); },
      set: (o, cb) => cb && cb(),
    },
    local: {
      get: (k, cb) => { if (typeof k === 'string') { cb && cb({ [k]: __previewLocal[k] }); } else { cb && cb(__previewLocal); } },
      set: (o, cb) => { const changes = {}; for (const k of Object.keys(o)) { changes[k] = { oldValue: __previewLocal[k], newValue: o[k] }; } Object.assign(__previewLocal, o); try { localStorage.setItem('__previewLocal', JSON.stringify(__previewLocal)); } catch (e) {} __previewFireChanged(changes, 'local'); cb && cb(); },
      remove: (k, cb) => { const old = __previewLocal[k]; delete __previewLocal[k]; try { localStorage.setItem('__previewLocal', JSON.stringify(__previewLocal)); } catch (e) {} __previewFireChanged({ [k]: { oldValue: old } }, 'local'); cb && cb(); }
    },
    onChanged: { addListener: (fn) => { __previewOnChangedFns.push(fn); } }
  },
  runtime: { sendMessage: (m, cb) => cb && cb(null), getURL: (p) => p, id: 'stub' },
  tabs: { query: () => {} }
};
window.browser = window.chrome;
window.__previewLocal = () => __previewLocal;
window.__previewFireChanged = __previewFireChanged;
window.__previewListenerCount = () => __previewOnChangedFns.length;
</script>
<style>
${css}
/* Live-preview theme toggle (preview-only chrome, not part of the extension) */
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
<script>/* react.js */\n${fs.readFileSync(path.join(__dirname, "src/react.js"), "utf8")}</script>
<script>/* react-dom.js */\n${fs.readFileSync(path.join(__dirname, "src/react-dom.js"), "utf8")}</script>
<script>/* button.js */\n${fs.readFileSync(path.join(__dirname, "src/button.js"), "utf8")}</script>
<script>/* custom-tooltip.js */\n${fs.readFileSync(path.join(__dirname, "src/custom-tooltip.js"), "utf8")}</script>
<script>/* theme-manager.js */\n${fs.readFileSync(path.join(__dirname, "src/theme-manager.js"), "utf8")}</script>
<script>/* colored-favicon.js */\n${fs.readFileSync(path.join(__dirname, "src/colored-favicon.js"), "utf8")}</script>
<script>/* glass-toast.js */\n${fs.readFileSync(path.join(__dirname, "src/glass-toast.js"), "utf8")}</script>
<script>/* custom-dropdown.js */\n${fs.readFileSync(path.join(__dirname, "src/custom-dropdown.js"), "utf8")}</script>
<script type="module">
  const theme = new URLSearchParams(location.search).get('theme') || 'dark';
  document.body.classList.add(theme === 'dark' ? 'sfarc-dark-theme' : 'light-theme');
  // theme-manager.js applies the theme to both <html> and <body>; keep the
  // preview toggle consistent so html-level .sfarc-dark-theme rules flip too.
  document.documentElement.classList.toggle('sfarc-dark-theme', theme === 'dark');
  window.__toggleTheme = () => {
    const dark = document.body.classList.toggle('sfarc-dark-theme');
    document.body.classList.toggle('light-theme', !dark);
    document.documentElement.classList.toggle('sfarc-dark-theme', dark);
    __previewTheme = dark ? 'dark' : 'light';
    return dark ? 'dark' : 'light';
  };
  document.getElementById('arc-preview-theme-btn').addEventListener('click', () => window.__toggleTheme());
  ${js}
  window.__ready = true;
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, "scratch-harness/preview-data-export.html"), html);
console.log("preview written:", (html.length / 1024 / 1024).toFixed(2), "MB");
