// Regression tests for the "Validate before save" feature in the metadata
// exporter: language-aware validators (XML / HTML / Apex / JS / CSS) plus the
// Validate button + pre-save gate wiring.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const acorn = require('acorn');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

const src = fs.readFileSync('src/metadata-exporter.js', 'utf8');

// Extract the validator functions from the real source with acorn so the tests
// run the exact production code.
const ast = acorn.parse(src, { ecmaVersion: 'latest' });
function extractFns(names) {
  const out = {};
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id && names.includes(node.id.name)) {
      out[node.id.name] = src.slice(node.start, node.end);
    }
  }
  return out;
}
const fns = extractFns(['isXmlFile', 'scanXmlTags', 'scanHtmlTags', 'scanCodeStructure', 'getFileLanguage']);
const missing = ['isXmlFile', 'scanXmlTags', 'scanHtmlTags', 'scanCodeStructure', 'getFileLanguage'].filter(n => !fns[n]);
check('extracted all validator functions from source', missing.length === 0);
if (missing.length) {
  console.log('  missing:', missing.join(', '));
  process.exit(1);
}

// VOID_HTML_TAGS is a top-level const — extract it too so scanHtmlTags works.
const voidDecl = ast.body.find(n => n.type === 'VariableDeclaration' &&
  n.declarations.some(d => d.id && d.id.name === 'VOID_HTML_TAGS'));
let voidSrc = '';
if (voidDecl) voidSrc = src.slice(voidDecl.start, voidDecl.end).replace('const VOID_HTML_TAGS =', 'ctx.VOID_HTML_TAGS =');

// Provide a context so functions that reference each other (getFileLanguage
// calls isXmlFile, scanHtmlTags uses VOID_HTML_TAGS) resolve to the extracted
// implementations.
const ctx = {};
if (voidSrc) new Function('ctx', voidSrc)(ctx);
const evalFn = (name) => {
  const factory = new Function('Set', 'ctx', `with (ctx) { return (${fns[name]}); }`);
  return factory(Set, ctx);
};
['isXmlFile', 'scanXmlTags', 'scanHtmlTags', 'scanCodeStructure', 'getFileLanguage'].forEach(n => { ctx[n] = evalFn(n); });
const isXmlFile = ctx.isXmlFile;
const scanXmlTags = ctx.scanXmlTags;
const scanHtmlTags = ctx.scanHtmlTags;
const scanCodeStructure = ctx.scanCodeStructure;
const getFileLanguage = ctx.getFileLanguage;

console.log('== 1. Language detection ==');
check('.cls -> apex', getFileLanguage('classes/MyClass.cls') === 'apex');
check('.trigger -> apex', getFileLanguage('triggers/MyTrig.trigger') === 'apex');
check('.page -> xml', getFileLanguage('pages/MyPage.page') === 'xml');
check('.component -> xml', getFileLanguage('components/MyComp.component') === 'xml');
check('.xml -> xml', getFileLanguage('objects/MyObj.object-meta.xml') === 'xml');
check('.html -> html', getFileLanguage('lwc/myComp/myComp.html') === 'html');
check('.js -> javascript', getFileLanguage('lwc/myComp/myComp.js') === 'javascript');
check('.css -> css', getFileLanguage('lwc/myComp/myComp.css') === 'css');
check('unknown -> null', getFileLanguage('README.md') === null);

console.log('== 2. XML tag validation ==');
check('valid xml: no error', scanXmlTags('<root><child attr="x">text</child><void/></root>') === null);
{
  const err = scanXmlTags('<root><a></b></root>');
  check('mismatched close reported', !!err && /Mismatched closing tag <\/b>/.test(err.message));
  check('line number reported', !!err && err.line === 1);
}
{
  const err = scanXmlTags('<root>\n  <open>');
  check('unclosed tag reported', !!err && /Unclosed tag <open>/.test(err.message) && err.line === 2);
}
{
  const err = scanXmlTags('<root><!-- <fake> --></root>');
  check('comments ignored', err === null);
}

console.log('== 3. HTML tag validation ==');
check('valid html with void elements', scanHtmlTags('<div><img src="a.png"><br><span>hi</span></div>') === null);
{
  const err = scanHtmlTags('<div><section></div>');
  check('mismatched html close reported', !!err && /Mismatched closing tag <\/div>/.test(err.message));
}
{
  const err = scanHtmlTags('<div><p>text');
  check('unclosed html tag reported', !!err && /Unclosed tag <p>/.test(err.message));
}
{
  const err = scanHtmlTags('<div><script>if (a < b) { x(); }</script></div>');
  check('script bodies skipped (no false positive)', err === null);
}

console.log('== 4. Apex / JS / CSS structure ==');
const validApex = `public class Foo {
    public Integer bar() {
        String s = 'it has { braces } and (parens)';
        // comment with } and )
        /* block with { } */
        if (true) { return 1; }
        return 0;
    }
}`;
check('valid apex: no error', scanCodeStructure(validApex) === null);
{
  const err = scanCodeStructure('public class Foo {\n    public void x() {\n        return;\n}');
  check('apex unclosed brace reported', !!err && /Unclosed '{'/.test(err.message) && err.line === 1);
}
{
  const err = scanCodeStructure('public void x() { if (true { return; ) }');
  check('apex mismatched paren reported', !!err && /Mismatched '\)'/.test(err.message));
}
{
  const err = scanCodeStructure('const f = () => { return [1, 2); };');
  check('js mismatched bracket reported', !!err && /Mismatched '\)'/.test(err.message));
}
{
  const js = 'const t = `template ${foo({ a: 1 })}`;';
  check('js template literal with braces ok', scanCodeStructure(js) === null);
}
{
  const css = '.foo { color: red; }\n.bar { background: url("x)("); }';
  check('css with parens in strings ok', scanCodeStructure(css) === null);
}
{
  const err = scanCodeStructure('.foo { color: red;');
  check('css unclosed brace reported', !!err && /Unclosed '{'/.test(err.message));
}

console.log('== 5. Wiring ==');
check('Validate button exists in HTML', fs.readFileSync('src/metadata-exporter.html', 'utf8').includes('validate-retrieve-file-btn'));
check('validateCurrentFile defined', /function validateCurrentFile\(\)/.test(src));
check('button shown when file opens', /validateBtn\.style\.display = isDiffMode \? 'none' : 'flex'/.test(src));
check('button hidden when pane cleared', src.indexOf("validateBtn.style.display = 'none'") > -1);
check('click bound (bottom)', /getElementById\('validate-retrieve-file-btn'\)[\s\S]*?addEventListener\('click', validateCurrentFile\)/.test(src));
check('pre-save gate on sync-local-btn', /sync-local-btn'\)\.addEventListener\('click'[\s\S]*?const preSaveError = validateCurrentFile\(\);/.test(src));
check('save aborts on validation error', src.indexOf('if (!proceed) return;') > -1);
check('top Validate hidden in diff mode (no duplicate)', src.indexOf("topValidate.style.display = 'none';") > -1 && src.indexOf("topValidate.style.display = 'flex';") > -1);
check('showFileContent hides Validate while diff mode active', /validateBtn\.style\.display = isDiffMode \? 'none' : 'flex';/.test(src));

console.log(`\n${pass}/${pass + fail} checks passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
