// Builds a 4-page live demo of the tab slide transition. Each page inlines
// the REAL src/nav-slide.js and the REAL slide CSS from sfir.css, with the
// sfir nav markup, so clicking Export/Import/Limits/Metadata actually
// navigates and slides in the preview.
const fs = require('fs');

const css = fs.readFileSync('src/styles/sfir.css', 'utf8');
const navSlideJs = fs.readFileSync('src/nav-slide.js', 'utf8');

// Extract the slide-transition CSS block from sfir.css
const start = css.indexOf('TAB PAGE SLIDE TRANSITION');
const end = css.indexOf('@media (prefers-reduced-motion: reduce)');
let slideCss = '';
if (start >= 0 && end >= 0) {
  // from the comment marker back to the start of the comment
  let s = css.lastIndexOf('/*', start);
  slideCss = css.slice(s, css.indexOf('}', end) + 1);
} else {
  console.error('slide CSS markers not found');
  process.exit(1);
}

const PAGES = [
  { file: 'data-export', label: 'Export', color: '#58a6ff', active: 'export' },
  { file: 'data-import', label: 'Import', color: '#3fb950', active: 'import' },
  { file: 'org-limits', label: 'Limits', color: '#e3b341', active: 'limits' },
  { file: 'metadata-exporter', label: 'Metadata', color: '#f47067', active: 'metadata' }
];

function buildPage(active) {
  const tabs = PAGES.map(p => `
        <li class="slds-builder-header__nav-item">
          <a class="slds-builder-header__item-action${p.file === active ? ' sfir-nav-active' : ''}" href="${p.file}.html?host=demo">
            <span class="sfir-nav-label">${p.label}</span>
          </a>
        </li>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${active} — Nav Slide Demo</title>
<style>
  /* REAL slide-transition CSS from sfir.css */
${slideCss}
  /* Minimal demo chrome (mimics the sfir pages) */
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Inter', -apple-system, 'Segoe UI', sans-serif; background: #0d1117; color: #c9d1d9; }
  .slds-builder-header_container { border-bottom: 1px solid #30363d; background: #161b22; }
  .slds-builder-header { display: flex; align-items: center; gap: 10px; padding: 0 16px; height: 46px; }
  .slds-builder-header__nav-list { display: flex; align-items: center; list-style: none; margin: 0; padding: 4px; gap: 4px; background: rgba(255,255,255,0.04); border: 1px solid #30363d; border-radius: 999px; }
  .slds-builder-header__nav-item { list-style: none; }
  .slds-builder-header__item-action {
    display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; border-radius: 999px;
    color: #8b949e; text-decoration: none; font-size: 12.5px; font-weight: 600;
    border: 1px solid transparent;
  }
  .slds-builder-header__item-action:hover { color: #e6edf3; background: rgba(255,255,255,0.06); }
  .slds-builder-header__item-action.sfir-nav-active { background: #1f6feb; color: #fff; box-shadow: 0 0 0 1px rgba(255,255,255,0.1) inset; }
  .center-title { flex: 1; text-align: center; font-size: 14px; font-weight: 700; color: #e6edf3; letter-spacing: 0.2px; }
  .main { padding: 32px; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 28px; max-width: 560px; }
  .card h1 { margin: 0 0 6px; font-size: 18px; color: #e6edf3; }
  .card .accent { width: 60px; height: 4px; border-radius: 4px; background: ${PAGES.find(p => p.file === active).color}; margin-bottom: 14px; }
  .card p { margin: 0; color: #8b949e; font-size: 13px; line-height: 1.6; }
  .measure {
    position: fixed; bottom: 8px; left: 8px; z-index: 999; background: rgba(0,0,0,0.8); color: #7ee787;
    font: 11px/1.6 ui-monospace, monospace; padding: 8px 10px; border-radius: 8px; white-space: pre;
    max-width: 90vw;
  }
</style>
</head>
<body>
  <div class="slds-builder-header_container">
    <header class="slds-builder-header">
      <nav class="slds-builder-header__nav sfir-border-none">
        <ul class="slds-builder-header__nav-list">
${tabs}
        </ul>
      </nav>
      <div class="center-title">Salesforce Comet — ${active.toUpperCase()} PAGE</div>
    </header>
  </div>
  <div class="main">
    <div class="card">
      <h1>${PAGES.find(p => p.file === active).label}</h1>
      <div class="accent"></div>
      <p>This is the <strong>${active}.html</strong> demo page. Click the tabs above to slide
      between pages. The current html class is shown in the corner —
      <em>sfir-page-enter-right</em> when arriving from the left tab, <em>sfir-page-enter-left</em>
      when arriving from the right tab.</p>
    </div>
  </div>
  <div class="measure" id="measure"></div>
  <script>
    ${navSlideJs}
  </script>
  <script>
    function measure() {
      const el = document.getElementById('measure');
      const cls = document.documentElement.className;
      const anim = getComputedStyle(document.documentElement).animationName;
      el.textContent = 'page: ${active}.html\\nhtml class: ' + (cls || '(none)') +
        '\\nanimation: ' + anim;
    }
    // Measure a few times (the class persists; animation ends).
    measure();
    setTimeout(measure, 350);
  </script>
</body>
</html>
`;
}

fs.mkdirSync('scratch-harness/nav-demo', { recursive: true });
PAGES.forEach(p => {
  fs.writeFileSync(`scratch-harness/nav-demo/${p.file}.html`, buildPage(p.file));
  console.log('wrote', 'scratch-harness/nav-demo/' + p.file + '.html');
});
