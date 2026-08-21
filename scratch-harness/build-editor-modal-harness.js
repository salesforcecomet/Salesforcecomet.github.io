const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");

const htmlSrc = fs.readFileSync(path.join(SRC, "code-editor.html"), "utf8");

// 1. Extract the full <style> block
const styleMatch = htmlSrc.match(/<style>([\s\S]*?)<\/style>/);
if (!styleMatch) throw new Error("No <style> block found");
const styleCss = styleMatch[1];

// 2. Extract the #create-modal markup (from its opening div to its final closing div,
//    right before the "Create New File in LWC Bundle Modal" comment)
const startTok = '    <div id="create-modal" class="modal-overlay">';
const startIdx = htmlSrc.indexOf(startTok);
if (startIdx === -1) throw new Error("create-modal not found");
const endTok = "<!-- Create New File in LWC Bundle Modal -->";
const endIdx = htmlSrc.indexOf(endTok);
if (endIdx === -1) throw new Error("end marker not found");
const modalHtml = htmlSrc.slice(startIdx, endIdx).trim();

// 3. Extra stylesheets the page relies on
const extraCss = [
  "src/glass-toast.css",
  "src/custom-dropdown.css",
  "src/controls.css"
].map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");

const stripExports = src => src.replace(/^export\s+/gm, "");

// 4. JS the modal needs (custom dropdowns + tooltips + FA icons)
const js = `
${stripExports(fs.readFileSync(path.join(SRC, "custom-tooltip.js"), "utf8"))}
${fs.readFileSync(path.join(SRC, "custom-dropdown.js"), "utf8")}
`;

// 5. Extract the real renderSecurityFindings function from code-editor.js
//    (balanced-brace extraction at the top level)
const ceSrc = fs.readFileSync(path.join(SRC, "code-editor.js"), "utf8");
function extractFn(src, name) {
  const start = src.indexOf(`function ${name}`);
  if (start === -1) throw new Error(`${name} not found`);
  let depth = 0, i = src.indexOf("{", start);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
}
const renderFn = extractFn(ceSrc, "renderSecurityFindings");
const escapeFn = extractFn(ceSrc, "escapeHtml");

// Test-run UI helpers (extracted verbatim from source so the harness previews
// the real behavior)
const testRunFns = [
  "getTestRunCard",
  "formatElapsed",
  "updateTestRunCard",
  "renderTestRunResults",
  "jumpToTestMethod"
].map(name => extractFn(ceSrc, name)).join("\n\n");

// Problems panel helpers
const problemFns = [
  "cleanErrorMessage",
  "problemSeverity",
  "updateProblemsSummary",
  "clearAllProblems",
  "addProblemDiagnostic"
].map(name => extractFn(ceSrc, name)).join("\n\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Create New Salesforce Asset — Live Preview</title>
<style>
${styleCss}
${extraCss}
/* harness chrome */
#harness-toolbar {
  position: fixed;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(30, 30, 30, 0.92);
  border: 1px solid rgba(100, 116, 139, 0.4);
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  font-family: 'Segoe UI', system-ui, sans-serif;
}
#harness-toolbar button {
  border: 1px solid rgba(100,116,139,0.4);
  background: rgba(255,255,255,0.08);
  color: #e2e8f0;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 999px;
  cursor: pointer;
}
#harness-toolbar button.active { background: #0284c7; border-color: #38bdf8; color: #fff; }
#harness-toolbar .sep { width: 1px; height: 18px; background: rgba(100,116,139,0.4); }
/* force the modal visible for auditing */
#create-modal { display: flex !important; }
#create-modal .modal-card { max-height: 90vh; }
body { margin: 0; }
/* harness app chrome */
.harness-header {
  position: fixed;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 92%;
  max-width: 1200px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  height: 36px;
  z-index: 996;
  background: var(--bg-header);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.harness-header .header-title { color: var(--text-active); font-weight: 600; font-size: 13px; font-family: 'Inter', system-ui, sans-serif; }
/* header actions row */
#harness-header-actions {
  position: fixed;
  top: 52px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 998;
  flex-wrap: wrap;
  justify-content: center;
}
/* terminal panel hosting the security report */
#harness-term {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  height: 46vh;
  background: var(--bg-terminal);
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  z-index: 999;
}
#harness-term .terminal-body {
  flex: 1;
  padding: 8px 14px;
  overflow-y: auto;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--bg-terminal);
  color: var(--text-main);
}
</style>
</head>
<body data-theme="sfarc-dark">
<div id="harness-toolbar">
  <button id="t-dark" class="active" data-theme="sfarc-dark">Dark+</button>
  <button id="t-light" data-theme="sfarc-light">Light+</button>
  <button id="t-amoled" data-theme="sfarc-amoled">AMOLED</button>
</div>

${modalHtml}

<header class="harness-header">
  <div class="header-title"><span>Comet Code Editor</span></div>
  <div class="header-actions">
    <button class="btn btn-secondary"><span class="material-symbols-rounded">play_circle</span> Run Tests</button>
    <button class="btn btn-secondary"><span class="material-symbols-rounded">shield</span> Security & Health</button>
  </div>
</header>

<div id="harness-chrome" style="display: flex; position: fixed; top: 52px; left: 50%; transform: translateX(-50%); gap: 0; z-index: 997; width: 92%; max-width: 1200px;">
  <div class="activity-bar" style="height: 320px; width: 48px;">
    <div class="activity-bar-top">
      <div class="activity-icon active"><i class="fa-solid fa-folder-open"></i></div>
      <div class="activity-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
      <div class="activity-icon"><i class="fa-solid fa-code-compare"></i></div>
      <div class="activity-icon"><i class="fa-solid fa-bug"></i></div>
    </div>
    <div class="activity-bar-bottom">
      <div class="activity-icon"><i class="fa-solid fa-gear"></i></div>
    </div>
  </div>
  <div class="sidebar" style="height: 320px; width: 260px; padding: 8px;">
    <div class="file-tree">
      <div class="tree-folder open">
        <div class="tree-folder-header"><i class="fa-solid fa-chevron-right tree-folder-icon"></i> Apex Classes</div>
        <div class="tree-folder-children">
          <div class="file-item"><span>AccountBatch.cls</span></div>
          <div class="file-item active"><span>AccountIdMapper.cls</span></div>
          <div class="file-item"><span>AccountIndustryMapBuilderTest.cls</span></div>
        </div>
      </div>
    </div>
  </div>
  <div style="flex: 1; background: var(--bg-tab); border-right: 1px solid var(--border-color); height: 320px;">
    <div style="display: flex;">
      <div class="tab"><span>AnimalsCallouts.cls</span></div>
      <div class="tab active"><span>AccountInd…</span></div>
    </div>
  </div>
  <div class="status-bar" style="position: absolute; bottom: 0; left: 0; right: 0; width: 100%;">
    <span id="status-message">Loaded Apex Class AccountIndustryMapBuilderTest</span>
    <span>Salesforce Tooling API v60.0</span>
  </div>
</div>

<div class="header-actions" id="harness-header-actions">
  <button id="hdr-btn-run-tests" class="btn btn-secondary">
    <span class="material-symbols-rounded" style="font-size: 15px; margin-right: 3px;">play_circle</span> Run Tests
  </button>
  <button id="hdr-btn-security" class="btn btn-secondary">
    <span class="material-symbols-rounded" style="font-size: 15px; margin-right: 3px;">shield</span> Security & Health
  </button>
  <button id="hdr-btn-exec-apex" class="btn btn-secondary">
    <span class="material-symbols-rounded" style="font-size: 15px; margin-right: 3px;">terminal</span> Execute Apex
  </button>
  <button id="btn-popout-app" class="btn btn-secondary">
    <span class="material-symbols-rounded" style="font-size: 15px; margin-right: 3px;">open_in_new</span> Pop Out App
  </button>
  <button id="btn-create-modal" class="btn btn-secondary">
    <span class="material-symbols-rounded" style="font-size: 15px; margin-right: 3px;">add</span> New Asset
  </button>
</div>

<div id="harness-term" class="terminal-panel">
  <div id="terminal-body-output" class="terminal-body"></div>
  <div id="terminal-body-problems" class="terminal-body" style="display: flex;"></div>
  <div id="terminal-body-coverage" class="terminal-body" style="display: none;"></div>
  <div id="terminal-body-security" class="terminal-body" style="display: none;"></div>
</div>

<script>
// minimal chrome stubs so scripts don't crash
window.chrome = window.chrome || {
  storage: { sync: { get: (k, cb) => cb && cb({}), set: () => {} }, local: { get: (k, cb) => cb && cb({}), set: () => {} }, onChanged: { addListener: () => {} } },
  runtime: { sendMessage: (m, cb) => cb && cb(null), getURL: (p) => p, id: 'stub' },
  tabs: { query: () => {} }
};
window.browser = window.chrome;

// replicate applyAppTheme variable sets
const THEME_VARS = {
  'sfarc-dark': {
    '--bg-main': '#1e1e1e', '--bg-sidebar': '#181818', '--bg-activity': '#181818',
    '--bg-header': '#181818', '--bg-tab': '#2d2d2d', '--bg-tab-active': '#1e1e1e',
    '--bg-terminal': '#181818', '--bg-terminal-header': '#252526', '--bg-input': '#2d2d2d',
    '--border-color': '#252526', '--text-main': '#cccccc', '--text-muted': '#858585',
    '--text-active': '#ffffff', '--item-hover': '#2a2d2e', '--item-active': '#37373d',
    '--icon-color': '#858585'
  },
  'sfarc-light': {
    '--bg-main': '#ffffff', '--bg-sidebar': '#f3f3f3', '--bg-activity': '#f3f3f3',
    '--bg-header': '#f3f3f3', '--bg-tab': '#ececec', '--bg-tab-active': '#ffffff',
    '--bg-terminal': '#ffffff', '--bg-terminal-header': '#f3f3f3', '--bg-input': '#ffffff',
    '--border-color': '#e5e5e5', '--text-main': '#333333', '--text-muted': '#616161',
    '--text-active': '#000000', '--item-hover': '#e8e8e8', '--item-active': '#e4e6f1',
    '--icon-color': '#424242'
  },
  'sfarc-amoled': {
    '--bg-main': '#000000', '--bg-sidebar': '#000000', '--bg-activity': '#000000',
    '--bg-header': '#000000', '--bg-tab': '#0a0a0a', '--bg-tab-active': '#000000',
    '--bg-terminal': '#000000', '--bg-terminal-header': '#0a0a0a', '--bg-input': '#0a0a0a',
    '--border-color': '#1a1a1a', '--text-main': '#e2e8f0', '--text-muted': '#64748b',
    '--text-active': '#ffffff', '--item-hover': '#121212', '--item-active': '#1e1e1e',
    '--icon-color': '#94a3b8'
  }
};
function applyTheme(name) {
  document.body.setAttribute('data-theme', name);
  const root = document.documentElement;
  Object.entries(THEME_VARS[name]).forEach(([k, v]) => root.style.setProperty(k, v));
  document.querySelectorAll('#harness-toolbar button').forEach(b =>
    b.classList.toggle('active', b.dataset.theme === name));
}
document.getElementById('harness-toolbar').addEventListener('click', (e) => {
  if (e.target.dataset.theme) applyTheme(e.target.dataset.theme);
});

// replicate openCreateModal's renderCreateAssetForm('lwc') so the LWC config
// group + hint are visible, exactly as when the real app opens the modal
(function openCreateModal() {
  const info = {
    group: 'lwc-targets-group',
    hint: 'Use <code>camelCase</code> (e.g. <code>myAccountViewer</code>). Creates the bundle with <code>.js</code>/<code>.html</code>/<code>.js-meta.xml</code> plus your chosen extras.',
    placeholder: 'e.g. myAccountViewer'
  };
  document.querySelectorAll('#create-modal .create-config-group').forEach(g => {
    g.style.display = 'none';
  });
  const group = document.getElementById(info.group);
  if (group) group.style.display = 'flex';
  const hint = document.getElementById('create-asset-hint');
  if (hint) hint.innerHTML = info.hint;
  const nameInput = document.getElementById('modal-asset-name');
  if (nameInput) nameInput.placeholder = info.placeholder;
})();

// ── Security & Health report demo (real renderSecurityFindings extracted from source) ──
${escapeFn}
${renderFn}
window.activeFilePath = 'src/classes/AnimalCallouts.cls';
window.editorInstance = null;
window.logToTerminal = () => {};
function renderDemo(mode) {
  const findings = mode === 'clean' ? [] : [
    { severity: 'HIGH', line: 42, title: 'SOQL Injection Risk', description: 'Dynamic query concatenates user input. Use a bind variable instead.', icon: 'fa-bug', color: '#f87171' },
    { severity: 'MEDIUM', line: 87, title: 'Class Missing Sharing Keyword', description: 'Security Warning: Apex class lacks explicit sharing mode.', icon: 'fa-shield-cat', color: '#fbbf24' },
    { severity: 'LOW', line: 120, title: 'Apex PMD: AvoidDebugStatements', description: 'System.debug statements left in production code.', icon: 'fa-shield-halved', color: '#38bdf8' }
  ];
  const score = mode === 'clean' ? 100 : mode === 'medium' ? 65 : 35;
  renderSecurityFindings(findings, score);
}
window.renderDemo = renderDemo;
renderDemo('findings');

// ── Problems panel demo ──
${problemFns}
window.currentFiles = {};
window.renderTabs = () => {};
window.showTerminalTab = () => {};
function demoProblems() {
  const pb = document.getElementById('terminal-body-problems');
  pb.innerHTML = '<div style="color: #64748b; font-style: italic;">No compilation problems detected.</div>';
  addProblemDiagnostic('AccountIndustryMapBuilderTest.cls', 63, 1, 'Test Failure in testBuildIndustryAccountMap_withNullData: System.AssertException: Assertion Failed: The map should be empty when a null list is provided.: Expected: 9, Actual: 0');
  addProblemDiagnostic('AccountIndustryMapBuilder.cls', 41, 12, 'Warning: Variable shadowing a class member name');
  addProblemDiagnostic('AccountIndustryMapBuilder.cls', 88, 5, 'Info: Unused method parameter: rawData');
}
// ── Apex Test Run demo (real helpers extracted from source) ──
let testRunCardEl = null;
let testRunStartTs = 0;
let coverageDecorationIds = [];
let coverageOverlayEl = null;
${testRunFns}
function demoTestRun() {
  testRunStartTs = Date.now() - 9000;
  updateTestRunCard({ title: 'Running tests for AccountIndustryMapBuilderTest', status: 'Queued', elapsedMs: Date.now() - testRunStartTs, progress: 8 });
  setTimeout(() => updateTestRunCard({ title: 'Running tests for AccountIndustryMapBuilderTest', status: 'Running', jobId: '707NS00002SBHwz', elapsedMs: Date.now() - testRunStartTs, progress: 46 }), 300);
  setTimeout(() => updateTestRunCard({ title: 'Running tests for AccountIndustryMapBuilderTest', status: 'Completed', jobId: '707NS00002SBHwz', elapsedMs: Date.now() - testRunStartTs, progress: 100, state: 'done' }), 700);
  setTimeout(() => {
    renderTestRunResults([
      { Outcome: 'Pass', MethodName: 'testAccountMappingWithIndustry', ApexClass: { Name: 'AccountIndustryMapBuilderTest' } },
      { Outcome: 'Pass', MethodName: 'testAccountMappingNoIndustry', ApexClass: { Name: 'AccountIndustryMapBuilderTest' } },
      { Outcome: 'Fail', MethodName: 'testAccountMappingWithInvalidIndustry', Message: 'System.AssertException: Assertion Failed: Expected industry mapping but got null.\\nClass.AccountIndustryMapBuilderTest.testAccountMappingWithInvalidIndustry: line 63, column 1', ApexClass: { Name: 'AccountIndustryMapBuilderTest' } }
    ], 'AccountIndustryMapBuilderTest');
  }, 1100);
}
document.getElementById('harness-toolbar').insertAdjacentHTML('beforeend', '<span class="sep"></span><button id="t-clean">0 findings</button><button id="t-mid">3 findings</button><button id="t-run">Run tests</button><button id="t-prob">Add problems</button>');
document.getElementById('harness-toolbar').addEventListener('click', (e) => {
  if (e.target.id === 't-clean') renderDemo('clean');
  else if (e.target.id === 't-mid') renderDemo('findings');
  else if (e.target.id === 't-run') demoTestRun();
  else if (e.target.id === 't-prob') demoProblems();
});
demoProblems();
</script>
<script>
${js}
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, "preview-create-asset.html"), html);
console.log("Wrote scratch-harness/preview-create-asset.html (" + html.length + " bytes)");
