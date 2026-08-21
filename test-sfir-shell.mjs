// Regression tests for the persistent SFIR tab shell (Export / Import /
// Limits / Metadata):
//   1. sfir-shell.html renders the ONE persistent header (tabs + page-utils
//      slot + org badge + user chip); sfir-shell.js lazily creates one iframe
//      per tab (?host=..&sfirEmbed=1), toggles active class + nav pill, and
//      never reloads a visited tab.
//   2. Each tab's own controls are painted INTO the shell bar (#sfir-shell-
//      utils) and swap on tab change — the pages render body-only (no header,
//      no strip, NO second bar). State flows up via sfirUtilsState, user
//      actions flow down via sfirUtilsAction.
//   3. background.js routes all four tab opens to the shell.
import fs from 'fs';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

const shellJs = fs.readFileSync('src/sfir-shell.js', 'utf8');
const shellCss = fs.readFileSync('src/sfir-shell.css', 'utf8');
const embedCss = fs.readFileSync('src/sfir-embed.css', 'utf8');
const shellHtml = fs.readFileSync('src/sfir-shell.html', 'utf8');
const bg = fs.readFileSync('src/background.js', 'utf8');
const exportJs = fs.readFileSync('src/data-export.js', 'utf8');
const importJs = fs.readFileSync('src/data-import.js', 'utf8');

// ── Shell document ────────────────────────────────────────────────────────
check('shell has persistent header', /id="sfir-shell-header"/.test(shellHtml));
check('shell has nav list with 4 tabs', (shellHtml.match(/data-page="(export|import|limits|metadata)"/g) || []).length === 4);
check('shell has org badge + user chip', /id="sfarc-nav-org"/.test(shellHtml) && /sfir-shell-user-initials/.test(shellHtml));
check('shell has tab host', /id="sfir-tab-host"/.test(shellHtml));
check('shell has page-utilities slot (ONE bar)', /id="sfir-shell-utils"/.test(shellHtml));
check('shell loads custom-dropdown for the Templates select', /custom-dropdown\.js/.test(shellHtml));
check('shell loads sfir-shell.js', /src="sfir-shell\.js"/.test(shellHtml));

// ── Shell CSS ─────────────────────────────────────────────────────────────
check('shell host fills below header', /#sfir-tab-host\s*\{[^}]*flex:\s*1/.test(shellCss));
check('iframes hidden unless active', /\.sfir-tab-frame\s*\{[^}]*display:\s*none/.test(shellCss) && /\.sfir-tab-frame\.active\s*\{[^}]*display:\s*block/.test(shellCss));
check('tab entrance slide exists', /@keyframes sfirTabIn/.test(shellCss));
check('utils slot styled', /\.sfir-shell-utils\s*\{/.test(shellCss));
check('host pill styled', /\.sfir-shell-host-pill\s*\{/.test(shellCss));
check('refresh button styled', /\.sfir-shell-refresh-btn\s*\{/.test(shellCss));

// ── Embed CSS: pages render body-only, no second bar ─────────────────────
check('embed mode hides page headers', /body\.sfir-embedded[\s\S]*?\.slds-builder-header_container[\s\S]*?display:\s*none !important/.test(embedCss));
check('embed CSS has NO utilities-strip styles (no extra bar)', !/.sfir-embed-utilities\s*\{/.test(embedCss));
check('embed CSS collapses the limits toolbar gap', /body\.sfir-embedded \.sfir-limits-toolbar\s*\{[^}]*margin-top:\s*8px !important/.test(embedCss));

// ── React pages: embed mode renders body-only + message bridge ───────────
check('data-export detects sfirEmbed', /const SFIR_EMBEDDED = [\s\S]*?get\("sfirEmbed"\) === "1"/.test(exportJs));
check('data-export renders NOTHING instead of PageHeader (no strip)', /SFIR_EMBEDDED\s*\n?\s*\? null\s*\n?\s*:\s*h\(PageHeader/.test(exportJs));
check('data-export captures app instance for the bridge', /activeExportApp = c/.test(exportJs));
check('data-export pushes utils state up', /sfirPushUtilsState\(\)/.test(exportJs) && /type: "sfirUtilsState"/.test(exportJs));
check('data-export handles shell actions (templates/tooling/queryAll/help)', /msg\.action === "selectTemplate"/.test(exportJs) && /msg\.action === "tooling"/.test(exportJs) && /msg\.action === "queryAll"/.test(exportJs) && /msg\.action === "help"/.test(exportJs));
check('data-import detects sfirEmbed', /const SFIR_EMBEDDED = [\s\S]*?get\("sfirEmbed"\) === "1"/.test(importJs));
check('data-import renders NOTHING instead of PageHeader (no strip)', /SFIR_EMBEDDED\s*\n?\s*\? null\s*\n?\s*:\s*h\(PageHeader/.test(importJs));
check('data-import captures app instance + help bridge', /activeImportApp = c/.test(importJs) && /msg\.action === "help"/.test(importJs));

// ── Static pages: embed class + refresh bridge ───────────────────────────
const limitsHtml = fs.readFileSync('src/org-limits.html', 'utf8');
const limitsJs = fs.readFileSync('src/org-limits.js', 'utf8');
const metaHtml = fs.readFileSync('src/metadata-exporter.html', 'utf8');
const metaJs = fs.readFileSync('src/metadata-exporter.js', 'utf8');
const themeManager = fs.readFileSync('src/theme-manager.js', 'utf8');
check('theme-manager (external, CSP-safe) applies sfir-embedded from ?sfirEmbed=1', /get\('sfirEmbed'\) === '1'/.test(themeManager) && /classList\.add\('sfir-embedded'\)/.test(themeManager));
check('no inline embed scripts left (MV3 CSP blocks them)', !limitsHtml.includes('document.body.classList.add("sfir-embedded")') && !metaHtml.includes('document.body.classList.add("sfir-embedded")'));
check('embed CSS keys off html.sfir-embedded (no flash)', /html\.sfir-embedded body \.slds-builder-header_container/.test(embedCss));
check('org-limits control bar has toolbar class', /class="sfir-limits-toolbar"/.test(limitsHtml));
check('org-limits listens for shell refresh action', /msg\.action === 'refresh'\) loadLimits\(true\)/.test(limitsJs));
check('org-limits pushes refreshing state to shell', /sfirPushState\(true\)/.test(limitsJs) && /sfirPushState\(false\)/.test(limitsJs));
check('metadata listens for shell refresh action', /msg\.action === 'refresh'\) loadMetadataTypes\(\)/.test(metaJs));

// ── All four pages load sfir-embed.css ────────────────────────────────────
for (const page of ['data-export.html', 'data-import.html', 'org-limits.html', 'metadata-exporter.html']) {
  check(`${page} links sfir-embed.css`, fs.readFileSync('src/' + page, 'utf8').includes('sfir-embed.css'));
}

// ── background.js routes the 4 tabs to the shell ──────────────────────────
check('background routes export -> shell', /shellTab\('export'\)/.test(bg) && /case 'data-export':/.test(bg));
check('background routes import -> shell', /shellTab\('import'\)/.test(bg));
check('background routes limits -> shell', /shellTab\('limits'\)/.test(bg));
check('background routes metadata -> shell', /shellTab\('metadata'\)/.test(bg));
check('background supports explicit sfir-shell request', /case 'sfir-shell':/.test(bg));

// ── Shell JS behavior (extracted, imports stubbed) ────────────────────────
function makeFakeElement(tag) {
  const e = {
    tagName: String(tag || 'div').toUpperCase(),
    className: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    title: '',
    type: '',
    style: {},
    children: [],
    _listeners: {},
    _innerHTML: '',
    _hasSvg: false,
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      toggle(c, on) { if (on === undefined) { if (this._set.has(c)) { this._set.delete(c); return false; } this._set.add(c); return true; } if (on) this._set.add(c); else this._set.delete(c); },
      contains(c) { return this._set.has(c); }
    },
    set innerHTML(v) { this._innerHTML = v; this._hasSvg = /<svg/.test(v); },
    get innerHTML() { return this._innerHTML; },
    appendChild(n) { this.children.push(n); },
    setAttribute(name, val) { this['attr-' + name] = String(val); },
    getAttribute(name) { return this['attr-' + name] != null ? this['attr-' + name] : null; },
    addEventListener(evt, fn) { (this._listeners[evt] = this._listeners[evt] || []).push(fn); },
    querySelector(sel) {
      if (sel === 'svg' && this._hasSvg) {
        if (!this._svgEl) { this._svgEl = makeFakeElement('svg'); this._svgEl._svg = true; }
        return this._svgEl;
      }
      return null;
    },
    get options() { return this.children; }
  };
  return e;
}

function matches(node, sel) {
  if (!node || typeof node.className !== 'string') return false;
  const cls = node.className.split(' ');
  if (sel === '.sfir-shell-refresh-btn') return cls.includes('sfir-shell-refresh-btn');
  if (sel === '.sfir-shell-host-pill') return cls.includes('sfir-shell-host-pill');
  if (sel === 'select.sfir-header-select') return node.tagName === 'SELECT' && cls.includes('sfir-header-select');
  if (sel === 'input[type="checkbox"]') return node.tagName === 'INPUT' && node.type === 'checkbox';
  if (sel === '.sfir-header-toggle-container') return cls.includes('sfir-header-toggle-container');
  return false;
}

function makeEnv(search) {
  const nav = {
    querySelector(sel) {
      const m = sel.match(/data-page="([^"]+)"/);
      const links = {
        export: { dataset: { page: 'export' }, classList: { toggle: () => {}, contains: () => false } },
        import: { dataset: { page: 'import' }, classList: { toggle: () => {}, contains: () => false } },
        limits: { dataset: { page: 'limits' }, classList: { toggle: () => {}, contains: () => false } },
        metadata: { dataset: { page: 'metadata' }, classList: { toggle: () => {}, contains: () => false } }
      };
      if (m) return links[m[1]] || null;
      return null;
    },
    addEventListener(evt, fn) { nav._listener = fn; },
    classList: { toggle: () => {}, contains: () => false }
  };
  const host = {
    _frames: [],
    querySelector(sel) { const m = sel.match(/data-tab="([^"]+)"/); return m ? host._frames.find(f => f.dataset.tab === m[1]) || null : null; },
    querySelectorAll() { return host._frames; },
    appendChild(f) { host._frames.push(f); }
  };
  const utilsSlot = {
    _children: [],
    get children() { return this._children; },
    set innerHTML(v) { this._children = []; },
    appendChild(node) { this._children.push(node); },
    querySelector(sel) { return utilsSlot.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel) {
      const out = [];
      (function walk(n) {
        if (matches(n, sel)) out.push(n);
        ((n && n.children) || []).forEach(c => walk(c));
      })(utilsSlot);
      return out;
    }
  };
  const created = [];
  const env = {
    nav, host, utilsSlot, created,
    activeClasses: {},
    get href() { return '/sfir-shell.html' + search; }
  };
  const document = {
    getElementById(id) {
      if (id === 'sfir-shell-nav') return nav;
      if (id === 'sfir-tab-host') return host;
      if (id === 'sfir-shell-utils') return utilsSlot;
      if (id === 'sfarc-comet-logo') return { set src(v) {} };
      if (id === 'sfarc-nav-org') return { set textContent(v) { env.org = v; } };
      if (id === 'sfarc-home-link') return { set href(v) {} };
      if (id === 'sfir-shell-user-initials') return { set textContent(v) { env.initials = v; } };
      if (id === 'sfir-shell-user-name') return { set textContent(v) {} };
      if (id === 'sfir-shell-user-email') return { set textContent(v) {} };
      return null;
    },
    createElement(tag) {
      if (tag !== 'iframe') return makeFakeElement(tag);
      const f = makeFakeElement('iframe');
      f.dataset = {};
      f.contentWindow = { postMessage(msg) { f._posted = msg; } };
      f.style = { setProperty: (k, v) => { f._props = f._props || {}; f._props[k] = v; } };
      f.src = '';
      created.push(f);
      return f;
    },
    querySelectorAll() { return []; }
  };
  return { env, nav, host, created, document, utilsSlot };
}

async function runShell(search) {
  const { env, nav, host, created, document, utilsSlot } = makeEnv(search);
  const code = shellJs
    .replace(/^import \{[^}]*\} from "[^"]*";\s*\n?/gm, '')
    .replace(/^import \{[^}]*\} from '[^']*';\s*\n?/gm, '');
  const fn = new Function('window', 'document', 'location', 'URL', 'history', 'sfConn', 'getUserInfo', 'chrome', code);
  const fakeWindow = {
    location: { search, href: '/sfir-shell.html' + search },
    history: { replaceState() {} },
    addEventListener(evt, listener) { fakeWindow._listeners = fakeWindow._listeners || {}; (fakeWindow._listeners[evt] = fakeWindow._listeners[evt] || []).push(listener); }
  };
  class FakeURL {
    constructor(href) { this.href = href; this.searchParams = { set() {}, get() { return null; } }; }
  }
  fn(fakeWindow, document, { search }, FakeURL, fakeWindow.history,
    { instanceHostname: '', async getSession(host) { this.instanceHostname = host || ''; } },
    async () => ({ success: true, userFullName: 'Tester', userInitials: 'TT', userName: 't' }),
    { runtime: { getURL: (p) => p }, storage: {} });
  await new Promise(r => setTimeout(r, 0));
  return { env, nav, host, created, utilsSlot, fakeWindow };
}

// Initial load: export tab active, iframe created, utils slot shows export controls
const t1 = await runShell('?tab=export');
const expFrame = t1.created.find(f => f.dataset.tab === 'export');
check('initial tab creates export iframe', !!expFrame);
check('iframe src carries sfirEmbed=1', expFrame && expFrame.src === 'data-export.html?sfirEmbed=1');
check('initial tab is active', expFrame && expFrame.classList.contains('active'));
check('initial frame gets no-slide class', expFrame && expFrame.classList.contains('sfir-tab-initial'));
check('org badge falls back to Unknown', t1.env.org === 'Unknown');
check('user initials populated', t1.env.initials === 'TT');
check('shell requests utils state from the page', expFrame && expFrame._posted && expFrame._posted.type === 'sfirUtilsRequest');
check('export execution controls stay out of the global shell bar', t1.utilsSlot.querySelector('select.sfir-header-select') === null);
check('export tab paints Incremental + Tooling + QueryAll toggles into the bar', t1.utilsSlot.querySelectorAll('input[type="checkbox"]').length === 3);
check('export tab paints all toggle containers into the bar', t1.utilsSlot.querySelectorAll('.sfir-header-toggle-container').length === 3);

// Switching to Limits: slot swaps to Refresh + host pill
const t2 = await runShell('?tab=export');
t2.nav._listener({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, target: { closest: () => ({ dataset: { page: 'limits' } }) }, preventDefault() {} });
const lim2 = t2.created.find(f => f.dataset.tab === 'limits');
check('switching creates new tab iframe lazily', !!lim2);
check('visited tab kept in DOM (no reload)', t2.created.length === 2);
check('limits tab paints Refresh into the ONE bar', t2.utilsSlot.querySelector('.sfir-shell-refresh-btn') !== null);
check('limits tab keeps the shell bar uncluttered', t2.utilsSlot.querySelector('.sfir-shell-host-pill') === null);
check('export controls removed from the bar', t2.utilsSlot.querySelector('select.sfir-header-select') === null);
check('limits frame got a refresh-capable bridge', lim2 && lim2._posted && lim2._posted.type === 'sfirUtilsRequest');

// Clicking the shell Refresh forwards the action to the limits iframe
const refreshBtn = t2.utilsSlot.querySelector('.sfir-shell-refresh-btn');
refreshBtn._listeners.click[0]({});
check('Refresh click forwards sfirUtilsAction to the page', lim2._posted && lim2._posted.source === 'sfir-shell' && lim2._posted.type === 'sfirUtilsAction' && lim2._posted.action === 'refresh');

// Page pushes utils state up → sync updates the bar's controls
t2.fakeWindow._listeners.message[0]({ data: { source: 'sfir-embed', tab: 'limits', type: 'sfirUtilsState', state: { refreshing: true } } });
const refreshIcon = t2.utilsSlot.querySelector('.sfir-shell-refresh-btn').querySelector('svg');
check('refreshing state spins the shell Refresh icon', refreshIcon && refreshIcon.classList.contains('sfir-shell-refresh-spin'));

// Export: toggling Tooling forwards the action
const t6 = await runShell('?tab=export');
t6.fakeWindow._listeners.message[0]({ data: { source: 'sfir-embed', tab: 'export', type: 'sfirUtilsState', state: { templates: ['SELECT Id FROM', 'SELECT Name FROM'], queryTooling: false, queryAll: false } } });
const sel6 = t6.utilsSlot.querySelector('select.sfir-header-select');
check('templates remain in the query toolbar', sel6 === null);
const boxes6 = t6.utilsSlot.querySelectorAll('input[type="checkbox"]');
boxes6[1].checked = true;
boxes6[1]._listeners.change[0]({});
const exp6 = t6.created.find(f => f.dataset.tab === 'export');
check('Tooling toggle forwards sfirUtilsAction', exp6._posted && exp6._posted.type === 'sfirUtilsAction' && exp6._posted.action === 'tooling' && exp6._posted.value === true);

// host param is forwarded into iframe src + org badge
const t5 = await runShell('?host=vishugrade-dev-ed.my.salesforce.com&tab=import');
const imp5 = t5.created.find(f => f.dataset.tab === 'import');
check('host forwarded to iframe', imp5 && imp5.src === 'data-import.html?host=vishugrade-dev-ed.my.salesforce.com&sfirEmbed=1');
check('org badge shows org name from host', t5.env.org === 'VISHUGRADE-DEV-ED');
check('import tab paints Help into the ONE bar', t5.utilsSlot.querySelectorAll('.sfir-header-toggle-container').length === 0);

// Same-tab click is a no-op
const t4 = await runShell('?tab=export');
const before = t4.created.length;
t4.nav._listener({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, target: { closest: () => ({ dataset: { page: 'export' } }) }, preventDefault() {} });
check('same-tab click creates nothing', t4.created.length === before);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
