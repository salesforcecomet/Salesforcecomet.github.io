// CSP fix: the extension's manifest CSP is `script-src 'self'`, which BLOCKS
// every inline `<script>window.__sfarcFaviconFill = [...]</script>` block in
// the 19 tool pages (log-viewer.html and friends log a violation on every
// open and lose their custom tab glyph).
//
// This script:
//   1. extracts each page's inline glyph assignment,
//   2. writes src/favicon-glyphs.js (a real, CSP-compliant script that assigns
//      the right glyph per page by filename),
//   3. replaces the inline <script> block in each HTML with
//      `<script src="favicon-glyphs.js"></script>` in the same spot.
//
// Run from repo root:  node scratch-harness/migrate-favicon-glyphs.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.html'));
const glyphs = {}; // page -> { fill?: string[], paths?: string[] }
let patched = 0;

const ASSIGN_RE = /window\.__sfarcFavicon(Fill|Paths)\s*=\s*(\[[\s\S]*?\]);/;

for (const file of files) {
  const full = path.join(SRC, file);
  let html = fs.readFileSync(full, 'utf8');
  const m = ASSIGN_RE.exec(html);
  if (!m) continue; // no inline glyph on this page

  const varName = m[1]; // Fill | Paths
  const value = m[2];   // array literal
  // Validate it is a proper JSON-ish array of strings
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error(`bad glyph in ${file}`);
  glyphs[file] = glyphs[file] || {};
  glyphs[file][varName === 'Fill' ? 'fill' : 'paths'] = parsed;

  // Remove the ENTIRE inline script block that held the assignment
  // (handles the leading comment lines inside <script>...</script>).
  const start = html.lastIndexOf('<script>', m.index);
  const end = html.indexOf('</script>', m.index);
  if (start < 0 || end < 0) throw new Error(`cannot find inline block in ${file}`);
  const block = html.slice(start, end + '</script>'.length);
  html = html.replace(block, '    <script src="favicon-glyphs.js"></script>');

  fs.writeFileSync(full, html);
  patched++;
  console.log('PATCHED:', file, `(${varName}, ${parsed.length} path(s))`);
}

// ── write the shared registry file ───────────────────────────────────────────
const lines = [
  '// Per-tool browser-tab favicon glyphs, keyed by page filename.',
  '//',
  '// Kept in a real .js file instead of inline <script> tags because the',
  '// extension CSP (manifest.json: script-src \'self\') blocks inline scripts.',
  '// colored-favicon.js reads window.__sfarcFaviconFill / __sfarcFaviconPaths',
  '// as before — this file just assigns them before that script runs.',
  '(function () {',
  "    const page = (location.pathname.split('/').pop() || '').toLowerCase();",
  '    const GLYPHS = {',
];
for (const [file, g] of Object.entries(glyphs).sort()) {
  const parts = [];
  if (g.fill) parts.push(`fill: ${JSON.stringify(g.fill)}`);
  if (g.paths) parts.push(`paths: ${JSON.stringify(g.paths)}`);
  lines.push(`        ${JSON.stringify(file)}: { ${parts.join(', ')} },`);
}
lines.push('    };');
lines.push('    const glyph = GLYPHS[page];');
lines.push('    if (!glyph) return;');
lines.push('    if (glyph.fill) window.__sfarcFaviconFill = glyph.fill;');
lines.push('    if (glyph.paths) window.__sfarcFaviconPaths = glyph.paths;');
lines.push('})();');

const outFile = path.join(SRC, 'favicon-glyphs.js');
fs.writeFileSync(outFile, lines.join('\n') + '\n');
console.log(`\nWrote ${outFile} (${Object.keys(glyphs).length} pages registered).`);
console.log('Patched', patched, 'HTML files.');
