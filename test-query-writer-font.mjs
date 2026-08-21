// Regression tests: the SOQL query writer (data-export) must use Helvetica —
// the #query textarea, its .query-backdrop highlight layer, and the query
// preview chip. Other --sfir-mono-font surfaces stay monospace.
import fs from 'fs';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

const css = fs.readFileSync('src/styles/sfir.css', 'utf8');

console.log('== Query writer font (sfir.css) ==');
check('#query uses Helvetica', /#query \{[\s\S]*?font-family: Helvetica, Arial, sans-serif !important;/.test(css));
check('.query-backdrop uses Helvetica', /\.query-backdrop \{[\s\S]*?font-family: Helvetica, Arial, sans-serif !important;/.test(css));
check('.sfir-query-preview-text uses Helvetica', /\.sfir-query-preview-text \{[\s\S]*?font-family: Helvetica, Arial, sans-serif !important;/.test(css));

console.log('== Other mono surfaces untouched ==');
check('mono font variable still defined', /--sfir-mono-font: 'Fira Code'/.test(css));
check('other mono surfaces still use variable', (css.match(/font-family: var\(--sfir-mono-font\)/g) || []).length >= 4);
const darkQueryBlock = (css.match(/body\.sfarc-dark-theme #query \{[\s\S]*?\n\}/) || [''])[0];
check('dark #query has no mono font override', darkQueryBlock.indexOf('font-family') === -1);

console.log(`\n${pass}/${pass + fail} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
