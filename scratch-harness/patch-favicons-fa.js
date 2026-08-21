// Patch every tool page's favicon glyph to the EXACT Font Awesome icon its
// launcher popup row shows (same path data), so the Chrome-tab favicon and the
// popup row are pixel-identical. The favicon renderer fills them with the org
// color (see colored-favicon.js __sfarcFaviconFill support).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const fa = JSON.parse(fs.readFileSync('/tmp/fa-icons.json', 'utf8'));

// page -> FA icon name used by that tool's popup row / settings checklist
const PAGE_ICON = {
  'data-export': 'file-export',
  'data-import': 'file-import',
  'org-limits': 'gauge-high',
  'metadata-exporter': 'cube',
  'rest-explorer': 'paper-plane',
  'graphql-explorer': 'diagram-project',
  'record-clone': 'arrows-rotate',
  'bulk-permission-wizard': 'layer-group',
  'bulk-field-builder': 'table-columns',
  'code-coverage': 'vial',
  'event-monitor': 'satellite-dish',
  'anonymous-apex': 'bolt',
  'automation-cascade': 'sitemap',
  'api-statistics': 'chart-line',
  'record-viewer': 'eye',
  'data-builder': 'database',
  'diff-checker': 'code-compare',
  'log-viewer': 'file-lines',
};

let ok = 0, skipped = 0;
for (const [page, icon] of Object.entries(PAGE_ICON)) {
  const file = path.join(root, `src/${page}.html`);
  const html = fs.readFileSync(file, 'utf8');
  const paths = fa[icon];
  if (!paths || !paths.length) { console.log(`SKIP ${page}: no FA paths for ${icon}`); skipped++; continue; }
  const lineRe = /^(\s*)window\.__sfarcFaviconPaths\s*=\s*\[[^\]]*\];/m;
  if (!lineRe.test(html)) { console.log(`SKIP ${page}: pattern not found`); skipped++; continue; }
  const replacement = `$1window.__sfarcFaviconFill = ["${paths[0]}"];`;
  const out = html.replace(lineRe, replacement);
  if (out === html) { console.log(`SKIP ${page}: no change`); skipped++; continue; }
  fs.writeFileSync(file, out);
  console.log(`OK   ${page} -> fa-${icon} (${paths[0].length} chars)`);
  ok++;
}
console.log(`\npatched ${ok}, skipped ${skipped}`);
