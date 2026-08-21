const fs = require('fs');
function extract(selector, file) {
  const css = fs.readFileSync(file, 'utf8');
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|\\n)([^\\n]*' + esc + '[^\\n]*\\{[\\s\\S]*?\\n\\s*\\})', 'm');
  const m = css.match(re);
  return m ? m[2].trim() : null;
}
const rules = [];
const add = (l, s, f) => { const r = extract(s, f); rules.push(`/* ${l} */\n${r || '/* NOT FOUND */'}`); };
add('query tab active', '.query-tab.active', 'src/styles/sfir.css');
add('header btn', '.sfir-header-btn', 'src/styles/sfir.css');
add('save-query is-saved', '.sfir-save-query-btn.is-saved', 'src/styles/sfir.css');
add('history item load hover', '.sfir-history-item-load-btn:hover', 'src/styles/sfir.css');
add('funnel active', '.sfir-funnel-btn.active', 'src/styles/sfir.css');
add('status bar', '.status-bar', 'src/code-editor.html');
add('btn blue', '.btn-blue', 'src/code-editor.html');

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { background: #1a1b1e; color: #fff; font-family: sans-serif; padding: 24px; }
.section { margin-bottom: 28px; }
.section h3 { color: #94a3b8; font-size: 12px; margin: 0 0 8px; }
${rules.join('\n')}
.sfir-header-btn, .sfir-save-query-btn, .sfir-history-item-load-btn { display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 6px; font-size: 12px; }
.sfir-funnel-btn { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 6px; font-size: 12px; }
.status-bar { display: inline-flex; align-items: center; padding: 8px 16px; font-size: 12px; border-radius: 4px; }
.btn-blue { display: inline-flex; align-items: center; padding: 6px 12px; font-size: 12px; border-radius: 4px; }
</style>
</head>
<body>
  <div class="section" id="lime" style="--sfarc-accent: #D2FF59; --sfarc-accent-contrast: #69802d; --primary: #D2FF59;">
    <h3>Light accent (lime) — text must be dark olive:</h3>
    <span class="query-tab active">Query 1</span>
    <button class="sfir-header-btn">Run Export</button>
    <button class="sfir-save-query-btn is-saved">Save Query</button>
    <button class="sfir-history-item-load-btn">Load</button>
    <button class="sfir-funnel-btn active">Funnel</button>
    <div class="status-bar">Status Bar</div>
    <button class="btn-blue">Blue Btn</button>
  </div>
  <div class="section" id="blue" style="--sfarc-accent: #2196f3; --sfarc-accent-contrast: #ffffff; --primary: #2196f3;">
    <h3>Dark accent (blue) — text stays white:</h3>
    <span class="query-tab active">Query 1</span>
    <button class="sfir-header-btn">Run Export</button>
    <button class="sfir-save-query-btn is-saved">Save Query</button>
    <div class="status-bar">Status Bar</div>
  </div>
  <script>
    window.__measure = () => {
      const txt = (sel, root) => getComputedStyle(root.querySelector(sel)).color;
      const lime = document.getElementById('lime');
      const blue = document.getElementById('blue');
      return {
        lime: {
          queryTab: txt('.query-tab', lime),
          headerBtn: txt('.sfir-header-btn', lime),
          saveQuery: txt('.sfir-save-query-btn', lime),
          loadBtn: txt('.sfir-history-item-load-btn', lime),
          statusBar: txt('.status-bar', lime),
          btnBlue: txt('.btn-blue', lime),
        },
        blue: {
          queryTab: txt('.query-tab', blue),
          headerBtn: txt('.sfir-header-btn', blue),
          statusBar: txt('.status-bar', blue),
        },
      };
    };
  </script>
</body>
</html>`;
fs.writeFileSync('scratch-harness/accent-contrast-preview.html', html);
console.log('written scratch-harness/accent-contrast-preview.html');
