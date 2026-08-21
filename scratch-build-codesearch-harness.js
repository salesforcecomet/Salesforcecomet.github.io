/* Build scratch-harness/preview-codesearch.html — the popup's expanded
   Global Code Search view (header chrome + search row + results pane +
   footer), extracted verbatim from main.js / code-search.js, for UI/UX
   auditing in both themes. */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SRC = path.join(ROOT, "src");

const css = [
  "src/inspector.css",
  "src/custom-dropdown.css",
  "src/glass-toast.css",
  "src/controls.css"
].map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");

const main = fs.readFileSync(path.join(SRC, "main.js"), "utf8");

function slice(fromMark, toMark, label, srcText) {
  const source = srcText || main;
  const a = source.indexOf(fromMark);
  const b = source.indexOf(toMark, a + fromMark.length);
  if (a < 0 || b < 0) {
    console.error(`Could not locate [${label}] (${fromMark} .. ${toMark})`);
    process.exit(1);
  }
  return main.slice(a, b);
}

// 1) Header chrome (title + Import/Export/Metadata/Code Editor/Hide Icons)
const header = slice('<div class="sfarc-header">', "<!-- Global Command Search -->", "header");

// 2) Global command search row (mode dropdown + context pills + input)
const searchRow = slice("<!-- Global Command Search -->", "<!-- Smart Filter Drawer -->", "searchRow");
// strip the trailing blank lines + close div of the container is fine (kept)

// 3+4) Footer (org item + bug/settings icons)
const footer = slice('<div class="sfarc-footer">', "document.body.appendChild(panel);", "footer");

const faJs = fs.readFileSync(path.join(SRC, "lib/font-awesome.min.js"), "utf8");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Code Search — Expanded Popup Audit</title>
<script>${faJs}</script>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0b0d11; }
  /* harness chrome */
  #harness-toolbar {
    position: fixed; top: 10px; right: 14px; z-index: 2147483647;
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 10px; border-radius: 999px;
    background: rgba(30, 30, 30, 0.92); border: 1px solid rgba(100, 116, 139, 0.4);
    font-family: 'Segoe UI', system-ui, sans-serif;
  }
  #harness-toolbar button {
    border: 1px solid rgba(100,116,139,0.4); background: rgba(255,255,255,0.08);
    color: #e2e8f0; font-size: 12px; font-weight: 600; padding: 5px 12px;
    border-radius: 999px; cursor: pointer;
  }
  #harness-toolbar button.active { background: #0284c7; border-color: #38bdf8; color: #fff; }
  #sfarc-panel {
    width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-sizing: border-box; padding: 24px;
  }
  #sfarc-panel .sfarc-popup-container {
    position: relative !important; inset: auto !important;
    width: clamp(820px, 66vw, 1180px) !important;
    height: clamp(620px, 72vh, 860px) !important;
    max-width: 100% !important; max-height: 100% !important;
    display: flex; flex-direction: column; overflow: hidden;
    box-sizing: border-box;
  }
  .sfarc-content { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  /* seeded results pane (from code-search.js injection) */
  .cs-pane { flex: 1; min-width: 0; width: 100%; max-width: 100%; display: flex; flex-direction: column; background: var(--sfarc-body-bg); min-height: 0; box-sizing: border-box; overflow: hidden; }
  ${css}
</style>
</head>
<body class="sfarc-dark-theme">
<div id="harness-toolbar">
  <button id="t-dark" class="active" data-theme="dark">Dark</button>
  <button id="t-light" data-theme="light">Light</button>
</div>

<div id="sfarc-panel" class="sfarc-dark-theme">
  <div class="sfarc-popup-container sfarc-code-search-expanded">
${header}
${searchRow}
    <!-- Content Area -->
    <div class="sfarc-content">
      <div class="cs-pane">
        <div style="display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--sfarc-border); background: var(--sfarc-bg); flex-shrink: 0;">
          <i class="fa-solid fa-magnifying-glass" style="color: var(--primary-color, #0176d3); font-size: 12px;"></i>
          <span style="font-weight: 600; font-size: 13px; color: var(--sfarc-text, #1e293b);">Code Search Results</span>
          <span id="sfarc-code-search-count" style="background: rgba(var(--primary-color-rgb, 1, 118, 211), 0.1); color: var(--primary-color, #0176d3); padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap;">12 files · 34 matches</span>
        </div>
        <div id="sfarc-code-search-results" style="flex: 1; min-width: 0; width: 100%; max-width: 100%; overflow-y: auto; overflow-x: hidden; padding: 10px 0; min-height: 0; box-sizing: border-box;">
          <div style="color: var(--sfarc-secondary-text); text-align: center; margin-top: 20px; padding: 0 20px;">
            No matches found.
          </div>
        </div>
      </div>
    </div>
${footer}
<script>
(function () {
  // seed the code-search context state exactly like main.js does
  var modeLabel = document.getElementById('sfarc-search-mode-label');
  if (modeLabel) modeLabel.textContent = 'Tools';
  var pills = document.getElementById('sfarc-global-context-pills');
  if (pills) {
    pills.innerHTML =
      '<div style="background: rgba(var(--primary-color-rgb, 1, 118, 211), 0.1); color: var(--primary-color, #0176d3); padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; user-select: none;">' +
      '<i class="fa-solid fa-search"></i><span>Global Code Search</span>' +
      '<i class="fa-solid fa-xmark" style="cursor: pointer; margin-left: 4px; opacity: 0.75; font-size: 11px;"></i></div>';
  }
  var input = document.getElementById('sfarc-global-search');
  if (input) input.placeholder = 'Search Global Code Search...';
})();

function applyTheme(light) {
  var b = document.body;
  var p = document.getElementById('sfarc-panel');
  if (light) {
    b.classList.remove('sfarc-dark-theme');
    p.classList.remove('sfarc-dark-theme');
  } else {
    b.classList.add('sfarc-dark-theme');
    p.classList.add('sfarc-dark-theme');
  }
  document.querySelectorAll('#harness-toolbar button').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.theme === (light ? 'light' : 'dark'));
  });
}
document.getElementById('harness-toolbar').addEventListener('click', function (e) {
  if (e.target.dataset.theme === 'light') applyTheme(true);
  else if (e.target.dataset.theme === 'dark') applyTheme(false);
});
</script>
</body>
</html>
`;

// strip the leftover template-literal tail from the footer extraction
const BT = String.fromCharCode(96); // backtick
const cleaned = html.replace(new RegExp("\\s*" + BT + ";\\s*(?=<script>)"), "");

fs.writeFileSync(path.join(__dirname, "scratch-harness/preview-codesearch.html"), cleaned);
console.log("Wrote scratch-harness/preview-codesearch.html (" + cleaned.length + " bytes)");
