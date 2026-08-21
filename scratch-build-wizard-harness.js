/* Build scratch-harness/preview-bulk-wizard.html — the Bulk Permission
   Wizard (step 1) from main.js, rendered standalone for UI/UX auditing. */
const fs = require('fs');
const path = require('path');

const root = __dirname;

const css = [
  'src/inspector.css',
  'src/bulk-field-builder.css',
  'src/glass-toast.css',
  'src/custom-dropdown.css',
  'src/controls.css'
].map(f => `/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(root, f), 'utf8')).join('\n');

// Extract the bulk updater container markup from main.js
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const startMark = `<div id="sfarc-bulk-updater-container"`;
const start = main.indexOf(startMark);
const endMark = `<!-- Metadata Tools Container -->`;
const end = main.indexOf(endMark);
if (start < 0 || end < 0) {
  console.error('Could not locate wizard markup in main.js');
  process.exit(1);
}
const wizardMarkup = main.slice(start, end).trim();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Bulk Permission Wizard (Live Preview)</title>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
  #sfarc-panel {
    width: 100%; height: 100%; display: flex; flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-sizing: border-box;
  }
  ${css}
  /* The wizard sits inside the page container in the real app */
  #sfarc-panel .sfir-page-container { height: 100%; display: flex; flex-direction: column; box-sizing: border-box; }
</style>
</head>
<body class="sfarc-dark-theme">
  <div id="sfarc-panel" class="sfarc-dark-theme">
    <div class="sfir-page-container">
      ${wizardMarkup}
    </div>
  </div>
  <script>
    // seed the object list with sample rows
    const sampleObjects = [
      ['AcceptedEventRelation', 'Accepted Event Relation'],
      ['Account', 'Account'],
      ['account__c', 'account'],
      ['account__ChangeEvent', 'Change Event: account'],
      ['AccountBrand', 'Account Brand'],
      ['AccountBrandShare', 'Account Brand Share'],
      ['AccountChangeEvent', 'Account Change Event'],
      ['AccountCleanInfo', 'Account Clean Info'],
      ['AccountContactRole', 'Account Contact Role'],
      ['AccountFeed', 'Account Feed'],
      ['AccountHistory', 'Account History'],
      ['AccountPartner', 'Account Partner'],
      ['AccountRecordType', 'Account Record Type'],
      ['AccountShare', 'Account Share'],
      ['AccountTag', 'Account Tag'],
      ['AccountTeamMember', 'Account Team Member'],
      ['AccountTerritoryAssignmentRule', 'Account Territory Assignment Rule'],
      ['AccountTerritoryAssignmentRuleItem', 'Account Territory Assignment Rule Item'],
      ['AccountTerritorySharingRule', 'Account Territory Sharing Rule'],
      ['ActionCadence', 'Action Cadence']
    ];
    const list = document.getElementById('sfarc-bulk-obj-list');
    if (list) {
      list.innerHTML = sampleObjects.map(([name, label]) =>
        '<label class="sfarc-bulk-obj-row" title="' + label + '">' +
        '<input type="checkbox" class="sfarc-obj-chk" value="' + name + '">' +
        '<span class="sfarc-bulk-obj-name">' + name + '</span>' +
        (label.toLowerCase() !== name.toLowerCase() ? '<span class="sfarc-bulk-obj-label">' + label + '</span>' : '') +
        '</label>'
      ).join('');
      const countEl = document.getElementById('sfarc-bulk-obj-count');
      if (countEl) countEl.textContent = sampleObjects.length + ' objects';
    }
    // window helpers the page might touch
    window.escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    // show the wizard container (hidden in the real app until the mode is opened)
    const wiz = document.getElementById('sfarc-bulk-updater-container');
    if (wiz) wiz.style.display = 'flex';
  </script>
</body>
</html>
`;

const out = path.join(root, 'scratch-harness', 'preview-bulk-wizard.html');
fs.writeFileSync(out, html);
console.log('wizard preview written:', (html.length / 1024 / 1024).toFixed(2), 'MB');
