const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");

const htmlSrc = fs.readFileSync(path.join(SRC, "event-monitor.html"), "utf8");

const styleMatch = htmlSrc.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) throw new Error("No <style> block found");
const styleCss = styleMatch[1];

const extraCss = [
  "src/inspector.css",
  "src/custom-dropdown.css",
  "src/controls.css"
].map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");

const subBar = `
    <div class="sub-bar" id="harness-sub-bar">
        <div class="sub-field" style="flex: 1; min-width: 200px;">
            <label class="sub-label">Platform Events</label>
            <select class="sub-select" id="select-platform-events" data-searchable data-search-placeholder="Search events...">
                <option value="">Select Platform Event...</option>
            </select>
        </div>
        <div class="sub-field" style="flex: 1; min-width: 200px;">
            <label class="sub-label">Change Data Capture (CDC)</label>
            <select class="sub-select" id="select-cdc-events" data-searchable data-search-placeholder="Search CDC objects...">
                <option value="">Select CDC Object...</option>
                <option value="/data/ChangeEvents">All Change Events (/data/ChangeEvents)</option>
            </select>
        </div>
        <div class="sub-field" style="flex: 1.5; min-width: 220px;">
            <label class="sub-label">Custom Channel / Topic</label>
            <input type="text" class="sub-input" id="input-custom-channel" placeholder="e.g. /event/Order_Event__e">
        </div>
        <div class="sub-field" style="width: 140px;">
            <label class="sub-label">Replay Option</label>
            <select class="sub-select" id="select-replay">
                <option value="-1">Newest (-1)</option>
                <option value="-2">Earliest 72h (-2)</option>
                <option value="custom">Custom Replay ID</option>
            </select>
        </div>
        <div class="sub-field" style="justify-content: flex-end;">
            <button class="btn-action primary" id="btn-subscribe" style="height: 32px;">
                <i class="fa-solid fa-plus"></i> Subscribe
            </button>
        </div>
    </div>
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Event Monitor — Control Colors Audit</title>
<style>
${styleCss}
${extraCss}
/* harness chrome */
body { margin: 0; padding: 40px 20px; }
#harness-sub-bar { position: static !important; margin: 0 auto; max-width: 1100px; }
#harness-toolbar {
  position: fixed; top: 8px; right: 12px; z-index: 2147483647;
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
</style>
</head>
<body>
<div id="harness-toolbar">
  <button id="t-dark" class="active" data-theme="dark">Dark</button>
  <button id="t-light" data-theme="light">Light</button>
</div>

${subBar}

<script>
window.chrome = window.chrome || {
  storage: { sync: { get: (k, cb) => cb && cb({}), set: () => {} }, local: { get: (k, cb) => cb && cb({}), set: () => {} }, onChanged: { addListener: () => {} } },
  runtime: { sendMessage: (m, cb) => cb && cb(null), getURL: (p) => p, id: 'stub' },
  tabs: { query: () => {} }
};
window.browser = window.chrome;

// replicate theme-manager.js class behavior exactly
function applyTheme(light) {
  if (light) {
    document.documentElement.classList.remove('sfarc-dark-theme');
    document.body.classList.remove('sfarc-dark-theme');
    document.body.classList.add('light-theme');
  } else {
    document.documentElement.classList.add('sfarc-dark-theme');
    document.body.classList.add('sfarc-dark-theme');
    document.body.classList.remove('light-theme');
  }
  document.querySelectorAll('#harness-toolbar button').forEach(b =>
    b.classList.toggle('active', b.dataset.theme === (light ? 'light' : 'dark')));
}
document.getElementById('harness-toolbar').addEventListener('click', (e) => {
  if (e.target.dataset.theme === 'light') applyTheme(true);
  else if (e.target.dataset.theme === 'dark') applyTheme(false);
});
applyTheme(false);
</script>
<script>
${fs.readFileSync(path.join(SRC, "custom-dropdown.js"), "utf8")}
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, "preview-event-monitor.html"), html);
console.log("Wrote scratch-harness/preview-event-monitor.html (" + html.length + " bytes)");
