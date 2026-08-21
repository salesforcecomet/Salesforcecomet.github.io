// Build a standalone preview of the glassmorphism Security & Health Audit panel,
// using the REAL terminal + report CSS extracted from code-editor.html.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/code-editor.html'), 'utf8');

// Extract rules matching given selectors (each rule: selectors { body })
function extractRules(html, matcher) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const sel = m[1].trim();
    if (matcher(sel)) rules.push(`${sel} { ${m[2].trim()} }`);
  }
  return rules.join('\n');
}

const terminalCss = extractRules(html, (s) =>
  /^\.terminal-panel\b|^\.terminal-header\b|^\.terminal-tabs\b|^\.terminal-tab\b|^\.terminal-body\b|^\.terminal-controls\b/.test(s)
);
const areaCss = extractRules(html, (s) => /^\.main-editor-area\b/.test(s));
const secCss = extractRules(html, (s) => s.includes('#terminal-body-security'));

const darkVars = `
  :root {
    --text-active: #e2e8f0;
    --text-muted: #94a3b8;
    --bg-main: #1e1e1e;
    --bg-terminal: #181818;
    --bg-terminal-header: #252526;
    --border-color: #252526;
    --icon-color: #9ca3af;
    --text-main: #d4d4d4;
    --sfarc-accent-glow: #38bdf8;
    --sfarc-accent-glow-rgb: 56, 189, 248;
    --accent-green: #2ea043;
  }
  body { margin: 0; font-family: Inter, -apple-system, sans-serif; background: #111418; }
`;

// Editor content behind the terminal so the blur has something to refract
const editorBackdrop = `
  <div style="flex: 1; padding: 16px 20px; font-family: 'Fira Code', monospace; font-size: 13px; line-height: 1.7; color: #d4d4d4; position: relative; overflow: hidden; background: #1e1e1e;">
    <div style="color: #38bdf8; font-weight: 600; margin-bottom: 6px;">AccountHandler.cls — Monaco Editor</div>
    ${Array.from({ length: 12 }, (_, i) => `<div><span style="color:#4b5563; display:inline-block; width:26px;">${i + 1}</span> <span style="color:${i % 2 ? '#7dd3fc' : '#a5b4fc'}">public class Demo</span> { <span style="color:#f9a8d4">String</span> a = <span style="color:#fde68a">'hello'</span>; }</div>`).join('')}
  </div>
`;

// Same render logic as renderSecurityFindings in code-editor.js
const findings = [
  { line: 11, icon: 'fa-triangle-exclamation', title: 'DML Statement inside Loop', description: 'Governor Limit Risk: DML statement inside a loop can hit the 150 DML statements governor limit.', severity: 'HIGH', color: '#f87171' },
  { line: 11, icon: 'fa-shield-halved', title: 'Apex PMD: AvoidDmlInLoops', description: 'PMD Rule (AvoidDmlInLoops): Avoid executing DML operations inside loops.', severity: 'HIGH', color: '#f87171' },
  { line: 11, icon: 'fa-shield-halved', title: 'Apex PMD: ApexCRUDViolation', description: 'PMD Rule (ApexCRUDViolation): Ensure CRUD/FLS permissions are checked or Security.stripInaccessible() is used before DML operations.', severity: 'MEDIUM', color: '#fbbf24' },
];
const score = 45;
const ok = findings.length === 0;
const scoreColor = score >= 80 ? '#2ea043' : score >= 50 ? '#fbbf24' : '#f87171';
const fileLabel = 'TestPmdController.cls';
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sevClass = (s) => s === 'HIGH' ? 'high' : s === 'MEDIUM' ? 'medium' : 'low';

const itemsHtml = findings.map(f => `
    <div class="sec-item" style="--sev: ${f.color || '#f87171'};" data-line="${f.line}" title="Click to jump to line ${f.line}">
        <span class="sec-line">L${f.line}</span>
        <div class="sec-item-body">
            <div class="sec-item-head">
                <div class="sec-item-title"><i class="fa-solid ${f.icon || 'fa-shield-halved'}"></i> ${escapeHtml(f.title)}</div>
                <span class="sec-sev ${sevClass(f.severity)}">${f.severity}</span>
            </div>
            <div class="sec-item-desc">${escapeHtml(f.description || '')}</div>
        </div>
    </div>
`).join('');

const reportHtml = `
    <div class="sec-report">
        <div class="sec-header">
            <div class="sec-title">
                <i class="fa-solid fa-shield-halved"></i> Security & Health Audit
                <span class="sec-file" title="${escapeHtml(fileLabel)}">${escapeHtml(fileLabel)}</span>
            </div>
            <div class="sec-score">
                <div class="sec-ring" style="--score-val: ${score}; --sec-color: ${scoreColor};" title="Health Score: ${score}/100">
                    <span class="sec-ring-num">${score}</span>
                </div>
            </div>
        </div>
        <div class="sec-verdict ${ok ? '' : 'warn'}">
            <i class="fa-solid ${ok ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
            <span><strong>${ok ? 'Excellent!' : `${findings.length} risk${findings.length === 1 ? '' : 's'} detected`}</strong> <span class="sec-muted">${ok ? 'No security risks or governor limit violations found.' : 'Click any finding to jump to its line.'}</span></span>
        </div>
        ${itemsHtml}
    </div>
`;

const terminal = `
  <div id="terminal-panel" class="terminal-panel">
    <div class="terminal-header">
      <div class="terminal-tabs">
        <div class="terminal-tab"><span style="font-size:15px;">🐞</span> Live Variables &amp; Logs</div>
        <div class="terminal-tab"><span style="font-size:15px;">&gt;_</span> Output / Console</div>
        <div class="terminal-tab"><span style="font-size:15px;">⚠</span> Problems</div>
        <div class="terminal-tab active"><span style="font-size:15px;">🛡</span> Security &amp; Health <span style="background: rgba(239,68,68,0.2); color:#f87171; padding:1px 6px; border-radius:999px; font-size:10px;">45/100</span></div>
        <div class="terminal-tab"><span style="font-size:15px;">◔</span> Code Coverage</div>
        <div class="terminal-tab"><span style="font-size:15px;">🕘</span> Revisions</div>
      </div>
      <div class="terminal-controls"><span>🗑</span><span>⛶</span><span>⌄</span></div>
    </div>
    <div class="terminal-body" id="terminal-body-security">${reportHtml}</div>
  </div>
`;

const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Security &amp; Health Audit — Glassmorphism Preview</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/js/all.min.js"></script>
<style>
${darkVars}
${areaCss}
${terminalCss}
${secCss}
</style>
</head>
<body>
<div class="main-editor-area">
  ${editorBackdrop}
  ${terminal}
</div>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'security-ui-preview.html'), out);
console.log('wrote scratch-harness/security-ui-preview.html (' + out.length + ' bytes)');
