// Builds smartfilter-preview.html — renders the new centered Smart Filters modal
// with the REAL inspector.css and the exact markup from main.js, plus a couple of
// filter rows, to verify the design in both themes.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'src', 'inspector.css'), 'utf8');

const modalMarkup = `
<div id="sfarc-panel" class="sfarc-panel sfarc-dark-theme" style="position: relative; width: 800px; height: 560px; overflow: hidden; background: #0f1115; border-radius: 14px;">
  <div id="sfarc-smart-filter-backdrop" class="sfarc-modal-backdrop" style="display: flex;">
    <div id="sfarc-smart-filter-popup" class="sfarc-smart-filter-modal" role="dialog" aria-modal="true">
      <div class="sfarc-smart-filter-modal-header">
        <span id="sfarc-smart-filter-title" class="sfarc-smart-filter-modal-title">Smart Filters</span>
        <button id="sfarc-smart-filter-close" class="sfarc-smart-filter-modal-close" title="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="sfarc-smart-filter-modal-body">
        <div class="sfarc-smart-filter-hint">Filter search results by User fields. Each condition is combined with the previous one.</div>
        <div id="sfarc-smart-filter-rows" class="sfarc-smart-filter-rows">
          <div class="sfarc-filter-row">
            <div style="width: 60px; flex-shrink: 0;"></div>
            <select class="sfarc-filter-select sfarc-filter-field" style="flex: 1; min-width: 0;">
              <option value="">Select Field...</option>
              <option selected>Username</option>
              <option>Email</option>
              <option>Profile</option>
              <option>Role</option>
              <option>License</option>
              <option>IsActive</option>
            </select>
            <select class="sfarc-filter-select sfarc-filter-op" style="width: 80px; flex-shrink: 0;">
              <option value="=" selected>Equals</option>
              <option value="!=">Not Equals</option>
              <option value="LIKE">Contains</option>
            </select>
            <input type="text" class="sfarc-filter-input sfarc-filter-val" value="" style="flex: 1; min-width: 0;" placeholder="Value...">
            <button class="sfarc-filter-del" title="Delete Condition"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        </div>
        <button id="sfarc-smart-filter-add-btn"><i class="fa-solid fa-plus"></i> Add Condition</button>
      </div>
      <div class="sfarc-smart-filter-modal-footer">
        <button id="sfarc-smart-filter-clear-btn" class="sfarc-smart-filter-clear">Clear</button>
        <button id="sfarc-smart-filter-apply-btn" class="sfarc-smart-filter-apply">Apply Filters</button>
      </div>
    </div>
  </div>
</div>`;

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Smart Filters Modal</title>
<style>
${css}
body { margin: 0; padding: 30px; background: #060709; font-family: Inter, system-ui, sans-serif; }
/* FA icon shims */
.fa-solid, .fa-regular { font-style: normal; }
</style>
</head>
<body>
${modalMarkup}
<script>
window.__measure = function () {
  const modal = document.querySelector('.sfarc-smart-filter-modal');
  const backdrop = document.querySelector('.sfarc-modal-backdrop');
  const mr = modal.getBoundingClientRect();
  const br = backdrop.getBoundingClientRect();
  const row = document.querySelector('.sfarc-filter-row');
  const rr = row.getBoundingClientRect();
  const rowKids = Array.from(row.children).map(k => ({ cls: k.className, w: Math.round(k.getBoundingClientRect().width) }));
  const cs = getComputedStyle(modal);
  return {
    backdrop: Math.round(br.width) + 'x' + Math.round(br.height),
    modal: Math.round(mr.width) + 'x' + Math.round(mr.height),
    modalPos: Math.round(mr.left) + ',' + Math.round(mr.top),
    centered: Math.abs((mr.left + mr.width / 2) - (br.left + br.width / 2)) < 2 && Math.abs((mr.top + mr.height / 2) - (br.top + br.height / 2)) < 2,
    radius: cs.borderRadius,
    bg: cs.backgroundColor,
    rowHeight: Math.round(rr.height),
    rowChildren: rowKids
  };
};
document.querySelector('.sfarc-smart-filter-modal-close i').textContent = '✕';
document.querySelector('.sfarc-filter-del i').textContent = '🗑';
document.querySelector('.sfarc-smart-filter-add-btn i').textContent = '+';
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'smartfilter-preview.html'), html);
console.log('Wrote scratch-harness/smartfilter-preview.html');
