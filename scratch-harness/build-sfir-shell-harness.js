#!/usr/bin/env node
// Builds scratch-harness/sfir-shell-preview.html — a SELF-CONTAINED preview of
// the REAL sfir-shell document: the actual shell markup, the real
// theme-manager + CSS inlined, and the real sfir-shell.js tab logic (its two
// module imports replaced with harness stubs — no chrome APIs available here).
// Stub tab pages stand in for the four extension pages so tab switching and
// state persistence can be verified live.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const srcHtml = read('src/sfir-shell.html');
const bodyMatch = srcHtml.match(/<body>([\s\S]*?)<\/body>/);
if (!bodyMatch) { console.error('no body found'); process.exit(1); }
const shellBody = bodyMatch[1];

// Real shell logic with imports stubbed (module imports can't run as a
// classic script inside a static preview page).
let shellJs = read('src/sfir-shell.js')
  .replace(/^import \{[^}]*\} from "[^"]*";\s*\n?/gm, '')
  .replace(/^import \{[^}]*\} from '[^']*';\s*\n?/gm, '');

const stubImports = `
// Harness stubs (replace the module imports; no chrome in the preview).
const sfConn = {
  instanceHostname: '',
  async getSession(host) { this.instanceHostname = host || ''; return null; }
};
async function getUserInfo() {
  return { success: true, userFullName: 'Harness User', userInitials: 'HU', userName: 'harness@example.com' };
}
`;

// Stub tab bodies — inlined via srcdoc (the preview server won't serve
// sibling files). Each carries an in-memory visit counter to prove the
// iframes keep their state when switching away and back.
const STUB_COLORS = {
  export: '#1d4ed8',
  import: '#0f766e',
  limits: '#7c3aed',
  metadata: '#b45309'
};
// Each stub also posts its utilities state up to the shell (like the real
// embedded pages do), so the live harness shows the ONE-bar swap working
// through the real message bridge.
const STUB_UTILS = {
  export: { templates: ['SELECT Id FROM', 'SELECT Name FROM Account'], queryTooling: false, queryAll: false },
  import: {},
  limits: { refreshing: false },
  metadata: { refreshing: false }
};
const STUBS = {};
Object.entries(STUB_COLORS).forEach(([key, color]) => {
  const utils = JSON.stringify(STUB_UTILS[key]);
  STUBS[key] = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${key}</title>
<style>body{margin:0;height:100vh;background:${color};display:flex;align-items:center;justify-content:center;font-family:system-ui;color:#fff;flex-direction:column}
h1{font-size:34px;margin:0 0 8px}code{background:rgba(0,0,0,.35);padding:6px 12px;border-radius:8px;font-size:15px}
#cnt{position:absolute;top:10px;left:12px;font-size:13px;opacity:.85}</style></head>
<body><div id="cnt"></div><h1>${key}</h1><code>loaded via iframe (sfirEmbed=1)</code>
<script>let visits = (window.__v || 0) + 1; window.__v = visits; document.getElementById('cnt').textContent = 'loads since page start: ' + visits;
try { window.parent.postMessage({ source: 'sfir-embed', tab: '${key}', type: 'sfirUtilsState', state: ${utils} }, '*'); } catch (e) {}
</script>
</body></html>`;
});

// The preview can't fetch real tab pages, so swap the iframe src for an
// inlined srcdoc stub — the surrounding shell logic stays the real thing.
shellJs = shellJs.replace(
  'frame.src = tab.file + "?" + [hostArg, embedArg].filter(Boolean).join("&");',
  'frame.srcdoc = STUBS[tab.key] || tab.file;'
);

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>SFIR Shell — live harness</title>
<script>
// Minimal chrome stub so theme-manager etc. boot in the static preview.
// The preview webview exposes a host chrome global (no storage API), so
// replace it wholesale rather than guarding with ||.
window.chrome = {
  storage: {
    sync: { get: (k, cb) => { if (cb) cb({ sfiSettings: {} }); } },
    local: { get: (k, cb) => { if (cb) cb({}); }, set() {} },
    onChanged: { addListener() {} }
  },
  runtime: { getURL: (p) => p, onMessage: { addListener() {} }, onInstalled: { addListener() {} } }
};
</script>
<style>
${read('src/styles/sfir.css')}
${read('src/styles/slds/slds.css')}
${read('src/button.css')}
${read('src/glass-toast.css')}
${read('src/sfir-shell.css')}
${read('src/custom-dropdown.css')}
${read('src/controls.css')}
#probe { position: fixed; bottom: 8px; left: 8px; color: #e2e8f0; font: 11px monospace; white-space: pre; background: rgba(0,0,0,.75); padding: 6px 10px; border-radius: 6px; z-index: 2147483000; }
</style>
<script>
${read('src/theme-manager.js')}
</script>
<script>
${read('src/custom-tooltip.js')}
</script>
<script>
${read('src/favicon-glyphs.js')}
</script>
<script>
${read('src/colored-favicon.js')}
</script>
</head>
<body>
${shellBody}
<pre id="probe"></pre>
<script>
${read('src/custom-dropdown.js')}
</script>
<script>
${stubImports}
const STUBS = ${JSON.stringify(STUBS).replace(/<\/script>/g, '<\\/script>')};
${shellJs}
</script>
<script>
function probe() {
  const host = document.getElementById('sfir-tab-host');
  const frames = Array.from(host.querySelectorAll('iframe')).map(f => f.dataset.tab + ':' + (f.classList.contains('active') ? 'ACTIVE' : 'hidden'));
  const active = document.querySelector('#sfir-shell-nav a.sfir-nav-active');
  const pill = document.querySelector('#sfir-shell-nav .sfir-nav-slider');
  const utils = document.getElementById('sfir-shell-utils');
  const sel = utils.querySelector('select.sfir-header-select');
  const utilsInfo = {
    controls: Array.from(utils.children).map(c => (c.children[0] && c.children[0].className) || c.className),
    templateOptions: sel ? sel.options.length - 1 : 0,
    toggles: utils.querySelectorAll('input[type="checkbox"]').length,
    refresh: !!utils.querySelector('.sfir-shell-refresh-btn'),
    hostPill: !!utils.querySelector('.sfir-shell-host-pill')
  };
  return JSON.stringify({
    activeNav: active ? active.dataset.page : null,
    frames,
    pillTransform: pill ? pill.style.transform : null,
    headerHeight: document.getElementById('sfir-shell-header').offsetHeight + 'px',
    initials: document.querySelector('.sfir-badge-avatar-text').textContent,
    org: document.getElementById('sfarc-nav-org').textContent,
    utils: utilsInfo
  }, null, 1);
}
window.__shellProbe = probe;
setTimeout(() => { document.getElementById('probe').textContent = probe(); }, 800);
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'sfir-shell-preview.html'), html);
console.log('Wrote scratch-harness/sfir-shell-preview.html (+4 stub tab pages, all sources inlined)');
