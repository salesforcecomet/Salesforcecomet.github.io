const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");

const mainSrc = fs.readFileSync(path.join(SRC, "main.js"), "utf8");

// 1. Extract the wizard markup from main.js
const startTok = '<div id="sfarc-bulk-updater-container"';
const startIdx = mainSrc.indexOf(startTok);
if (startIdx === -1) throw new Error("bulk-updater-container not found");
const endTok = "<!-- Metadata Tools Container -->";
const endIdx = mainSrc.indexOf(endTok);
if (endIdx === -1) throw new Error("end marker not found");
const wizardHtml = mainSrc.slice(startIdx, endIdx).trim();

// 2. Stylesheets
const css = [
  "src/inspector.css",
  "src/custom-dropdown.css"
].map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");

const dropdownJs = fs.readFileSync(path.join(SRC, "custom-dropdown.js"), "utf8");

// 3. Shell + seed JS (replicates renderObjects output and step switching)
const seedJs = `
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  const objects = [
    ['AcceptedEventRelation', 'Accepted Event Relation'],
    ['Account', 'Account'],
    ['account__c', 'account'],
    ['account__ChangeEvent', 'Change Event: account'],
    ['AccountBrand', 'Account Brand'],
    ['AccountBrandShare', 'Account Brand Share'],
    ['AccountChangeEvent', 'Account Change Event'],
    ['AccountCleanInfo', 'Account Clean Info'],
    ['AccountContactRole', 'Account Contact Role'],
    ['AccountContactRoleChangeEvent', 'Account Contact Role Change Event'],
    ['AccountFeed', 'Account Feed'],
    ['AccountHistory', 'Account History'],
    ['AccountPartner', 'Account Partner'],
    ['AccountShare', 'Account Share'],
    ['ActionLinkGroupTemplate', 'Action Link Group Template']
  ];
  function renderObjects() {
    const list = document.getElementById('sfarc-bulk-obj-list');
    const term = (document.getElementById('sfarc-bulk-obj-search').value || '').toLowerCase();
    const filtered = objects.filter(([name, label]) => name.toLowerCase().includes(term) || label.toLowerCase().includes(term));
    list.innerHTML = filtered.map(([name, label]) => \`
      <label class="sfarc-bulk-obj-row" title="\${escapeHtml(label || name)}">
        <input type="checkbox" class="sfarc-obj-chk" value="\${escapeHtml(name)}">
        <span class="sfarc-bulk-obj-name">\${escapeHtml(name)}</span>
        \${label && label.toLowerCase() !== name.toLowerCase()
          ? \`<span class="sfarc-bulk-obj-label">\${escapeHtml(label)}</span>\` : ''}
      </label>
    \`).join('');
    const count = document.getElementById('sfarc-bulk-obj-count');
    if (count) count.textContent = filtered.length + ' objects';
  }
  document.getElementById('sfarc-bulk-obj-search').addEventListener('input', renderObjects);
  renderObjects();
  document.getElementById('sfarc-bulk-obj-selectall').addEventListener('change', e => {
    document.querySelectorAll('.sfarc-obj-chk').forEach(c => c.checked = e.target.checked);
  });

  // Step switcher (replicates setStep)
  function setStep(n) {
    for (let i = 1; i <= 4; i++) {
      const step = document.getElementById('sfarc-bulk-step' + i);
      step.style.display = (i === n) ? 'flex' : 'none';
      const ind = document.getElementById('sfarc-wiz-ind-' + i);
      ind.classList.remove('active', 'done', 'upcoming');
      if (i < n) ind.classList.add('done');
      else if (i === n) ind.classList.add('active');
      else ind.classList.add('upcoming');
      const num = ind.querySelector('.sfarc-wiz-num');
      num.textContent = i < n ? '\\u2713' : String(i);
    }
    // seed step 2 content on first visit
    if (n === 2 && !window._seeded2) {
      window._seeded2 = true;
      const perms = document.getElementById('sfarc-bulk-obj-perms-list');
      perms.innerHTML = \`
        <div class="sfarc-bw-section-title">Object Permissions</div>
        <div class="sfarc-bw-master-panel">
          <div class="sfarc-bw-master-panel-title"><i class="fa-solid fa-bolt"></i> Bulk Select All Objects</div>
          <div class="sfarc-bw-perm-grid">
            <label><input type="checkbox" class="sfarc-obj-perm-master" value="PermissionsRead"> Read</label>
            <label><input type="checkbox" class="sfarc-obj-perm-master" value="PermissionsCreate"> Create</label>
            <label><input type="checkbox" class="sfarc-obj-perm-master" value="PermissionsEdit"> Edit</label>
            <label><input type="checkbox" class="sfarc-obj-perm-master" value="PermissionsDelete"> Delete</label>
            <label><input type="checkbox" class="sfarc-obj-perm-master" value="PermissionsViewAllRecords"> View All</label>
            <label><input type="checkbox" class="sfarc-obj-perm-master" value="PermissionsModifyAllRecords"> Modify All</label>
          </div>
        </div>
        <div class="sfarc-bw-perm-card">
          <div class="sfarc-bw-perm-card-title">Account</div>
          <div class="sfarc-bw-perm-grid">
            <label><input type="checkbox" class="sfarc-obj-perm-chk"> Read</label>
            <label><input type="checkbox" class="sfarc-obj-perm-chk"> Create</label>
            <label><input type="checkbox" class="sfarc-obj-perm-chk"> Edit</label>
            <label><input type="checkbox" class="sfarc-obj-perm-chk"> Delete</label>
            <label><input type="checkbox" class="sfarc-obj-perm-chk"> View All</label>
            <label><input type="checkbox" class="sfarc-obj-perm-chk"> Modify All</label>
          </div>
        </div>
        <div class="sfarc-bw-section-title sfarc-bw-rt-head">
          <span>Record Type Access</span>
          <label class="sfarc-bw-chk"><input type="checkbox" id="sfarc-rt-selectall"> Select All</label>
        </div>
        <div class="sfarc-bw-rt-row">
          <div class="sfarc-bw-rt-name">Master <span class="sfarc-bw-rt-type">(Account)</span></div>
          <label class="sfarc-bw-chk"><input type="checkbox" class="sfarc-rt-chk"> Grant Access</label>
        </div>
        <div class="sfarc-bw-rt-row">
          <div class="sfarc-bw-rt-name">PersonAccount <span class="sfarc-bw-rt-type">(Account)</span></div>
          <label class="sfarc-bw-chk"><input type="checkbox" class="sfarc-rt-chk"> Grant Access</label>
        </div>
      \`;
    }
    if (n === 3 && !window._seeded3) {
      window._seeded3 = true;
      const fld = document.getElementById('sfarc-bulk-fld-list');
      fld.innerHTML = ['Account.Name', 'Account.Industry', 'Account.AnnualRevenue', 'Account.OwnerId', 'Account.Type'].map(api => \`
        <div class="sfarc-bw-fld-row">
          <div class="sfarc-bw-fld-name">\${api} <span class="sfarc-bw-fld-label">(Field)</span></div>
          <div class="sfarc-bw-fld-perms">
            <label class="sfarc-bw-chk"><input type="checkbox" class="sfarc-fld-chk-read"> Read</label>
            <label class="sfarc-bw-chk"><input type="checkbox" class="sfarc-fld-chk-edit"> Edit</label>
          </div>
        </div>
      \`).join('');
    }
  }
  window.setStep = setStep;
  document.getElementById('sfarc-bulk-next1-btn').addEventListener('click', () => setStep(2));
  document.getElementById('sfarc-bulk-back1-btn').addEventListener('click', () => setStep(1));
  document.getElementById('sfarc-bulk-next1b-btn').addEventListener('click', () => setStep(3));
  document.getElementById('sfarc-bulk-back2-btn').addEventListener('click', () => setStep(2));
  document.getElementById('sfarc-bulk-next2-btn').addEventListener('click', () => setStep(4));
  document.getElementById('sfarc-bulk-back4-btn').addEventListener('click', () => setStep(3));
`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Bulk Permission Wizard — Live Preview</title>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0b0c0f; }
  #sfarc-panel {
    width: 100%; height: 100%; display: flex; flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-sizing: border-box;
  }
  /* harness chrome */
  #harness-toolbar {
    position: fixed; top: 10px; left: 50%; transform: translateX(-50%);
    z-index: 2147483647; display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 10px; border-radius: 999px;
    background: rgba(30, 30, 30, 0.92); border: 1px solid rgba(100,116,139,0.4);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35); font-family: 'Segoe UI', system-ui, sans-serif;
  }
  #harness-toolbar button {
    border: 1px solid rgba(100,116,139,0.4); background: rgba(255,255,255,0.08);
    color: #e2e8f0; font-size: 12px; font-weight: 600; padding: 5px 12px;
    border-radius: 999px; cursor: pointer;
  }
  #harness-toolbar button.active { background: #0284c7; border-color: #38bdf8; color: #fff; }
  #harness-toolbar .sep { width: 1px; height: 18px; background: rgba(100,116,139,0.4); }
  /* always show the wizard */
  #sfarc-bulk-updater-container { display: flex !important; }
  ${css}
</style>
</head>
<body>
<div id="harness-toolbar">
  <button id="t-dark" class="active">Dark</button>
  <button id="t-light">Light</button>
  <span class="sep"></span>
  <button id="t-step1">Step 1</button>
  <button id="t-step2">Step 2</button>
  <button id="t-step3">Step 3</button>
  <button id="t-step4">Step 4</button>
</div>

<div id="sfarc-panel" class="sfarc-dark-theme">
${wizardHtml}
</div>

<script>
// stub chrome + sfApi so nothing crashes
window.chrome = window.chrome || {
  storage: { sync: { get: (k, cb) => cb && cb({}), set: () => {} }, local: { get: (k, cb) => cb && cb({}), set: () => {} }, onChanged: { addListener: () => {} } },
  runtime: { sendMessage: (m, cb) => cb && cb(null), getURL: (p) => p, id: 'stub' }
};
window.browser = window.chrome;
window.sfApi = { query: async () => ({ records: [] }), fetch: async () => ({ json: async () => ({ sobjects: [] }) }), apiVersion: '60.0' };
window.escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.toast = { error: () => {} };

const panel = document.getElementById('sfarc-panel');
function setTheme(name) {
  panel.classList.toggle('sfarc-dark-theme', name === 'dark');
  document.body.classList.toggle('sfarc-dark-theme', name === 'dark');
  document.querySelectorAll('#harness-toolbar button[data-theme]').forEach(b => b.classList.toggle('active', b.dataset.theme === name));
}
document.getElementById('t-dark').dataset.theme = 'dark';
document.getElementById('t-light').dataset.theme = 'light';
document.getElementById('harness-toolbar').addEventListener('click', e => {
  if (e.target.dataset.theme) setTheme(e.target.dataset.theme);
  else if (e.target.id === 't-step1') setStep(1);
  else if (e.target.id === 't-step2') setStep(2);
  else if (e.target.id === 't-step3') setStep(3);
  else if (e.target.id === 't-step4') setStep(4);
});

${seedJs}
</script>
<script>
${dropdownJs}
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, "preview-bulk-wizard.html"), html);
console.log("Wrote scratch-harness/preview-bulk-wizard.html (" + html.length + " bytes)");
