// Insert per-page favicon glyphs: every extension page that launches in a new
// tab gets `window.__sfarcFaviconPaths = [...]` (Feather-style stroke paths)
// plus a colored-favicon.js include, so the browser tab icon shows the tool's
// glyph in the org favicon color.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const GLYPHS = {
  'anonymous-apex.html': ['M4 17l6-6-6-6', 'M12 19h8'],
  'api-statistics.html': ['M18 20V10', 'M12 20V4', 'M6 20v-6'],
  'automation-cascade.html': ['M6 3v12', 'M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M18 9a9 9 0 0 1-9 9'],
  'bulk-field-builder.html': ['M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18'],
  'bulk-permission-wizard.html': ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  'code-coverage.html': ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  'code-editor.html': ['M22 9H2M14 17.5L16.5 15L14 12.5M10 12.5L7.5 15L10 17.5M2 7.8L2 16.2C2 17.8802 2 18.7202 2.32698 19.362C2.6146 19.9265 3.07354 20.3854 3.63803 20.673C4.27976 21 5.11984 21 6.8 21H17.2C18.8802 21 19.7202 21 20.362 20.673C20.9265 20.3854 21.3854 19.9265 21.673 19.362C22 18.7202 22 17.8802 22 16.2V7.8C22 6.11984 22 5.27977 21.673 4.63803C21.3854 4.07354 20.9265 3.6146 20.362 3.32698C19.7202 3 18.8802 3 17.2 3L6.8 3C5.11984 3 4.27976 3 3.63803 3.32698C3.07354 3.6146 2.6146 4.07354 2.32698 4.63803C2 5.27976 2 6.11984 2 7.8Z'],
  'data-builder.html': ['M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3z', 'M21 12c0 1.66-4 3-9 3s-9-1.34-9-3', 'M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5'],
  'data-export.html': ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  'data-import.html': ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M17 8l-5-5-5 5', 'M12 3v12'],
  'diff-checker.html': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M9 13h6', 'M9 17h4'],
  'event-monitor.html': ['M5 12.55a11 11 0 0 1 14.08 0', 'M1.42 9a16 16 0 0 1 21.16 0', 'M8.53 16.11a6 6 0 0 1 6.95 0', 'M12 20h.01'],
  'graphql-explorer.html': ['M18 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M6 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M18 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M8.59 13.51 15.42 17.49', 'M15.41 6.51 8.59 10.49'],
  'log-viewer.html': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  'metadata-exporter.html': ['M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.27 6.96 12 12.01l8.73-5.05', 'M12 22.08V12'],
  'org-limits.html': ['M22 12h-4l-3 9L9 3l-3 9H2'],
  'record-clone.html': ['M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  'record-viewer.html': ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  'rest-explorer.html': ['M22 2 11 13', 'M22 2 15 22l-4-9-9-4z']
};

let changed = 0;
for (const [file, paths] of Object.entries(GLYPHS)) {
  const full = path.join(ROOT, 'src', file);
  if (!fs.existsSync(full)) { console.log('SKIP (missing):', file); continue; }
  let html = fs.readFileSync(full, 'utf8');

  const json = JSON.stringify(paths);

  // Remove any previous inline glyph script (both old single-path and new array form)
  html = html.replace(/\n?\s*<script>\s*window\.__sfarcFavicon(StrokePath|Paths)\s*=\s*[^<]*<\/script>/g, '');

  const inline = `\n    <script>\n        // Browser-tab favicon: this tool's glyph, stroked in the org favicon\n        // color (colored-favicon.js renders it instead of the default cloud).\n        window.__sfarcFaviconPaths = ${json};\n    </script>`;

  if (html.includes('colored-favicon.js')) {
    // Insert right before the colored-favicon script so the var is set first
    html = html.replace(/(\s*<script[^>]*colored-favicon\.js[^>]*><\/script>)/, inline + '$1');
  } else {
    // Page has no colored favicon yet — add glyph + script before </head>
    const scriptTag = `${inline}\n    <script src="colored-favicon.js" defer></script>`;
    if (/<\/head>/.test(html)) {
      html = html.replace(/<\/head>/, scriptTag + '\n</head>');
    } else {
      console.log('SKIP (no </head>):', file);
      continue;
    }
  }

  fs.writeFileSync(full, html);
  changed++;
  console.log('PATCHED:', file);
}
console.log('Done. Patched', changed, 'pages.');
