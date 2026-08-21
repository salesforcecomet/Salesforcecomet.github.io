const fs = require('fs');

function extract(selector, file) {
  const css = fs.readFileSync(file, 'utf8');
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|\\n)([^\\n]*' + esc + '[^\\n]*\\{[\\s\\S]*?\\n\\})', 'm');
  const m = css.match(re);
  return m ? m[2].trim() : null;
}

const rules = [];
const add = (label, sel, file) => rules.push(`/* ${label} */\n${extract(sel, file) || '/* NOT FOUND */'}`);
add('backdrop', '.query-backdrop', 'src/styles/sfir.css');
add('query', '#query', 'src/styles/sfir.css');
add('preview chip', '.sfir-query-preview-text', 'src/styles/sfir.css');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { background: #1e1e1e; font-family: sans-serif; padding: 24px; color: #fff; }
.wrap { max-width: 620px; }
${rules.join('\n')}
</style>
</head>
<body>
  <div class="wrap">
    <div style="margin-bottom:8px; font-size:11px; color:#94a3b8; font-weight:600;">OBJECTS SUGGESTIONS:</div>
    <div class="query-editor-wrapper" style="position:relative; width:100%; background:#ffffff; border-radius:0;">
      <div class="query-backdrop" id="backdrop">SELECT OwnerId, BillingAddress FROM Account</div>
      <textarea id="query" spellcheck="false">SELECT OwnerId, BillingAddress FROM Account</textarea>
    </div>
    <div style="margin-top:10px;">
      <span class="sfir-query-preview-text" id="preview">SELECT OwnerId, BillingAddress FROM</span>
    </div>
  </div>
  <script>
    window.__measure = () => ({
      editorFont: getComputedStyle(document.getElementById('query')).fontFamily,
      backdropFont: getComputedStyle(document.getElementById('backdrop')).fontFamily,
      previewFont: getComputedStyle(document.getElementById('preview')).fontFamily,
      editorPad: getComputedStyle(document.getElementById('query')).padding,
    });
  </script>
</body>
</html>`;

fs.writeFileSync('scratch-harness/query-font-preview.html', html);
console.log('written scratch-harness/query-font-preview.html');
