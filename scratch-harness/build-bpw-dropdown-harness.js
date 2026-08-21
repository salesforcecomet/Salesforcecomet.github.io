#!/usr/bin/env node
// Builds scratch-harness/bpw-dropdown-preview.html — the Bulk Permission
// Wizard's Permission Set select enhanced by the REAL custom-dropdown.js,
// with 500 fake permission sets, verifying:
//   - the native select is hidden and replaced by the custom trigger,
//   - a search input appears (options.length > 8),
//   - typing filters options,
//   - clicking an option sets the select value + fires change,
//   - the native chevron is hidden while the custom trigger shows its own.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const PERM_SETS = [
  'Account read only (Account_read_only)',
  'ActorCASCPermSet (ActorCASCPermSet)',
  'Agentic Near Core CRM (AncCrmIntegrationUser)',
  'Agentic Near Core Marketing (AncMarketingIntegrationUser)',
  'Authenticated Payer (AuthenticatedPayer)',
  'Buyer (B2BBuyer)',
  'Buyer Manager (B2BBuyerManager)',
  'Bypass Lead Validation Rules (Bypass_Lead_Validation_Rules)',
  'C2CAnalyticsStoragePermSet (C2CAnalyticsStoragePermSet)',
  'CRM User (CRMUserPsl)',
  'Channel Manager (PRMChannelManagerPermissionSet)',
  'Command Center (CommandCenter)',
  'Commerce Admin (CommerceAdmin)',
  'Data Cloud Home Org Integration User (D360HomeOrgPermSet)',
  'DeliveryEstimationServicePermSet (DeliveryEstimationServicePermSet)'
];
// Pad to 500 options so the search input kicks in.
for (let i = 0; i < 485; i++) {
  PERM_SETS.push(`Generated Permission Set ${i + 16} (GenPS${i + 16})`);
}

const optionsHtml = PERM_SETS.map((label, i) =>
  `<option value="0PS000000000${String(i).padStart(4, '0')}">${label}</option>`).join('');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>BPW Permission Set — searchable dropdown</title>
<script>
// chrome stub for theme-manager-less pages (custom-dropdown has no chrome use,
// but keep parity with other harnesses).
window.chrome = window.chrome || { storage: { sync: { get: (k, cb) => cb && cb({}) }, local: { get: (k, cb) => cb && cb({}) }, onChanged: { addListener() {} } }, runtime: { getURL: (p) => p } };
</script>
<style>
:root { --sfarc-accent: #2196f3; --sfarc-accent-rgb: 33, 150, 243; }
${read('src/custom-dropdown.css')}
${read('src/bulk-permission-wizard.css')}
body { margin: 0; padding: 24px; background: #eef1f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
body.sfarc-dark-theme { background: #12141a; color: #e2e8f0; }
.bpw-controls { display: flex; gap: 16px; align-items: flex-end; }
#report { position: fixed; bottom: 8px; left: 8px; color: #e2e8f0; font: 11px monospace; white-space: pre-wrap; background: rgba(0,0,0,.75); padding: 6px 10px; border-radius: 6px; z-index: 2147483000; }
</style>
</head>
<body class="sfarc-dark-theme">
<div class="bpw-controls">
  <div class="bpw-control-group">
    <label class="tool-label" for="bpw-permset">Permission Set</label>
    <div class="bpw-select-wrap" id="wrap">
      <svg class="bpw-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
      <select id="bpw-permset" class="tool-select bpw-permset" data-searchable="true" data-search-placeholder="Search permission sets...">
        ${optionsHtml}
      </select>
    </div>
  </div>
</div>
<pre id="report"></pre>
<script>
${read('src/custom-dropdown.js')}
</script>
<script>
function probe() {
  const select = document.getElementById('bpw-permset');
  const container = document.querySelector('.sfarc-custom-dropdown-container');
  const trigger = document.querySelector('.sfarc-custom-dropdown-trigger');
  const search = document.querySelector('.sfarc-custom-dropdown-search-input');
  const chevron = document.querySelector('.bpw-select-chevron');
  return {
    selectHidden: getComputedStyle(select).display === 'none',
    containerExists: !!container,
    triggerText: trigger ? trigger.querySelector('.sfarc-custom-dropdown-value').textContent.slice(0, 40) : null,
    searchExists: !!search,
    searchPlaceholder: search ? search.placeholder : null,
    nativeChevronHidden: chevron ? getComputedStyle(chevron).display === 'none' : null,
    optionCount: document.querySelectorAll('.sfarc-custom-dropdown-option').length
  };
}
window.__bpwProbe = () => JSON.stringify(probe(), null, 1);
// Verify filtering + selection programmatically (the search input listener
// calls renderOptions + updateMenuPosition; drive it directly).
window.__bpwFilter = (text) => {
  const search = document.querySelector('.sfarc-custom-dropdown-search-input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(search, text);
  search.dispatchEvent(new Event('input', { bubbles: true }));
  return document.querySelectorAll('.sfarc-custom-dropdown-option').length;
};
window.__bpwClickFirst = () => {
  const first = document.querySelector('.sfarc-custom-dropdown-option');
  first.click();
  const select = document.getElementById('bpw-permset');
  return { value: select.value, label: select.options[select.selectedIndex].text };
};
document.getElementById('report').textContent = window.__bpwProbe();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'bpw-dropdown-preview.html'), html);
console.log('Wrote scratch-harness/bpw-dropdown-preview.html');
