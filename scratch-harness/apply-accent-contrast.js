// Migrate white TEXT on accent-filled surfaces to var(--sfarc-accent-contrast)
// so light org accents get dark readable text. Run with --preview to see the
// changes without writing; --write applies them.
const fs = require('fs');
const { execSync } = require('child_process');

const apply = process.argv.includes('--write');
const preview = apply || process.argv.includes('--preview');

const files = execSync('ls -1 src/**/*.css src/*.html 2>/dev/null', { encoding: 'utf8' })
  .split('\n').filter(Boolean)
  .filter(f => !f.includes('scratch') && !f.includes('preview-') && !f.includes('unused') && !f.endsWith('slds.css'));

// A background declaration using the plain accent/primary var (NOT -dark/-light/-glow/-soft/-rgb).
const BG_VAR = /background[^;]*var\(--(?:sfarc-accent|primary)(?![-\w])/;
// A `color:` declaration (NOT background-color) that is white, optional !important.
const WHITE = /(^|[;{]\s*)(color\s*:\s*(?:#fff\b|#ffffff\b|white\b)\s*)(!important)?\s*;/gi;

let total = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let out = '';
  let last = 0, m, changed = 0;
  const diffs = [];
  while ((m = re.exec(src)) !== null) {
    const sel = m[1];
    const body = m[2];
    let newBody = body;
    if (BG_VAR.test(body) && WHITE.test(body)) {
      newBody = body.replace(WHITE, (full, pre, decl, imp) => {
        const value = decl.replace(/^color\s*:\s*/i, '').trim();
        return pre + `color: var(--sfarc-accent-contrast, ${value})` + (imp ? ' ' + imp : '') + ';';
      });
      if (newBody !== body) {
        changed++;
        diffs.push(sel.trim().replace(/\s+/g, ' ').slice(0, 60) + '  =>  ' + newBody.trim().replace(/\s+/g, ' ').slice(0, 90));
      }
    }
    out += src.slice(last, m.index) + sel + '{' + newBody + '}';
    last = m.index + m[0].length;
  }
  out += src.slice(last);
  if (changed && preview) {
    console.log(`\n=== ${f} (${changed} rule${changed > 1 ? 's' : ''}) ===`);
    for (const d of diffs) console.log('  ' + d);
  }
  if (apply && changed) {
    fs.writeFileSync(f, out);
    total += changed;
  }
}
if (apply) console.log(`\nApplied to ${total} rule blocks.`);
else console.log('\nPreview only. Re-run with --write to apply.');
