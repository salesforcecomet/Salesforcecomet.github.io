// Converts native alert('...') → toast.{success|error|warning|info}('...')
// for Chrome Web Store quality. Confirms/prompts are handled manually.
const fs = require('fs');

const FILES = [
  'src/main.js',
  'src/popup.js',
  'src/code-editor.js',
  'src/bulk-field-builder.js',
  'src/record-clone.js',
  'src/record-viewer.js',
  'src/log-viewer.js',
  'src/rest-explorer.js',
  'src/graphql-explorer.js',
  'src/utils.js',
  'src/settings.js',
  'src/event-monitor.js',
  'src/data-builder.js',
  'src/api-statistics-page.js'
];

const ERR = /error|failed|fail to|could not|cannot|unable|not found|not available|no debug level|must (start|be)|please select|please enter|please navigate|please load|doesn.?t exist|not recognized|no active|missing|invalid|denied|at least one/;
const OK = /copied|saved|created|enabled|success|updated|added|downloaded|exported|deleted|reset|removed|completed|done|cleared/;
const WARN = /please|are you sure|will be|coming soon|warning|refresh this page|not yet/;

function classify(text) {
  const t = text.toLowerCase();
  if (ERR.test(t)) return 'error';
  if (OK.test(t)) return 'success';
  if (WARN.test(t)) return 'warning';
  return 'info';
}

// Find the matching close paren index starting after the opening paren at `open`.
function findClose(src, open) {
  let depth = 0;
  let inStr = null;
  let i = open;
  while (i < src.length) {
    const ch = src[i];
    if (inStr) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === inStr) inStr = null;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
    } else if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function convertFile(path) {
  const orig = fs.readFileSync(path, 'utf8');
  let src = orig;
  const out = [];
  let idx = 0;
  let count = 0;
  const re = /alert\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const open = m.index + m[0].length - 1;
    const close = findClose(src, open);
    if (close === -1) continue;
    const inner = src.slice(open + 1, close).trim();
    const type = classify(inner);
    out.push({ at: m.index, inner: inner.slice(0, 60), type });
    count++;
  }
  // Replace from the end to keep indices valid.
  const ops = [];
  const re2 = /alert\s*\(/g;
  let m2;
  while ((m2 = re2.exec(src)) !== null) {
    const open = m2.index + m2[0].length - 1;
    const close = findClose(src, open);
    if (close === -1) continue;
    const inner = src.slice(open + 1, close).trim();
    ops.push({ start: m2.index, end: close + 1, inner });
  }
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i];
    const type = classify(op.inner);
    src = src.slice(0, op.start) + 'toast.' + type + '(' + op.inner + ')' + src.slice(op.end);
  }
  if (src !== orig) {
    fs.writeFileSync(path, src);
  }
  console.log(path + ': ' + count + ' alert() converted (' + out.map(o => o.type).join(',') + ')');
}

for (const f of FILES) {
  try {
    convertFile(f);
  } catch (e) {
    console.error('FAILED', f, e.message);
  }
}
console.log('done');
