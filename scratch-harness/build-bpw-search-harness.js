// Builds bpw-search-preview.html — replicates Bulk Permission Wizard step-1
// controls with the REAL bulk-permission-wizard.css AND the REAL
// font-awesome.min.js (same file the page loads), so FA's <i> -> <svg>
// transformation happens exactly like in Chrome. The search icons are plain
// inline <svg class="bpw-search-icon"> — never touched by FA.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'src', 'bulk-permission-wizard.css'), 'utf8');
const faJs = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'font-awesome.min.js'), 'utf8');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>BPW Search Box Icon Check</title>
<style>
${css}
body { margin: 0; padding: 30px; background: #111318; font-family: Inter, sans-serif; }
#bpw-root { max-width: 900px; }
</style>
<script>
${faJs}
</script>
</head>
<body class="sfarc-dark-theme">
<div id="bpw-root">
  <div class="bpw-root">
    <div class="bpw-body">
      <div class="bpw-panel">
        <div class="bpw-controls">
          <div class="bpw-control-group">
            <label class="tool-label" for="bpw-permset">Permission Set</label>
            <select id="bpw-permset" class="tool-select bpw-permset"><option>ActorCASCPermSet (ActorCASCPermSe...)</option></select>
          </div>
          <div class="bpw-control-group bpw-target-search">
            <label class="tool-label" for="bpw-target-name">Target Name</label>
            <div class="bpw-search-wrap">
              <svg class="bpw-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" id="bpw-target-name" class="tool-input" placeholder="Enter target Name (e.g. Sales_User_PS)...">
            </div>
          </div>
          <div class="bpw-control-group bpw-object-search">
            <label class="tool-label" for="bpw-object-search">Select Objects</label>
            <div class="bpw-search-wrap">
              <svg class="bpw-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" id="bpw-object-search" class="tool-input" placeholder="Search objects...">
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
function report() {
  const out = [];
  document.querySelectorAll('.bpw-search-wrap').forEach(wrap => {
    const icon = wrap.querySelector('.bpw-search-icon');
    const input = wrap.querySelector('.tool-input');
    const ir = icon.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    const inputR = input.getBoundingClientRect();
    out.push({
      input: input.id,
      iconTag: icon.tagName.toLowerCase() + '.' + (icon.getAttribute('class') || ''),
      wrap: wr.width + 'x' + wr.height,
      icon: Math.round(ir.left - wr.left) + '..' + Math.round(ir.right - wr.left) + ' (x), ' + Math.round(ir.top - wr.top) + '..' + Math.round(ir.bottom - wr.top) + ' (y)',
      iconInsideInput: ir.left >= inputR.left && ir.right <= inputR.right && ir.top >= inputR.top - 1 && ir.bottom <= inputR.bottom + 1,
      iconVertCentered: Math.abs((ir.top + ir.bottom) / 2 - (inputR.top + inputR.bottom) / 2) < 1.5,
      iconColor: getComputedStyle(icon).color,
      inputPaddingLeft: getComputedStyle(input).paddingLeft
    });
  });
  window.__report = out;
  return JSON.stringify(out, null, 1);
}
window.__check = report;
document.body.style.opacity = '1';
</script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'bpw-search-preview.html'), html);
console.log('Wrote scratch-harness/bpw-search-preview.html (real FA JS + inline svg icons)');
