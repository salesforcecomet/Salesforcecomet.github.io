// Builds scratch-harness/auth-input-preview.html: inlines the REAL
// src/styles/record-clone.css and renders the auth modal's SID input with its
// icon, then measures icon vs input vertical centers (delta should be 0).
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/styles/record-clone.css'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Auth modal SID input — icon alignment</title>
<style>
  body { background: #eef1f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; }
  .card { background: #fff; border: 1px solid rgba(15,23,42,0.1); border-radius: 12px; max-width: 760px; padding: 20px; }
  .sfarc-form-group { display: flex; flex-direction: column; gap: 6px; }
  .sfarc-form-label { font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #525866; }
  pre { font: 11px ui-monospace, Menlo, monospace; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-top: 16px; white-space: pre-wrap; }
</style>
<style>${css}</style>
</head>
<body>
<div class="card">
  <div class="sfarc-form-group">
    <label class="sfarc-form-label">Session ID / Access Token (SID)</label>
    <div class="sfarc-input-with-icon">
      <span class="sfarc-input-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-1.5 1.5L14 9.5a5 5 0 1 0 3 3l3.5-3.5m-3.5-3.5l1.5-1.5"/><circle cx="7.5" cy="16.5" r="1.5"/></svg>
      </span>
      <input type="password" class="sfarc-input" placeholder="Paste the session URL or SID — e.g. https://my-company.my.salesforce.com/secur/frontdoor.jsp?sid=00D...">
    </div>
  </div>
  <pre id="out">measuring…</pre>
</div>
<script>
  function measure() {
    const wrap = document.querySelector('.sfarc-input-with-icon');
    const icon = wrap.querySelector('.sfarc-input-icon');
    const input = wrap.querySelector('input');
    const ir = icon.getBoundingClientRect();
    const inp = input.getBoundingClientRect();
    const ic = ir.top + ir.height / 2;
    const inpc = inp.top + inp.height / 2;
    const textOverlap = ir.right > inp.left + parseFloat(getComputedStyle(input).paddingLeft);
    document.getElementById('out').textContent =
      'icon center: ' + ic.toFixed(1) + 'px · input center: ' + inpc.toFixed(1) + 'px · delta: ' + (ic - inpc).toFixed(1) + 'px\n' +
      'icon size: ' + ir.height.toFixed(1) + 'px · input height: ' + inp.height.toFixed(1) + 'px · icon left offset: ' + (ir.left - inp.left).toFixed(1) + 'px\n' +
      'icon overlaps text zone (icon.right > padding-left edge): ' + textOverlap + ' (padding-left: ' + getComputedStyle(input).paddingLeft + ')';
  }
  setTimeout(measure, 50);
  window.__measure = measure;
<\/script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'scratch-harness/auth-input-preview.html'), html);
console.log('Wrote scratch-harness/auth-input-preview.html (' + html.length + ' bytes)');
