import fs from 'node:fs';

const js = fs.readFileSync('src/metadata-exporter.js', 'utf8');
const html = fs.readFileSync('src/metadata-exporter.html', 'utf8');
const css = fs.readFileSync('src/metadata-exporter.css', 'utf8');
let passed = 0;
let failed = 0;
function check(name, condition) {
  if (condition) { passed++; console.log('  PASS', name); }
  else { failed++; console.error('  FAIL', name); }
}

check('normalizes Windows separators', /function normalizeProjectPath[\s\S]*replace\(\/\\\\\/g, '\/'\)/.test(js));
check('uses case-insensitive project keys', /function projectPathKey[\s\S]*toLocaleLowerCase/.test(js));
check('normalizes BOM and CRLF for diffing', /function normalizeComparisonContent[\s\S]*\\uFEFF[\s\S]*\\r\\n/.test(js));
check('org lookup uses canonical path keys', /currentExtractedFiles\.find[\s\S]{0,300}projectPathKey/.test(js));
check('package filter is case-insensitive', /function matchesPackageXmlFilter[\s\S]{0,700}toLowerCase/.test(js));
check('folder reads are batched', /const batchSize = 24;[\s\S]*Promise\.all/.test(js));
check('ZIP reads are batched', /selectLocalProjectZip[\s\S]*const batchSize = 20;[\s\S]*Promise\.all/.test(js));
check('large loops yield to UI', (js.match(/setTimeout\(resolve, 0\)/g) || []).length >= 3);
check('tree children render lazily', /let childrenRendered = false[\s\S]*row\.onclick[\s\S]*renderTreeLevel/.test(js));
check('Azure ZIP selector exists', html.includes('value="local_zip"') && html.includes('local-project-zip-input'));
check('major pipeline artifact sources exist', ['pipeline_github', 'pipeline_gitlab', 'pipeline_jenkins', 'pipeline_bitbucket', 'pipeline_circleci', 'pipeline_generic'].every(value => html.includes(`value="${value}"`)));
check('Windows directory fallback exists', html.includes('webkitdirectory') && js.includes('selectLocalProjectFolderFallback'));
check('progress panel exists', html.includes('local-import-progress') && js.includes('updateLocalImportProgress'));
check('progress bar is styled', css.includes('.local-import-progress-track'));
check('ignored dependency folders', js.includes("'node_modules'") && js.includes("'.git'"));

console.log(`\n${passed}/${passed + failed} checks passed`);
process.exit(failed ? 1 : 0);
